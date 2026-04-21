import { useMemo, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Terminal, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import {
  getCliAuthorizeContextFn,
  mintCliTokenFn,
  type CliAuthorizeOrg,
} from '#/lib/server-fns/cli-auth'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

type AuthorizeSearch = {
  port?: number
  state?: string
}

export const Route = createFileRoute('/cli/authorize')({
  validateSearch: (search: Record<string, unknown>): AuthorizeSearch => {
    const rawPort = search.port
    const port =
      typeof rawPort === 'number'
        ? rawPort
        : typeof rawPort === 'string' && /^\d+$/.test(rawPort)
          ? Number(rawPort)
          : undefined
    const state =
      typeof search.state === 'string' && /^[A-Za-z0-9_-]+$/.test(search.state)
        ? search.state
        : undefined
    return { port, state }
  },
  loader: async () => getCliAuthorizeContextFn(),
  component: CliAuthorizePage,
})

function CliAuthorizePage() {
  const ctx = Route.useLoaderData()
  console.log('ctx', ctx)
  const { port, state } = Route.useSearch()

  const invalidQuery =
    !port ||
    port < 1 ||
    port > 65535 ||
    !state ||
    state.length < 8 ||
    state.length > 256

  if (invalidQuery) {
    return (
      <Shell title="Invalid CLI login request" intent="error">
        <p>
          This page can only be reached by running{' '}
          <code className="rounded bg-muted px-1 py-0.5">handoff login</code>{' '}
          from your terminal.
        </p>
      </Shell>
    )
  }

  if (!ctx.signedIn) {
    const returnTo = `/cli/authorize?port=${port}&state=${state}`
    return (
      <Shell title="Sign in to authorize the CLI" intent="info">
        <p>You need to sign in before you can issue a CLI token.</p>
        <div className="mt-4">
          <Button asChild>
            <Link to="/sign-in" search={{ redirect: returnTo }}>
              Sign in
            </Link>
          </Button>
        </div>
      </Shell>
    )
  }

  if (ctx.orgs.length === 0) {
    return (
      <Shell title="No organizations" intent="error">
        <p>
          Your account isn't part of any organization yet. Finish onboarding
          first, then re-run <code>handoff login</code>.
        </p>
        <div className="mt-4">
          <Button asChild>
            <Link to="/onboarding">Continue onboarding</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <ConsentForm
      orgs={ctx.orgs}
      activeOrgId={ctx.activeOrgId}
      email={ctx.user.email}
      port={port!}
      state={state!}
    />
  )
}

function ConsentForm({
  orgs,
  activeOrgId,
  email,
  port,
  state,
}: {
  orgs: CliAuthorizeOrg[]
  activeOrgId: string | null
  email: string
  port: number
  state: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const defaultId = useMemo(() => {
    if (activeOrgId && orgs.some((o) => o.id === activeOrgId)) return activeOrgId
    // Prefer the first Team-plan org so the button isn't pre-disabled.
    const firstTeam = orgs.find((o) => o.plan === 'team')
    return firstTeam?.id ?? orgs[0]!.id
  }, [orgs, activeOrgId])

  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultId)
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'done' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  const selected = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0]!
  const canAuthorize = selected.plan === 'team' && status !== 'submitting'

  async function upgradeSelected() {
    setUpgrading(true)
    try {
      if (activeOrgId !== selected.id) {
        await authClient.organization.setActive({ organizationId: selected.id })
        await queryClient.invalidateQueries()
      }
      await router.navigate({ to: '/billing' })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setUpgrading(false)
    }
  }

  async function authorize() {
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const clientHost =
        typeof window !== 'undefined' ? window.location.hostname : undefined
      const result = await mintCliTokenFn({
        data: { port, state, orgId: selected.id, hostname: clientHost },
      })

      const res = await fetch(`http://127.0.0.1:${port}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: result.token, state: result.state }),
      })
      if (!res.ok) {
        throw new Error(
          `CLI did not accept the token (HTTP ${res.status}). The login command may have timed out — re-run \`handoff login\`.`,
        )
      }
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  if (status === 'done') {
    return (
      <Shell title="You're signed in" intent="success">
        <p>
          The CLI has a token for{' '}
          <span className="font-medium">{selected.name}</span>. You can close
          this tab.
        </p>
      </Shell>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Card>
        <CardHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
            <Terminal className="size-5 text-[var(--h-accent)]" />
          </div>
          <CardTitle>Authorize the Handoff CLI</CardTitle>
          <CardDescription>
            {orgs.length === 1
              ? 'A token will be issued for your terminal session.'
              : 'Choose the organization you want to authorize the CLI for.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            <Row label="Signed in as" value={email} />
            <Row
              label="Scope"
              value="Full read/write access to env vars for the chosen org"
            />
            <Row label="Expires" value="never (revoke any time from settings)" />
          </dl>

          <OrgChooser
            orgs={orgs}
            selectedId={selected.id}
            onSelect={setSelectedOrgId}
          />

          {selected.plan !== 'team' && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {selected.name} is on the Free plan
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  CLI access requires the Team plan for this organization.
                </p>
                {selected.role === 'owner' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={upgradeSelected}
                    disabled={upgrading}
                  >
                    {upgrading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <ExternalLink className="size-3" />
                    )}
                    Upgrade {selected.name}
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    You're {selected.role === 'admin' ? 'an admin' : 'a member'} of
                    this org — only the owner can change the plan. Ask them to
                    upgrade, then re-run <code>handoff login</code>.
                  </p>
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={authorize}
              disabled={!canAuthorize}
              className="flex-1"
            >
              {status === 'submitting' ? 'Authorizing…' : `Authorize ${selected.name}`}
            </Button>
            <Button
              asChild
              variant="outline"
              disabled={status === 'submitting'}
            >
              <Link to="/dashboard">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OrgChooser({
  orgs,
  selectedId,
  onSelect,
}: {
  orgs: CliAuthorizeOrg[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (orgs.length === 1) {
    const org = orgs[0]!
    return (
      <div className="rounded-md border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-3">
        <OrgLine org={org} showRole />
      </div>
    )
  }

  return (
    <fieldset className="space-y-1">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
        Organization
      </legend>
      <div className="flex flex-col gap-1.5" role="radiogroup">
        {orgs.map((org) => {
          const active = org.id === selectedId
          return (
            <label
              key={org.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                active
                  ? 'border-[var(--h-accent)] bg-[var(--h-accent-subtle)]/40'
                  : 'border-[var(--h-border)] hover:border-[var(--h-border-strong,var(--h-border))] hover:bg-[var(--h-surface)]/60'
              }`}
            >
              <input
                type="radio"
                name="cli-authorize-org"
                value={org.id}
                checked={active}
                onChange={() => onSelect(org.id)}
                className="size-4 accent-[var(--h-accent)]"
              />
              <div className="min-w-0 flex-1">
                <OrgLine org={org} showRole />
              </div>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function OrgLine({ org, showRole }: { org: CliAuthorizeOrg; showRole: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{org.name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {showRole && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {org.role}
          </Badge>
        )}
        <Badge variant={org.plan === 'team' ? 'default' : 'secondary'}>
          {org.plan === 'team' ? 'Team' : 'Free'}
        </Badge>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function Shell({
  title,
  intent,
  children,
}: {
  title: string
  intent: 'success' | 'error' | 'info'
  children: React.ReactNode
}) {
  const Icon =
    intent === 'success'
      ? CheckCircle2
      : intent === 'error'
        ? AlertCircle
        : Terminal
  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Card>
        <CardHeader>
          <div
            className={`mb-3 flex size-10 items-center justify-center rounded-full ${
              intent === 'success'
                ? 'bg-emerald-500/10 text-emerald-600'
                : intent === 'error'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-[var(--h-accent-subtle)] text-[var(--h-accent)]'
            }`}
          >
            <Icon className="size-5" />
          </div>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
