/**
 * POST /api/admin/faculty/:facultyId/password-setup — issue a password
 * setup/reset link for an active faculty user: mint + persist a setup token,
 * emit the audit event, then (subject to the process-wide rate limiter) send the
 * email. Purpose selection, audit action, delivery gating, and the response
 * shape are moved verbatim; the token/link/email/rate-limit services are injected.
 */
import { notFound } from '../../../lib/http-errors.js'
import type { PeopleRepository } from '../../ports/people-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import type {
  BuildPasswordSetupLinkFn,
  CheckPasswordSetupRateLimitFn,
  IssuePasswordSetupTokenFn,
  PasswordSetupEmailTransport,
} from './deps.js'

export type IssuePasswordSetupDeps = {
  repo: PeopleRepository
  emitAudit: AuditEmitter
  now: () => string
  issuePasswordSetupToken: IssuePasswordSetupTokenFn
  buildPasswordSetupLink: BuildPasswordSetupLinkFn
  emailTransport: PasswordSetupEmailTransport
  checkPasswordSetupRateLimit: CheckPasswordSetupRateLimitFn
  passwordSetupPreviewEnabled: boolean
  emailFromAddress: string
  emailFromName: string
}

export type IssuePasswordSetupInput = {
  facultyId: string
  actorUserId: string
  actorRole: string
  actorFacultyId: string | null
}

export async function issuePasswordSetup(deps: IssuePasswordSetupDeps, input: IssuePasswordSetupInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const profile = await repo.getFacultyProfileById(input.facultyId)
  if (!profile || profile.status !== 'active') throw notFound('Active faculty profile not found')
  const user = await repo.getUserAccountById(profile.userId)
  if (!user || user.status !== 'active') throw notFound('Active user account not found for this faculty profile')
  const credentialRows = await repo.listPasswordCredentialsByUser(user.userId)
  const now = deps.now()
  const issued = deps.issuePasswordSetupToken(now)
  const purpose = credentialRows.length > 0 ? 'reset' : 'invite'
  await repo.insertPasswordSetupToken({
    passwordSetupTokenId: issued.passwordSetupTokenId,
    userId: user.userId,
    purpose,
    tokenHash: issued.tokenHash,
    issuedToEmail: user.email,
    requestedByUserId: input.actorUserId,
    expiresAt: issued.expiresAt,
    consumedAt: null,
    createdAt: now,
    updatedAt: now,
  })
  await deps.emitAudit({
    entityType: 'FacultyProfile',
    entityId: profile.facultyId,
    action: purpose === 'invite' ? 'password_invite_issued' : 'password_reset_issued',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    after: {
      purpose,
      issuedToEmail: user.email,
      expiresAt: issued.expiresAt,
      previewEnabled: deps.passwordSetupPreviewEnabled,
    },
  })
  const setupLink = deps.buildPasswordSetupLink(issued.rawToken)
  const transport = deps.emailTransport
  const rateLimitResult = deps.checkPasswordSetupRateLimit(user.email)
  let emailDelivered = false
  if (rateLimitResult.allowed) {
    const deliveryResult = await transport.sendPasswordSetupEmail({
      to: user.email,
      recipientName: profile.displayName ?? user.username,
      setupLink,
      purpose,
      expiresAt: issued.expiresAt,
      fromAddress: deps.emailFromAddress,
      fromName: deps.emailFromName,
    })
    emailDelivered = deliveryResult.delivered
  }
  return {
    status: 200,
    body: {
      facultyId: profile.facultyId,
      purpose,
      issuedToEmail: user.email,
      expiresAt: issued.expiresAt,
      previewEnabled: deps.passwordSetupPreviewEnabled,
      setupUrl: deps.passwordSetupPreviewEnabled ? setupLink : null,
      emailDelivered,
      rateLimited: !rateLimitResult.allowed,
    },
  }
}
