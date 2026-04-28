import { createFileRoute } from '@tanstack/react-router'
import { logger } from '#/lib/logger'

const log = logger.child({ scope: 'api.healthz' })

export const Route = createFileRoute('/api/healthz')({
  server: {
    handlers: {
      GET: () => {
        log.debug('ping')
        return new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      },
    },
  },
})
