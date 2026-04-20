import { createHash } from 'node:crypto'
import type { AppConfig } from '../config.js'
import { createId } from './ids.js'
import { addHours } from './time.js'

export type PasswordSetupPurpose = 'invite' | 'reset'

export type FacultyCredentialStatus = {
  passwordConfigured: boolean
  activeSetupRequest: boolean
  latestPurpose: PasswordSetupPurpose | null
  latestRequestedAt: string | null
  latestExpiresAt: string | null
}

export function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function issuePasswordSetupToken(config: AppConfig, now: string) {
  const rawToken = crypto.randomUUID()
  return {
    passwordSetupTokenId: createId('password_setup_token'),
    rawToken,
    tokenHash: hashPasswordSetupToken(rawToken),
    expiresAt: addHours(now, config.passwordSetupTtlHours),
  }
}

export function buildPasswordSetupLink(config: AppConfig, token: string) {
  const baseUrl = config.passwordSetupBaseUrl.trim().replace(/\/+$/, '')
  return `${baseUrl}/?password-setup-token=${encodeURIComponent(token)}#/app`
}

export function isPasswordSetupTokenExpired(expiresAt: string, now: string) {
  return new Date(expiresAt).getTime() <= new Date(now).getTime()
}

export function deriveFacultyCredentialStatus(input: {
  now: string
  passwordConfigured: boolean
  tokens: Array<{
    purpose: string
    createdAt: string
    expiresAt: string
    consumedAt: string | null
  }>
}): FacultyCredentialStatus {
  const latest = [...input.tokens]
    .filter(token => token.purpose === 'invite' || token.purpose === 'reset')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const activeSetupRequest = latest
    ? !latest.consumedAt && !isPasswordSetupTokenExpired(latest.expiresAt, input.now)
    : false

  return {
    passwordConfigured: input.passwordConfigured,
    activeSetupRequest,
    latestPurpose: latest && (latest.purpose === 'invite' || latest.purpose === 'reset') ? latest.purpose : null,
    latestRequestedAt: latest?.createdAt ?? null,
    latestExpiresAt: latest?.expiresAt ?? null,
  }
}
