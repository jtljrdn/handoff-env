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

-- Variables are encrypted client-side with the org DEK before insert. The
-- server never sees plaintext. ciphertext + nonce are XChaCha20-Poly1305
-- AEAD output. dek_version identifies which org_dek wraps this row, so we
-- can rotate the DEK and re-encrypt in the background.
CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  dek_version INTEGER NOT NULL,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT variables_env_key_unique UNIQUE (environment_id, key)
);

CREATE TABLE IF NOT EXISTS variable_versions (
  id TEXT PRIMARY KEY,
  variable_id TEXT NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  old_ciphertext BYTEA,
  old_nonce BYTEA,
  old_dek_version INTEGER,
  new_ciphertext BYTEA,
  new_nonce BYTEA,
  new_dek_version INTEGER,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL
);

-- API tokens carry their own X25519 keypair. The token string contains the
-- private key (base64url) so the CLI can unwrap the org DEK locally; the
-- server only stores the SHA-256 hash, the public key, and the DEK sealed to
-- that public key. Compromising the token database does not reveal any DEK.
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hashed_token TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  token_public_key BYTEA,
  wrapped_dek BYTEA,
  dek_version INTEGER,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Zero-knowledge: organization DEKs and member wrappings (Phase 2)
-- =============================================================================
-- Each organization owns one or more 32-byte data encryption keys (DEKs). The
-- DEKs themselves are never stored on the server in plaintext: each is wrapped
-- (sealed-box) to every member's public key and stored in member_dek_wrap.
-- New DEK versions are created on member removal so the removed member's
-- previously cached DEK becomes useless once variables are re-encrypted.
CREATE TABLE IF NOT EXISTS organization_dek (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id TEXT NOT NULL,
  retired_at TIMESTAMPTZ,
  rotation_pending_at TIMESTAMPTZ,
  rotation_reason TEXT,
  CONSTRAINT organization_dek_org_version_unique UNIQUE (org_id, version)
);
CREATE INDEX IF NOT EXISTS organization_dek_org_idx ON organization_dek (org_id, version DESC);

-- Idempotent migration so existing databases pick up the rotation columns
-- before the partial index below references them.
ALTER TABLE organization_dek
  ADD COLUMN IF NOT EXISTS rotation_pending_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rotation_reason TEXT;

CREATE INDEX IF NOT EXISTS organization_dek_rotation_pending_idx
  ON organization_dek (org_id) WHERE rotation_pending_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS member_dek_wrap (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  dek_version INTEGER NOT NULL,
  wrapped_dek BYTEA NOT NULL,
  wrapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  wrapped_by_user_id TEXT NOT NULL,
  CONSTRAINT member_dek_wrap_unique UNIQUE (org_id, user_id, dek_version)
);
CREATE INDEX IF NOT EXISTS member_dek_wrap_user_idx ON member_dek_wrap (user_id, org_id);

-- A row exists here for every member who has joined an org but does not yet
-- have a wrapped DEK because no existing member has been online to seal it.
-- Cleared atomically when the wrap is applied.
CREATE TABLE IF NOT EXISTS pending_member_wrap (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pending_member_wrap_unique UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS pending_member_wrap_org_idx ON pending_member_wrap (org_id);

-- =============================================================================
-- Shareable variable links
-- =============================================================================
-- A share row stores an opaque envelope built client-side: the variable's
-- plaintext is encrypted under a one-shot share DEK, and the share DEK is
-- wrapped under sha256(Argon2id(password) || link_secret). The link_secret
-- lives only in the URL fragment, so the server cannot decrypt even with full
-- DB access. The server's job is purely to enforce TTL and view count.
CREATE TABLE IF NOT EXISTS variable_shares (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  variable_id TEXT REFERENCES variables(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  pw_salt BYTEA NOT NULL,
  kdf_ops_limit INTEGER NOT NULL,
  kdf_mem_limit BIGINT NOT NULL,
  wrap_ciphertext BYTEA NOT NULL,
  wrap_nonce BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS variable_shares_org_idx ON variable_shares (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS variable_shares_env_idx ON variable_shares (environment_id);
CREATE INDEX IF NOT EXISTS variable_shares_expires_idx ON variable_shares (expires_at);

-- Atomically validate and consume one view of a share. Returns the row when
-- the consumption succeeds; raises 'EXPIRED' / 'EXHAUSTED' / 'REVOKED' /
-- 'NOT_FOUND' otherwise so the caller can surface a precise 410 / 404.
CREATE OR REPLACE FUNCTION consume_share_view(p_id TEXT)
RETURNS variable_shares
LANGUAGE plpgsql
AS $$
DECLARE
  v_row variable_shares;
BEGIN
  SELECT * INTO v_row FROM variable_shares WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REVOKED';
  END IF;

  IF v_row.expires_at <= now() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EXPIRED';
  END IF;

  IF v_row.max_views IS NOT NULL AND v_row.view_count >= v_row.max_views THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EXHAUSTED';
  END IF;

  UPDATE variable_shares
     SET view_count = view_count + 1
   WHERE id = p_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION consume_share_view(TEXT) FROM anon, authenticated;

ALTER TABLE variable_shares ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Zero-knowledge vault (Phase 1)
-- =============================================================================
-- One row per user holding the material needed for client-side decryption:
-- a public X25519 key, the user's private key encrypted with a passphrase-
-- derived KEK (Argon2id), and a second copy of the private key wrapped under
-- the user's recovery code. The server only ever sees opaque ciphertext.
CREATE TABLE IF NOT EXISTS user_vault (
  user_id TEXT PRIMARY KEY,
  public_key BYTEA NOT NULL,
  encrypted_private_key BYTEA NOT NULL,
  enc_priv_nonce BYTEA NOT NULL,
  kdf_salt BYTEA NOT NULL,
  kdf_ops_limit INTEGER NOT NULL,
  kdf_mem_limit BIGINT NOT NULL,
  recovery_wrapped_private_key BYTEA NOT NULL,
  recovery_priv_nonce BYTEA NOT NULL,
  vault_initialized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  passphrase_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Invite-only signup
-- =============================================================================
-- The service is invite-only. A user may only sign up if their email matches
-- a non-expired, unused signup_invite, OR a pending Better Auth org invitation
-- (so existing teammate-to-teammate flow keeps working). The gate itself is
-- enforced server-side in lib/auth.ts (databaseHooks.user.create.before).
--
-- First admin bootstrap (run once after migration):
--   UPDATE "user" SET role = 'admin' WHERE email = '<your-email>';
-- The role column is added by Better Auth's admin() plugin.
CREATE TABLE IF NOT EXISTS signup_invite (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_user_id TEXT
);
CREATE INDEX IF NOT EXISTS signup_invite_email_unused_idx
  ON signup_invite (email) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS signup_request (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id TEXT,
  CONSTRAINT signup_request_status_check
    CHECK (status IN ('pending', 'approved', 'denied'))
);
CREATE INDEX IF NOT EXISTS signup_request_status_idx
  ON signup_request (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS signup_request_one_pending_per_email
  ON signup_request (email) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  environment_id TEXT REFERENCES environments(id) ON DELETE SET NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_org_created_idx ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_project_created_idx ON audit_log (project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx ON audit_log (actor_user_id, org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_org_action_created_idx ON audit_log (org_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_project_target_key_created_idx
  ON audit_log (project_id, target_key, created_at DESC)
  WHERE target_key IS NOT NULL;

-- Postgres functions for operations that require transactions.
-- The Supabase JS SDK does not support multi-statement transactions,
-- so these are called via supabase.rpc().

-- All inputs are opaque ciphertext (base64 strings in the JSONB) decoded into
-- BYTEA on insert. The server never sees plaintext.
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
  SELECT array_agg(item->>'key')
  INTO v_input_keys
  FROM jsonb_array_elements(p_variables) AS item;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variables) LOOP
    SELECT * INTO v_existing
    FROM variables
    WHERE environment_id = p_environment_id AND key = v_item->>'key'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE variables SET
        ciphertext = decode(v_item->>'ciphertext', 'base64'),
        nonce = decode(v_item->>'nonce', 'base64'),
        dek_version = (v_item->>'dek_version')::INTEGER,
        updated_by = p_user_id,
        updated_at = now()
      WHERE id = v_existing.id;

      INSERT INTO variable_versions (
        id, variable_id,
        old_ciphertext, old_nonce, old_dek_version,
        new_ciphertext, new_nonce, new_dek_version,
        changed_by, action
      )
      VALUES (
        v_item->>'version_id',
        v_existing.id,
        v_existing.ciphertext, v_existing.nonce, v_existing.dek_version,
        decode(v_item->>'ciphertext', 'base64'),
        decode(v_item->>'nonce', 'base64'),
        (v_item->>'dek_version')::INTEGER,
        p_user_id,
        'update'
      );
      v_updated := v_updated + 1;
    ELSE
      v_new_id := v_item->>'id';
      INSERT INTO variables (id, key, ciphertext, nonce, dek_version, environment_id, updated_by)
      VALUES (
        v_new_id,
        v_item->>'key',
        decode(v_item->>'ciphertext', 'base64'),
        decode(v_item->>'nonce', 'base64'),
        (v_item->>'dek_version')::INTEGER,
        p_environment_id,
        p_user_id
      );

      INSERT INTO variable_versions (
        id, variable_id,
        new_ciphertext, new_nonce, new_dek_version,
        changed_by, action
      )
      VALUES (
        v_item->>'version_id',
        v_new_id,
        decode(v_item->>'ciphertext', 'base64'),
        decode(v_item->>'nonce', 'base64'),
        (v_item->>'dek_version')::INTEGER,
        p_user_id,
        'create'
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  FOR v_existing IN
    SELECT * FROM variables
    WHERE environment_id = p_environment_id
      AND key != ALL(v_input_keys)
  LOOP
    INSERT INTO variable_versions (
      id, variable_id,
      old_ciphertext, old_nonce, old_dek_version,
      changed_by, action
    )
    VALUES (
      gen_random_uuid()::TEXT,
      v_existing.id,
      v_existing.ciphertext, v_existing.nonce, v_existing.dek_version,
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
ALTER TABLE user_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_dek ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_dek_wrap ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_member_wrap ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_request ENABLE ROW LEVEL SECURITY;

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
