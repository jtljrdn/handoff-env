import { createFileRoute, redirect, useRouter, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  FolderPlus,
  Layers,
  Plus,
  UserPlus,
  Mail,
  ArrowRight,
  Check,
} from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { authClient } from '#/lib/auth-client'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import { getSeatChangePreviewFn } from '#/lib/server-fns/billing'
import { SeatChangeConfirmDialog } from '#/components/billing/SeatChangeConfirmDialog'
import {
  createOnboardingProjectFn,
  pasteEnvVariablesFn,
} from '#/lib/server-fns/onboarding'
import { parseEnvText } from '@handoff-env/types'
import type { OrgRole } from '@handoff-env/types'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { PlanLimitBanner } from '#/components/billing/PlanLimitBanner'
import { parseActionError } from '#/lib/billing/parse-limit-error'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
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

export const Route = createFileRoute('/_authed/dashboard')({
  beforeLoad: async ({ context }) => {
    if (!context.onboardingStatus.hasOrganization) {
      throw redirect({ to: '/onboarding' })
    }
  },
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData({
      queryKey: ['sidebar-data'],
      queryFn: () => getDashboardDataFn(),
      staleTime: 30_000,
    })
  },
  component: DashboardPage,
})

// Wrap a Button so we can disable it at the plan limit while still showing a
// tooltip explaining *why*. Disabled buttons don't fire pointer events, so the
// trigger wraps the button in a focusable span when disabled.
function LimitGatedButton({
  disabled,
  tooltip,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip?: string }) {
  const button = (
    <Button {...props} disabled={disabled}>
      {children}
    </Button>
  )
  if (!disabled || !tooltip) return button
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function DashboardPage() {
  const router = useRouter()
  const dashboardData = Route.useLoaderData()
  const [showNewProject, setShowNewProject] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  return (
    <div className="px-6 py-8">
      <div className="rise-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--h-text)] flex items-center gap-2">
              Projects
              {dashboardData.currentUserRole === 'owner' ? (
                <Link
                  to="/billing"
                  className="no-underline"
                  title="Manage billing"
                >
                  <Badge
                    variant={dashboardData.plan === 'team' ? 'default' : 'secondary'}
                    className="cursor-pointer"
                  >
                    {dashboardData.plan === 'team' ? 'Team' : 'Free'}
                  </Badge>
                </Link>
              ) : (
                <Badge
                  variant={dashboardData.plan === 'team' ? 'default' : 'secondary'}
                >
                  {dashboardData.plan === 'team' ? 'Team' : 'Free'}
                </Badge>
              )}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {dashboardData.org.memberCount} member{dashboardData.org.memberCount !== 1 ? 's' : ''} in {dashboardData.org.name}
            </p>
          </div>
          <div className="flex gap-2">
            <LimitGatedButton
              disabled={dashboardData.atMemberLimit}
              tooltip={
                dashboardData.atMemberLimit
                  ? dashboardData.currentUserRole === 'owner'
                    ? `Member limit reached (${dashboardData.limits.maxMembers} on Free). Upgrade to invite more.`
                    : 'Member limit reached. Ask the owner to upgrade.'
                  : undefined
              }
              onClick={() => setShowInvite(true)}
              variant="outline"
              size="sm"
            >
              <UserPlus className="size-3.5" />
              Invite
            </LimitGatedButton>
            <LimitGatedButton
              disabled={dashboardData.atProjectLimit}
              tooltip={
                dashboardData.atProjectLimit
                  ? dashboardData.currentUserRole === 'owner'
                    ? `Project limit reached (${dashboardData.limits.maxProjects} on Free). Upgrade to add more.`
                    : 'Project limit reached. Ask the owner to upgrade.'
                  : undefined
              }
              onClick={() => setShowNewProject(true)}
              size="sm"
            >
              <Plus className="size-3.5" />
              New project
            </LimitGatedButton>
          </div>
        </div>

        {dashboardData.plan === 'free' &&
          (dashboardData.atProjectLimit || dashboardData.atMemberLimit) && (
            <PlanLimitBanner
              orgId={dashboardData.org.id}
              role={dashboardData.currentUserRole}
              atProjectLimit={dashboardData.atProjectLimit}
              atMemberLimit={dashboardData.atMemberLimit}
            />
          )}

        <InviteModal
          orgId={dashboardData.org.id}
          currentUserRole={dashboardData.currentUserRole}
          open={showInvite}
          onOpenChange={setShowInvite}
        />

        <NewProjectModal
          open={showNewProject}
          onOpenChange={setShowNewProject}
          onCreated={() => {
            setShowNewProject(false)
            router.invalidate()
          }}
        />

        {dashboardData.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
              <FolderPlus className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to start managing environment variables.
            </p>
            <LimitGatedButton
              className="mt-4"
              size="sm"
              disabled={dashboardData.atProjectLimit}
              tooltip={
                dashboardData.atProjectLimit
                  ? dashboardData.currentUserRole === 'owner'
                    ? `Project limit reached (${dashboardData.limits.maxProjects} on Free). Upgrade to add more.`
                    : 'Project limit reached. Ask the owner to upgrade.'
                  : undefined
              }
              onClick={() => setShowNewProject(true)}
            >
              <Plus className="size-3.5" />
              Create project
            </LimitGatedButton>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardData.projects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-[var(--h-accent-subtle)]">
                  <Layers className="size-4 text-[var(--h-accent)]" />
                </div>
                <p className="mt-3 text-sm font-medium">{project.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {project.slug}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="size-3" />
                    {project.environmentCount} env{project.environmentCount !== 1 ? 's' : ''}
                  </span>
                  <span>
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invite Modal
// ---------------------------------------------------------------------------

function InviteModal({
  orgId,
  currentUserRole,
  open,
  onOpenChange,
}: {
  orgId: string
  currentUserRole: OrgRole
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const MAX_INVITES = 5
  const [invites, setInvites] = useState([{ email: '', role: 'member' as OrgRole }])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentEmails, setSentEmails] = useState<string[]>([])
  const [confirmDelta, setConfirmDelta] = useState<number | null>(null)

  function reset() {
    setInvites([{ email: '', role: 'member' }])
    setSending(false)
    setError('')
    setSentEmails([])
    setConfirmDelta(null)
  }

  function addRow() {
    if (invites.length < MAX_INVITES) {
      setInvites([...invites, { email: '', role: 'member' }])
    }
  }

  function removeRow(index: number) {
    setInvites(invites.filter((_, i) => i !== index))
  }

  function updateInvite(index: number, field: 'email' | 'role', value: string) {
    setInvites(
      invites.map((inv, i) =>
        i === index
          ? { ...inv, [field]: field === 'role' ? (value as OrgRole) : value }
          : inv,
      ),
    )
  }

  async function handleSubmit() {
    const validInvites = invites.filter((inv) => inv.email.trim())
    if (validInvites.length === 0) return

    setError('')

    try {
      const preview = await getSeatChangePreviewFn({
        data: { seatDelta: validInvites.length },
      })
      const needsConfirm =
        preview.plan === 'team' &&
        (preview.crossesThreshold || preview.deltaCents > 0)

      if (needsConfirm) {
        setConfirmDelta(validInvites.length)
        return
      }
    } catch (err) {
      // If preview fails we fall through to the send — server will still
      // enforce the rule via beforeCreateInvitation.
      console.error('Seat preview failed:', err)
    }

    await sendInvites()
  }

  async function sendInvites() {
    const validInvites = invites.filter((inv) => inv.email.trim())
    setConfirmDelta(null)
    setSending(true)
    const sent: string[] = []

    for (const invite of validInvites) {
      const { error } = await authClient.organization.inviteMember({
        email: invite.email.trim(),
        role: invite.role,
        organizationId: orgId,
      })
      if (error) {
        const parsed = parseActionError(
          error,
          `Failed to invite ${invite.email}`,
        )
        setError(
          parsed.isLimitError
            ? parsed.message
            : `Failed to invite ${invite.email}: ${parsed.message}`,
        )
        setSending(false)
        return
      }
      sent.push(invite.email)
    }

    setSending(false)
    setSentEmails(sent)
  }

  const hasSent = sentEmails.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        {hasSent ? (
          <div className="grid gap-4 text-center py-2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
              <Check className="size-6 text-[var(--h-accent)]" />
            </div>
            <DialogHeader className="items-center">
              <DialogTitle>Invitations sent</DialogTitle>
              <DialogDescription>
                {sentEmails.length === 1
                  ? `Invitation sent to ${sentEmails[0]}`
                  : `${sentEmails.length} invitations sent`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1">
              {sentEmails.length > 1 && sentEmails.map((email) => (
                <p key={email} className="text-sm text-muted-foreground">{email}</p>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite team members</DialogTitle>
              <DialogDescription>
                Add up to {MAX_INVITES} team members. They'll receive an email invitation.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              {invites.map((invite, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={invite.email}
                      onChange={(e) => updateInvite(i, 'email', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={invite.role}
                    onValueChange={(value) => updateInvite(i, 'role', value as OrgRole)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {invites.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeRow(i)}
                    >
                      <span className="sr-only">Remove</span>
                      &times;
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {invites.length < MAX_INVITES && (
              <Button variant="outline" size="sm" onClick={addRow} className="w-fit">
                <Plus className="size-3.5" />
                Add another
              </Button>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={sending || invites.every((inv) => !inv.email.trim())}
              >
                {sending ? 'Sending...' : 'Send invites'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
      <SeatChangeConfirmDialog
        open={confirmDelta !== null}
        seatDelta={confirmDelta ?? 0}
        currentUserRole={currentUserRole}
        onCancel={() => setConfirmDelta(null)}
        onConfirm={sendInvites}
      />
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// New Project Modal (multi-step: details → paste env → done)
// ---------------------------------------------------------------------------

interface CreatedProject {
  id: string
  name: string
  slug: string
  environments: { id: string; name: string }[]
}

type ProjectStep = 'details' | 'env' | 'done'

function NewProjectModal({
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
            <ProjectEnvStep
              project={project}
              onNext={() => setStep('done')}
            />
          )}
          {step === 'done' && project && (
            <ProjectDoneStep
              project={project}
              onClose={handleClose}
            />
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
          A project groups environment variables across environments like dev, staging, and production.
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
          Paste your <code>.env</code> file contents for <span className="font-medium text-foreground">{project.name}</span>. They'll be encrypted and stored securely.
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
          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
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
          Your project has been created with {project.environments.length} environments.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-center gap-1.5">
        {project.environments.map((env) => (
          <Badge key={env.id} variant="secondary">
            {env.name}
          </Badge>
        ))}
      </div>
      <Button onClick={onClose}>
        Done
      </Button>
    </div>
  )
}
