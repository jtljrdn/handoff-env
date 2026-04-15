import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { Github } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { checkEmailFn } from '#/lib/server-fns/auth'
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

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const [step, setStep] = useState<'email' | 'otp' | 'onboarding'>('email')
  const [email, setEmail] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [error, setError] = useState('')

  function getRedirectPath(): string {
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      return redirectTo
    }
    return '/onboarding'
  }

  const emailForm = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setError('')

      const [checkResult, otpResult] = await Promise.all([
        checkEmailFn({ data: { email: value.email } }),
        authClient.emailOtp.sendVerificationOtp({
          email: value.email,
          type: 'sign-in',
        }),
      ])

      if (otpResult.error) {
        setError(otpResult.error.message ?? 'Failed to send code')
        return
      }

      setEmail(value.email)
      setIsNewUser(checkResult.isNewUser)
      setStep('otp')
    },
  })

  const otpForm = useForm({
    defaultValues: { otp: '' },
    onSubmit: async ({ value }) => {
      setError('')

      const { error: verifyError } = await authClient.signIn.emailOtp({
        email,
        otp: value.otp,
      })

      if (verifyError) {
        setError(verifyError.message ?? 'Invalid code')
        return
      }

      if (isNewUser) {
        setStep('onboarding')
      } else {
        router.navigate({ to: getRedirectPath() })
      }
    },
  })

  const onboardingForm = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      setError('')

      const { error: updateError } = await authClient.updateUser({
        name: value.name,
      })

      if (updateError) {
        setError(updateError.message ?? 'Failed to save name')
        return
      }

      router.navigate({ to: getRedirectPath() })
    },
  })

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <Card className="rise-in w-full max-w-sm overflow-hidden">
        <div key={step} className="step-in">
          {step === 'email' && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">First, what's your email?</CardTitle>
              </CardHeader>
              <CardContent className="mt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void emailForm.handleSubmit()
                  }}
                  className="grid gap-4"
                >
                  <emailForm.Field name="email">
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
                          autoFocus
                        />
                      </div>
                    )}
                  </emailForm.Field>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <emailForm.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? 'Sending code...' : 'Continue'}
                      </Button>
                    )}
                  </emailForm.Subscribe>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  <Github className="size-4" />
                  Continue with GitHub
                </Button>
              </CardContent>
            </>
          )}

          {step === 'otp' && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">
                  {isNewUser ? "Let's verify your email" : 'Welcome back'}
                </CardTitle>
                <CardDescription>
                  Enter the code we sent to{' '}
                  <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void otpForm.handleSubmit()
                  }}
                  className="grid gap-4"
                >
                  <otpForm.Field name="otp">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor="otp">Verification code</Label>
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          required
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Enter code"
                          autoFocus
                        />
                      </div>
                    )}
                  </otpForm.Field>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <otpForm.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? 'Verifying...' : 'Verify'}
                      </Button>
                    )}
                  </otpForm.Subscribe>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    otpForm.reset()
                    setError('')
                    setStep('email')
                  }}
                  className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Use a different email
                </button>
              </CardContent>
            </>
          )}

          {step === 'onboarding' && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Welcome to Handoff</CardTitle>
                <CardDescription>
                  What should we call you?
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void onboardingForm.handleSubmit()
                  }}
                  className="grid gap-4"
                >
                  <onboardingForm.Field name="name">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          type="text"
                          required
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Your name"
                          autoFocus
                        />
                      </div>
                    )}
                  </onboardingForm.Field>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <onboardingForm.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? 'Setting up...' : 'Continue'}
                      </Button>
                    )}
                  </onboardingForm.Subscribe>
                </form>
              </CardContent>
            </>
          )}
        </div>
      </Card>
    </main>
  )
}
