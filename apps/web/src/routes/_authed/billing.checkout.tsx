import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { ArrowLeft, Check, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getBillingDataFn, createCheckoutIntentFn } from '#/lib/server-fns/billing'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_authed/billing/checkout')({
  beforeLoad: async () => {
    const data = await getBillingDataFn()
    const isTrialing = data.subscription?.billingInterval === 'trial'
    if (data.plan === 'team' && !isTrialing) {
      throw redirect({ to: '/billing' })
    }
  },
  loader: async () => getBillingDataFn(),
  component: CheckoutPage,
})

type Cadence = 'monthly' | 'annual'

function CheckoutPage() {
  const data = Route.useLoaderData()
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [intent, setIntent] = useState<{
    clientSecret: string
    publishableKey: string
  } | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(
    null,
  )
  const [loading, setLoading] = useState(false)

  async function initCheckout(next: Cadence) {
    setLoading(true)
    try {
      const result = await createCheckoutIntentFn({
        data: { annual: next === 'annual' },
      })
      setIntent({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
      })
      setStripePromise(loadStripe(result.publishableKey))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initCheckout(cadence)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCadenceChange(next: Cadence) {
    if (next === cadence) return
    setCadence(next)
    setIntent(null)
    setStripePromise(null)
    await initCheckout(next)
  }

  const seats = Math.max(1, data.usage.members)
  const included = data.includedSeats
  const extra = Math.max(0, seats - included)
  const basePrice = cadence === 'monthly' ? 20 : 200
  const perSeat = cadence === 'monthly' ? 4 : 42
  const extraCost = extra * perSeat
  const total = basePrice + extraCost

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          to="/billing"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--h-text-2)] transition-colors hover:text-[var(--h-text)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to billing
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rise-in mb-16">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-accent)]">
            Handoff · Upgrade
          </p>
          <h1
            className="font-display font-extrabold leading-[0.95] tracking-tight text-[var(--h-text)]"
            style={{ fontSize: 'clamp(2.75rem, 6vw, 4.75rem)' }}
          >
            Unlock the Team plan.
          </h1>
          <p className="mt-4 max-w-xl text-base text-[var(--h-text-2)]">
            Unlimited projects, unlimited environments, CLI & API access,
            versioning, and 180-day audit history, for everyone on the team.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <OrderSummary
            cadence={cadence}
            onCadenceChange={handleCadenceChange}
            seats={seats}
            included={included}
            extra={extra}
            basePrice={basePrice}
            perSeat={perSeat}
            total={total}
            changing={loading}
          />

          <PaymentPanel
            intent={intent}
            stripePromise={stripePromise}
            cadence={cadence}
            total={total}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Order Summary (left column)
// ---------------------------------------------------------------------------

function OrderSummary({
  cadence,
  onCadenceChange,
  seats,
  included,
  extra,
  basePrice,
  perSeat,
  total,
  changing,
}: {
  cadence: Cadence
  onCadenceChange: (next: Cadence) => void
  seats: number
  included: number
  extra: number
  basePrice: number
  perSeat: number
  total: number
  changing: boolean
}) {
  return (
    <div className="space-y-10">
      <section>
        <SectionHeading index="01" title="Billing cadence" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CadenceOption
            label="Monthly"
            price="$20"
            sub="per month, base rate"
            selected={cadence === 'monthly'}
            onClick={() => onCadenceChange('monthly')}
            disabled={changing}
          />
          <CadenceOption
            label="Annual"
            price="$200"
            sub="per year · save 17%"
            selected={cadence === 'annual'}
            onClick={() => onCadenceChange('annual')}
            disabled={changing}
            badge="Best value"
          />
        </div>
      </section>

      <section>
        <SectionHeading index="02" title="Seats" />
        <div className="mt-5 rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--h-text-2)]">
                Active members in your organization
              </p>
              <p
                className="mt-1 font-display font-bold tracking-tight text-[var(--h-text)]"
                style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
              >
                {seats}{' '}
                <span className="font-sans text-sm font-normal text-[var(--h-text-3)]">
                  seat{seats === 1 ? '' : 's'}
                </span>
              </p>
            </div>
            <div className="shrink-0 rounded-full border border-[var(--h-border)] bg-[var(--h-bg)] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--h-text-2)]">
              auto-synced
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-dashed border-[var(--h-border)] pt-4 text-sm">
            <div>
              <p className="text-[var(--h-text-3)]">Included</p>
              <p className="font-medium text-[var(--h-text)]">
                {Math.min(seats, included)} of {included}
              </p>
            </div>
            <div>
              <p className="text-[var(--h-text-3)]">Extra</p>
              <p className="font-medium text-[var(--h-text)]">
                {extra > 0 ? `${extra} × $${perSeat}` : 'None'}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--h-text-3)]">
          Adding or removing members updates your subscription automatically.
          You'll be prorated for any mid-cycle changes.
        </p>
      </section>

      <section>
        <SectionHeading index="03" title="Order" />
        <div className="mt-5 rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-6">
          <LineItem
            label="Team plan"
            detail={`Base · ${cadence}`}
            amount={`$${basePrice}.00`}
          />
          {extra > 0 && (
            <LineItem
              label="Extra seats"
              detail={`${extra} × $${perSeat}`}
              amount={`$${extraCost(extra, perSeat)}.00`}
            />
          )}
          <div className="my-5 border-t border-[var(--h-border)]" />
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
                Total today
              </p>
              <p className="text-xs text-[var(--h-text-2)]">
                {cadence === 'monthly' ? 'Billed monthly' : 'Billed once per year'} · tax calculated at checkout
              </p>
            </div>
            <p
              className="font-display font-bold tabular-nums tracking-tight text-[var(--h-text)]"
              style={{ fontSize: 'clamp(2rem, 3vw, 2.75rem)' }}
            >
              ${total.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 text-sm text-[var(--h-text-2)]">
          {[
            'Cancel or change plan at any time, no questions asked',
            'Prorated billing on member changes',
            'Invoices and receipts delivered by email',
          ].map((reason) => (
            <div key={reason} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 text-[var(--h-accent)]" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function extraCost(extra: number, perSeat: number) {
  return extra * perSeat
}

function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-accent)]">
        {index}
      </span>
      <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--h-text)]">
        {title}
      </h2>
    </div>
  )
}

function CadenceOption({
  label,
  price,
  sub,
  selected,
  onClick,
  disabled,
  badge,
}: {
  label: string
  price: string
  sub: string
  selected: boolean
  onClick: () => void
  disabled: boolean
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-xl border p-5 text-left transition-all ${
        selected
          ? 'border-[var(--h-accent)] bg-[var(--h-accent-subtle)] shadow-[0_0_0_1px_var(--h-accent)_inset]'
          : 'border-[var(--h-border)] bg-[var(--h-surface)]/40 hover:border-[var(--h-accent)]/40 hover:bg-[var(--h-surface)]'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-[var(--h-accent)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
          {badge}
        </span>
      )}
      <p className="font-display text-sm font-semibold tracking-tight text-[var(--h-text)]">
        {label}
      </p>
      <p
        className="mt-2 font-display font-bold tracking-tight text-[var(--h-text)]"
        style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}
      >
        {price}
      </p>
      <p className="mt-1 text-xs text-[var(--h-text-2)]">{sub}</p>
    </button>
  )
}

function LineItem({
  label,
  detail,
  amount,
}: {
  label: string
  detail: string
  amount: string
}) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <div className="shrink-0">
        <p className="text-sm font-medium text-[var(--h-text)]">{label}</p>
        <p className="text-xs text-[var(--h-text-3)]">{detail}</p>
      </div>
      <span
        aria-hidden
        className="relative flex-1 self-end pb-1 text-[var(--h-border)]"
        style={{
          backgroundImage:
            'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '6px 6px',
          backgroundPosition: 'left bottom',
          backgroundRepeat: 'repeat-x',
          height: '0.9em',
        }}
      />
      <p className="shrink-0 font-mono text-sm tabular-nums text-[var(--h-text)]">
        {amount}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment Panel (right column)
// ---------------------------------------------------------------------------

function PaymentPanel({
  intent,
  stripePromise,
  cadence,
  total,
}: {
  intent: { clientSecret: string; publishableKey: string } | null
  stripePromise: Promise<Stripe | null> | null
  cadence: Cadence
  total: number
}) {
  const appearance = useMemo(() => buildStripeAppearance(), [])

  return (
    <aside className="lg:sticky lg:top-8 lg:self-start">
      <div className="rounded-2xl border border-[var(--h-border)] bg-[var(--h-bg)] p-6 shadow-[0_1px_0_0_var(--h-border),0_30px_60px_-40px_oklch(0.35_0.05_70_/_0.25)] lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <SectionHeading index="04" title="Payment" />
          <div className="flex items-center gap-1.5 text-xs text-[var(--h-text-3)]">
            <ShieldCheck className="size-3.5" />
            <span>Secured by Stripe</span>
          </div>
        </div>

        {intent && stripePromise ? (
          <Elements
            key={intent.clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret: intent.clientSecret,
              appearance,
              loader: 'never',
            }}
          >
            <CheckoutForm cadence={cadence} total={total} />
          </Elements>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-[var(--h-text-3)]">
            <Loader2 className="size-4 animate-spin" />
            Preparing secure payment form…
          </div>
        )}
      </div>

      <p className="mt-4 px-1 text-center text-[11px] leading-relaxed text-[var(--h-text-3)]">
        Your card details are transmitted directly to Stripe over a PCI-compliant
        encrypted channel and never touch Handoff's servers.
      </p>
    </aside>
  )
}

function CheckoutForm({ cadence, total }: { cadence: Cadence; total: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setMessage(null)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing?success=1`,
      },
    })
    if (error) {
      setMessage(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />

      {message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {message}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Processing payment…
          </>
        ) : (
          <>Pay ${total.toFixed(2)} {cadence === 'monthly' ? '/ month' : '/ year'}</>
        )}
      </Button>

      <p className="text-center text-[11px] text-[var(--h-text-3)]">
        By subscribing, you agree to Handoff's Terms and acknowledge the Privacy
        Policy. You can cancel at any time from the billing portal.
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Stripe Elements appearance: match the warm editorial aesthetic
// ---------------------------------------------------------------------------

function buildStripeAppearance() {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  const cssVar = (name: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim()
    return v || fallback
  }

  return {
    theme: (isDark ? 'night' : 'flat') as 'flat' | 'night',
    variables: {
      colorPrimary: cssVar('--h-accent', '#d97745'),
      colorBackground: cssVar('--h-bg', '#faf7f0'),
      colorText: cssVar('--h-text', '#2a241c'),
      colorTextSecondary: cssVar('--h-text-2', '#6c6358'),
      colorTextPlaceholder: cssVar('--h-text-3', '#94897a'),
      colorDanger: '#c0392b',
      fontFamily: "'Figtree', ui-sans-serif, system-ui, sans-serif",
      fontSizeBase: '15px',
      borderRadius: '8px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        border: `1px solid ${cssVar('--h-border', '#e0d8c9')}`,
        backgroundColor: cssVar('--h-surface', '#f5f0e4'),
        boxShadow: 'none',
        padding: '12px 14px',
      },
      '.Input:focus': {
        borderColor: cssVar('--h-accent', '#d97745'),
        boxShadow: `0 0 0 3px ${cssVar('--h-accent-subtle', '#f5e6d3')}`,
      },
      '.Label': {
        fontWeight: '500',
        fontSize: '13px',
        color: cssVar('--h-text-2', '#6c6358'),
      },
      '.Tab': {
        border: `1px solid ${cssVar('--h-border', '#e0d8c9')}`,
        backgroundColor: cssVar('--h-surface', '#f5f0e4'),
      },
      '.Tab--selected': {
        borderColor: cssVar('--h-accent', '#d97745'),
        backgroundColor: cssVar('--h-accent-subtle', '#f5e6d3'),
      },
    },
  } as const
}
