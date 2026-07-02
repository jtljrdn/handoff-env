import { Link, useRouter } from '@tanstack/react-router'
import { LogOut, Building2 } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { lockVault } from '#/lib/vault/store'
import { Button } from '#/components/ui/button'
import { Logo } from '#/components/Logo.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

export default function Header() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const activeOrg = authClient.useActiveOrganization()

  async function onSignOut() {
    lockVault()
    await authClient.signOut()
    router.navigate({ to: '/' })
  }

  return (
    <header className="pointer-events-none sticky top-0 z-50 px-4 pt-4">
      <nav className="pointer-events-auto page-wrap flex items-center gap-4 rounded-full border border-[color-mix(in_oklch,var(--h-border)_70%,transparent)] bg-[color-mix(in_oklch,var(--h-surface)_78%,transparent)] py-2 pl-5 pr-2 shadow-[0_12px_32px_-16px_oklch(0.35_0.1_264_/_0.28)] backdrop-blur-2xl">
        <Link to="/" className="pointer-events-auto">
          <Logo />
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/docs/$" params={{ _splat: 'introduction' }}>
              Docs
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pricing">Pricing</Link>
          </Button>
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-[var(--h-accent-subtle)]" />
          ) : session?.user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                  >
                    <span className="text-xs font-medium text-[var(--h-text)]">
                      {session.user.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium">{session.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  {activeOrg.data && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span className="text-xs truncate">
                            {activeOrg.data.name}
                          </span>
                        </div>
                      </DropdownMenuLabel>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/sign-in" search={{}}>
                Get started
              </Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  )
}
