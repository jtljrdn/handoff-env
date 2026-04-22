import { authClient } from '#/lib/auth-client'
import { lockVault } from '#/lib/vault/store'
import { Link } from '@tanstack/react-router'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--h-surface)]" />
    )
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
            <span className="text-xs font-medium text-[var(--h-text)]">
              {session.user.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            lockVault()
            void authClient.signOut()
          }}
          className="text-sm font-medium text-[var(--h-text-2)] transition-colors hover:text-[var(--h-text)]"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link
      to="/"
      className="text-sm font-medium text-[var(--h-text-2)] transition-colors hover:text-[var(--h-text)]"
    >
      Sign in
    </Link>
  )
}
