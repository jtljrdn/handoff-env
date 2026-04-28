import { brand, paragraph, renderBaseEmail } from './base'

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:12px;line-height:1.5;color:${brand.text3};text-transform:uppercase;letter-spacing:0.08em;width:80px;vertical-align:top;">
      ${escape(label)}
    </td>
    <td style="padding:8px 0 8px 16px;font-size:14px;line-height:1.55;color:${brand.text};word-break:break-word;">
      ${escape(value)}
    </td>
  </tr>`
}

export function renderSignupRequestNotificationEmail(input: {
  email: string
  name?: string | null
  reason?: string | null
  reviewUrl?: string | null
}): { subject: string; html: string } {
  const subject = `New invite request from ${input.email}`

  const rows =
    detailRow('Email', input.email) +
    (input.name ? detailRow('Name', input.name) : '') +
    (input.reason ? detailRow('Reason', input.reason) : '')

  const detailsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 24px 0;border-top:1px solid ${brand.border};">
    ${rows}
  </table>`

  const reviewCta = input.reviewUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;">
        <tr>
          <td align="left">
            <a href="${escape(input.reviewUrl)}"
               style="display:inline-block;background-color:${brand.panel};color:${brand.panelText};text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.01em;padding:10px 18px;border-radius:8px;border:1px solid ${brand.panelBorder};">
              Review in admin
            </a>
          </td>
        </tr>
      </table>`
    : ''

  const html = renderBaseEmail({
    title: subject,
    preheader: `New invite request from ${input.email}`,
    heading: 'New invite request',
    bodyHtml:
      paragraph('Someone just requested access to Handoff.') +
      detailsTable +
      reviewCta,
  })

  return { subject, html }
}
