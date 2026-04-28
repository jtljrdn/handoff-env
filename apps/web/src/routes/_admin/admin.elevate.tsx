import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { createServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { requirePlatformAdmin } from '#/lib/middleware/auth'
import {
  elevateOrg,
  revokeManualElevation,
  OrgNotFoundError,
} from '#/lib/billing/manual-elevation'
import { logger } from '#/lib/logger'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

const log = logger.child({ scope: 'admin.elevate' })

type ElevateInput = { target: string; months: number }
type RevokeInput = { target: string }

export const elevateOrgFn = createServerFn({ method: 'POST' })
  .inputValidator((input: ElevateInput) => input)
  .handler(async ({ data }) => {
    const admin = await requirePlatformAdmin()
    try {
      const result = await elevateOrg({
        target: data.target.trim(),
        months: data.months,
      })
      log.info('elevate.granted', {
        adminUserId: admin.userId,
        ...result,
        periodEnd: result.periodEnd.toISOString(),
      })
      return {
        ok: true as const,
        ...result,
        periodEnd: result.periodEnd.toISOString(),
      }
    } catch (err) {
      if (err instanceof OrgNotFoundError) {
        throw new Error(err.message)
      }
      throw err
    }
  })

export const revokeOrgElevationFn = createServerFn({ method: 'POST' })
  .inputValidator((input: RevokeInput) => input)
  .handler(async ({ data }) => {
    const admin = await requirePlatformAdmin()
    try {
      const result = await revokeManualElevation({ target: data.target.trim() })
      log.info('elevate.revoked', {
        adminUserId: admin.userId,
        ...result,
      })
      return { ok: true as const, ...result }
    } catch (err) {
      if (err instanceof OrgNotFoundError) {
        throw new Error(err.message)
      }
      throw err
    }
  })

export const Route = createFileRoute('/_admin/admin/elevate')({
  component: ElevatePage,
})

type LastResult =
  | {
      kind: 'granted'
      orgName: string
      orgSlug: string
      orgId: string
      periodEnd: string
      action: 'created' | 'extended'
    }
  | {
      kind: 'revoked'
      orgName: string
      orgSlug: string
      orgId: string
      revoked: number
    }

function ElevatePage() {
  const [lastResult, setLastResult] = useState<LastResult | null>(null)

  const elevateMut = useMutation({
    mutationFn: (input: ElevateInput) => elevateOrgFn({ data: input }),
    onSuccess: (result) => {
      toast.success(
        `${result.action === 'extended' ? 'Extended' : 'Granted'} Team for ${result.orgName}`,
        {
          description: `Expires ${new Date(result.periodEnd).toLocaleDateString()}`,
        },
      )
      setLastResult({
        kind: 'granted',
        orgName: result.orgName,
        orgSlug: result.orgSlug,
        orgId: result.orgId,
        periodEnd: result.periodEnd,
        action: result.action,
      })
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to elevate'),
  })

  const revokeMut = useMutation({
    mutationFn: (input: RevokeInput) => revokeOrgElevationFn({ data: input }),
    onSuccess: (result) => {
      toast.success(`Revoked manual elevation for ${result.orgName}`, {
        description: `Removed ${result.revoked} subscription row(s)`,
      })
      setLastResult({
        kind: 'revoked',
        orgName: result.orgName,
        orgSlug: result.orgSlug,
        orgId: result.orgId,
        revoked: result.revoked,
      })
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to revoke'),
  })

  const form = useForm({
    defaultValues: { target: '', months: 12 },
    onSubmit: async ({ value }) => {
      await elevateMut.mutateAsync({
        target: value.target,
        months: Number(value.months),
      })
    },
  })

  const busy = elevateMut.isPending || revokeMut.isPending

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Elevate organization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manually grant or revoke Team-tier access. Mirrors{' '}
          <code className="font-mono text-xs">scripts/elevate-org.ts</code>.
          Real Stripe subscriptions are never touched.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grant Team access</CardTitle>
          <CardDescription>
            Writes a manual subscription row tagged with{' '}
            <code className="font-mono">manual_&lt;orgId&gt;</code>. Re-running
            extends the existing grant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
          >
            <form.Field name="target">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor="elevate-target">Org id or slug</Label>
                  <Input
                    id="elevate-target"
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="acme or org_abc123"
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="months">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor="elevate-months">Months</Label>
                  <Input
                    id="elevate-months"
                    type="number"
                    min={1}
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                  />
                </div>
              )}
            </form.Field>
            <Button type="submit" disabled={busy}>
              {elevateMut.isPending ? 'Granting...' : 'Grant'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revoke manual access</CardTitle>
          <CardDescription>
            Deletes only rows tagged{' '}
            <code className="font-mono">manual_%</code>. Trial rows and real
            Stripe subscriptions are untouched.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevokeForm
            onSubmit={(target) => revokeMut.mutate({ target })}
            disabled={busy}
            pending={revokeMut.isPending}
          />
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-[var(--h-surface)] p-3 font-mono text-xs">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RevokeForm({
  onSubmit,
  disabled,
  pending,
}: {
  onSubmit: (target: string) => void
  disabled: boolean
  pending: boolean
}) {
  const [target, setTarget] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (target.trim()) onSubmit(target.trim())
      }}
      className="grid gap-3 sm:grid-cols-[2fr_auto] sm:items-end"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="revoke-target">Org id or slug</Label>
        <Input
          id="revoke-target"
          required
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="acme or org_abc123"
        />
      </div>
      <Button type="submit" variant="outline" disabled={disabled}>
        {pending ? 'Revoking...' : 'Revoke'}
      </Button>
    </form>
  )
}
