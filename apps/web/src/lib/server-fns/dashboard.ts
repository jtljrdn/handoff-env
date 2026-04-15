import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { listProjects } from '#/lib/services/projects'

export const getDashboardDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) throw new Error('Unauthorized')

    const activeOrgId = session.session.activeOrganizationId
    if (!activeOrgId) throw new Error('No active organization')

    const fullOrg = await auth.api.getFullOrganization({
      headers: request.headers,
      query: { organizationId: activeOrgId },
    })

    const projects = await listProjects(activeOrgId)

    return {
      org: {
        id: activeOrgId,
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
  },
)
