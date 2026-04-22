import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Check,
  Copy,
  Search,
  Settings2,
  UserPlus,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'
import {
  actorInitials,
  actorLabel,
  envDot,
  type DashboardProject,
} from './types'

type SortKey = 'recent' | 'name' | 'created'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently active',
  name: 'Name',
  created: 'Newest',
}

export function ProjectList({
  projects,
  onInvite,
  canInvite,
}: {
  projects: DashboardProject[]
  onInvite: () => void
  canInvite: boolean
}) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    let list = needle
      ? projects.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.slug.toLowerCase().includes(needle),
        )
      : projects.slice()

    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'created')
        return a.createdAt < b.createdAt ? 1 : -1
      const av = a.lastActivityAt ?? a.createdAt
      const bv = b.lastActivityAt ?? b.createdAt
      return av < bv ? 1 : -1
    })
    return list
  }, [projects, filter, sort])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-bold tracking-tight text-foreground">
          All projects
          <span className="ml-2 font-sans text-sm font-normal text-muted-foreground/70">
            {projects.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter projects…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 w-52 pl-8 text-xs"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {SORT_LABELS[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <DropdownMenuItem key={k} onClick={() => setSort(k)}>
                  {SORT_LABELS[k]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canInvite && (
            <Button variant="ghost" size="sm" onClick={onInvite}>
              <UserPlus className="size-3.5" />
              Invite
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No projects match <span className="font-mono">{filter}</span>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card/40">
          {visible.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ProjectRow({ project }: { project: DashboardProject }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const cliCmd = `handoff pull ${project.slug}`

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(cliCmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* ignore */
    }
  }

  return (
    <li className="group relative">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        // Critical row layout inlined so the flex layout is applied on first
        // paint, before the external stylesheet finishes loading. Without this
        // the <a> falls back to inline display and the action buttons wrap
        // onto a new line until CSS lands, causing a visible layout shift.
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingLeft: 16,
          paddingRight: 16,
          height: 60,
        }}
        className="transition-colors hover:bg-accent/40"
      >
        <span
          className="font-mono text-xs leading-4 text-muted-foreground"
          style={{ minWidth: '9ch', flexShrink: 0 }}
        >
          {project.slug}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-medium leading-5 text-foreground">
            {project.name}
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            className="mt-1 text-xs leading-4 text-muted-foreground"
          >
            <span>
              <span className="tabular-nums text-foreground/80">
                {project.variableCount}
              </span>{' '}
              var{project.variableCount !== 1 ? 's' : ''}
            </span>
            <span className="text-border">·</span>
            <span>
              <span className="tabular-nums text-foreground/80">
                {project.environmentCount}
              </span>{' '}
              env{project.environmentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div
          style={{ flexShrink: 0 }}
          className="hidden items-center gap-1.5 md:flex"
        >
          <EnvDots count={project.environmentCount} />
        </div>

        <div
          style={{ flexShrink: 0 }}
          className="hidden min-w-[180px] items-center justify-end gap-2 text-xs text-muted-foreground md:flex"
        >
          {project.lastActivityBy && (
            <Avatar
              initials={actorInitials(project.lastActivityBy)}
              title={actorLabel(project.lastActivityBy)}
            />
          )}
          <span className="tabular-nums">{project.lastActivityLabel}</span>
        </div>

        <TooltipProvider delayDuration={250}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy CLI command"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? 'Copied' : `Copy ${cliCmd}`}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void navigate({
                      to: '/projects/$projectId/settings',
                      params: { projectId: project.id },
                    })
                  }}
                  aria-label="Project settings"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Settings2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Project settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex size-7 items-center justify-center text-muted-foreground">
                  <ArrowUpRight className="size-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Open project</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </Link>
    </li>
  )
}

function EnvDots({ count }: { count: number }) {
  const labels = ['development', 'staging', 'production']
  const rendered = labels.slice(0, Math.min(count, labels.length))
  const extra = Math.max(0, count - rendered.length)
  return (
    <span className="flex items-center gap-0.5">
      {rendered.map((name) => (
        <span
          key={name}
          title={name}
          className="size-1.5 rounded-full"
          style={{ background: envDot(name) }}
        />
      ))}
      {extra > 0 && (
        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  )
}

function Avatar({ initials, title }: { initials: string; title: string }) {
  return (
    <span
      title={title}
      className={cn(
        'flex size-5 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] font-mono text-[10px] font-medium text-[var(--h-accent)]',
      )}
    >
      {initials}
    </span>
  )
}
