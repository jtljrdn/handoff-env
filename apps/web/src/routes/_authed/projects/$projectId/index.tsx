import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  FolderPlus,
  Copy,
  Check,
  Download,
} from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { getVariablesFn, setVariableFn, deleteVariableFn, bulkUpsertVariablesFn } from '#/lib/server-fns/variables'
import { createEnvironmentFn, listEnvironmentsFn } from '#/lib/server-fns/environments'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { parseEnvText } from '@handoff-env/types'
import { Skeleton } from '#/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '#/lib/utils'
import { usePermission } from '#/hooks/usePermission'

interface SearchParams {
  env?: string
}

export const Route = createFileRoute('/_authed/projects/$projectId/')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    env: typeof search.env === 'string' ? search.env : undefined,
  }),
  component: ProjectVariablesPage,
})

function ProjectVariablesPage() {
  const { projectId } = Route.useParams()
  const { env: selectedEnvId } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: environments = [] } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => listEnvironmentsFn({ data: { projectId } }),
    staleTime: 30_000,
  })

  const [revealed, setRevealed] = useState(false)
  const [showAddVariable, setShowAddVariable] = useState(false)
  const [editingVariable, setEditingVariable] = useState<{ id: string; key: string; value?: string } | null>(null)
  const [deletingVariable, setDeletingVariable] = useState<{ id: string; key: string } | null>(null)
  const [showAddEnv, setShowAddEnv] = useState(false)
  const canDeleteVariable = usePermission('variable', 'delete')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const currentEnvId = selectedEnvId ?? environments[0]?.id
  const currentEnv = environments.find((e: { id: string }) => e.id === currentEnvId)

  const { data: variables = [], isLoading, isFetching, isPlaceholderData, error: queryError } = useQuery({
    queryKey: ['variables', currentEnvId, revealed],
    queryFn: () =>
      getVariablesFn({
        data: { environmentId: currentEnvId!, reveal: revealed },
      }),
    enabled: !!currentEnvId,
    retry: 1,
    placeholderData: (prev) => prev,
  })

  const isRevealing = revealed && isFetching && isPlaceholderData

  function selectEnv(envId: string) {
    setRevealed(false)
    navigate({
      to: '/projects/$projectId',
      params: { projectId },
      search: { env: envId },
      replace: true,
    })
  }

  function invalidateVariables() {
    queryClient.invalidateQueries({ queryKey: ['variables', currentEnvId] })
  }

  async function copyValue(variableId: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedId(variableId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function downloadEnvFile() {
    const envName = currentEnv?.name ?? 'variables'
    const filename = `.env.${envName}`
    const a = document.createElement('a')
    a.href = `/api/environments/${currentEnvId}/download`
    a.click()
    toast.info('Download Started', {
      description: `You may need to rename the file to add the leading dot`,
      duration: 12_000,
    })
  }

  return (
    <>
      {/* Environment tabs */}
      <div className="mb-6 flex items-center gap-1.5 overflow-x-auto">
        {environments.map((env) => (
          <button
            key={env.id}
            type="button"
            onClick={() => selectEnv(env.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              env.id === currentEnvId
                ? 'bg-[var(--h-accent-subtle)] text-[var(--h-accent)]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {env.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAddEnv(true)}
          className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      {/* Toolbar */}
      {currentEnvId && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddVariable(true)}>
              <Plus className="size-3.5" />
              Add variable
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadEnvFile}
              disabled={variables.length === 0}
            >
              <Download className="size-3.5" />
              Download .env
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              {revealed ? 'Hide values' : 'Reveal values'}
            </Button>
          </div>
        </div>
      )}

      {/* Variables table */}
      {!currentEnvId ? (
        <EmptyState
          message="No environments"
          description="Add an environment to start managing variables."
          action={
            <Button size="sm" onClick={() => setShowAddEnv(true)}>
              <Plus className="size-3.5" />
              Add environment
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading variables...
        </div>
      ) : queryError ? (
        <div className="py-12 text-center text-sm text-destructive">
          Failed to load variables: {queryError.message}
        </div>
      ) : variables.length === 0 ? (
        <EmptyState
          message="No variables yet"
          description={`Add your first variable to ${currentEnv?.name ?? 'this environment'}, or use the CLI to push your .env file.`}
          action={
            <Button size="sm" onClick={() => setShowAddVariable(true)}>
              <Plus className="size-3.5" />
              Add variable
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Key</TableHead>
                <TableHead className="w-auto">Value</TableHead>
                <TableHead className="w-[120px]">Updated</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable) => (
                <TableRow key={variable.id}>
                  <TableCell className="truncate font-mono text-sm font-medium">
                    {variable.key}
                  </TableCell>
                  <TableCell className="max-w-0 font-mono text-sm text-muted-foreground">
                    {isRevealing ? (
                      <Skeleton className="h-4 w-3/4" />
                    ) : revealed && variable.value !== undefined ? (
                      <span className="block truncate" title={variable.value}>{variable.value}</span>
                    ) : (
                      <span className="select-none tracking-wider">
                        {'••••••••'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(variable.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {revealed && variable.value !== undefined && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => copyValue(variable.id, variable.value!)}
                          title="Copy value"
                        >
                          {copiedId === variable.id ? (
                            <Check className="size-3" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setEditingVariable({
                            id: variable.id,
                            key: variable.key,
                            value: variable.value,
                          })
                        }
                        title="Edit variable"
                      >
                        <Pencil className="size-3" />
                      </Button>
                      {canDeleteVariable && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setDeletingVariable({
                              id: variable.id,
                              key: variable.key,
                            })
                          }
                          title="Delete variable"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Variable Dialog */}
      <VariableDialog
        open={showAddVariable}
        onOpenChange={setShowAddVariable}
        environmentId={currentEnvId!}
        onSuccess={invalidateVariables}
      />

      {/* Edit Variable Dialog */}
      {editingVariable && (
        <VariableDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingVariable(null)
          }}
          environmentId={currentEnvId!}
          editKey={editingVariable.key}
          editValue={editingVariable.value}
          onSuccess={() => {
            invalidateVariables()
            setEditingVariable(null)
          }}
        />
      )}

      {/* Delete Variable Dialog */}
      <DeleteVariableDialog
        open={!!deletingVariable}
        onOpenChange={(open) => {
          if (!open) setDeletingVariable(null)
        }}
        variableId={deletingVariable?.id ?? ''}
        variableKey={deletingVariable?.key ?? ''}
        onDeleted={() => {
          invalidateVariables()
          setDeletingVariable(null)
        }}
      />

      {/* Add Environment Dialog */}
      <AddEnvironmentDialog
        open={showAddEnv}
        onOpenChange={setShowAddEnv}
        projectId={projectId}
        onCreated={(envId) => {
          setShowAddEnv(false)
          queryClient.invalidateQueries({ queryKey: ['environments', projectId] })
          queryClient.invalidateQueries({ queryKey: ['sidebar-data'] })
          navigate({
            to: '/projects/$projectId',
            params: { projectId },
            search: { env: envId },
          })
        }}
      />
    </>
  )
}

function EmptyState({
  message,
  description,
  action,
}: {
  message: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderPlus className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{message}</p>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-4">{action}</div>
    </div>
  )
}

function looksLikeEnvPaste(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
  if (lines.length === 0) return false
  if (lines.length >= 2) return lines.filter((l) => l.includes('=')).length >= 2
  return /^[A-Za-z_]\w*=/.test(lines[0])
}

function VariableDialog({
  open,
  onOpenChange,
  environmentId,
  editKey,
  editValue,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  environmentId: string
  editKey?: string
  editValue?: string
  onSuccess: () => void
}) {
  const isEditing = !!editKey
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>(() =>
    isEditing
      ? [{ key: editKey, value: editValue ?? '' }]
      : [{ key: '', value: '' }],
  )

  function handleClose(v: boolean) {
    if (!v) {
      setRows(isEditing ? [{ key: editKey!, value: editValue ?? '' }] : [{ key: '', value: '' }])
      setError('')
    }
    onOpenChange(v)
  }

  function updateRow(index: number, field: 'key' | 'value', val: string) {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: field === 'key' ? val.toUpperCase() : val }
      if (!isEditing && index === next.length - 1 && (next[index].key || next[index].value)) {
        next.push({ key: '', value: '' })
      }
      return next
    })
  }

  function removeRow(index: number) {
    setRows((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index))
  }

  function handleKeyPaste(e: React.ClipboardEvent<HTMLInputElement>, index: number) {
    if (isEditing) return
    const pasted = e.clipboardData.getData('text')
    if (looksLikeEnvPaste(pasted)) {
      e.preventDefault()
      const entries = parseEnvText(pasted)
      if (entries.length > 0) {
        setRows((prev) => {
          const before = prev.slice(0, index)
          return [...before, ...entries, { key: '', value: '' }]
        })
      }
    }
  }

  async function handleSubmit() {
    setError('')
    const entries = rows.filter((r) => r.key.trim())
    if (entries.length === 0) return

    setSubmitting(true)
    try {
      if (isEditing) {
        await setVariableFn({
          data: { environmentId, key: entries[0].key, value: entries[0].value },
        })
      } else {
        await bulkUpsertVariablesFn({
          data: { environmentId, entries },
        })
      }
      onSuccess()
      handleClose(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save variables')
    } finally {
      setSubmitting(false)
    }
  }

  const filledCount = rows.filter((r) => r.key.trim()).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit variable' : 'Add variables'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the value for ${editKey}.`
              : 'Add environment variables. Paste a .env to fill multiple at once.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          className="grid gap-3"
        >
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {rows.map((row, i) => {
              const isLastBlank = !isEditing && i === rows.length - 1
              return (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={row.key}
                    onChange={(e) => updateRow(i, 'key', e.target.value)}
                    onPaste={(e) => handleKeyPaste(e, i)}
                    placeholder="KEY"
                    className="w-[180px] shrink-0 font-mono text-sm"
                    disabled={isEditing}
                    autoFocus={i === 0 && !isEditing}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">=</span>
                  <Input
                    value={row.value}
                    onChange={(e) => updateRow(i, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 font-mono text-sm"
                    autoFocus={i === 0 && isEditing}
                  />
                  {!isEditing && !isLastBlank && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      type="button"
                      onClick={() => removeRow(i)}
                      className="shrink-0 text-muted-foreground"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                  {(isEditing || isLastBlank) && <div className="w-6 shrink-0" />}
                </div>
              )
            })}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || filledCount === 0}>
              {submitting
                ? 'Saving...'
                : isEditing
                  ? 'Update variable'
                  : filledCount <= 1
                    ? 'Add variable'
                    : `Add ${filledCount} variables`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteVariableDialog({
  open,
  onOpenChange,
  variableId,
  variableKey,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  variableId: string
  variableKey: string
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteVariableFn({ data: { variableId } })
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete variable</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-mono font-medium text-foreground">
              {variableKey}
            </span>
            ? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AddEnvironmentDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onCreated: (envId: string) => void
}) {
  const [error, setError] = useState('')
  const router = useRouter()

  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        const env = await createEnvironmentFn({
          data: {
            projectId,
            name: value.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          },
        })
        router.invalidate()
        onCreated(env.id)
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to create environment',
        )
      }
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          form.reset()
          setError('')
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add environment</DialogTitle>
          <DialogDescription>
            Create a new environment for this project.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="grid gap-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor="env-name">Name</Label>
                <Input
                  id="env-name"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="preview"
                  autoFocus
                />
              </div>
            )}
          </form.Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create environment'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
