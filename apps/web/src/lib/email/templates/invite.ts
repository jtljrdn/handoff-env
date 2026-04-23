import { brand, paragraph, renderBaseEmail } from './base'

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inviteCta(href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center">
        <a href="${escape(href)}"
           style="display:inline-block;background-color:${brand.panel};color:${brand.panelText};text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.01em;padding:12px 22px;border-radius:8px;border:1px solid ${brand.panelBorder};">
          Accept your invite
        </a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 16px 0;font-size:12px;line-height:1.6;color:${brand.text3};text-align:center;">
    Or paste this link into your browser:<br />
    <span style="color:${brand.text2};word-break:break-all;">${escape(href)}</span>
  </p>`
}

export function renderInviteEmail(input: {
  signInUrl: string
  expiresAt: Date
  note?: string | null
}): { subject: string; html: string } {
  const subject = "You're invited to Handoff"
  const expiry = input.expiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const noteHtml = input.note
    ? paragraph(`<em style="color:${brand.text2};">"${escape(input.note)}"</em>`)
    : ''

  const html = renderBaseEmail({
    title: subject,
    preheader: 'Your invite to Handoff is ready.',
    heading: "You're in.",
    bodyHtml:
      paragraph(
        "Handoff is invite-only right now. Someone on the team thought you'd be a good fit, so here you are.",
      ) +
      noteHtml +
      inviteCta(input.signInUrl) +
      paragraph(
        `This invite expires on <strong style="color:${brand.text};">${escape(expiry)}</strong>. Sign in with the email address this was sent to.`,
      ),
    footerNote: 'If you weren\'t expecting this, you can safely ignore the email.',
  })

  return { subject, html }
}
