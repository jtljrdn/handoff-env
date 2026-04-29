import { useMemo, useState } from 'react'
import {
  CalendarRange,
  Check,
  ChevronDown,
  Search,
  Tag,
  User,
  X,
  Folder,
  Layers,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
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

export function AuditFilterBar({
  scope,
  value,
  onChange,
  facets,
  retentionCutoffISO,
}: AuditFilterBarProps) {
  const [search, setSearch] = useState(value.targetKeySearch)

  const update = (patch: Partial<AuditFilterValue>) => {
    onChange({ ...value, ...patch })
  }

  const memberLabel = useMemo(() => {
    if (!value.actorUserId) return 'Any actor'
    const m = facets.members.find((x) => x.id === value.actorUserId)
    return m ? (m.name ?? m.email ?? m.id) : 'Actor'
  }, [value.actorUserId, facets.members])

  const projectLabel = useMemo(() => {
    if (!value.projectId) return 'Any project'
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
    if (!value.environmentId) return 'Any environment'
    const e = envOptions.find((x) => x.id === value.environmentId)
    return e?.name ?? 'Environment'
  }, [value.environmentId, envOptions])

  const dateLabel = formatDateRangeLabel(value.dateFrom, value.dateTo)
  const retentionMin = retentionCutoffISO ? new Date(retentionCutoffISO) : undefined

  const hasAnyFilter =
    value.actions.length > 0 ||
    Boolean(value.actorUserId) ||
    Boolean(value.projectId) ||
    Boolean(value.environmentId) ||
    Boolean(value.targetKeySearch) ||
    Boolean(value.dateFrom) ||
    Boolean(value.dateTo)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          onBlur={() => {
            if (search !== value.targetKeySearch) update({ targetKeySearch: search })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update({ targetKeySearch: search })
          }}
          placeholder="Search target key…"
          className="h-8 w-56 pl-7 text-sm"
        />
      </div>

      <ActionsFilter
        value={value.actions}
        onChange={(actions) => update({ actions })}
      />

      <FacetSelect
        icon={User}
        label={memberLabel}
        active={Boolean(value.actorUserId)}
        onClear={
          value.actorUserId ? () => update({ actorUserId: null }) : undefined
        }
        renderContent={() => (
          <Command>
            <CommandInput placeholder="Filter members…" />
            <CommandList>
              <CommandEmpty>No members</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => update({ actorUserId: null })}>
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
          label={projectLabel}
          active={Boolean(value.projectId)}
          onClear={
            value.projectId
              ? () => update({ projectId: null, environmentId: null })
              : undefined
          }
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
          label={envLabel}
          active={Boolean(value.environmentId)}
          onClear={
            value.environmentId
              ? () => update({ environmentId: null })
              : undefined
          }
          renderContent={() => (
            <Command>
              <CommandInput placeholder="Filter environments…" />
              <CommandList>
                <CommandEmpty>No environments</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => update({ environmentId: null })}>
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
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={
              value.dateFrom || value.dateTo
                ? 'h-8 border-[var(--h-accent)]/40'
                : 'h-8'
            }
          >
            <CalendarRange className="size-3.5" />
            {dateLabel}
            <ChevronDown className="size-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
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
          {retentionMin && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Earliest available: {retentionMin.toLocaleDateString()}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {hasAnyFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => {
            setSearch('')
            onChange(emptyFilter())
          }}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}

      {value.actions.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
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
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={count > 0 ? 'h-8 border-[var(--h-accent)]/40' : 'h-8'}
        >
          <Tag className="size-3.5" />
          {count === 0 ? 'Any action' : `${count} action${count === 1 ? '' : 's'}`}
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
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
  icon: Icon,
  label,
  active,
  onClear,
  renderContent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClear?: () => void
  renderContent: () => React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={active ? 'h-8 border-[var(--h-accent)]/40' : 'h-8'}
        >
          <Icon className="size-3.5" />
          <span className="max-w-[10rem] truncate">{label}</span>
          {active && onClear ? (
            <X
              className="size-3 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClear()
              }}
            />
          ) : (
            <ChevronDown className="size-3 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
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
  if (!from && !to) return 'Any time'
  const f = from ? new Date(from) : null
  const t = to ? new Date(to) : null
  if (f && t) {
    return `${f.toLocaleDateString()} → ${t.toLocaleDateString()}`
  }
  if (f) return `From ${f.toLocaleDateString()}`
  if (t) return `Until ${t.toLocaleDateString()}`
  return 'Any time'
}
