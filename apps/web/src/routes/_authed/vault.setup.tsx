import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Download,
  Key,
  Loader2,
  Shield,
} from 'lucide-react'
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
  getVaultStatusFn,
  initVaultFn,
} from '#/lib/server-fns/vault'
import { authClient } from '#/lib/auth-client'
import { buildNewVault } from '#/lib/vault/client'
import { unlockVault } from '#/lib/vault/store'
import { useSodiumReady } from '#/lib/vault/use-sodium-ready'

const MIN_PASSPHRASE_LENGTH = 12

export const Route = createFileRoute('/_authed/vault/setup')({
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.ensureQueryData({
      queryKey: ['vault-status'],
      queryFn: () => getVaultStatusFn(),
      staleTime: 30_000,
    })
    if (status.initialized) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: VaultSetupPage,
})

type Step = 'intro' | 'passphrase' | 'recovery' | 'done'

function VaultSetupPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const sodiumReady = useSodiumReady()
  const [step, setStep] = useState<Step>('intro')
  const [recoveryDisplay, setRecoveryDisplay] = useState<string | null>(null)
  const [recoveryAck, setRecoveryAck] = useState(false)

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <div className="rise-in w-full max-w-lg">
        <div key={step} className="step-in">
          {step === 'intro' && (
            <IntroStep
              ready={sodiumReady}
              onContinue={() => setStep('passphrase')}
            />
          )}
          {step === 'passphrase' && (
            <PassphraseStep
              onComplete={(display) => {
                setRecoveryDisplay(display)
                setStep('recovery')
              }}
            />
          )}
          {step === 'recovery' && recoveryDisplay && (
            <RecoveryStep
              recoveryDisplay={recoveryDisplay}
              acknowledged={recoveryAck}
              onAcknowledge={setRecoveryAck}
              onContinue={async () => {
                await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
                setStep('done')
              }}
            />
          )}
          {step === 'done' && (
            <DoneStep
              onContinue={async () => {
                await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
                await queryClient.invalidateQueries({ queryKey: ['auth-context'] })
                await router.invalidate()
                await router.navigate({ to: '/onboarding' })
              }}
            />
          )}
        </div>
      </div>
    </main>
  )
}

function IntroStep({
  ready,
  onContinue,
}: {
  ready: boolean
  onContinue: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <Shield className="size-6 text-[var(--h-accent)]" />
        </div>
        <CardTitle className="text-center text-xl">Set up your vault</CardTitle>
        <CardDescription className="text-center">
          Handoff encrypts every secret in your browser before it touches our
          servers. To do that, you need a vault passphrase only you know.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Key className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
            <div>
              <p className="font-medium">A passphrase you'll type at sign-in</p>
              <p className="text-muted-foreground">
                Used to unlock your secrets in the browser. Never sent to us.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
            <div>
              <p className="font-medium">A recovery code to download</p>
              <p className="text-muted-foreground">
                Your one and only way back in if you forget the passphrase. Save
                it somewhere safe and offline.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="font-medium">If you lose both, your data is gone</p>
              <p className="text-muted-foreground">
                We have no way to reset it. That's the price of true
                zero-knowledge.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={onContinue} disabled={!ready} className="w-full">
          {ready ? "Let's begin" : 'Loading crypto…'}
        </Button>
      </CardContent>
    </Card>
  )
}

function PassphraseStep({
  onComplete,
}: {
  onComplete: (recoveryDisplay: string) => void
}) {
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
        const materials = buildNewVault(value.passphrase)
        await initVaultFn({
          data: {
            publicKey: materials.publicKey,
            encryptedPrivateKey: materials.encryptedPrivateKey,
            encPrivNonce: materials.encPrivNonce,
            kdfSalt: materials.kdfSalt,
            kdfOpsLimit: materials.kdfOpsLimit,
            kdfMemLimit: materials.kdfMemLimit,
            recoveryWrappedPrivateKey: materials.recoveryWrappedPrivateKey,
            recoveryPrivNonce: materials.recoveryPrivNonce,
          },
        })
        unlockVault(
          session.user.id,
          materials.identity.publicKey,
          materials.identity.privateKey,
        )
        onComplete(materials.recoveryDisplay)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create vault')
        setBusy(false)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose your vault passphrase</CardTitle>
        <CardDescription>
          At least {MIN_PASSPHRASE_LENGTH} characters. A long, memorable phrase
          beats a short, complex one.
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
                <Label htmlFor="passphrase">Passphrase</Label>
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
                <Label htmlFor="confirm">Confirm passphrase</Label>
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
                Deriving key and generating recovery code…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function RecoveryStep({
  recoveryDisplay,
  acknowledged,
  onAcknowledge,
  onContinue,
}: {
  recoveryDisplay: string
  acknowledged: boolean
  onAcknowledge: (v: boolean) => void
  onContinue: () => void
}) {
  function downloadCode() {
    const blob = new Blob(
      [
        `Handoff vault recovery code\n` +
          `Generated: ${new Date().toISOString()}\n\n` +
          `${recoveryDisplay}\n\n` +
          `Keep this somewhere safe and offline. If you forget your\n` +
          `passphrase, this is the only way back into your vault. If you\n` +
          `lose both, your data cannot be recovered.\n`,
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `handoff-recovery-code-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Save your recovery code</CardTitle>
        <CardDescription>
          This is shown once. Download it and store it somewhere safe.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div
          className="rounded-lg border-2 border-dashed border-[var(--h-accent)] bg-[var(--h-accent-subtle)] p-4 text-center font-mono text-sm tracking-wider text-[var(--h-text)] selection:bg-[var(--h-accent)] selection:text-[var(--h-bg)]"
          aria-label="Recovery code"
        >
          {recoveryDisplay}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(recoveryDisplay)}
            className="flex-1"
          >
            Copy
          </Button>
          <Button onClick={downloadCode} className="flex-1">
            <Download className="size-3.5" />
            Download .txt
          </Button>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            className="mt-0.5 size-4 cursor-pointer"
          />
          <span>
            I have saved my recovery code somewhere safe. I understand that if I
            lose both my passphrase and this code, my data cannot be recovered.
          </span>
        </label>

        <Button onClick={onContinue} disabled={!acknowledged} className="w-full">
          Continue
        </Button>
      </CardContent>
    </Card>
  )
}

function DoneStep({ onContinue }: { onContinue: () => void }) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <Check className="size-6 text-[var(--h-accent)]" />
        </div>
        <CardTitle className="text-xl">Your vault is ready</CardTitle>
        <CardDescription>
          From now on, every secret is encrypted in your browser before it
          leaves your machine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onContinue} className="w-full">
          Continue to onboarding
        </Button>
      </CardContent>
    </Card>
  )
}
