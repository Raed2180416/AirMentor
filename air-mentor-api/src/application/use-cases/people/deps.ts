/**
 * Injected-service contracts for the people use-cases.
 *
 * The controller binds these over RouteContext (config, clock, email transport,
 * the process-wide rate limiter, and the context-bound resolveBatchPolicy) and
 * passes them in, so the use-cases stay persistence- and framework-free. Shapes
 * mirror the originals in lib/password-setup, lib/email-transport, and
 * lib/email-rate-limiter exactly — no behavioural drift.
 */
import type { EmailTransport } from '../../../lib/email-transport.js'
import type { EmailRateLimitResult } from '../../../lib/email-rate-limiter.js'

export type IssuedPasswordSetupToken = {
  passwordSetupTokenId: string
  rawToken: string
  tokenHash: string
  expiresAt: string
}

/** `now => issuePasswordSetupToken(context.config, now)` bound by the controller. */
export type IssuePasswordSetupTokenFn = (now: string) => IssuedPasswordSetupToken

/** `rawToken => buildPasswordSetupLink(context.config, rawToken)` bound by the controller. */
export type BuildPasswordSetupLinkFn = (rawToken: string) => string

/** `email => adminPasswordSetupRateLimiter.check(email, Date.now())` bound by the controller. */
export type CheckPasswordSetupRateLimitFn = (email: string) => EmailRateLimitResult

export type PasswordSetupEmailTransport = EmailTransport
