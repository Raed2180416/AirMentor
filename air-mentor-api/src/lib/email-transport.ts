import type { Transporter } from 'nodemailer'

export type EmailTransportMode = 'smtp' | 'noop'

export type SendPasswordSetupEmailOptions = {
  to: string
  recipientName: string
  setupLink: string
  purpose: 'invite' | 'reset'
  expiresAt: string
  fromAddress: string
  fromName: string
}

export type EmailTransport = {
  mode: EmailTransportMode
  sendPasswordSetupEmail(opts: SendPasswordSetupEmailOptions): Promise<{ delivered: boolean; previewUrl?: string | null }>
}

export type SmtpEmailConfig = {
  host: string
  port: number
  secure: boolean
  user: string | null
  pass: string | null
  fromAddress: string
  fromName: string
}

function buildPasswordSetupEmailBody(opts: SendPasswordSetupEmailOptions) {
  const actionLabel = opts.purpose === 'invite' ? 'set up your password' : 'reset your password'
  const expiryLabel = new Date(opts.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  return {
    subject: opts.purpose === 'invite'
      ? 'AirMentor: Set up your faculty account password'
      : 'AirMentor: Reset your faculty account password',
    text: [
      `Hi ${opts.recipientName},`,
      '',
      `Please follow the link below to ${actionLabel}:`,
      '',
      opts.setupLink,
      '',
      `This link expires on ${expiryLabel}.`,
      '',
      'If you did not request this, please ignore this email or contact your system administrator.',
      '',
      'AirMentor',
    ].join('\n'),
    html: [
      `<p>Hi ${opts.recipientName},</p>`,
      `<p>Please follow the link below to ${actionLabel}:</p>`,
      `<p><a href="${opts.setupLink}">${opts.setupLink}</a></p>`,
      `<p>This link expires on ${expiryLabel}.</p>`,
      `<p>If you did not request this, please ignore this email or contact your system administrator.</p>`,
      `<p>AirMentor</p>`,
    ].join(''),
  }
}

export function createNoopEmailTransport(): EmailTransport {
  return {
    mode: 'noop',
    async sendPasswordSetupEmail(opts) {
      // Local dev: log the link so the operator can copy it
      // eslint-disable-next-line no-console
      console.log(`[email-transport:noop] password-setup email suppressed (${opts.purpose}) → to=${opts.to} link=${opts.setupLink}`)
      return { delivered: false, previewUrl: null }
    },
  }
}

export async function createSmtpEmailTransport(smtpConfig: SmtpEmailConfig): Promise<EmailTransport> {
  const { createTransport } = await import('nodemailer')
  const transporter: Transporter = createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    ...(smtpConfig.user && smtpConfig.pass ? {
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    } : {}),
  })

  return {
    mode: 'smtp',
    async sendPasswordSetupEmail(opts) {
      const body = buildPasswordSetupEmailBody(opts)
      const from = smtpConfig.fromName
        ? `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`
        : smtpConfig.fromAddress
      await transporter.sendMail({
        from,
        to: opts.to,
        subject: body.subject,
        text: body.text,
        html: body.html,
      })
      return { delivered: true, previewUrl: null }
    },
  }
}
