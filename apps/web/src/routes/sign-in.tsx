import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { createResendContactFn } from '#/lib/server-fns/auth'
import { submitSignupRequestFn } from '#/lib/server-fns/signup-requests'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '#/components/ui/input-otp'
import { CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Logo } from '#/components/Logo.tsx'
import { FlutedShader } from '#/components/fluted-shader.tsx'

export const Route = createFileRoute('/sign-in')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; invited?: string; error?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    invited: typeof search.invited === 'string' ? search.invited : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: SignInPage,
})

type Step =
  | 'email'
  | 'otp'
  | 'onboarding'
  | 'not-invited'
  | 'request-access'
  | 'request-sent'

const EASE = [0.16, 1, 0.3, 1] as const

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -20 : 20 }),
}

// Height-animated, directional wizard shell. Only one step is mounted at a
// time (mode="wait"), so a callback ref can safely measure the active step.
function AuthWizard({
  stepKey,
  direction,
  children,
}: {
  stepKey: string
  direction: number
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const roRef = useRef<ResizeObserver | null>(null)

  const measure = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!el) return
    setHeight(el.offsetHeight)
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    roRef.current = ro
  }, [])

  return (
    <motion.div
      className="relative"
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE }}
    >
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        <motion.div
          key={stepKey}
          ref={measure}
          custom={direction}
          variants={reduce ? undefined : slideVariants}
          initial={reduce ? false : 'enter'}
          animate={reduce ? { opacity: 1 } : 'center'}
          exit={reduce ? { opacity: 0 } : 'exit'}
          transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  )
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </button>
  )
}

function SignInPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { redirect: redirectTo, invited, error: errorParam } = Route.useSearch()
  const [step, setStep] = useState<Step>('email')
  const [direction, setDirection] = useState(1)
  const [email, setEmail] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [resendNonce, setResendNonce] = useState(0)
  const [error, setError] = useState(
    errorParam === 'INVITE_REQUIRED'
      ? 'This email is not invited. Request access below.'
      : '',
  )

  const go = useCallback((next: Step, dir = 1) => {
    setError('')
    setDirection(dir)
    setStep(next)
  }, [])

  // Resend cooldown: 30s countdown while on the OTP step, restarts on resend.
  useEffect(() => {
    if (step !== 'otp') return
    setResendIn(30)
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [step, resendNonce])

  function getRedirectPath(): string {
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      return redirectTo
    }
    return '/onboarding'
  }

  // The _authed guard reads the session from the cached ['auth-context'] query;
  // drop it so the guard refetches with the new session instead of a stale miss.
  async function completeSignIn() {
    queryClient.removeQueries({ queryKey: ['auth-context'] })
    queryClient.removeQueries({ queryKey: ['vault-status'] })
    await router.navigate({ to: getRedirectPath() })
  }

  const emailForm = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setError('')
      const otpResult = await authClient.emailOtp.sendVerificationOtp({
        email: value.email,
        type: 'sign-in',
      })
      if (otpResult.error) {
        setError(otpResult.error.message ?? 'Failed to send code')
        return
      }
      setEmail(value.email)
      go('otp', 1)
    },
  })

  const otpForm = useForm({
    defaultValues: { otp: '' },
    onSubmit: async ({ value }) => {
      setError('')
      const { data, error: verifyError } = await authClient.signIn.emailOtp({
        email,
        otp: value.otp,
      })
      if (verifyError) {
        if (verifyError.code === 'INVITE_REQUIRED') {
          go('not-invited', 1)
          return
        }
        setError(verifyError.message ?? 'Invalid code')
        otpForm.setFieldValue('otp', '')
        return
      }
      if (!data?.user?.name) {
        go('onboarding', 1)
      } else {
        await completeSignIn()
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
      await createResendContactFn({ data: { name: value.name } }).catch((err) => {
        console.error('[Handoff] createResendContactFn failed:', err)
      })
      await completeSignIn()
    },
  })

  const requestForm = useForm({
    defaultValues: { name: '', reason: '' },
    onSubmit: async ({ value }) => {
      setError('')
      try {
        await submitSignupRequestFn({
          data: {
            email,
            name: value.name || undefined,
            reason: value.reason || undefined,
          },
        })
      } catch {
        setError('Something went wrong. Please try again.')
        return
      }
      go('request-sent', 1)
    },
  })

  const resendOtp = async () => {
    if (resendIn > 0) return
    setError('')
    const r = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    })
    if (r.error) {
      setError(r.error.message ?? 'Failed to resend code')
      return
    }
    otpForm.reset()
    setResendNonce((n) => n + 1)
  }

  const backToEmail = () => {
    emailForm.reset()
    otpForm.reset()
    go('email', -1)
  }

  const signInWithGitHub = async () => {
    const { error: ghError } = await authClient.signIn.social({
      provider: 'github',
      errorCallbackURL: '/sign-in?error=INVITE_REQUIRED',
    })
    if (ghError) {
      setError(
        ghError.code === 'INVITE_REQUIRED'
          ? 'This email is not invited. Request access below.'
          : (ghError.message ?? 'Failed to sign in with GitHub'),
      )
      return
    }
    await completeSignIn()
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[2fr_3fr]">
      <div className="relative flex flex-col px-8 py-9 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(80%_100%_at_50%_0%,var(--h-accent-subtle),transparent)] lg:hidden"
        />
        <Link to="/" className="relative w-fit">
          <Logo />
        </Link>
        <div className="relative flex flex-1 items-center">
          <div className="rise-in w-full max-w-sm">
            <AuthWizard stepKey={step} direction={direction}>
              {step === 'email' && (
                <>
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl">
                      First, what's your email?
                    </CardTitle>
                    {invited && (
                      <CardDescription>
                        Welcome. Use the email your invite was sent to.
                      </CardDescription>
                    )}
                  </CardHeader>
                  <div className="mt-6">
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

                      {error && <p className="text-sm text-destructive">{error}</p>}

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

                    <div className="my-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={signInWithGitHub}
                      disabled
                    >
                      <GitHubIcon className="size-4" />
                      Continue with GitHub
                    </Button>
                  </div>
                </>
              )}

              {step === 'otp' && (
                <>
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl">Check your email</CardTitle>
                    <CardDescription>
                      Enter the 6-digit code sent to{' '}
                      <span className="font-medium text-foreground">{email}</span>
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-6">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void otpForm.handleSubmit()
                      }}
                      className="grid gap-4"
                    >
                      <otpForm.Field name="otp">
                        {(field) => (
                          <InputOTP
                            id="otp"
                            maxLength={6}
                            value={field.state.value}
                            onChange={(v) => field.handleChange(v)}
                            onComplete={() => void otpForm.handleSubmit()}
                            autoFocus
                            containerClassName="w-full"
                          >
                            <InputOTPGroup className="w-full gap-2">
                              {[0, 1, 2, 3, 4, 5].map((i) => (
                                <InputOTPSlot
                                  key={i}
                                  index={i}
                                  className="h-12 flex-1 rounded-md border-l text-base first:rounded-l-md last:rounded-r-md"
                                />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        )}
                      </otpForm.Field>

                      {error && <p className="text-sm text-destructive">{error}</p>}

                      <otpForm.Subscribe
                        selector={(s) => ({
                          submitting: s.isSubmitting,
                          len: s.values.otp.length,
                        })}
                      >
                        {({ submitting, len }) => (
                          <Button
                            type="submit"
                            disabled={submitting || len < 6}
                            className="w-full"
                          >
                            {submitting ? 'Verifying...' : 'Verify'}
                          </Button>
                        )}
                      </otpForm.Subscribe>
                    </form>

                    <div className="mt-4 flex items-center justify-between">
                      <BackButton onClick={backToEmail} label="Different email" />
                      <button
                        type="button"
                        onClick={resendOtp}
                        disabled={resendIn > 0}
                        className="text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline disabled:font-normal disabled:text-muted-foreground disabled:no-underline"
                      >
                        {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {step === 'not-invited' && (
                <>
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl">Handoff is invite-only</CardTitle>
                    <CardDescription>
                      We don't have an invite on file for{' '}
                      <span className="font-medium text-foreground">{email}</span>.
                      Request access and we'll be in touch.
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-6 grid gap-3">
                    <Button className="w-full" onClick={() => go('request-access', 1)}>
                      Request access
                    </Button>
                    <div className="flex justify-center">
                      <BackButton onClick={backToEmail} label="Use a different email" />
                    </div>
                  </div>
                </>
              )}

              {step === 'request-access' && (
                <>
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl">Request access</CardTitle>
                    <CardDescription>
                      Handoff is in closed preview. Tell us a little about you and
                      we'll reach out at{' '}
                      <span className="font-medium text-foreground">{email}</span>.
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-6">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void requestForm.handleSubmit()
                      }}
                      className="grid gap-4"
                    >
                      <requestForm.Field name="name">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor="req-name">Name (optional)</Label>
                            <Input
                              id="req-name"
                              type="text"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Your name"
                              autoFocus
                            />
                          </div>
                        )}
                      </requestForm.Field>

                      <requestForm.Field name="reason">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor="req-reason">
                              What would you use Handoff for? (optional)
                            </Label>
                            <textarea
                              id="req-reason"
                              rows={3}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="A team of 4, syncing prod and staging .env files..."
                              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        )}
                      </requestForm.Field>

                      {error && <p className="text-sm text-destructive">{error}</p>}

                      <requestForm.Subscribe selector={(s) => s.isSubmitting}>
                        {(isSubmitting) => (
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full"
                          >
                            {isSubmitting ? 'Sending...' : 'Request invite'}
                          </Button>
                        )}
                      </requestForm.Subscribe>
                    </form>

                    <div className="mt-4 flex justify-center">
                      <BackButton onClick={() => go('not-invited', -1)} label="Back" />
                    </div>
                  </div>
                </>
              )}

              {step === 'request-sent' && (
                <>
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl">Request received</CardTitle>
                    <CardDescription>
                      Thanks. If you're a fit, we'll send an invite to{' '}
                      <span className="font-medium text-foreground">{email}</span>{' '}
                      soon.
                    </CardDescription>
                  </CardHeader>
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={backToEmail}
                    >
                      <ArrowLeft className="size-4" />
                      Back to sign in
                    </Button>
                  </div>
                </>
              )}

              {step === 'onboarding' && (
                <>
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl">Welcome to Handoff</CardTitle>
                    <CardDescription>What should we call you?</CardDescription>
                  </CardHeader>
                  <div className="mt-6">
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

                      {error && <p className="text-sm text-destructive">{error}</p>}

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
                  </div>
                </>
              )}
            </AuthWizard>
          </div>
        </div>
        <p className="relative text-xs text-[var(--h-text-3)]">
          Handoff is invite-only while in beta.
        </p>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <FlutedShader className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-14">
          <p className="max-w-md font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.02em] text-white">
            Your .env file,
            <br />
            but shared.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            Zero-knowledge secrets for your team. Encrypted before it ever leaves
            your machine.
          </p>
        </div>
      </div>
    </main>
  )
}
