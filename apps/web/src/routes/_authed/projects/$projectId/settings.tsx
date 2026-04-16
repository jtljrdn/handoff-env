import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, GripVertical } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { updateProjectFn, deleteProjectFn, getProjectByIdFn } from '#/lib/server-fns/projects'
import { deleteEnvironmentFn, listEnvironmentsFn } from '#/lib/server-fns/environments'
import { usePermission } from '#/hooks/usePermission'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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

export const Route = createFileRoute('/_authed/projects/$projectId/settings')({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectByIdFn({ data: { projectId } }),
    staleTime: 30_000,
  })

  const { data: environments = [] } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => listEnvironmentsFn({ data: { projectId } }),
    staleTime: 30_000,
  })

  const canUpdateProject = usePermission('project', 'update')
  const canDeleteProject = usePermission('project', 'delete')
  const canDeleteEnvironment = usePermission('environment', 'delete')

  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [deletingEnvId, setDeletingEnvId] = useState<string | null>(null)
  const [deletingEnvName, setDeletingEnvName] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  const form = useForm({
    defaultValues: {
      name: project?.name ?? '',
      slug: project?.slug ?? '',
    },
    onSubmit: async ({ value }) => {
      setSaveError('')
      setSaveSuccess(false)
      try {
        await updateProjectFn({
          data: {
            projectId,
            name: value.name,
            slug: value.slug,
          },
        })
        setSaveSuccess(true)
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        queryClient.invalidateQueries({ queryKey: ['sidebar-data'] })
        setTimeout(() => setSaveSuccess(false), 2000)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to update project')
      }
    },
  })

  return (
    <div className="max-w-2xl space-y-8">
      {/* Project details */}
      {canUpdateProject && (
        <section>
          <h2 className="text-base font-semibold">Project details</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Update your project name and slug.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="mt-4 space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="settings-name">Name</Label>
                  <Input
                    id="settings-name"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="slug">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="settings-slug">Slug</Label>
                  <Input
                    id="settings-slug"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}
            </form.Field>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            {saveSuccess && (
              <p className="text-sm text-[var(--h-accent)]">Saved successfully.</p>
            )}

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </section>
      )}

      {/* Environments */}
      <section>
        <h2 className="text-base font-semibold">Environments</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage the environments in this project.
        </p>

        <div className="mt-4 rounded-lg border">
          {environments.map((env, i) => (
            <div
              key={env.id}
              className={`flex items-center justify-between px-4 py-3 ${
                i < environments.length - 1 ? 'border-b' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="size-4 text-muted-foreground/40" />
                <span className="text-sm font-medium">{env.name}</span>
              </div>
              {canDeleteEnvironment && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setDeletingEnvId(env.id)
                    setDeletingEnvName(env.name)
                  }}
                  title={`Delete ${env.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          {environments.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No environments.
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      {canDeleteProject && (
        <section>
          <h2 className="text-base font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Permanently delete this project and all its data.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() => setShowDeleteProject(true)}
          >
            <Trash2 className="size-3.5" />
            Delete project
          </Button>
        </section>
      )}

      {/* Delete environment dialog */}
      <DeleteEnvironmentDialog
        open={!!deletingEnvId}
        onOpenChange={(open) => {
          if (!open) setDeletingEnvId(null)
        }}
        envId={deletingEnvId ?? ''}
        envName={deletingEnvName}
        onDeleted={() => {
          setDeletingEnvId(null)
          queryClient.invalidateQueries({ queryKey: ['environments', projectId] })
          queryClient.invalidateQueries({ queryKey: ['sidebar-data'] })
        }}
      />

      {/* Delete project dialog */}
      <DeleteProjectDialog
        open={showDeleteProject}
        onOpenChange={setShowDeleteProject}
        projectId={projectId}
        projectSlug={project?.slug ?? ''}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ['sidebar-data'] })
          navigate({ to: '/dashboard' })
        }}
      />
    </div>
  )
}

function DeleteEnvironmentDialog({
  open,
  onOpenChange,
  envId,
  envName,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  envId: string
  envName: string
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteEnvironmentFn({ data: { envId } })
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete environment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{envName}</span>? All
            variables in this environment will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : 'Delete environment'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectSlug,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectSlug: string
  onDeleted: () => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const isConfirmed = confirmation === projectSlug

  async function handleDelete() {
    if (!isConfirmed) return
    setDeleting(true)
    try {
      await deleteProjectFn({ data: { projectId } })
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setConfirmation('')
        onOpenChange(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the project, all environments, and all
            variables. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="delete-confirm">
            Type{' '}
            <span className="font-mono font-medium text-foreground">
              {projectSlug}
            </span>{' '}
            to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={projectSlug}
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : 'Delete project'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
