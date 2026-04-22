export const brand = {
  bg: '#f7f5f1',
  surface: '#f2eee8',
  text: '#2a241c',
  text2: '#5e5647',
  text3: '#857d6f',
  border: '#dcd6cc',
  accent: '#c88f32',
  accentSubtle: '#efe4cf',
  panel: '#25201a',
  panelBorder: '#3a3229',
  panelText: '#cbc3b4',
  panelText2: '#8a8273',
} as const

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type BaseEmailInput = {
  title: string
  preheader: string
  heading: string
  bodyHtml: string
  footerNote?: string
}

export function renderBaseEmail(input: BaseEmailInput): string {
  const { title, preheader, heading, bodyHtml, footerNote } = input
  const year = new Date().getFullYear()
  const betterAuthUrl = process.env.BETTER_AUTH_URL

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escape(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${brand.bg};color:${brand.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escape(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${brand.bg};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 8px 24px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;line-height:0;">
                        <img src="${betterAuthUrl}/logo.png" width="22" height="22" alt="Handoff">
                    </td>
                    <td style="vertical-align:middle;font-family:'Schibsted Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:-0.01em;color:${brand.text};">
                      handoff
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid ${brand.border};border-radius:14px;padding:36px 32px;box-shadow:0 1px 2px rgba(30,20,10,0.04);">
                <h1 style="margin:0 0 16px 0;font-family:'Schibsted Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${brand.text};">
                  ${escape(heading)}
                </h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px 0 8px;font-size:12px;line-height:1.6;color:${brand.text3};">
                ${footerNote ? `<p style="margin:0 0 12px 0;">${footerNote}</p>` : ''}
                <p style="margin:0;">&copy; ${year} Handoff &middot; Your <code style="background-color:${brand.accentSubtle};color:${brand.text2};padding:1px 5px;border-radius:4px;font-size:11px;">.env</code> file, but shared.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${brand.text2};">${html}</p>`
}

export function otpCodeBlock(code: string): string {
  const digits = code
    .split('')
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:18px;">${escape(d)}</span>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" style="background-color:${brand.panel};border:1px solid ${brand.panelBorder};border-radius:10px;padding:24px 16px;">
        <div style="font-family:'SF Mono',Menlo,Consolas,Monaco,monospace;font-size:32px;font-weight:700;letter-spacing:0.35em;color:${brand.panelText};padding-left:0.35em;">
          ${digits}
        </div>
        <div style="margin-top:10px;font-family:'SF Mono',Menlo,Consolas,Monaco,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${brand.panelText2};">
          Verification code
        </div>
      </td>
    </tr>
  </table>`
}
