import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Eye, Copy, Check, AlertCircle, Lock } from 'lucide-react'
import { openShareEnvelope, ready } from '@handoff-env/crypto'
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

interface SharePayload {
  id: string
  label: string
  pwSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
  wrapCiphertext: string
  wrapNonce: string
  ciphertext: string
  nonce: string
  expiresAt: string
  viewsLeft: number | null
}

type ConsumeError = 'EXPIRED' | 'EXHAUSTED' | 'REVOKED' | 'NOT_FOUND' | 'RATE_LIMITED'

export const Route = createFileRoute('/s/$shareId')({
  ssr: false,
  component: SharePage,
})

function readLinkSecret(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  return hash || null
}

function SharePage() {
  const { shareId } = Route.useParams()
  const [linkSecret] = useState<string | null>(readLinkSecret)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [viewsLeft, setViewsLeft] = useState<number | null>(null)
  const [serverError, setServerError] = useState<ConsumeError | null>(null)
  const [decryptError, setDecryptError] = useState(false)
  const [copied, setCopied] = useState(false)
  const linkSecretMissing = linkSecret === null

  useEffect(() => {
    if (!linkSecret) return
    if (window.location.hash) {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }
  }, [linkSecret])

  async function reveal() {
    if (!linkSecret) return
    if (password.length < 1) return
    setBusy(true)
    setDecryptError(false)
    setServerError(null)
    try {
      await ready()
      const res = await fetch(`/api/share/${shareId}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string }
        if (
          body.code === 'EXPIRED' ||
          body.code === 'EXHAUSTED' ||
          body.code === 'REVOKED' ||
          body.code === 'NOT_FOUND' ||
          body.code === 'RATE_LIMITED'
        ) {
          setServerError(body.code)
        } else {
          setServerError('NOT_FOUND')
        }
        return
      }
      const json = (await res.json()) as { data: SharePayload }
      const payload = json.data
      try {
        const value = await openShareEnvelope(payload, password, linkSecret)
        setPlaintext(value)
        setLabel(payload.label)
        setViewsLeft(payload.viewsLeft)
      } catch {
        setDecryptError(true)
      }
    } catch {
      setServerError('NOT_FOUND')
    } finally {
      setBusy(false)
    }
  }

  function copyValue() {
    if (!plaintext) return
    navigator.clipboard.writeText(plaintext).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (linkSecretMissing) {
    return (
      <ShareShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-center">Link is incomplete</CardTitle>
            <CardDescription className="text-center">
              This share link is missing the secret part after the <code>#</code>.
              Ask the sender to share the full URL.
            </CardDescription>
          </CardHeader>
        </Card>
      </ShareShell>
    )
  }

  if (serverError) {
    return (
      <ShareShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-center">
              {serverError === 'EXPIRED' && 'This link has expired'}
              {serverError === 'EXHAUSTED' && 'This link has been used up'}
              {serverError === 'REVOKED' && 'This link was revoked'}
              {serverError === 'NOT_FOUND' && 'Link not found'}
              {serverError === 'RATE_LIMITED' && 'Too many attempts'}
            </CardTitle>
            <CardDescription className="text-center">
              Ask the sender to mint a new one if you still need the value.
            </CardDescription>
          </CardHeader>
        </Card>
      </ShareShell>
    )
  }

  if (plaintext !== null) {
    return (
      <ShareShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Eye className="size-6 text-primary" />
            </div>
            <CardTitle className="text-center">{label}</CardTitle>
            <CardDescription className="text-center">
              {viewsLeft === null
                ? 'No view limit on this link.'
                : viewsLeft === 0
                  ? 'This was the last allowed view.'
                  : `${viewsLeft} view${viewsLeft === 1 ? '' : 's'} remaining.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="rounded-md border bg-muted p-3 text-sm break-all whitespace-pre-wrap">
              {plaintext}
            </pre>
            <Button onClick={copyValue} variant="outline" className="w-full">
              {copied ? (
                <>
                  <Check className="mr-2 size-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" /> Copy value
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </ShareShell>
    )
  }

  return (
    <ShareShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <CardTitle className="text-center">A secret was shared with you</CardTitle>
          <CardDescription className="text-center">
            Enter the password the sender gave you to reveal the value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-password">Password</Label>
            <Input
              id="share-password"
              type="password"
              autoComplete="off"
              autoFocus
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') void reveal()
              }}
            />
            {decryptError ? (
              <p className="text-sm text-destructive">
                Wrong password, or the data is corrupted. Try again.
              </p>
            ) : null}
          </div>
          <Button
            onClick={() => void reveal()}
            disabled={busy || !linkSecret || password.length === 0}
            className="w-full"
          >
            {busy ? 'Decrypting...' : 'Reveal'}
          </Button>
        </CardContent>
      </Card>
    </ShareShell>
  )
}

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      {children}
    </main>
  )
}
