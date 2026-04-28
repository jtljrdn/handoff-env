import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LifeBuoy, Loader2 } from 'lucide-react'
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
import {
  getRecoveryMaterialsFn,
  getVaultStatusFn,
  resetPassphraseFn,
} from '#/lib/server-fns/vault'
import {
  rewrapForNewPassphrase,
  unlockWithRecoveryCode,
} from '#/lib/vault/client'
import { unlockVault } from '#/lib/vault/store'
import { useSodiumReady } from '#/lib/vault/use-sodium-ready'
import { authClient } from '#/lib/auth-client'
import type { IdentityKeypair } from '@handoff-env/crypto'

const MIN_PASSPHRASE_LENGTH = 12

export const Route = createFileRoute('/_authed/vault/recover')({
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
  component: VaultRecoverPage,
})

type Step = 'recovery-code' | 'new-passphrase'

function VaultRecoverPage() {
  const sodiumReady = useSodiumReady()
  const [step, setStep] = useState<Step>('recovery-code')
  const [identity, setIdentity] = useState<IdentityKeypair | null>(null)

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <div className="rise-in w-full max-w-sm">
        <div key={step} className="step-in">
          {step === 'recovery-code' && (
            <RecoveryCodeStep
              ready={sodiumReady}
              onUnlocked={(id) => {
                setIdentity(id)
                setStep('new-passphrase')
              }}
            />
          )}
          {step === 'new-passphrase' && identity && (
            <NewPassphraseStep identity={identity} />
          )}
        </div>
      </div>
    </main>
  )
}

function RecoveryCodeStep({
  ready,
  onUnlocked,
}: {
  ready: boolean
  onUnlocked: (id: IdentityKeypair) => void
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const form = useForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      setError('')
      if (!ready) return
      setBusy(true)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0))
      })
      try {
        const materials = await getRecoveryMaterialsFn()
        const id = unlockWithRecoveryCode(value.code.trim(), materials)
        onUnlocked(id)
      } catch {
        setError('That recovery code did not match.')
        setBusy(false)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <LifeBuoy className="size-6 text-[var(--h-accent)]" />
        </div>
        <CardTitle className="text-center text-xl">Use your recovery code</CardTitle>
        <CardDescription className="text-center">
          Paste the recovery code you saved when you set up your vault. It will
          unlock your data and let you set a new passphrase.
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
          <form.Field name="code">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor="code">Recovery code</Label>
                <Input
                  id="code"
                  type="text"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  className="font-mono"
                  disabled={busy}
                />
              </div>
            )}
          </form.Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={busy || !ready} className="w-full">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link
            to="/vault/unlock"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            I remember my passphrase after all
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function NewPassphraseStep({ identity }: { identity: IdentityKeypair }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const form = useForm({
    defaultValues: { passphrase: '', confirm: '' },
    onSubmit: async ({ value }) => {
      setError('')
      if (value.passphrase.length < MIN_PASSPHRASE_LENGTH) {
        setError(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
        return
      }
      if (value.passphrase !== value.confirm) {
        setError('Passphrases do not match.')
        return
      }
      if (!session?.user?.id) {
        setError('Session expired. Please sign in again.')
        return
      }
      setBusy(true)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0))
      })
      try {
        const wrapped = rewrapForNewPassphrase({
          privateKey: identity.privateKey,
          passphrase: value.passphrase,
        })
        await resetPassphraseFn({ data: wrapped })
        unlockVault(session.user.id, identity.publicKey, identity.privateKey)
        await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
        await router.navigate({ to: '/dashboard' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update passphrase')
        setBusy(false)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set a new passphrase</CardTitle>
        <CardDescription>
          Pick a new passphrase. The old one will stop working.
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
                <Label htmlFor="passphrase">New passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  required
                  minLength={MIN_PASSPHRASE_LENGTH}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoFocus
                  autoComplete="new-password"
                  disabled={busy}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="confirm">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor="confirm">Confirm new passphrase</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </div>
            )}
          </form.Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deriving key…
              </>
            ) : (
              'Save and continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
