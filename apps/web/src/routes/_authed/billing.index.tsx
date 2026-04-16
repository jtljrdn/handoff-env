import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  AlertCircle,
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createBillingPortalSessionFn,
  getBillingDataFn,
} from '#/lib/server-fns/billing'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/_authed/billing/')({
  loader: async ({ context }) => {
    try {
      return {
        forbidden: false as const,
        data: await context.queryClient.fetchQuery({
          queryKey: ['billing'],
          queryFn: () => getBillingDataFn(),
        }),
      }
    } catch (err) {
      if (err instanceof Response && err.status === 403) {
        return { forbidden: true as const, data: null }
      }
      throw err
    }
  },
  staleTime: 0,
  shouldReload: true,
  component: BillingIndexPage,
})

function BillingIndexPage() {
  const result = Route.useLoaderData()

  if (result.forbidden) {
    return <NoAccess />
  }

  return <BillingContent data={result.data!} />
}

function NoAccess() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="rise-in rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-10 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <AlertCircle className="size-5 text-[var(--h-accent)]" />
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--h-text)]">
          Owners only
        </h2>
        <p className="mt-2 text-sm text-[var(--h-text-2)]">
          Billing information is only visible to the organization owner. Ask
          your owner to upgrade, change the plan, or manage payment methods.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

function BillingContent({
  data,
}: {
  data: Awaited<ReturnType<typeof getBillingDataFn>>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const isTeam = data.plan === 'team'
  const interval = data.subscription?.billingInterval ?? 'month'
  const perSeatPerMo = interval === 'year' ? 3.5 : 4
  const perSeatBilled = interval === 'year' ? 42 : 4
  const baseBilled = interval === 'year' ? 200 : 20
  const members = data.usage.members + data.usage.pendingInvitations
  const extraSeats = Math.max(0, members - data.includedSeats)
  const baseCost = isTeam ? baseBilled : 0
  const extraCost = isTeam ? extraSeats * perSeatBilled : 0
  const totalCost = baseCost + extraCost
  const monthlyEquivalent = interval === 'year' ? totalCost / 12 : totalCost
  const annualEquivalent = interval === 'year' ? totalCost : totalCost * 12

  async function openPortal() {
    setBusy(true)
    try {
      const result = await createBillingPortalSessionFn({
        data: { returnUrl: `${window.location.origin}/billing` },
      })
      window.location.href = result.url
    } catch (err) {
      toast.error((err as Error).message)
      setBusy(false)
    }
  }

  async function refresh() {
    await router.invalidate()
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rise-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--h-text)]">
              Billing
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your subscription and usage.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current plan
                <Badge variant={isTeam ? 'default' : 'secondary'}>
                  {isTeam ? 'Team' : 'Free'}
                </Badge>
                {data.subscription?.cancelAtPeriodEnd && (
                  <Badge variant="destructive">Canceling</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isTeam && data.subscription
                  ? `Billed ${interval === 'year' ? 'annually' : 'monthly'} · ${
                      data.subscription.cancelAtPeriodEnd ? 'ends' : 'renews'
                    } ${
                      data.subscription.periodEnd
                        ? new Date(
                            data.subscription.periodEnd,
                          ).toLocaleDateString()
                        : '—'
                    }`
                  : 'Upgrade to unlock unlimited projects, environments, members, and CLI/API access.'}
              </CardDescription>
            </div>
            {isTeam && (
              <Button onClick={openPortal} disabled={busy} size="sm">
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CreditCard className="size-3.5" />
                )}
                Manage billing
                <ExternalLink className="size-3.5" />
              </Button>
            )}
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
              <SeatsCard
                members={members}
                included={data.includedSeats}
                extra={extraSeats}
                perSeatPerMo={perSeatPerMo}
                isTeam={isTeam}
                maxMembers={data.limits.maxMembers}
              />
              <SimpleStat
                label="Projects"
                current={data.usage.projects}
                max={data.limits.maxProjects}
              />
              <SimpleStat
                label="Audit history"
                current={data.limits.auditRetentionDays}
                suffix=" days"
              />
            </div>

            {isTeam && (
              <div className="mt-5 rounded-lg border border-[var(--h-border)] bg-[var(--h-surface)]/40 p-4">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
                  Cost breakdown
                </p>
                <div className="space-y-1.5 text-sm">
                  <CostRow
                    label={`Team plan (${interval === 'year' ? 'annual' : 'monthly'})`}
                    amount={baseCost}
                  />
                  {extraSeats > 0 && (
                    <CostRow
                      label={`Extra seats (${extraSeats} × $${perSeatBilled})`}
                      amount={extraCost}
                    />
                  )}
                  <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-[var(--h-border)] pt-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--h-text)]">
                        Total {interval === 'year' ? 'per year' : 'per month'}
                      </p>
                      <p className="text-xs text-[var(--h-text-3)]">
                        {interval === 'year'
                          ? `≈ $${monthlyEquivalent.toFixed(2)}/month`
                          : `≈ $${annualEquivalent.toFixed(2)}/year`}
                      </p>
                    </div>
                    <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-[var(--h-text)]">
                      ${totalCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!isTeam && (
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to Team</CardTitle>
              <CardDescription>
                $20/mo or $200/yr — includes {data.includedSeats} seats, then
                $4/user/mo ($3.50/user/mo on annual).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mb-4 space-y-1.5 text-sm">
                {[
                  'Unlimited projects and environments',
                  `${data.includedSeats} seats included, then per-seat pricing`,
                  '180-day audit history',
                  'CLI + API access for CI/CD',
                  'Secret versioning / rollback',
                  'Webhooks on secret changes',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-[var(--h-accent)]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button asChild>
                <Link to="/billing/checkout">Continue to checkout</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isTeam && (
          <div className="mt-4 rounded-md border border-dashed border-[var(--h-border)] bg-transparent px-4 py-3 text-xs text-[var(--h-text-3)]">
            Need to cancel, swap monthly ↔ annual, update card, or download
            invoices? Open <span className="font-medium text-[var(--h-text-2)]">Manage billing</span> above.
          </div>
        )}
      </div>
    </div>
  )
}

function SeatsCard({
  members,
  included,
  extra,
  perSeatPerMo,
  isTeam,
  maxMembers,
}: {
  members: number
  included: number
  extra: number
  perSeatPerMo: number
  isTeam: boolean
  maxMembers: number
}) {
  if (!isTeam) {
    const atLimit = members >= maxMembers
    return (
      <div className="rounded-lg border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Users className="size-3.5 text-[var(--h-text-3)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
            Members
          </p>
        </div>
        <p
          className={`font-display text-3xl font-bold tracking-tight ${atLimit ? 'text-destructive' : 'text-[var(--h-text)]'}`}
        >
          {members}
          <span className="ml-1 font-sans text-sm font-normal text-[var(--h-text-3)]">
            / {maxMembers}
          </span>
        </p>
        <p className="mt-2 text-xs text-[var(--h-text-2)]">
          Free plan includes {maxMembers} members.{' '}
          <Link
            to="/billing/checkout"
            className="font-medium text-[var(--h-accent)] hover:underline"
          >
            Upgrade for unlimited
          </Link>
        </p>
      </div>
    )
  }

  const filledIncluded = Math.min(members, included)
  return (
    <div className="rounded-lg border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-3.5 text-[var(--h-text-3)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
            Seats
          </p>
        </div>
        <p className="font-display text-xs text-[var(--h-text-2)]">
          <span className="text-lg font-bold tracking-tight text-[var(--h-text)]">
            {members}
          </span>{' '}
          active
        </p>
      </div>

      <div className="mb-3 flex gap-0.5" aria-hidden>
        {Array.from({ length: Math.max(included, members) }).map((_, i) => {
          const isIncluded = i < included
          const isFilled = i < members
          return (
            <div
              key={i}
              className="h-2 flex-1 rounded-sm transition-colors"
              style={{
                backgroundColor: isFilled
                  ? isIncluded
                    ? 'var(--h-accent)'
                    : 'oklch(0.55 0.13 155)'
                  : 'var(--h-border)',
                opacity: isFilled ? 1 : 0.5,
              }}
            />
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-baseline gap-1.5">
          <span
            className="inline-block size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: 'var(--h-accent)' }}
          />
          <div>
            <p className="font-medium text-[var(--h-text)]">
              {filledIncluded} / {included} included
            </p>
            <p className="text-[var(--h-text-3)]">base plan</p>
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="inline-block size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: 'oklch(0.55 0.13 155)' }}
          />
          <div>
            <p className="font-medium text-[var(--h-text)]">
              {extra} extra
            </p>
            <p className="text-[var(--h-text-3)]">
              {extra > 0
                ? `@ $${perSeatPerMo.toFixed(2)}/mo each`
                : `+$${perSeatPerMo.toFixed(2)}/mo beyond ${included}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SimpleStat({
  label,
  current,
  max,
  suffix,
}: {
  label: string
  current: number
  max?: number
  suffix?: string
}) {
  const unlimited = max !== undefined && !Number.isFinite(max)
  return (
    <div className="rounded-lg border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
        {current}
        {suffix && (
          <span className="ml-0.5 font-sans text-sm font-normal text-[var(--h-text-3)]">
            {suffix}
          </span>
        )}
        {!suffix && max !== undefined && (
          <span className="ml-1 font-sans text-sm font-normal text-[var(--h-text-3)]">
            {unlimited ? '/ ∞' : `/ ${max}`}
          </span>
        )}
      </p>
    </div>
  )
}

function CostRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--h-text-2)]">{label}</span>
      <span className="font-mono tabular-nums text-[var(--h-text)]">
        ${amount.toFixed(2)}
      </span>
    </div>
  )
}

