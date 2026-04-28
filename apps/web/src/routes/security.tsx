import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  KeyRound,
  Lock,
  Map,
  ShieldCheck,
  Terminal,
} from 'lucide-react'

export const Route = createFileRoute('/security')({
  head: () => ({
    meta: [
      { title: 'Security · Handoff' },
      {
        name: 'description',
        content:
          'Handoff is a zero-knowledge secrets manager. Your secrets are encrypted in your browser before they ever reach our servers. We literally cannot read them.',
      },
    ],
  }),
  component: SecurityPage,
})

function SecurityPage() {
  return (
    <main className="relative">
      <Hero />
      <Sections />
      <Limits />
      <Roadmap />
      <Disclosure />
    </main>
  )
}

function Hero() {
  return (
    <section className="px-4 pb-10 pt-16 lg:pt-24">
      <div className="page-wrap mx-auto max-w-3xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-accent)]">
          Security
        </p>
        <h1
          className="mt-3 font-display font-extrabold leading-[0.95] tracking-tight text-[var(--h-text)]"
          style={{ fontSize: 'clamp(2.25rem, 5vw + 0.5rem, 3.75rem)' }}
        >
          We can't read your secrets.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-[var(--h-text-2)]">
          Every secret is encrypted on your device before it reaches our
          servers. The decryption key never leaves you.
        </p>
      </div>
    </section>
  )
}

function Sections() {
  return (
    <section className="px-4 py-10">
      <div className="page-wrap mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        <Card
          icon={<Lock className="h-4 w-4" />}
          title="Zero-knowledge encryption"
          points={[
            'XChaCha20-Poly1305 on every secret value, with the variable ID bound as associated data. X25519 sealed boxes wrap each org key to each member.',
            'Argon2id derives your key from your vault passphrase. libsodium does all the math; no homegrown crypto.',
            'We store ciphertext, sealed boxes, public keys, and your encrypted private key. We do not store your passphrase or any plaintext secret.',
          ]}
        />

        <Card
          icon={<KeyRound className="h-4 w-4" />}
          title="Recovery without a back door"
          points={[
            'At signup we show a one-time recovery code. Save it offline; it wraps a second copy of your private key.',
            'Forget your passphrase? The recovery code lets you back in and reset it.',
            'Lose both? Your data is permanently unreadable. We have no override.',
          ]}
        />

        <Card
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Transport and hosting"
          points={[
            'TLS 1.2+ on every endpoint, certificates rotated automatically. The CLI verifies certs and refuses plaintext fallback.',
            'Managed Postgres with provider-managed encrypted backups. Two app slots behind Caddy for zero-downtime deploys; root login disabled.',
            'Even if every server-side secret were exposed, no organization data is decryptable.',
          ]}
          honest="Honest note: HSTS preload and a strict Content Security Policy are queued for the next hardening pass."
        />

        <Card
          icon={<Terminal className="h-4 w-4" />}
          title="Access and accountability"
          points={[
            'Better Auth with email OTP, password, and GitHub OAuth. HTTP-only session cookies. Role-based access: owner, admin, member.',
            'Each CLI/API token carries its own X25519 keypair. We store only a SHA-256 hash plus the sealed key; the token string is shown once.',
            'Project, environment, variable, and token events are recorded with actor, action, and timestamp. Our logger redacts secrets everywhere.',
          ]}
          honest="Honest note: TOTP 2FA, login events, and client IP in the audit log are not yet shipped."
        />
      </div>
    </section>
  )
}

function Card({
  icon,
  title,
  points,
  honest,
}: {
  icon: React.ReactNode
  title: string
  points: string[]
  honest?: string
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface)] p-6">
      <div className="flex items-center gap-2 text-[var(--h-accent)]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--h-border)] bg-[var(--h-bg)]">
          {icon}
        </span>
        <h2 className="font-display text-lg font-semibold text-[var(--h-text)]">
          {title}
        </h2>
      </div>
      <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-[var(--h-text-2)]">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[var(--h-text-3)]"
            />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      {honest && (
        <p className="mt-4 rounded-md border border-dashed border-[var(--h-border)] bg-[var(--h-bg)] p-3 text-xs leading-relaxed text-[var(--h-text-3)]">
          {honest}
        </p>
      )}
    </article>
  )
}

function Limits() {
  const items = [
    'Forget your passphrase AND lose your recovery code and access is gone. We cannot reset it.',
    'New members cannot read existing secrets until an existing member is online to seal the org key for them.',
    'No server-side search, no webhooks with values, no email previews. Anything that would need plaintext server-side does not exist.',
    'Removing a member immediately revokes their sessions, API tokens, and wrapped copy of the org key. Re-encryption of existing variables happens the next time an admin loads the org page. Anything they already pulled to disk is already plaintext on their machine; we cannot un-cache it.',
  ]
  return (
    <section className="px-4 py-10">
      <div className="page-wrap mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-[var(--h-accent)]">
          <AlertTriangle className="h-4 w-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            The trade-offs
          </p>
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
          What zero-knowledge costs you.
        </h2>
        <ul className="mt-5 space-y-3 rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface)] p-6 text-sm leading-relaxed text-[var(--h-text-2)]">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[var(--h-text-3)]"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Roadmap() {
  const items: { title: string; detail: string }[] = [
    {
      title: 'TOTP / authenticator 2FA',
      detail: 'Authenticator apps alongside email OTP for stronger step-up.',
    },
    {
      title: 'Scoped tokens',
      detail: 'CI tokens limited to a single project or environment.',
    },
    {
      title: 'Rate limiting',
      detail: 'Throttle sign-in, OTP, and token endpoints against brute force.',
    },
    {
      title: 'Login events in audit log',
      detail: 'Capture sign-in, OAuth link, and client IP for end-to-end review.',
    },
  ]

  return (
    <section className="px-4 py-14">
      <div className="page-wrap mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-[var(--h-accent)]">
          <Map className="h-4 w-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Roadmap
          </p>
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
          What we have not built yet.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--h-text-2)]">
          If any are blockers, tell us at{' '}
          <a
            href="mailto:jordan@jtlee.dev"
            className="text-[var(--h-accent)] underline-offset-4 hover:underline"
          >
            jordan@jtlee.dev
          </a>
          .
        </p>
        <ul className="mt-6 divide-y divide-[var(--h-border)] overflow-hidden rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]">
          {items.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <span className="shrink-0 font-medium text-[var(--h-text)] sm:w-64">
                {item.title}
              </span>
              <span className="text-sm leading-relaxed text-[var(--h-text-2)]">
                {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Disclosure() {
  return (
    <section className="px-4 pb-20">
      <div className="page-wrap mx-auto max-w-3xl rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface)] p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[var(--h-accent)]">
          <AlertTriangle className="h-4 w-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Responsible disclosure
          </p>
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
          Found something? We want to know.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--h-text-2)]">
          Email{' '}
          <a
            href="mailto:jordan@jtlee.dev"
            className="text-[var(--h-accent)] underline-offset-4 hover:underline"
          >
            jordan@jtlee.dev
          </a>{' '}
          with a description and reproduction steps.
          {/* TODO: Change email to security@gethandoff.dev */}
        </p>
        <p className="mt-5 text-sm text-[var(--h-text-3)]">
          For product questions unrelated to security, see the{' '}
          <Link
            to="/docs"
            className="text-[var(--h-accent)] underline-offset-4 hover:underline"
          >
            docs
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
