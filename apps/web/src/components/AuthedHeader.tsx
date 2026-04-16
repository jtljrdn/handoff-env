import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

interface AuthedHeaderProps {
  onMenuClick: () => void
}

export default function AuthedHeader({ onMenuClick }: AuthedHeaderProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  async function onSignOut() {
    await authClient.signOut()
    queryClient.removeQueries({ queryKey: ['auth-context'] })
    queryClient.removeQueries({ queryKey: ['sidebar-data'] })
    router.navigate({ to: '/' })
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--h-border)] bg-background px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-[var(--h-text-2)] transition-colors hover:bg-[var(--h-surface)] hover:text-[var(--h-text)] md:hidden"
        aria-label="Toggle navigation"
      >
        <Menu className="size-5" />
      </button>

      <Link to="/dashboard" className="flex items-center gap-2">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <rect
            x="0"
            y="3"
            width="11"
            height="13"
            rx="2.5"
            fill="var(--h-accent)"
            opacity="0.45"
          />
          <rect
            x="5"
            y="5"
            width="11"
            height="13"
            rx="2.5"
            fill="var(--h-accent)"
          />
        </svg>
        <span className="font-display text-base font-bold tracking-tight text-[var(--h-text)]">
          handoff
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-3">

        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
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
                  <p className="truncate text-xs text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
