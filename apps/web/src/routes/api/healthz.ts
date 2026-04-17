import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/healthz')({
  server: {
    handlers: {
      GET: () =>
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
    },
  },
})
