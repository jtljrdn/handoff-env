import { db } from '#/db'
import { environments } from '#/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import type { CreateEnvironmentInput } from '@handoff-env/types'

export async function createEnvironment(
  projectId: string,
  input: CreateEnvironmentInput,
) {
  const existing = await db
    .select({ id: environments.id })
    .from(environments)
    .where(
      and(
        eq(environments.projectId, projectId),
        eq(environments.name, input.name),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    throw new Error(
      `Environment "${input.name}" already exists in this project`,
    )
  }

  const [env] = await db
    .insert(environments)
    .values({
      name: input.name,
      projectId,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()

  return env
}

export async function listEnvironments(projectId: string) {
  return db
    .select()
    .from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(asc(environments.sortOrder), asc(environments.name))
}

export async function getEnvironment(envId: string) {
  const [env] = await db
    .select()
    .from(environments)
    .where(eq(environments.id, envId))
    .limit(1)

  return env ?? null
}

export async function getEnvironmentByName(
  projectId: string,
  envName: string,
) {
  const [env] = await db
    .select()
    .from(environments)
    .where(
      and(
        eq(environments.projectId, projectId),
        eq(environments.name, envName),
      ),
    )
    .limit(1)

  return env ?? null
}

export async function deleteEnvironment(envId: string) {
  await db.delete(environments).where(eq(environments.id, envId))
}

export async function reorderEnvironments(
  projectId: string,
  orderedIds: string[],
) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(environments)
        .set({ sortOrder: i })
        .where(
          and(
            eq(environments.id, orderedIds[i]),
            eq(environments.projectId, projectId),
          ),
        )
    }
  })
}
