import { createServerFn } from '@tanstack/react-start'
import { requireOrgSession } from '#/lib/middleware/auth'
import { auth } from '#/lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { listProjects } from '#/lib/services/projects'

export const getDashboardDataFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireOrgSession()
    const request = getRequest()

    const fullOrg = await auth.api.getFullOrganization({
      headers: request.headers,
      query: { organizationId: user.orgId },
    })

    const projects = await listProjects(user.orgId)

    return {
      org: {
        id: user.orgId,
        name: fullOrg?.name ?? '',
        slug: fullOrg?.slug ?? '',
        memberCount: fullOrg?.members?.length ?? 0,
      },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        environmentCount: p.environmentCount,
        createdAt: p.created_at,
      })),
    }
  })
