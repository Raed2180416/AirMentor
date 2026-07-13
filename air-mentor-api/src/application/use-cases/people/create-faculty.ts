/**
 * POST /api/admin/faculty — create a faculty profile + user account (with either
 * an admin-set password or an invite setup-token), seed UI preferences, emit the
 * creation audit, then re-read and return the provenance-enriched record. The
 * insert sequence, audit payload, and re-read/enrich are moved verbatim; DB
 * access goes through the repository and the token/theme services are injected.
 */
import { createId } from '../../../lib/ids.js'
import { hashPassword } from '../../../lib/passwords.js'
import { deriveFacultyCredentialStatus } from '../../../lib/password-setup.js'
import { notFound } from '../../../lib/http-errors.js'
import type { PeopleRepository } from '../../ports/people-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapFacultyRecord } from './people-domain.js'
import { enrichFacultyRecordWithProvenance, type ResolveBatchPolicyFn } from './faculty-provenance.js'
import type { IssuePasswordSetupTokenFn } from './deps.js'
import type { FacultyCreateBody } from './people-schemas.js'

export type CreateFacultyDeps = {
  repo: PeopleRepository
  emitAudit: AuditEmitter
  resolveBatchPolicy: ResolveBatchPolicyFn
  now: () => string
  issuePasswordSetupToken: IssuePasswordSetupTokenFn
  defaultThemeMode: string
}

export type CreateFacultyInput = {
  actorUserId: string
  actorRole: string
  actorFacultyId: string | null
  body: FacultyCreateBody
}

export async function createFaculty(deps: CreateFacultyDeps, input: CreateFacultyInput): Promise<UseCaseResponse> {
  const { repo } = deps
  const body = input.body
  const institution = await repo.getFirstInstitutionId()
  if (!institution) throw notFound('Institution-backed user setup is missing')
  const now = deps.now()
  const userId = createId('user')
  const facultyId = createId('faculty')
  await repo.insertUserAccount({
    userId,
    institutionId: institution,
    username: body.username,
    email: body.email,
    phone: body.phone ?? null,
    status: body.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
  })
  if (body.password) {
    await repo.insertPasswordCredential({
      userId,
      passwordHash: await hashPassword(body.password),
      updatedAt: now,
    })
  } else {
    const issued = deps.issuePasswordSetupToken(now)
    await repo.insertPasswordSetupToken({
      passwordSetupTokenId: issued.passwordSetupTokenId,
      userId,
      purpose: 'invite',
      tokenHash: issued.tokenHash,
      issuedToEmail: body.email,
      requestedByUserId: input.actorUserId,
      expiresAt: issued.expiresAt,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }
  await repo.insertUiPreference({
    userId,
    themeMode: deps.defaultThemeMode,
    version: 1,
    updatedAt: now,
  })
  const created = {
    facultyId,
    userId,
    employeeCode: body.employeeCode,
    displayName: body.displayName,
    designation: body.designation,
    joinedOn: body.joinedOn ?? null,
    status: body.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  await repo.insertFacultyProfile(created)
  await deps.emitAudit({
    entityType: 'FacultyProfile',
    entityId: facultyId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.actorFacultyId,
    after: {
      ...created,
      username: body.username,
      email: body.email,
      phone: body.phone ?? null,
      credentialProvisioning: body.password ? 'admin-password' : 'invite-link',
    },
  })
  const createdProfile = await repo.getFacultyProfileById(facultyId)
  const createdUser = await repo.getUserAccountById(userId)
  const createdCredentialRows = await repo.listPasswordCredentialsByUser(userId)
  const createdTokenRows = await repo.listPasswordSetupTokensByUser(userId)
  const references = await repo.loadReferenceData()
  const record = await enrichFacultyRecordWithProvenance(deps.resolveBatchPolicy, mapFacultyRecord({
    profile: createdProfile!,
    user: createdUser,
    credentialStatus: deriveFacultyCredentialStatus({
      now,
      passwordConfigured: createdCredentialRows.length > 0,
      tokens: createdTokenRows,
    }),
    appointments: [],
    grants: [],
    references,
  }), references, new Map())
  return { status: 200, body: record }
}
