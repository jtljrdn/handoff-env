-- Handoff-env database schema
-- This file is the source of truth for the database structure.
-- Better Auth manages its own tables separately (user, session, account, verification, organization, member, invitation).

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  org_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_org_slug_unique UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT environments_project_name_unique UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT variables_env_key_unique UNIQUE (environment_id, key)
);

CREATE TABLE IF NOT EXISTS variable_versions (
  id TEXT PRIMARY KEY,
  variable_id TEXT NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  encrypted_old_value TEXT,
  encrypted_new_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS org_encryption_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hashed_token TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Postgres functions for operations that require transactions.
-- The Supabase JS SDK does not support multi-statement transactions,
-- so these are called via supabase.rpc().

CREATE OR REPLACE FUNCTION bulk_upsert_variables(
  p_environment_id TEXT,
  p_variables JSONB,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_created INTEGER := 0;
  v_updated INTEGER := 0;
  v_deleted INTEGER := 0;
  v_item JSONB;
  v_existing RECORD;
  v_new_id TEXT;
  v_input_keys TEXT[];
BEGIN
  -- Collect input keys
  SELECT array_agg(item->>'key')
  INTO v_input_keys
  FROM jsonb_array_elements(p_variables) AS item;

  -- Upsert each variable
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variables) LOOP
    SELECT * INTO v_existing
    FROM variables
    WHERE environment_id = p_environment_id AND key = v_item->>'key'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE variables SET
        encrypted_value = v_item->>'encrypted_value',
        iv = v_item->>'iv',
        auth_tag = v_item->>'auth_tag',
        updated_by = p_user_id,
        updated_at = now()
      WHERE id = v_existing.id;

      INSERT INTO variable_versions (id, variable_id, encrypted_old_value, encrypted_new_value, iv, auth_tag, changed_by, action)
      VALUES (
        v_item->>'version_id',
        v_existing.id,
        v_existing.encrypted_value,
        v_item->>'version_encrypted_value',
        v_item->>'version_iv',
        v_item->>'version_auth_tag',
        p_user_id,
        'update'
      );
      v_updated := v_updated + 1;
    ELSE
      v_new_id := v_item->>'id';
      INSERT INTO variables (id, key, encrypted_value, iv, auth_tag, environment_id, updated_by)
      VALUES (
        v_new_id,
        v_item->>'key',
        v_item->>'encrypted_value',
        v_item->>'iv',
        v_item->>'auth_tag',
        p_environment_id,
        p_user_id
      );

      INSERT INTO variable_versions (id, variable_id, encrypted_new_value, iv, auth_tag, changed_by, action)
      VALUES (
        v_item->>'version_id',
        v_new_id,
        v_item->>'version_encrypted_value',
        v_item->>'version_iv',
        v_item->>'version_auth_tag',
        p_user_id,
        'create'
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- Delete variables not in input
  FOR v_existing IN
    SELECT * FROM variables
    WHERE environment_id = p_environment_id
      AND key != ALL(v_input_keys)
  LOOP
    INSERT INTO variable_versions (id, variable_id, encrypted_old_value, encrypted_new_value, iv, auth_tag, changed_by, action)
    VALUES (
      gen_random_uuid()::TEXT,
      v_existing.id,
      v_existing.encrypted_value,
      v_existing.encrypted_value,
      v_existing.iv,
      v_existing.auth_tag,
      p_user_id,
      'delete'
    );
    DELETE FROM variables WHERE id = v_existing.id;
    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'deleted', v_deleted);
END;
$$;

CREATE OR REPLACE FUNCTION reorder_environments(
  p_project_id TEXT,
  p_ordered_ids TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    UPDATE environments
    SET sort_order = i - 1
    WHERE id = p_ordered_ids[i] AND project_id = p_project_id;
  END LOOP;
END;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- This app uses Better Auth (not Supabase Auth) for identity management, so
-- auth.uid() / auth.jwt() are not available. RLS here serves as a firewall:
-- the anon key (exposed via the Data API) cannot access any custom table.
-- The server-side Supabase client uses the service_role key, which bypasses RLS.
-- Authorization is enforced in application code via verifyProjectOrg,
-- verifyEnvironmentOrg, requireOrgSession, and requireCliAuth.
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- With RLS enabled and no permissive policies, the anon and authenticated
-- roles have zero access (Postgres RLS default-deny). Only service_role
-- (which has BYPASSRLS) can read/write these tables.

-- Revoke direct RPC execution from public-facing roles.
-- These functions are SECURITY INVOKER, so RLS would block their internal
-- queries anyway, but revoking EXECUTE prevents them from being called at all
-- via the Data API with the anon key.
REVOKE EXECUTE ON FUNCTION bulk_upsert_variables(TEXT, JSONB, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION reorder_environments(TEXT, TEXT[]) FROM anon, authenticated;

-- =============================================================================
-- Storage buckets
-- =============================================================================
-- Public-read bucket for organization logos. Writes happen server-side via the
-- service_role key (see uploadOrgLogoFn), so no storage.objects RLS policies
-- are needed for upload. The bucket is public so the logo URLs render in the
-- sidebar/header without signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;
