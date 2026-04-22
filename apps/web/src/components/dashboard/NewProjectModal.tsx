import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import {
  createOnboardingProjectFn,
  pasteEnvVariablesFn,
} from '#/lib/server-fns/onboarding'
import { parseEnvText } from '@handoff-env/types'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { parseActionError } from '#/lib/billing/parse-limit-error'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

interface CreatedProject {
  id: string
  name: string
  slug: string
  environments: { id: string; name: string }[]
}

type ProjectStep = 'details' | 'env' | 'done'

export function NewProjectModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<ProjectStep>('details')
  const [project, setProject] = useState<CreatedProject | null>(null)

  function reset() {
    setStep('details')
    setProject(null)
  }

  function handleClose() {
    const shouldRefresh = step === 'env' || step === 'done'
    reset()
    onOpenChange(false)
    if (shouldRefresh) onCreated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
        else onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={step !== 'done'}>
        <div key={step} className="step-in">
          {step === 'details' && (
            <ProjectDetailsStep
              onCreated={(p) => {
                setProject(p)
                setStep('env')
              }}
              onCancel={() => {
                reset()
                onOpenChange(false)
              }}
            />
          )}
          {step === 'env' && project && (
            <ProjectEnvStep project={project} onNext={() => setStep('done')} />
          )}
          {step === 'done' && project && (
            <ProjectDoneStep project={project} onClose={handleClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProjectDetailsStep({
  onCreated,
  onCancel,
}: {
  onCreated: (project: CreatedProject) => void
  onCancel: () => void
}) {
  const [error, setError] = useState('')

  const form = useForm({
    defaultValues: { name: '', slug: '' },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        const result = await createOnboardingProjectFn({
          data: { name: value.name, slug: value.slug },
        })
        onCreated({
          id: result.project.id,
          name: result.project.name,
          slug: result.project.slug,
          environments: result.environments,
        })
      } catch (e) {
        setError(parseActionError(e, 'Failed to create project').message)
      }
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create a new project</DialogTitle>
        <DialogDescription>
          A project groups environment variables across environments like dev,
          staging, and production.
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
              <Label htmlFor="modal-project-name">Project name</Label>
              <Input
                id="modal-project-name"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  form.setFieldValue('slug', slugify(e.target.value))
                }}
                placeholder="My API"
                autoFocus
              />
            </div>
          )}
        </form.Field>

        <form.Field name="slug">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="modal-project-slug">Slug</Label>
              <Input
                id="modal-project-slug"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="my-api"
              />
            </div>
          )}
        </form.Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create project'}
                {!isSubmitting && <ArrowRight className="size-3.5" />}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </>
  )
}

function ProjectEnvStep({
  project,
  onNext,
}: {
  project: CreatedProject
  onNext: () => void
}) {
  const [envText, setEnvText] = useState('')
  const [selectedEnv, setSelectedEnv] = useState(
    project.environments[0]?.name ?? 'development',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const parsed = envText.trim() ? parseEnvText(envText) : []

  async function handleSubmit() {
    if (!envText.trim()) {
      onNext()
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await pasteEnvVariablesFn({
        data: {
          projectId: project.id,
          environmentName: selectedEnv,
          envText,
        },
      })
      onNext()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save variables')
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add environment variables</DialogTitle>
        <DialogDescription>
          Paste your <code>.env</code> file contents for{' '}
          <span className="font-medium text-foreground">{project.name}</span>.
          They'll be encrypted and stored securely.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="modal-env-select">Environment</Label>
          <Select value={selectedEnv} onValueChange={setSelectedEnv}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {project.environments.map((env) => (
                <SelectItem key={env.id} value={env.name}>
                  {env.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="modal-env-text">Variables</Label>
          <textarea
            id="modal-env-text"
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder={`DATABASE_URL=postgres://...\nAPI_KEY=sk-...\nSECRET=my-secret`}
            rows={7}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        {parsed.length > 0 && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {parsed.length} variable{parsed.length !== 1 ? 's' : ''} detected
            </p>
            <div className="grid gap-1">
              {parsed.slice(0, 8).map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-medium">{entry.key}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="truncate font-mono text-muted-foreground">
                    {'*'.repeat(Math.min(entry.value.length, 20))}
                  </span>
                </div>
              ))}
              {parsed.length > 8 && (
                <p className="text-xs text-muted-foreground">
                  ...and {parsed.length - 8} more
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onNext} disabled={submitting}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? 'Saving...'
              : envText.trim()
                ? 'Save variables'
                : 'Continue'}
            {!submitting && <ArrowRight className="size-3.5" />}
          </Button>
        </div>
      </div>
    </>
  )
}

function ProjectDoneStep({
  project,
  onClose,
}: {
  project: CreatedProject
  onClose: () => void
}) {
  return (
    <div className="grid gap-4 text-center py-2">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
        <Check className="size-6 text-[var(--h-accent)]" />
      </div>
      <DialogHeader className="items-center">
        <DialogTitle>{project.name} is ready</DialogTitle>
        <DialogDescription>
          Your project has been created with {project.environments.length}{' '}
          environments.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-center gap-1.5">
        {project.environments.map((env) => (
          <Badge key={env.id} variant="secondary">
            {env.name}
          </Badge>
        ))}
      </div>
      <Button onClick={onClose}>Done</Button>
    </div>
  )
}
