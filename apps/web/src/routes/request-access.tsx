import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { submitSignupRequestFn } from '#/lib/server-fns/signup-requests'
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

export const Route = createFileRoute('/request-access')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { email?: string } => ({
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: RequestAccessPage,
})

function RequestAccessPage() {
  const { email: prefilledEmail } = Route.useSearch()
  const [submitted, setSubmitted] = useState(false)

  const form = useForm({
    defaultValues: {
      email: prefilledEmail ?? '',
      name: '',
      reason: '',
    },
    onSubmit: async ({ value }) => {
      await submitSignupRequestFn({
        data: {
          email: value.email,
          name: value.name || undefined,
          reason: value.reason || undefined,
        },
      })
      setSubmitted(true)
    },
  })

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <Card className="rise-in w-full max-w-md overflow-hidden">
        {submitted ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Request received</CardTitle>
              <CardDescription>
                Thanks. If you're a fit, you'll get an invite email soon.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4">
              <Button variant="outline" className="w-full" asChild>
                <Link to="/">
                  <ArrowLeft className="size-4" />
                  Back home
                </Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Request access</CardTitle>
              <CardDescription>
                Handoff is currently invite-only. Tell us a bit about you and
                we'll be in touch.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void form.handleSubmit()
                }}
                className="grid gap-4"
              >
                <form.Field name="email">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="you@example.com"
                        autoFocus={!prefilledEmail}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="name">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name (optional)</Label>
                      <Input
                        id="name"
                        type="text"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="reason">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor="reason">
                        What would you use Handoff for? (optional)
                      </Label>
                      <textarea
                        id="reason"
                        rows={3}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="A team of 4, syncing prod and staging .env files..."
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? 'Sending...' : 'Request invite'}
                    </Button>
                  )}
                </form.Subscribe>
              </form>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  to="/sign-in"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  )
}
