import { useMemo, useState } from 'react'
import {
  CalendarRange,
  Check,
  Search,
  Tag,
  User,
  X,
  Folder,
  Layers,
} from 'lucide-react'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import { Calendar } from '#/components/ui/calendar'
import { ACTION_GROUPS, actionLabel } from './action-labels'
import type { AuditAction } from '#/lib/services/audit'

export interface AuditFilterValue {
  actions: AuditAction[]
  actorUserId: string | null
  projectId: string | null
  environmentId: string | null
  targetKeySearch: string
  dateFrom: string | null
  dateTo: string | null
}

export interface AuditFacets {
  members: Array<{ id: string; name: string | null; email: string | null }>
  projects?: Array<{ id: string; name: string; slug: string }>
  environments?: Array<{ id: string; name: string; projectId: string }>
}

interface AuditFilterBarProps {
  scope: 'org' | 'project'
  value: AuditFilterValue
  onChange: (next: AuditFilterValue) => void
  facets: AuditFacets
  retentionCutoffISO: string | null
  /** Right-aligned action slot (e.g. export), sits after the filter cluster. */
  rightSlot?: React.ReactNode
}

export function emptyFilter(): AuditFilterValue {
  return {
    actions: [],
    actorUserId: null,
    projectId: null,
    environmentId: null,
    targetKeySearch: '',
    dateFrom: null,
    dateTo: null,
  }
}

/**
 * Icon-only trigger for the right-aligned filter cluster. Renders inside a
 * Popover; the label lives in the tooltip, and active filters get an accent
 * treatment plus a corner dot so the state reads without a text label.
 */
function TriggerButton({
  icon: Icon,
  active,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  tooltip: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={tooltip}
            className={cn(
              'relative',
              active &&
                'border-[var(--h-accent)]/50 bg-[var(--h-accent-subtle)] text-[var(--h-accent)] hover:bg-[var(--h-accent-subtle)] hover:text-[var(--h-accent)]',
            )}
          >
            <Icon className="size-4" />
            {active && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--h-accent)] ring-2 ring-[var(--h-bg)]"
              />
            )}
          </Button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function AuditFilterBar({
  scope,
  value,
  onChange,
  facets,
  retentionCutoffISO,
  rightSlot,
}: AuditFilterBarProps) {
  const [search, setSearch] = useState(value.targetKeySearch)

  const update = (patch: Partial<AuditFilterValue>) => {
    onChange({ ...value, ...patch })
  }

  const memberLabel = useMemo(() => {
    if (!value.actorUserId) return 'Actor'
    const m = facets.members.find((x) => x.id === value.actorUserId)
    return m ? (m.name ?? m.email ?? m.id) : 'Actor'
  }, [value.actorUserId, facets.members])

  const projectLabel = useMemo(() => {
    if (!value.projectId) return 'Project'
    const p = facets.projects?.find((x) => x.id === value.projectId)
    return p?.name ?? 'Project'
  }, [value.projectId, facets.projects])

  const envOptions = useMemo(() => {
    if (!facets.environments) return []
    return value.projectId
      ? facets.environments.filter((e) => e.projectId === value.projectId)
      : facets.environments
  }, [facets.environments, value.projectId])

  const envLabel = useMemo(() => {
    if (!value.environmentId) return 'Environment'
    const e = envOptions.find((x) => x.id === value.environmentId)
    return e?.name ?? 'Environment'
  }, [value.environmentId, envOptions])

  const dateLabel = formatDateRangeLabel(value.dateFrom, value.dateTo)
  const retentionMin = retentionCutoffISO
    ? new Date(retentionCutoffISO)
    : undefined

  const hasAnyFilter =
    value.actions.length > 0 ||
    Boolean(value.actorUserId) ||
    Boolean(value.projectId) ||
    Boolean(value.environmentId) ||
    Boolean(value.targetKeySearch) ||
    Boolean(value.dateFrom) ||
    Boolean(value.dateTo)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            onBlur={() => {
              if (search !== value.targetKeySearch)
                update({ targetKeySearch: search })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update({ targetKeySearch: search })
            }}
            placeholder="Search target key…"
            className="h-8 w-56 pl-7 text-sm"
          />
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <ActionsFilter
              value={value.actions}
              onChange={(actions) => update({ actions })}
            />

            <FacetSelect
              icon={User}
              name="actor"
              activeLabel={value.actorUserId ? memberLabel : null}
              renderContent={() => (
                <Command>
                  <CommandInput placeholder="Filter members…" />
                  <CommandList>
                    <CommandEmpty>No members</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => update({ actorUserId: null })}
                      >
                        <Check
                          className={
                            value.actorUserId
                              ? 'opacity-0'
                              : 'size-3.5 text-[var(--h-accent)]'
                          }
                        />
                        Any actor
                      </CommandItem>
                      {facets.members.map((m) => {
                        const lbl = m.name ?? m.email ?? m.id
                        return (
                          <CommandItem
                            key={m.id}
                            value={lbl}
                            onSelect={() => update({ actorUserId: m.id })}
                          >
                            <Check
                              className={
                                value.actorUserId === m.id
                                  ? 'size-3.5 text-[var(--h-accent)]'
                                  : 'opacity-0'
                              }
                            />
                            <span className="truncate">{lbl}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            />

            {scope === 'org' && facets.projects ? (
              <FacetSelect
                icon={Folder}
                name="project"
                activeLabel={value.projectId ? projectLabel : null}
                renderContent={() => (
                  <Command>
                    <CommandInput placeholder="Filter projects…" />
                    <CommandList>
                      <CommandEmpty>No projects</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() =>
                            update({ projectId: null, environmentId: null })
                          }
                        >
                          <Check
                            className={
                              value.projectId
                                ? 'opacity-0'
                                : 'size-3.5 text-[var(--h-accent)]'
                            }
                          />
                          Any project
                        </CommandItem>
                        {facets.projects!.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() =>
                              update({ projectId: p.id, environmentId: null })
                            }
                          >
                            <Check
                              className={
                                value.projectId === p.id
                                  ? 'size-3.5 text-[var(--h-accent)]'
                                  : 'opacity-0'
                              }
                            />
                            <span className="truncate">{p.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                )}
              />
            ) : null}

            {envOptions.length > 0 && (
              <FacetSelect
                icon={Layers}
                name="environment"
                activeLabel={value.environmentId ? envLabel : null}
                renderContent={() => (
                  <Command>
                    <CommandInput placeholder="Filter environments…" />
                    <CommandList>
                      <CommandEmpty>No environments</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => update({ environmentId: null })}
                        >
                          <Check
                            className={
                              value.environmentId
                                ? 'opacity-0'
                                : 'size-3.5 text-[var(--h-accent)]'
                            }
                          />
                          Any environment
                        </CommandItem>
                        {envOptions.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.name}
                            onSelect={() => update({ environmentId: e.id })}
                          >
                            <Check
                              className={
                                value.environmentId === e.id
                                  ? 'size-3.5 text-[var(--h-accent)]'
                                  : 'opacity-0'
                              }
                            />
                            <span className="truncate">{e.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                )}
              />
            )}

            <Popover>
              <TriggerButton
                icon={CalendarRange}
                active={Boolean(value.dateFrom || value.dateTo)}
                tooltip={
                  value.dateFrom || value.dateTo
                    ? `Date: ${dateLabel}`
                    : 'Filter by date'
                }
              />
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={{
                    from: value.dateFrom ? new Date(value.dateFrom) : undefined,
                    to: value.dateTo ? new Date(value.dateTo) : undefined,
                  }}
                  onSelect={(range) => {
                    update({
                      dateFrom: range?.from ? range.from.toISOString() : null,
                      dateTo: range?.to ? endOfDayISO(range.to) : null,
                    })
                  }}
                  disabled={retentionMin ? { before: retentionMin } : undefined}
                  numberOfMonths={2}
                />
                {(retentionMin || value.dateFrom || value.dateTo) && (
                  <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                    <span>
                      {retentionMin
                        ? `Earliest: ${retentionMin.toLocaleDateString()}`
                        : ''}
                    </span>
                    {(value.dateFrom || value.dateTo) && (
                      <button
                        type="button"
                        className="font-medium text-[var(--h-accent)] hover:underline"
                        onClick={() => update({ dateFrom: null, dateTo: null })}
                      >
                        Clear dates
                      </button>
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {hasAnyFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setSearch('')
                  onChange(emptyFilter())
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}

            {rightSlot && (
              <>
                <div
                  aria-hidden
                  className="mx-0.5 hidden h-5 w-px bg-[var(--h-border)] sm:block"
                />
                {rightSlot}
              </>
            )}
          </div>
        </TooltipProvider>
      </div>

      {value.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.actions.map((a) => (
            <Badge
              key={a}
              variant="outline"
              className="cursor-pointer gap-1"
              onClick={() =>
                update({ actions: value.actions.filter((x) => x !== a) })
              }
            >
              {actionLabel(a)}
              <X className="size-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionsFilter({
  value,
  onChange,
}: {
  value: AuditAction[]
  onChange: (next: AuditAction[]) => void
}) {
  const count = value.length
  return (
    <Popover>
      <TriggerButton
        icon={Tag}
        active={count > 0}
        tooltip={
          count > 0
            ? `${count} action${count === 1 ? '' : 's'} selected`
            : 'Filter by action'
        }
      />
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Filter actions…" />
          <CommandList>
            <CommandEmpty>No actions</CommandEmpty>
            {ACTION_GROUPS.map((group, idx) => (
              <div key={group.label}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={group.label}>
                  {group.actions.map((action) => {
                    const checked = value.includes(action)
                    return (
                      <CommandItem
                        key={action}
                        value={action}
                        onSelect={() => {
                          if (checked) {
                            onChange(value.filter((a) => a !== action))
                          } else {
                            onChange([...value, action])
                          }
                        }}
                      >
                        <Check
                          className={
                            checked
                              ? 'size-3.5 text-[var(--h-accent)]'
                              : 'opacity-0'
                          }
                        />
                        <span className="font-mono text-xs">{action}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function FacetSelect({
  icon,
  name,
  activeLabel,
  renderContent,
}: {
  icon: React.ComponentType<{ className?: string }>
  /** Lowercase category noun, e.g. "actor". */
  name: string
  /** Selected value's display label, or null when the filter is inactive. */
  activeLabel: string | null
  renderContent: () => React.ReactNode
}) {
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1)
  return (
    <Popover>
      <TriggerButton
        icon={icon}
        active={activeLabel != null}
        tooltip={
          activeLabel != null
            ? `${capitalized}: ${activeLabel}`
            : `Filter by ${name}`
        }
      />
      <PopoverContent align="end" className="w-64 p-0">
        {renderContent()}
      </PopoverContent>
    </Popover>
  )
}

function endOfDayISO(d: Date): string {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

function formatDateRangeLabel(from: string | null, to: string | null): string {
  if (!from && !to) return 'Date'
  const f = from ? new Date(from) : null
  const t = to ? new Date(to) : null
  if (f && t) {
    return `${f.toLocaleDateString()} → ${t.toLocaleDateString()}`
  }
  if (f) return `From ${f.toLocaleDateString()}`
  if (t) return `Until ${t.toLocaleDateString()}`
  return 'Any time'
}
