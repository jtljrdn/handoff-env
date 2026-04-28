import {
  createFileRoute,
  redirect,
  useRouter,
  Link,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  Camera,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  LogOut,
  MoreHorizontal,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { getAuthContextFn } from '#/lib/server-fns/auth'
import { getTrialStatusFn } from '#/lib/server-fns/trial'
import {
  deleteOrganizationFn,
  getOrgSettingsFn,
  leaveOrgFn,
  removeMemberFn,
  removeOrgLogoFn,
  transferOwnershipFn,
  updateMemberRoleFn,
  updateOrgDetailsFn,
  uploadOrgLogoFn,
} from '#/lib/server-fns/organization'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { InviteModal } from '#/components/org/InviteModal'
import type { OrgRole } from '@handoff-env/types'
import { OrgLogo } from '#/components/org/OrgLogo'
import { grantPendingWrap, rotateOrgDek } from '#/lib/vault/org'
import { getRotationStatusFn } from '#/lib/server-fns/org-vault'
import { useVault } from '#/lib/vault/store'
import { KeyRound } from 'lucide-react'

type OrgData = Awaited<ReturnType<typeof getOrgSettingsFn>>
type MemberRow = OrgData['members'][number]

export const Route = createFileRoute('/_authed/organization')({
  beforeLoad: async ({ context }) => {
    const authCtx = await context.queryClient.ensureQueryData({
      queryKey: ['auth-context'],
      queryFn: () => getAuthContextFn(),
      staleTime: 60_000,
    })
    if (!authCtx.onboardingStatus.hasOrganization) {
      throw redirect({ to: '/onboarding' })
    }
  },
  loader: async ({ context }) => {
    try {
      return {
        forbidden: false as const,
        data: await context.queryClient.fetchQuery({
          queryKey: ['org-settings'],
          queryFn: () => getOrgSettingsFn(),
        }),
      }
    } catch (err) {
      if (err instanceof Response && err.status === 403) {
        return { forbidden: true as const, data: null }
      }
      throw err
    }
  },
  staleTime: 0,
  shouldReload: true,
  component: OrganizationPage,
})

function OrganizationPage() {
  const result = Route.useLoaderData()
  if (result.forbidden) return <NoAccess />
  return <OrgContent data={result.data!} />
}

function NoAccess() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="rise-in rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-10 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <Shield className="size-5 text-[var(--h-accent)]" />
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--h-text)]">
          Admins & owners only
        </h2>
        <p className="mt-2 text-sm text-[var(--h-text-2)]">
          Organization settings are visible to admins and the owner. Ask your
          owner or an admin for changes to the organization.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

function OrgContent({ data }: { data: OrgData }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isOwner = data.currentUserRole === 'owner'
  const [showInvite, setShowInvite] = useState(false)

  async function refresh() {
    // Invalidate the org-settings query FIRST so the loader's fetchQuery on
    // re-run gets fresh data (not an "unexpired" cache hit), then fan out to
    // everything else the org powers.
    await queryClient.invalidateQueries({ queryKey: ['org-settings'] })
    await Promise.all([
      router.invalidate(),
      queryClient.invalidateQueries({ queryKey: ['sidebar-data'] }),
      queryClient.invalidateQueries({ queryKey: ['auth-context'] }),
      queryClient.invalidateQueries({ queryKey: ['organizations'] }),
    ])
  }

  const activeCount = data.usage.members + data.usage.pendingInvitations
  const ownerCount = data.members.filter((m) => m.role === 'owner').length
  const { data: trialStatus } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => getTrialStatusFn(),
    staleTime: 5 * 60 * 1000,
  })
  const trialDaysLeft =
    trialStatus?.status === 'trialing' ? trialStatus.daysLeft : null

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rise-in space-y-10">
        <HeaderStrip
          org={data.org}
          plan={data.plan}
          memberCount={data.usage.members}
          pendingCount={data.usage.pendingInvitations}
          isOwner={isOwner}
        />

        <RotationBanner
          orgId={data.org.id}
          currentUserRole={data.currentUserRole}
          onComplete={refresh}
        />

        <DetailsSection org={data.org} onSaved={refresh} />

        <section>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--h-text)]">
                Members
              </h2>
              <p className="mt-0.5 text-sm text-[var(--h-text-2)]">
                {data.usage.members} member{data.usage.members === 1 ? '' : 's'}
                {data.usage.pendingInvitations > 0 &&
                  ` · ${data.usage.pendingInvitations} pending`}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="size-3.5" />
              Invite
            </Button>
          </div>

          <MembersTable
            members={data.members}
            currentUserId={data.currentUserId}
            currentUserRole={data.currentUserRole}
            orgId={data.org.id}
            orgName={data.org.name}
            onChange={refresh}
          />
        </section>

        {data.invitations.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--h-text)]">
              Pending invitations
            </h2>
            <p className="mt-0.5 text-sm text-[var(--h-text-2)]">
              Invitations expire after 7 days.
            </p>
            <InvitationsList
              invitations={data.invitations}
              onChange={refresh}
            />
          </section>
        )}

        <PlanSummary
          plan={data.plan}
          activeCount={activeCount}
          includedSeats={data.includedSeats}
          isOwner={isOwner}
          trialDaysLeft={trialDaysLeft}
        />

        {isOwner && (
          <DangerZone
            orgName={data.org.name}
            members={data.members}
            currentUserId={data.currentUserId}
          />
        )}

        <InviteModal
          orgId={data.org.id}
          currentUserRole={data.currentUserRole}
          open={showInvite}
          onOpenChange={(v) => {
            setShowInvite(v)
            if (!v) refresh()
          }}
        />

        <LeaveOrgButton
          currentUserRole={data.currentUserRole}
          ownerCount={ownerCount}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rotation banner: auto-runs DEK rotation when the org has a pending rotation
// (queued by afterRemoveMember) and the viewer is an admin/owner with an
// unlocked vault.
// ---------------------------------------------------------------------------
type RotationUiState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'error'; message: string }

function RotationBanner({
  orgId,
  currentUserRole,
  onComplete,
}: {
  orgId: string
  currentUserRole: OrgRole
  onComplete: () => Promise<void>
}) {
  const unlocked = useVault()
  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'

  const { data: status, refetch } = useQuery({
    queryKey: ['rotation-status', orgId],
    queryFn: () => getRotationStatusFn({ data: { orgId } }),
    enabled: isAdmin,
    staleTime: 0,
  })

  const [uiState, setUiState] = useState<RotationUiState>({ status: 'idle' })
  const runningRef = useRef(false)

  useEffect(() => {
    if (!status?.pending) return
    if (!unlocked || !isAdmin) return
    if (runningRef.current) return
    runningRef.current = true

    setUiState({ status: 'running', done: 0, total: 0 })
    rotateOrgDek(orgId, (done, total) => {
      setUiState({ status: 'running', done, total })
    })
      .then(async (result) => {
        runningRef.current = false
        if (result.rotated) {
          toast.success(
            `Key rotation complete. Re-encrypted ${result.variableCount} variable${result.variableCount === 1 ? '' : 's'}.`,
          )
          setUiState({ status: 'idle' })
          await onComplete()
          await refetch()
        } else {
          setUiState({ status: 'idle' })
        }
      })
      .catch((err: unknown) => {
        runningRef.current = false
        const message =
          err instanceof Error ? err.message : 'Key rotation failed.'
        setUiState({ status: 'error', message })
        toast.error(message)
      })
  }, [status, unlocked, isAdmin, orgId, onComplete, refetch])

  if (!isAdmin || !status?.pending) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--h-border)] bg-[var(--h-accent-subtle)] p-4">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent)]/15 text-[var(--h-accent)]">
        {uiState.status === 'running' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
      </div>
      <div className="flex-1 text-sm">
        <p className="font-medium text-[var(--h-text)]">
          Securing keys after member removal
        </p>
        <p className="mt-1 text-[var(--h-text-2)]">
          {uiState.status === 'running' && uiState.total > 0
            ? `Re-encrypting variables (${uiState.done} of ${uiState.total})...`
            : uiState.status === 'running'
              ? 'Starting rotation...'
              : uiState.status === 'error'
                ? `Rotation failed: ${uiState.message}. Refresh to retry.`
                : !unlocked
                  ? 'Unlock your vault to complete the rotation. Removed members cannot access new data, but the org key still needs to be rotated.'
                  : 'Rotation will start automatically. This re-encrypts every variable with a new key and invalidates all CLI tokens.'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header strip: logo + name + plan + member count
// ---------------------------------------------------------------------------
function HeaderStrip({
  org,
  plan,
  memberCount,
  pendingCount,
  isOwner,
}: {
  org: OrgData['org']
  plan: 'free' | 'team'
  memberCount: number
  pendingCount: number
  isOwner: boolean
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <OrgLogo logo={org.logo} name={org.name} size="lg" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
              {org.name}
            </h1>
            <Badge variant={plan === 'team' ? 'default' : 'secondary'}>
              {plan === 'team' ? 'Team' : 'Free'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[var(--h-text-3)]">Org ID: <span className="font-mono">{org.id}</span></p>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--h-text-3)]">
            <Users className="size-3" />
            <span>
              {memberCount} member{memberCount === 1 ? '' : 's'}
              {pendingCount > 0 && ` (${pendingCount} pending)`}
            </span>
          </p>
        </div>
      </div>
      {isOwner && (
        <Button asChild size="sm" variant="outline">
          <Link to="/billing">
            <CreditCard className="size-3.5" />
            Manage billing
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      )}
    </div>
  )
}

function DetailsSection({
  org,
  onSaved,
}: {
  org: OrgData['org']
  onSaved: () => Promise<void>
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const logoBusy = uploading || removing

  const form = useForm({
    defaultValues: { name: org.name },
    onSubmit: async ({ value }) => {
      try {
        await updateOrgDetailsFn({ data: { name: value.name } })
        await onSaved()
        toast.success('Saved')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to save')
      }
    },
  })

  async function handleLogoFile(file: File) {
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(
        file.type,
      )
    ) {
      toast.error('Use a PNG, JPG, WebP, or SVG image.')
      return
    }
    if (file.size > 1_048_576) {
      toast.error('Logo must be 1 MB or smaller.')
      return
    }
    setUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      await uploadOrgLogoFn({
        data: { dataUrl, mimeType: file.type, sizeBytes: file.size },
      })
      await onSaved()
      toast.success('Logo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function removeLogo() {
    setRemoving(true)
    try {
      await removeOrgLogoFn()
      await onSaved()
      toast.success('Logo removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove logo')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section>
      <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--h-text)]">
        Details
      </h2>

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr]">
        {/* Logo uploader */}
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={logoBusy}
            aria-busy={logoBusy}
            aria-label={
              uploading
                ? 'Uploading logo'
                : removing
                  ? 'Removing logo'
                  : 'Change logo'
            }
            className="group relative disabled:cursor-not-allowed"
            title={
              uploading ? 'Uploading…' : removing ? 'Removing…' : 'Change logo'
            }
          >
            <OrgLogo logo={org.logo} name={org.name} size="lg" />
            <span
              className={`absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 transition-opacity ${
                logoBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {logoBusy ? (
                <Loader2 className="size-5 animate-spin text-white" />
              ) : (
                <Camera className="size-5 text-white" />
              )}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleLogoFile(file)
              e.target.value = ''
            }}
          />
          {org.logo && (
            <button
              type="button"
              onClick={removeLogo}
              disabled={logoBusy}
              className="inline-flex items-center gap-1 text-xs text-[var(--h-text-3)] hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-[var(--h-text-3)]"
            >
              {removing && <Loader2 className="size-3 animate-spin" />}
              {removing ? 'Removing…' : 'Remove logo'}
            </button>
          )}
        </div>

        {/* Name + slug form */}
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
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => [s.isSubmitting, s.isDirty] as const}
          >
            {([isSubmitting, isDirty]) => (
              <div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !isDirty}
                >
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Members table
// ---------------------------------------------------------------------------
function MembersTable({
  members,
  currentUserId,
  currentUserRole,
  orgId,
  orgName,
  onChange,
}: {
  members: MemberRow[]
  currentUserId: string
  currentUserRole: OrgRole
  orgId: string
  orgName: string
  onChange: () => Promise<void>
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--h-border)]">
      <div className="divide-y divide-[var(--h-border)]">
        {members.map((m) => (
          <MemberRowUI
            key={m.id}
            member={m}
            isSelf={m.userId === currentUserId}
            callerRole={currentUserRole}
            orgId={orgId}
            orgName={orgName}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  )
}

function MemberRowUI({
  member,
  isSelf,
  callerRole,
  orgId,
  orgName,
  onChange,
}: {
  member: MemberRow
  isSelf: boolean
  callerRole: OrgRole
  orgId: string
  orgName: string
  onChange: () => Promise<void>
}) {
  const vault = useVault()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [transferFor, setTransferFor] = useState<MemberRow | null>(null)
  const [removing, setRemoving] = useState(false)
  const [roleChanging, setRoleChanging] = useState(false)
  const [granting, setGranting] = useState(false)
  const isOwnerCaller = callerRole === 'owner'
  const canActOnThis = !isSelf && (member.role !== 'owner' || isOwnerCaller)
  const canGrantAccess =
    (callerRole === 'owner' || callerRole === 'admin') &&
    !isSelf &&
    member.pendingWrap &&
    member.publicKey !== null
  const rowBusy = removing || roleChanging || granting

  async function grantAccess() {
    if (!member.publicKey) return
    if (!vault) {
      toast.error('Unlock your vault to grant access.')
      return
    }
    setGranting(true)
    try {
      await grantPendingWrap({
        orgId,
        targetUserId: member.userId,
        targetPublicKey: member.publicKey,
      })
      toast.success(`${member.email} can now read secrets`)
      await onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to grant access')
    } finally {
      setGranting(false)
    }
  }

  async function changeRole(next: OrgRole) {
    if (next === member.role) return
    setRoleChanging(true)
    try {
      await updateMemberRoleFn({ data: { memberId: member.id, role: next } })
      await onChange()
      toast.success(`Role updated to ${next}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setRoleChanging(false)
    }
  }

  async function remove() {
    if (removing) return
    setRemoving(true)
    try {
      await removeMemberFn({ data: { memberId: member.id } })
      // Close dialog BEFORE onChange so the row unmounts cleanly; if onChange
      // throws (unlikely; it only invalidates caches) the member is still
      // gone server-side, which matches what the toast says.
      setConfirmRemove(false)
      toast.success(`${member.email} removed`)
      await onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove member')
    } finally {
      setRemoving(false)
    }
  }

  const displayName = member.name || member.email.split('@')[0]

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] text-sm font-medium text-[var(--h-text)]">
        {member.image ? (
          <img
            src={member.image}
            alt={displayName}
            className="size-full rounded-full object-cover"
          />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--h-text)]">
          {displayName}
          {isSelf && (
            <span className="ml-2 text-xs font-normal text-[var(--h-text-3)]">
              (you)
            </span>
          )}
        </p>
        <p className="truncate text-xs text-[var(--h-text-3)]">
          {member.email}
        </p>
      </div>

      {/* Pending access */}
      {member.pendingWrap && (
        <div className="flex shrink-0 items-center gap-2">
          {member.publicKey === null ? (
            <Badge variant="secondary" className="text-[10px]">
              Waiting for vault setup
            </Badge>
          ) : (
            <>
              <Badge variant="secondary" className="text-[10px]">
                Pending access
              </Badge>
              {canGrantAccess && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={grantAccess}
                  disabled={rowBusy || !vault}
                  title={vault ? undefined : 'Unlock your vault to grant access'}
                >
                  {granting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Granting…
                    </>
                  ) : (
                    'Grant access'
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Role */}
      <div className="flex shrink-0 items-center gap-1.5">
        {roleChanging && (
          <Loader2
            aria-label="Updating role"
            className="size-3.5 animate-spin text-[var(--h-text-3)]"
          />
        )}
        {canActOnThis ? (
          <Select
            value={member.role}
            onValueChange={(v) => changeRole(v as OrgRole)}
            disabled={rowBusy}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              {isOwnerCaller && <SelectItem value="owner">Owner</SelectItem>}
            </SelectContent>
          </Select>
        ) : (
          <RoleBadge role={member.role} />
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {canActOnThis ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" disabled={rowBusy}>
                {removing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isOwnerCaller && member.role !== 'owner' && (
                <DropdownMenuItem onClick={() => setTransferFor(member)}>
                  <Crown className="size-4" />
                  Transfer ownership
                </DropdownMenuItem>
              )}
              {isOwnerCaller && member.role !== 'owner' && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                onClick={() => setConfirmRemove(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Remove from org
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="inline-block size-8" />
        )}
      </div>

      <AlertDialog
        open={confirmRemove}
        onOpenChange={(v) => {
          // Block close-via-Escape / click-outside while the mutation is in
          // flight so the user doesn't lose the progress indicator.
          if (removing && !v) return
          setConfirmRemove(v)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to all projects in this organization
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            {/* Plain Button instead of AlertDialogAction so Radix doesn't
                auto-close the dialog on click before the mutation settles. */}
            <Button
              variant="destructive"
              onClick={remove}
              disabled={removing}
            >
              {removing && <Loader2 className="size-3.5 animate-spin" />}
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransferOwnershipDialog
        target={transferFor}
        orgName={orgName}
        onClose={() => setTransferFor(null)}
        onDone={async () => {
          setTransferFor(null)
          await onChange()
        }}
      />
    </div>
  )
}

function RoleBadge({ role }: { role: OrgRole }) {
  if (role === 'owner') {
    return (
      <Badge variant="default" className="gap-1">
        <Crown className="size-3" />
        Owner
      </Badge>
    )
  }
  if (role === 'admin') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Shield className="size-3" />
        Admin
      </Badge>
    )
  }
  return <Badge variant="outline">Member</Badge>
}

// ---------------------------------------------------------------------------
// Invitations list
// ---------------------------------------------------------------------------
function InvitationsList({
  invitations,
  onChange,
}: {
  invitations: OrgData['invitations']
  onChange: () => Promise<void>
}) {
  // Track the set of in-flight invitation IDs so two rows can cancel in
  // parallel without freezing each other's buttons.
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set())

  async function cancel(id: string, email: string) {
    if (cancelingIds.has(id)) return
    setCancelingIds((prev) => new Set(prev).add(id))
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId: id,
      })
      if (error) throw new Error(error.message ?? 'Failed to cancel')
      toast.success(`Invitation to ${email} canceled`)
      await onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setCancelingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--h-border)] divide-y divide-[var(--h-border)]">
      {invitations.map((inv) => {
        const busy = cancelingIds.has(inv.id)
        return (
          <div
            key={inv.id}
            className="flex items-center gap-4 px-4 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[var(--h-text)]">
                {inv.email}
              </p>
              <p className="mt-0.5 text-xs text-[var(--h-text-3)]">
                Invited as {inv.role}
                {inv.inviterEmail && ` by ${inv.inviterEmail}`} · expires{' '}
                {new Date(inv.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => cancel(inv.id, inv.email)}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              {busy ? 'Canceling…' : 'Cancel'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan summary
// ---------------------------------------------------------------------------
function PlanSummary({
  plan,
  activeCount,
  includedSeats,
  isOwner,
  trialDaysLeft,
}: {
  plan: 'free' | 'team'
  activeCount: number
  includedSeats: number
  isOwner: boolean
  trialDaysLeft: number | null
}) {
  const isTeam = plan === 'team'
  const isTrialing = trialDaysLeft !== null && trialDaysLeft > 0
  return (
    <section className="rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
            Current plan
          </p>
          <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
            {isTeam ? 'Team' : 'Free'}
            {isTrialing && (
              <Badge variant="outline" className="text-xs font-normal">
                Trial · {trialDaysLeft}d left
              </Badge>
            )}
          </p>
          <p className="mt-1 text-sm text-[var(--h-text-2)]">
            {isTeam
              ? `${activeCount} / ${includedSeats}+ seats used`
              : `${activeCount} members (upgrade for unlimited)`}
          </p>
        </div>
        {isOwner && (
          <Button
            asChild
            size="sm"
            variant={isTeam && !isTrialing ? 'outline' : 'default'}
          >
            <Link to="/billing">
              {isTrialing
                ? 'Add payment method'
                : isTeam
                  ? 'Manage billing'
                  : 'Upgrade to Team'}
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Danger zone (owner only)
// ---------------------------------------------------------------------------
function DangerZone({
  orgName,
  members,
  currentUserId,
}: {
  orgName: string
  members: MemberRow[]
  currentUserId: string
}) {
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const transferableMembers = members.filter(
    (m) => m.userId !== currentUserId && m.role !== 'owner',
  )

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/[0.03] p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight text-destructive">
        Danger zone
      </h2>
      <p className="mt-0.5 text-sm text-[var(--h-text-2)]">
        Actions here are permanent. Double-check before confirming.
      </p>

      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--h-text)]">
              Transfer ownership
            </p>
            <p className="text-sm text-[var(--h-text-2)]">
              Hand the org over to another member. You become an admin.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={transferableMembers.length === 0}
            onClick={() => setShowTransfer(true)}
            title={
              transferableMembers.length === 0
                ? 'Invite another member first.'
                : undefined
            }
          >
            <Crown className="size-3.5" />
            Transfer
          </Button>
        </div>
        <div className="h-px bg-destructive/20" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--h-text)]">
              Delete organization
            </p>
            <p className="text-sm text-[var(--h-text-2)]">
              Permanently deletes projects, variables, members, and cancels the
              subscription.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <TransferOwnershipChooser
        open={showTransfer}
        onOpenChange={setShowTransfer}
        members={transferableMembers}
        orgName={orgName}
      />

      <DeleteOrgDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        orgName={orgName}
      />
    </section>
  )
}

function TransferOwnershipChooser({
  open,
  onOpenChange,
  members,
  orgName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  members: MemberRow[]
  orgName: string
}) {
  const [selected, setSelected] = useState<MemberRow | null>(null)

  return (
    <>
      <Dialog
        open={open && !selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
          onOpenChange(v)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              Pick the member who should become the new owner.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-[var(--h-border)] divide-y divide-[var(--h-border)]">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--h-surface)]"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] text-xs font-medium text-[var(--h-text)]">
                  {(m.name || m.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--h-text)]">
                    {m.name || m.email}
                  </p>
                  <p className="truncate text-xs text-[var(--h-text-3)]">
                    {m.email} · {m.role}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <TransferOwnershipDialog
        target={selected}
        orgName={orgName}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null)
          onOpenChange(false)
        }}
      />
    </>
  )
}

const TRANSFER_PHRASE = 'transfer ownership'

function TransferOwnershipDialog({
  target,
  orgName,
  onClose,
  onDone,
}: {
  target: MemberRow | null
  orgName: string
  onClose: () => void
  onDone: () => void | Promise<void>
}) {
  const [confirmName, setConfirmName] = useState('')
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  const nameMatches = confirmName === orgName
  const phraseMatches = confirmPhrase.trim().toLowerCase() === TRANSFER_PHRASE

  function reset() {
    setConfirmName('')
    setConfirmPhrase('')
  }

  async function handle() {
    if (!target) return
    if (!nameMatches || !phraseMatches) return
    if (busy) return
    setBusy(true)
    try {
      await transferOwnershipFn({
        data: {
          memberId: target.id,
          confirmationName: orgName,
          confirmationPhrase: TRANSFER_PHRASE,
        },
      })
      toast.success(`Ownership transferred to ${target.email}`)
      reset()
      await onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed')
      // Keep the dialog open and inputs intact so the user can retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(v) => {
        // Ignore Escape / outside clicks while the mutation is in flight.
        if (busy && !v) return
        if (!v) {
          reset()
          onClose()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer ownership</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{target?.email}</span>{' '}
            will become the owner, and you will be demoted to admin. Only the
            new owner can manage billing and delete the organization.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="transfer-confirm-name">
              Type the organization name{' '}
              <span className="font-medium text-foreground">{orgName}</span>
            </Label>
            <Input
              id="transfer-confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={orgName}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transfer-confirm-phrase">
              Then type{' '}
              <span className="font-mono font-medium text-foreground">
                {TRANSFER_PHRASE}
              </span>
            </Label>
            <Input
              id="transfer-confirm-phrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={TRANSFER_PHRASE}
              className="font-mono"
              disabled={busy}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            onClick={handle}
            disabled={busy || !nameMatches || !phraseMatches}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Transferring…' : 'Transfer ownership'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const DELETE_PHRASE = 'delete organization'

function DeleteOrgDialog({
  open,
  onOpenChange,
  orgName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgName: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirmName, setConfirmName] = useState('')
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  const nameMatches = confirmName === orgName
  const phraseMatches = confirmPhrase.trim().toLowerCase() === DELETE_PHRASE

  function reset() {
    setConfirmName('')
    setConfirmPhrase('')
  }

  async function handle() {
    if (!nameMatches || !phraseMatches) return
    if (busy) return
    setBusy(true)
    try {
      await deleteOrganizationFn({
        data: {
          confirmationName: orgName,
          confirmationPhrase: DELETE_PHRASE,
        },
      })
      // Note: we intentionally don't clear `busy` on success. The dialog
      // stays in its "Deleting…" state until the navigation happens, which
      // prevents a flash of the enabled button between the mutation and
      // the route change.
      await queryClient.invalidateQueries()
      toast.success('Organization deleted')
      router.navigate({ to: '/dashboard' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (busy && !v) return
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete organization</AlertDialogTitle>
          <AlertDialogDescription>
            Every project, environment, variable, API token, and member record
            in this organization will be permanently deleted. Any active Stripe
            subscription will be canceled. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm-name">
              Type the organization name{' '}
              <span className="font-medium text-foreground">{orgName}</span>
            </Label>
            <Input
              id="delete-confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={orgName}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm-phrase">
              Then type{' '}
              <span className="font-mono font-medium text-foreground">
                {DELETE_PHRASE}
              </span>
            </Label>
            <Input
              id="delete-confirm-phrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={DELETE_PHRASE}
              className="font-mono"
              disabled={busy}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handle}
            disabled={busy || !nameMatches || !phraseMatches}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Deleting…' : 'Delete organization'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function LeaveOrgButton({
  currentUserRole,
  ownerCount,
}: {
  currentUserRole: OrgRole
  ownerCount: number
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const blocked = currentUserRole === 'owner' && ownerCount <= 1

  async function leave() {
    if (busy) return
    setBusy(true)
    try {
      await leaveOrgFn()
      // Keep `busy` true through the navigation (see DeleteOrgDialog for the
      // same pattern) so the button doesn't flash enabled before the route
      // changes.
      await queryClient.invalidateQueries()
      toast.success('You left the organization')
      router.navigate({ to: '/dashboard' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to leave')
      setBusy(false)
      // Keep the dialog open so the user sees the toast in context and can
      // retry; closing would bury the error and reset their intent.
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/40 p-4">
        <div>
          <p className="text-sm font-medium text-[var(--h-text)]">
            Leave organization
          </p>
          <p className="text-sm text-[var(--h-text-2)]">
            {blocked
              ? 'Transfer ownership before leaving.'
              : 'You will lose access to all projects and variables.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={blocked}
          onClick={() => setOpen(true)}
        >
          <LogOut className="size-3.5" />
          Leave
        </Button>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (busy && !v) return
          setOpen(v)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this organization?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed as a member and lose access to all of its
              projects. You can be re-invited later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={leave} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {busy ? 'Leaving…' : 'Leave'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
