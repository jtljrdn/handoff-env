import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { authClient } from '#/lib/auth-client'
import { getVaultStatusFn } from '#/lib/server-fns/vault'
import { unlockWithPassphrase } from '#/lib/vault/client'
import { unlockVault, getUnlocked } from '#/lib/vault/store'
import { useSodiumReady } from '#/lib/vault/use-sodium-ready'

export const Route = createFileRoute('/_authed/vault/unlock')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.ensureQueryData({
      queryKey: ['vault-status'],
      queryFn: () => getVaultStatusFn(),
      staleTime: 30_000,
    })
    if (!status.initialized) {
      throw redirect({ to: '/vault/setup' })
    }
  },
  loader: async ({ context }) => {
    const status = await context.queryClient.ensureQueryData({
      queryKey: ['vault-status'],
      queryFn: () => getVaultStatusFn(),
      staleTime: 30_000,
    })
    if (!status.initialized) throw new Error('Vault not initialized')
    return { status }
  },
  component: VaultUnlockPage,
})

async function yieldToPaint() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0))
  })
}

function VaultUnlockPage() {
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const { status } = Route.useLoaderData()
  const sodiumReady = useSodiumReady()
  const { data: session } = authClient.useSession()
  const [error, setError] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const form = useForm({
    defaultValues: { passphrase: '' },
    onSubmit: async ({ value }) => {
      setError('')
      if (!sodiumReady) return
      if (status.initialized !== true) return
      if (!session?.user?.id) return
      setUnlocking(true)
      await yieldToPaint()
      try {
        const identity = unlockWithPassphrase(value.passphrase, status)
        unlockVault(session.user.id, identity.publicKey, identity.privateKey)
      } catch {
        setError('Incorrect passphrase.')
        setUnlocking(false)
        return
      }
      const target =
        redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
          ? redirectTo
          : '/dashboard'
      await router.navigate({ to: target })
    },
  })

  if (getUnlocked()) {
    router.navigate({ to: '/dashboard' })
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <div className="rise-in w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
              <Lock className="size-6 text-[var(--h-accent)]" />
            </div>
            <CardTitle className="text-center text-xl">Unlock your vault</CardTitle>
            <CardDescription className="text-center">
              Your secrets stay locked in the browser until you unlock them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
              className="grid gap-4"
            >
              <form.Field name="passphrase">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor="passphrase">Vault passphrase</Label>
                    <Input
                      id="passphrase"
                      type="password"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoFocus
                      autoComplete="current-password"
                      disabled={unlocking}
                    />
                  </div>
                )}
              </form.Field>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={unlocking || !sodiumReady}
                className="w-full"
              >
                {unlocking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deriving key…
                  </>
                ) : !sodiumReady ? (
                  'Loading crypto…'
                ) : (
                  'Unlock'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <Link
                to="/vault/recover"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Lost your passphrase? Use your recovery code
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
