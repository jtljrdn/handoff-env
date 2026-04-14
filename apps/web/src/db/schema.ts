import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => nanoid())

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()

export const projects = pgTable(
  'projects',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    orgId: text('org_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('projects_org_slug_unique').on(t.orgId, t.slug)],
)

export const environments = pgTable(
  'environments',
  {
    id: id(),
    name: text('name').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('environments_project_name_unique').on(t.projectId, t.name)],
)

export const variables = pgTable(
  'variables',
  {
    id: id(),
    key: text('key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    environmentId: text('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    updatedBy: text('updated_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('variables_env_key_unique').on(t.environmentId, t.key)],
)

export const variableVersions = pgTable('variable_versions', {
  id: id(),
  variableId: text('variable_id')
    .notNull()
    .references(() => variables.id, { onDelete: 'cascade' }),
  encryptedOldValue: text('encrypted_old_value'),
  encryptedNewValue: text('encrypted_new_value').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  action: text('action').notNull(),
})

export const orgEncryptionKeys = pgTable('org_encryption_keys', {
  id: id(),
  orgId: text('org_id').notNull().unique(),
  encryptedKey: text('encrypted_key').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  createdAt: createdAt(),
})

export const apiTokens = pgTable('api_tokens', {
  id: id(),
  userId: text('user_id').notNull(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  hashedToken: text('hashed_token').notNull().unique(),
  prefix: text('prefix').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: createdAt(),
})
