import {
  otpCodeBlock,
  paragraph,
  renderBaseEmail,
} from './base'

export type OtpEmailType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email'

type Copy = {
  subject: string
  preheader: string
  heading: string
  intro: string
  outro: string
}

const COPY: Record<OtpEmailType, Copy> = {
  'email-verification': {
    subject: 'Welcome to Handoff — verify your email',
    preheader: 'Use this code to finish creating your Handoff account.',
    heading: 'Welcome to Handoff',
    intro:
      "You're one step away from syncing your team's <code style=\"font-family:'SF Mono',Menlo,Consolas,monospace;\">.env</code> files. Enter this code to verify your email and finish creating your account:",
    outro:
      "This code expires in 10 minutes. If you didn't sign up for Handoff, you can safely ignore this email.",
  },
  'sign-in': {
    subject: 'Your Handoff sign-in code',
    preheader: 'Use this code to sign in to Handoff.',
    heading: 'Sign in to Handoff',
    intro:
      'Enter the code below to finish signing in. It expires in 10 minutes.',
    outro:
      "If you didn't try to sign in, you can ignore this email — no one can access your account without this code.",
  },
  'forget-password': {
    subject: 'Reset your Handoff password',
    preheader: 'Use this code to reset your Handoff password.',
    heading: 'Reset your password',
    intro:
      "Enter the code below to confirm it's you and set a new password. It expires in 10 minutes.",
    outro:
      "If you didn't request a password reset, you can ignore this email — your password hasn't changed.",
  },
  'change-email': {
    subject: 'Confirm your new Handoff email',
    preheader: 'Use this code to confirm your new email address.',
    heading: 'Confirm your new email',
    intro:
      'Enter the code below to confirm this is your new email address. It expires in 10 minutes.',
    outro:
      "If you didn't request this change, ignore this email and consider updating your Handoff password.",
  },
}

export function getOtpCopy(type: OtpEmailType): Copy {
  return COPY[type]
}

export function renderOtpEmail(input: {
  otp: string
  type: OtpEmailType
}): { subject: string; html: string } {
  const copy = COPY[input.type]

  const html = renderBaseEmail({
    title: copy.subject,
    preheader: copy.preheader,
    heading: copy.heading,
    bodyHtml:
      paragraph(copy.intro) + otpCodeBlock(input.otp) + paragraph(copy.outro),
    footerNote:
      'For your security, never share this code with anyone — Handoff will never ask for it.',
  })

  return { subject: copy.subject, html }
}
