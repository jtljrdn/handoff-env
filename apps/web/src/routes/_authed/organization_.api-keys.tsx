import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  Check,
  Copy,
  HelpCircle,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Triangle,
} from 'lucide-react'
import { getAuthContextFn } from '#/lib/server-fns/auth'
import {
  createApiTokenFn,
  listApiTokensFn,
  revokeApiTokenFn,
  type ListApiTokensResult,
} from '#/lib/server-fns/api-tokens'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { formatRelativeTime } from '#/lib/relative-time'

type TokenRow = ListApiTokensResult['tokens'][number]

export const Route = createFileRoute('/_authed/organization_/api-keys')({
  beforeLoad: async ({ context }) => {
    const authCtx = await context.queryClient.ensureQueryData({
      queryKey: ['auth-context'],
      queryFn: () => getAuthContextFn(),
      staleTime: 60_000,
    })
    if (!authCtx.onboardingStatus.hasOrganization) {
      throw redirect({ to: '/onboarding' })
    }
  },
  loader: async ({ context }) => {
    return await context.queryClient.fetchQuery({
      queryKey: ['api-tokens'],
      queryFn: () => listApiTokensFn(),
    })
  },
  staleTime: 0,
  shouldReload: true,
  component: ApiKeysPage,
})

function ApiKeysPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['api-tokens'] })
    await router.invalidate()
  }

  const isTeam = data.plan === 'team'

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rise-in space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--h-accent-subtle)]">
              <KeyRound className="size-5 text-[var(--h-accent)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
                  API Keys
                </h1>
                <Badge variant={isTeam ? 'default' : 'secondary'}>
                  {isTeam ? 'Team' : 'Free'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--h-text-2)]">
                {data.canViewAll
                  ? 'Manage API tokens across your organization. Use these for the CLI and CI/CD.'
                  : 'Manage your own API tokens. Use these for the CLI and CI/CD.'}
              </p>
            </div>
          </div>
          {data.canCreate && isTeam && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              Create token
            </Button>
          )}
        </div>

        {!isTeam && <PlanGateCard />}

        {data.tokens.length === 0 ? (
          <EmptyState
            canCreate={data.canCreate && isTeam}
            onCreate={() => setShowCreate(true)}
          />
        ) : (
          <TokensTable
            tokens={data.tokens}
            canViewAll={data.canViewAll}
            currentUserId={data.currentUserId}
            onChange={refresh}
          />
        )}
      </div>

      <CreateTokenDialog
        open={showCreate}
        onOpenChange={(v) => {
          setShowCreate(v)
          if (!v) refresh()
        }}
      />
    </div>
  )
}

function PlanGateCard() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
        <Sparkles className="size-4 text-[var(--h-accent)]" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--h-text)]">
          API and CLI access require the Team plan
        </p>
        <p className="mt-0.5 text-sm text-[var(--h-text-2)]">
          Upgrade to create tokens for the CLI, CI/CD pipelines, and automation.
        </p>
      </div>
      <Button asChild size="sm">
        <Link to="/billing">Upgrade</Link>
      </Button>
    </div>
  )
}

function EmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean
  onCreate: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--h-border)] bg-[var(--h-surface)]/40 p-10 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
        <KeyRound className="size-5 text-[var(--h-accent)]" />
      </div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--h-text)]">
        No API tokens yet
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--h-text-2)]">
        Create a token to authenticate the{' '}
        <span className="font-mono text-xs">handoff</span> CLI or integrate with
        CI providers like GitHub Actions or Vercel.
      </p>
      {canCreate && (
        <Button size="sm" className="mt-6" onClick={onCreate}>
          <Plus className="size-3.5" />
          Create your first token
        </Button>
      )}
    </div>
  )
}

function TokensTable({
  tokens,
  canViewAll,
  currentUserId,
  onChange,
}: {
  tokens: TokenRow[]
  canViewAll: boolean
  currentUserId: string
  onChange: () => Promise<void>
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--h-border)]">
      <div className="grid grid-cols-[1.4fr_1fr_auto] gap-4 border-b border-[var(--h-border)] bg-[var(--h-surface)]/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-[var(--h-text-3)] sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div>Name</div>
        {canViewAll ? (
          <div className="hidden sm:block">Created by</div>
        ) : (
          <div className="hidden sm:block">Prefix</div>
        )}
        <div className="hidden sm:block">Last used</div>
        <div>Expires</div>
        <div className="w-6" />
      </div>
      <div className="divide-y divide-[var(--h-border)]">
        {tokens.map((t) => (
          <TokenRowUI
            key={t.id}
            token={t}
            canViewAll={canViewAll}
            isOwned={'user_id' in t ? t.user_id === currentUserId : true}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  )
}

function TokenRowUI({
  token,
  canViewAll,
  isOwned,
  onChange,
}: {
  token: TokenRow
  canViewAll: boolean
  isOwned: boolean
  onChange: () => Promise<void>
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const expired =
    !!token.expires_at && new Date(token.expires_at).getTime() < Date.now()
  const creatorName = 'creator_name' in token ? token.creator_name : null
  const creatorEmail = 'creator_email' in token ? token.creator_email : null
  const creatorLabel = creatorName || creatorEmail || 'Unknown'
  const creatorInitial = creatorLabel.charAt(0).toUpperCase()

  async function revoke() {
    setRevoking(true)
    try {
      await revokeApiTokenFn({ data: { tokenId: token.id } })
      setConfirmRevoke(false)
      toast.success(`Token "${token.name}" revoked`)
      await onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke token')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--h-text)]">
          {token.name}
          {expired && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-[var(--h-surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--h-text-3)]">
              <Triangle className="size-2.5" /> Expired
            </span>
          )}
        </p>
        <p className="truncate font-mono text-xs text-[var(--h-text-3)]">
          {token.prefix}…
        </p>
        {canViewAll && (
          <p className="mt-0.5 truncate text-xs text-[var(--h-text-3)] sm:hidden">
            by {creatorLabel}
          </p>
        )}
      </div>

      {canViewAll ? (
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] text-[10px] font-medium text-[var(--h-text)]">
            {creatorInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-[var(--h-text-2)]">
              {creatorName || creatorEmail || 'Unknown'}
            </p>
            {creatorName && creatorEmail && (
              <p className="truncate text-xs text-[var(--h-text-3)]">
                {creatorEmail}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden min-w-0 font-mono text-xs text-[var(--h-text-3)] sm:block">
          {token.prefix}…
        </div>
      )}

      <div className="hidden text-sm text-[var(--h-text-2)] sm:block">
        {token.last_used_at ? formatRelativeTime(token.last_used_at) : 'Never'}
      </div>

      <div className="text-sm text-[var(--h-text-2)]">
        {token.expires_at
          ? new Date(token.expires_at).toLocaleDateString()
          : 'Never'}
      </div>

      <div className="flex justify-end">
        {isOwned || canViewAll ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={revoking}>
                {revoking ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault()
                  setConfirmRevoke(true)
                }}
              >
                <Trash2 className="size-3.5" /> Revoke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking <span className="font-mono">{token.name}</span> is
              immediate and cannot be undone. Any CLI session or CI job using
              this token will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                revoke()
              }}
              disabled={revoking}
            >
              {revoking ? 'Revoking…' : 'Revoke token'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type CreateStep = 'form' | 'done'

function CreateTokenDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState<CreateStep>('form')
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setStep('form')
    setPlaintext(null)
    setCopied(false)
  }

  const form = useForm({
    defaultValues: { name: '', expiresInDays: '0' as string },
    onSubmit: async ({ value }) => {
      try {
        const expiresInDays =
          value.expiresInDays === '0' ? undefined : Number(value.expiresInDays)
        const res = await createApiTokenFn({
          data: { name: value.name.trim(), expiresInDays },
        })
        setPlaintext(res.token)
        setStep('done')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to create token')
      }
    },
  })

  async function copyPlaintext() {
    if (!plaintext) return
    try {
      await navigator.clipboard.writeText(plaintext)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed. Select and copy manually.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onOpenChange(false)
          setTimeout(reset, 200)
          return
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={step !== 'done'}>
        <div key={step} className="step-in min-w-0">
          {step === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>Create API token</DialogTitle>
                <DialogDescription>
                  Use this token to authenticate the CLI or integrate with CI/CD
                  pipelines. You'll see the token once, so store it somewhere
                  safe.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  form.handleSubmit()
                }}
                className="space-y-4"
              >
                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim()
                        ? 'Name is required'
                        : value.length > 100
                          ? 'Max 100 characters'
                          : undefined,
                  }}
                >
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor={field.name}>Name</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="github-actions-deploy"
                        maxLength={100}
                        autoFocus
                      />
                      <p className="text-xs text-[var(--h-text-3)]">
                        A short label so you can identify this token later.
                      </p>
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-xs text-destructive">
                          {field.state.meta.errors.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="expiresInDays">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label>Expires</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Never</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">365 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <DialogFooter>
                  <form.Subscribe
                    selector={(s) => [s.canSubmit, s.isSubmitting] as const}
                  >
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        type="submit"
                        disabled={!canSubmit || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Creating…
                          </>
                        ) : (
                          'Create token'
                        )}
                      </Button>
                    )}
                  </form.Subscribe>
                </DialogFooter>
              </form>
            </>
          )}

          {step === 'done' && plaintext && (
            <>
              <DialogHeader>
                <DialogTitle>Save your token</DialogTitle>
                <DialogDescription>
                  This is the only time you'll see the full token. Keep it
                  somewhere safe.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-2 rounded-md border border-[var(--h-border)] bg-[var(--h-surface)] py-2 pl-3 pr-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--h-text)]">
                    {plaintext}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={copyPlaintext}
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    Route.Link
                  }}
                >
                  <HelpCircle className="size-3.5" />
                  Help
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    form.reset({ name: '', expiresInDays: '0' })
                    setTimeout(reset, 200)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
