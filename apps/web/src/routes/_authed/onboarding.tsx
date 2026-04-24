import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Users,
  FolderPlus,
  FileKey,
  Check,
  Plus,
  X,
  ArrowRight,
  Mail,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { authClient } from '#/lib/auth-client'
import {
  createOnboardingProjectFn,
  pasteEncryptedVariablesFn,
} from '#/lib/server-fns/onboarding'
import { seedOrgDek, unwrapOrgDek } from '#/lib/vault/org'
import { encryptVariableValue } from '#/lib/vault/variables'
import { parseActionError } from '#/lib/billing/parse-limit-error'
import { parseEnvText } from '@handoff-env/types'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export const Route = createFileRoute('/_authed/onboarding')({
  beforeLoad: async ({ context }) => {
    if (context.onboardingStatus.hasOrganization) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: OnboardingPage,
})

type Step = 'invitations' | 'create-org' | 'invite-team' | 'create-project' | 'paste-env' | 'done'

interface CreatedProject {
  id: string
  name: string
  slug: string
  environments: { id: string; name: string }[]
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function OnboardingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('invitations')
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null)
  const [createdProject, setCreatedProject] = useState<CreatedProject | null>(null)
  const { data: pendingInvitations = [], isLoading: loadingInvitations } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { data } = await authClient.organization.listUserInvitations()
      return (data ?? [])
        .filter((inv) => inv.status === 'pending')
        .map((inv) => ({
          id: inv.id,
          organizationName: inv.organizationName,
          role: inv.role,
        }))
    },
  })

  const hasCheckedInvitations = !loadingInvitations
  if (hasCheckedInvitations && pendingInvitations.length === 0 && step === 'invitations') {
    setStep('create-org')
  }

  const goToDashboard = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['auth-context'] })
    router.navigate({ to: '/dashboard' })
  }, [queryClient, router])

  const steps = [
    { label: 'Organization', icon: Building2 },
    { label: 'Team', icon: Users },
    { label: 'Project', icon: FolderPlus },
    { label: 'Variables', icon: FileKey },
  ]

  const activeStepIndex = step === 'invitations' ? 0 :
    step === 'create-org' ? 0 :
    step === 'invite-team' ? 1 :
    step === 'create-project' ? 2 :
    step === 'paste-env' ? 3 :
    4

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <div className="rise-in w-full max-w-lg">
        {step !== 'invitations' && step !== 'done' && (
          <nav className="mb-8 flex items-center justify-center gap-2">
            {steps.map((s, i) => {
              const Icon = s.icon
              const isActive = i === activeStepIndex
              const isComplete = i < activeStepIndex
              return (
                <div key={s.label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className={`h-px w-6 ${isComplete ? 'bg-[var(--h-accent)]' : 'bg-border'}`} />
                  )}
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--h-accent-subtle)] text-[var(--h-text)]'
                        : isComplete
                          ? 'text-[var(--h-accent)]'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {isComplete ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                </div>
              )
            })}
          </nav>
        )}

        <div key={step} className="step-in">
          {step === 'invitations' && !loadingInvitations && (
            <InvitationsStep
              invitations={pendingInvitations}
              onAccepted={goToDashboard}
              onSkip={() => setStep('create-org')}
            />
          )}
          {step === 'create-org' && (
            <CreateOrgStep
              onCreated={(orgId) => {
                setCreatedOrgId(orgId)
                setStep('invite-team')
              }}
            />
          )}
          {step === 'invite-team' && createdOrgId && (
            <InviteTeamStep
              orgId={createdOrgId}
              onNext={() => setStep('create-project')}
            />
          )}
          {step === 'create-project' && (
            <CreateProjectStep
              onCreated={(project) => {
                setCreatedProject(project)
                setStep('paste-env')
              }}
            />
          )}
          {step === 'paste-env' && createdProject && createdOrgId && (
            <PasteEnvStep
              orgId={createdOrgId}
              project={createdProject}
              onNext={() => setStep('done')}
            />
          )}
          {step === 'done' && <DoneStep onGoToDashboard={goToDashboard} />}
        </div>
      </div>
    </main>
  )
}

function InvitationsStep({
  invitations,
  onAccepted,
  onSkip,
}: {
  invitations: { id: string; organizationName: string; role: string }[]
  onAccepted: () => void
  onSkip: () => void
}) {
  const [accepting, setAccepting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleAccept(invitationId: string) {
    setError('')
    setAccepting(invitationId)
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    })
    if (error) {
      setError(error.message ?? 'Failed to accept invitation')
      setAccepting(null)
      return
    }
    onAccepted()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">You've been invited</CardTitle>
        <CardDescription>
          Join an existing organization or create your own.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {invitations.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-[var(--h-accent-subtle)]">
                <Building2 className="size-4 text-[var(--h-accent)]" />
              </div>
              <div>
                <p className="text-sm font-medium">{inv.organizationName}</p>
                <Badge variant="secondary" className="mt-0.5 text-[10px]">
                  {inv.role}
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleAccept(inv.id)}
              disabled={accepting !== null}
            >
              {accepting === inv.id ? 'Joining...' : 'Join'}
            </Button>
          </div>
        ))}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button variant="outline" onClick={onSkip} className="w-full">
          Create a new organization
        </Button>
      </CardContent>
    </Card>
  )
}

function CreateOrgStep({
  onCreated,
}: {
  onCreated: (orgId: string) => void
}) {
  const [error, setError] = useState('')

  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      setError('')
      // The `slug` column is a Better Auth requirement (NOT NULL UNIQUE), but
      // it's an internal detail; users never see or edit it. Derive a unique,
      // opaque slug from nanoid so name collisions across orgs are impossible.
      const { data, error: createError } = await authClient.organization.create({
        name: value.name,
        slug: nanoid(16).toLowerCase(),
      })
      if (createError) {
        setError(createError.message ?? 'Failed to create organization')
        return
      }
      if (data?.id) {
        await authClient.organization.setActive({ organizationId: data.id })
        try {
          await seedOrgDek(data.id)
        } catch (e) {
          setError(
            e instanceof Error
              ? `Could not initialize encryption key: ${e.message}`
              : 'Could not initialize encryption key',
          )
          return
        }
        onCreated(data.id)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your organization</CardTitle>
        <CardDescription>
          This is where your team's projects and variables will live.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Acme Inc."
                  autoFocus
                />
              </div>
            )}
          </form.Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Creating...' : 'Create organization'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}

function InviteTeamStep({
  orgId,
  onNext,
}: {
  orgId: string
  onNext: () => void
}) {
  const MAX_INVITES = 5
  const [invites, setInvites] = useState([{ email: '', role: 'member' as const }])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(0)

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
        i === index ? { ...inv, [field]: value } : inv,
      ),
    )
  }

  async function handleSubmit() {
    const validInvites = invites.filter((inv) => inv.email.trim())
    if (validInvites.length === 0) {
      onNext()
      return
    }

    setError('')
    setSending(true)
    let successCount = 0

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
      successCount++
      setSent(successCount)
    }

    setSending(false)
    onNext()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Invite your team</CardTitle>
        <CardDescription>
          Add up to {MAX_INVITES} team members. You can always invite more later.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
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
                onValueChange={(value) => updateInvite(i, 'role', value)}
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
                  <X className="size-3" />
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

        {sending && sent > 0 && (
          <p className="text-xs text-muted-foreground">
            Sent {sent} of {invites.filter((inv) => inv.email.trim()).length} invitations...
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onNext}
            disabled={sending}
            className="flex-1"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={sending}
            className="flex-1"
          >
            {sending ? 'Sending...' : 'Send invites'}
            {!sending && <ArrowRight className="size-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateProjectStep({
  onCreated,
}: {
  onCreated: (project: CreatedProject) => void
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your first project</CardTitle>
        <CardDescription>
          A project groups environment variables across environments like dev, staging, and production.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
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
                <Label htmlFor="project-slug">Slug</Label>
                <Input
                  id="project-slug"
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

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Creating...' : 'Create project'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}

function PasteEnvStep({
  orgId,
  project,
  onNext,
}: {
  orgId: string
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
      const environment = project.environments.find(
        (e) => e.name === selectedEnv,
      )
      if (!environment) throw new Error(`Environment "${selectedEnv}" not found`)

      const wrap = await unwrapOrgDek(orgId)
      if (!wrap) {
        throw new Error('Vault is locked or org key is missing.')
      }
      try {
        const entries = await Promise.all(
          parsed.map(async (entry) => {
            const payload = await encryptVariableValue(
              environment.id,
              entry.key,
              entry.value,
              wrap.dek,
              wrap.dekVersion,
            )
            return {
              key: entry.key,
              ciphertext: payload.ciphertext,
              nonce: payload.nonce,
              dekVersion: payload.dekVersion,
            }
          }),
        )
        await pasteEncryptedVariablesFn({
          data: {
            projectId: project.id,
            environmentName: selectedEnv,
            entries,
          },
        })
        onNext()
      } finally {
        wrap.dek.fill(0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save variables')
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Add your environment variables</CardTitle>
        <CardDescription>
          Paste your <code>.env</code> file contents below. They'll be encrypted and stored securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="env-select">Environment</Label>
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
          <Label htmlFor="env-text">Variables</Label>
          <textarea
            id="env-text"
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder={`DATABASE_URL=postgres://...\nAPI_KEY=sk-...\nSECRET=my-secret`}
            rows={8}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        {parsed.length > 0 && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {parsed.length} variable{parsed.length !== 1 ? 's' : ''} detected
            </p>
            <div className="grid gap-1">
              {parsed.slice(0, 10).map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-medium">{entry.key}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="truncate font-mono text-muted-foreground">
                    {'*'.repeat(Math.min(entry.value.length, 20))}
                  </span>
                </div>
              ))}
              {parsed.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  ...and {parsed.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onNext}
            disabled={submitting}
            className="flex-1"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1"
          >
            {submitting
              ? 'Saving...'
              : envText.trim()
                ? 'Save variables'
                : 'Continue'}
            {!submitting && <ArrowRight className="size-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DoneStep({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <Check className="size-6 text-[var(--h-accent)]" />
        </div>
        <CardTitle className="text-xl">You're all set</CardTitle>
        <CardDescription>
          Your organization, project, and variables are ready. You can now manage
          everything from the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onGoToDashboard} className="w-full">
          Go to Dashboard
          <ArrowRight className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}
