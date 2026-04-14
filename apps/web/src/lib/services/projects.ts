import { db } from '#/db'
import { projects, environments } from '#/db/schema'
import { createOrgEncryptionKey } from '#/lib/encryption'
import { orgEncryptionKeys } from '#/db/schema'
import { eq, and, count, sql } from 'drizzle-orm'
import { DEFAULT_ENVIRONMENTS } from '@handoff-env/types'
import type { CreateProjectInput, UpdateProjectInput } from '@handoff-env/types'

export async function createProject(
  orgId: string,
  input: CreateProjectInput,
) {
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.slug, input.slug)))
    .limit(1)

  if (existing.length > 0) {
    throw new Error(`Project with slug "${input.slug}" already exists in this organization`)
  }

  const [project] = await db
    .insert(projects)
    .values({
      name: input.name,
      slug: input.slug,
      orgId,
    })
    .returning()

  const envValues = DEFAULT_ENVIRONMENTS.map((name: string, index: number) => ({
    name,
    projectId: project.id,
    sortOrder: index,
  }))
  await db.insert(environments).values(envValues)

  const existingKey = await db
    .select({ id: orgEncryptionKeys.id })
    .from(orgEncryptionKeys)
    .where(eq(orgEncryptionKeys.orgId, orgId))
    .limit(1)

  if (existingKey.length === 0) {
    await createOrgEncryptionKey(orgId)
  }

  return project
}

export async function getProject(orgId: string, projectSlug: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.slug, projectSlug)))
    .limit(1)

  return project ?? null
}

export async function getProjectById(projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  return project ?? null
}

export async function listProjects(orgId: string) {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      orgId: projects.orgId,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      environmentCount: count(environments.id),
    })
    .from(projects)
    .leftJoin(environments, eq(environments.projectId, projects.id))
    .where(eq(projects.orgId, orgId))
    .groupBy(projects.id)
    .orderBy(projects.name)

  return rows
}

export async function updateProject(
  projectId: string,
  orgId: string,
  input: UpdateProjectInput,
) {
  if (input.slug) {
    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.orgId, orgId),
          eq(projects.slug, input.slug),
          sql`${projects.id} != ${projectId}`,
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      throw new Error(`Project with slug "${input.slug}" already exists in this organization`)
    }
  }

  const [updated] = await db
    .update(projects)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(projects.id, projectId))
    .returning()

  return updated ?? null
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId))
}
