import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicFaculties,
  academicTerms,
  batches,
  branches,
  departments,
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  institutions,
  mentorAssignments,
  roleGrants,
  sectionOfferings,
  uiPreferences,
  userAccounts,
  userPasswordCredentials,
  userPasswordSetupTokens,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { notFound } from '../lib/http-errors.js'
import { hashPassword } from '../lib/passwords.js'
import { buildPasswordSetupLink, deriveFacultyCredentialStatus, issuePasswordSetupToken } from '../lib/password-setup.js'
import { createNoopEmailTransport } from '../lib/email-transport.js'
import { EmailRateLimiter } from '../lib/email-rate-limiter.js'
import { resolveBatchPolicy } from './admin-structure.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const adminPasswordSetupRateLimiter = new EmailRateLimiter(10 * 60 * 1000, 5)

const facultyCreateSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional().nullable(),
  employeeCode: z.string().min(1),
  displayName: z.string().min(1),
  designation: z.string().min(1),
  joinedOn: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const facultyPatchSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  employeeCode: z.string().min(1),
  displayName: z.string().min(1),
  designation: z.string().min(1),
  joinedOn: z.string().optional().nullable(),
  status: z.string().min(1),
  version: z.number().int().positive(),
})

const appointmentCreateSchema = z.object({
  facultyId: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const appointmentPatchSchema = appointmentCreateSchema.extend({
  version: z.number().int().positive(),
})

const roleGrantCreateSchema = z.object({
  facultyId: z.string().min(1),
  roleCode: z.enum(['SYSTEM_ADMIN', 'HOD', 'COURSE_LEADER', 'MENTOR']),
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const roleGrantPatchSchema = roleGrantCreateSchema.extend({
  version: z.number().int().positive(),
})

const facultyDirectoryScopeQuerySchema = z.object({
  academicFacultyId: z.string().trim().min(1).optional(),
  departmentId: z.string().trim().min(1).optional(),
  branchId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  sectionCode: z.string().trim().min(1).optional(),
})

type PeopleReferenceData = {
  institution: typeof institutions.$inferSelect | null
  academicFacultyById: Map<string, typeof academicFaculties.$inferSelect>
  departmentById: Map<string, typeof departments.$inferSelect>
  branchById: Map<string, typeof branches.$inferSelect>
  batchById: Map<string, typeof batches.$inferSelect>
  termById: Map<string, typeof academicTerms.$inferSelect>
  offeringById: Map<string, typeof sectionOfferings.$inferSelect>
  ownerships: Array<typeof facultyOfferingOwnerships.$inferSelect>
}

type FacultyRecord = ReturnType<typeof mapFacultyRecord>
type ResolvedBatchPolicySnapshot = Awaited<ReturnType<typeof resolveBatchPolicy>>
type RecordProofProvenance = {
  scopeDescriptor: {
    scopeType: string
    scopeId: string
    label: string
    batchId: string | null
    sectionCode: string | null
    branchName: string | null
    simulationRunId: string | null
    simulationStageCheckpointId: string | null
    studentId: string | null
  } | null
  resolvedFrom: {
    kind: string
    scopeType: string | null
    scopeId: string | null
    label: string
  } | null
  scopeMode: string | null
  countSource: 'operational-semester' | 'proof-run' | 'proof-checkpoint' | 'unavailable' | null
  activeOperationalSemester: number | null
}
type FacultyRecordWithProvenance = FacultyRecord & Partial<RecordProofProvenance>
type ProvenanceScopeType = 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch' | 'section' | 'proof'

const SUPPORTED_PROVENANCE_SCOPE_TYPES = new Set([
  'institution',
  'academic-faculty',
  'department',
  'branch',
  'batch',
  'section',
] as const)

function normalizeProvenanceScopeType(scopeType: string) {
  return SUPPORTED_PROVENANCE_SCOPE_TYPES.has(scopeType as 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch' | 'section')
    ? scopeType as ProvenanceScopeType
    : 'proof'
}

async function loadPeopleReferenceData(context: RouteContext): Promise<PeopleReferenceData> {
  const [
    institution,
    academicFacultyRows,
    departmentRows,
    branchRows,
    batchRows,
    termRows,
    offeringRows,
    ownershipRows,
  ] = await Promise.all([
    context.db.select().from(institutions).then(rows => rows[0] ?? null),
    context.db.select().from(academicFaculties),
    context.db.select().from(departments),
    context.db.select().from(branches),
    context.db.select().from(batches),
    context.db.select().from(academicTerms),
    context.db.select().from(sectionOfferings),
    context.db.select().from(facultyOfferingOwnerships),
  ])
  return {
    institution,
    academicFacultyById: new Map(academicFacultyRows.map(row => [row.academicFacultyId, row])),
    departmentById: new Map(departmentRows.map(row => [row.departmentId, row])),
    branchById: new Map(branchRows.map(row => [row.branchId, row])),
    batchById: new Map(batchRows.map(row => [row.batchId, row])),
    termById: new Map(termRows.map(row => [row.termId, row])),
    offeringById: new Map(offeringRows.map(row => [row.offeringId, row])),
    ownerships: ownershipRows,
  }
}

function mapAppointment(row: typeof facultyAppointments.$inferSelect, references?: PeopleReferenceData) {
  const department = references?.departmentById.get(row.departmentId) ?? null
  const branch = row.branchId ? references?.branchById.get(row.branchId) ?? null : null
  return {
    appointmentId: row.appointmentId,
    facultyId: row.facultyId,
    departmentId: row.departmentId,
    departmentName: department?.name ?? null,
    departmentCode: department?.code ?? null,
    branchId: row.branchId,
    branchName: branch?.name ?? null,
    branchCode: branch?.code ?? null,
    isPrimary: row.isPrimary === 1,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function buildRoleGrantScopeLabel(row: typeof roleGrants.$inferSelect, references?: PeopleReferenceData) {
  if (!references) return null
  if (row.scopeType === 'institution') return references.institution?.name ?? row.scopeId
  if (row.scopeType === 'academic-faculty') return references.academicFacultyById.get(row.scopeId)?.name ?? row.scopeId
  if (row.scopeType === 'department') return references.departmentById.get(row.scopeId)?.name ?? row.scopeId
  if (row.scopeType === 'branch') return references.branchById.get(row.scopeId)?.name ?? row.scopeId
  if (row.scopeType === 'batch') return references.batchById.get(row.scopeId)?.batchLabel ?? row.scopeId
  if (row.scopeType === 'offering') {
    const offering = references.offeringById.get(row.scopeId)
    if (!offering) return row.scopeId
    const branch = references.branchById.get(offering.branchId)
    return `${branch?.name ?? offering.branchId} · Section ${offering.sectionCode}`
  }
  if (row.scopeType === 'section') {
    const [batchId, sectionCode] = row.scopeId.split('::')
    const batchLabel = batchId ? references.batchById.get(batchId)?.batchLabel ?? batchId : row.scopeId
    return sectionCode ? `${batchLabel} · Section ${sectionCode}` : row.scopeId
  }
  return row.scopeId
}

function mapRoleGrant(row: typeof roleGrants.$inferSelect, references?: PeopleReferenceData) {
  return {
    grantId: row.grantId,
    facultyId: row.facultyId,
    roleCode: row.roleCode,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    scopeLabel: buildRoleGrantScopeLabel(row, references),
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapMentorAssignment(row: typeof mentorAssignments.$inferSelect) {
  return {
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    facultyId: row.facultyId,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapFacultyRecord(params: {
  profile: typeof facultyProfiles.$inferSelect
  user: typeof userAccounts.$inferSelect | undefined
  appointments: Array<typeof facultyAppointments.$inferSelect>
  grants: Array<typeof roleGrants.$inferSelect>
  credentialStatus: ReturnType<typeof deriveFacultyCredentialStatus>
  references?: PeopleReferenceData
}) {
  return {
    facultyId: params.profile.facultyId,
    userId: params.profile.userId,
    username: params.user?.username ?? '',
    email: params.user?.email ?? '',
    phone: params.user?.phone ?? null,
    employeeCode: params.profile.employeeCode,
    displayName: params.profile.displayName,
    designation: params.profile.designation,
    joinedOn: params.profile.joinedOn,
    status: params.profile.status,
    version: params.profile.version,
    createdAt: params.profile.createdAt,
    updatedAt: params.profile.updatedAt,
    credentialStatus: params.credentialStatus,
    appointments: params.appointments.map(item => mapAppointment(item, params.references)),
    roleGrants: params.grants.map(item => mapRoleGrant(item, params.references)),
  }
}

function isActiveRow(status: string, endDate?: string | null) {
  return status === 'active' && !endDate
}

function hasFacultyDirectoryScopeFilter(filter: z.infer<typeof facultyDirectoryScopeQuerySchema>) {
  return Boolean(filter.academicFacultyId || filter.departmentId || filter.branchId || filter.batchId || filter.sectionCode)
}

function matchesFacultyDirectoryScope(
  faculty: FacultyRecord,
  references: PeopleReferenceData,
  filter: z.infer<typeof facultyDirectoryScopeQuerySchema>,
) {
  if (!hasFacultyDirectoryScopeFilter(filter)) return true

  const scopedBatch = filter.batchId ? references.batchById.get(filter.batchId) ?? null : null
  const scopedBranchId = filter.branchId ?? scopedBatch?.branchId ?? null
  const scopedDepartmentId = filter.departmentId
    ?? (scopedBranchId ? references.branchById.get(scopedBranchId)?.departmentId ?? null : null)
    ?? null
  const batchTermIds = filter.batchId
    ? new Set(
        Array.from(references.termById.values())
          .filter(item => item.batchId === filter.batchId)
          .map(item => item.termId),
      )
    : null
  const sectionScopeId = filter.batchId && filter.sectionCode
    ? `${filter.batchId}::${filter.sectionCode.trim().toUpperCase()}`
    : null

  const appointmentMatch = faculty.appointments.some(appointment => {
    if (!isActiveRow(appointment.status, appointment.endDate)) return false
    const department = references.departmentById.get(appointment.departmentId) ?? null
    if (filter.academicFacultyId && department?.academicFacultyId !== filter.academicFacultyId) return false
    if (scopedDepartmentId && appointment.departmentId !== scopedDepartmentId) return false
    if (scopedBranchId && appointment.branchId && appointment.branchId !== scopedBranchId) return false
    return true
  })

  const ownershipMatch = references.ownerships.some(ownership => {
    if (ownership.facultyId !== faculty.facultyId || ownership.status !== 'active') return false
    const offering = references.offeringById.get(ownership.offeringId) ?? null
    if (!offering) return false
    const term = references.termById.get(offering.termId) ?? null
    const department = offering.branchId ? references.branchById.get(offering.branchId)?.departmentId ?? null : null
    if (filter.academicFacultyId) {
      const academicFacultyId = department ? references.departmentById.get(department)?.academicFacultyId ?? null : null
      if (academicFacultyId !== filter.academicFacultyId) return false
    }
    if (scopedDepartmentId && department !== scopedDepartmentId) return false
    if (scopedBranchId && offering.branchId !== scopedBranchId) return false
    if (batchTermIds && (!term || !batchTermIds.has(term.termId))) return false
    if (filter.sectionCode && offering.sectionCode.trim().toUpperCase() !== filter.sectionCode.trim().toUpperCase()) return false
    return true
  })

  const grantMatch = faculty.roleGrants.some(grant => {
    if (!isActiveRow(grant.status, grant.endDate)) return false
    if (sectionScopeId && grant.scopeType === 'section' && grant.scopeId === sectionScopeId) return true
    if (filter.batchId && grant.scopeType === 'batch' && grant.scopeId === filter.batchId) return true
    if (scopedBranchId && grant.scopeType === 'branch' && grant.scopeId === scopedBranchId) return true
    if (scopedDepartmentId && grant.scopeType === 'department' && grant.scopeId === scopedDepartmentId) return true
    if (filter.academicFacultyId && grant.scopeType === 'academic-faculty' && grant.scopeId === filter.academicFacultyId) return true
    return false
  })

  return appointmentMatch || ownershipMatch || grantMatch
}

function pickFacultyScopeSource(
  faculty: FacultyRecord,
  references: PeopleReferenceData,
): { scopeType: string; scopeId: string; label: string; batchId?: string; sectionCode?: string | null } | null {
  const activeOwnership = references.ownerships
    .filter(item => item.facultyId === faculty.facultyId && item.status === 'active')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt) || left.ownershipId.localeCompare(right.ownershipId))[0]
  if (activeOwnership) {
    const offering = references.offeringById.get(activeOwnership.offeringId)
    const term = offering ? references.termById.get(offering.termId) ?? null : null
    const batch = term?.batchId ? references.batchById.get(term.batchId) ?? null : null
    if (batch) {
      return {
        scopeType: 'section',
        scopeId: `${batch.batchId}::${offering?.sectionCode ?? ''}`.replace(/::$/, ''),
        label: batch.batchLabel,
        batchId: batch.batchId,
        sectionCode: offering?.sectionCode ?? null,
      }
    }
  }

  const activeBatchGrant = faculty.roleGrants.find(grant => grant.status === 'active' && grant.scopeType === 'batch')
  if (activeBatchGrant) {
    return {
      scopeType: 'batch',
      scopeId: activeBatchGrant.scopeId,
      label: activeBatchGrant.scopeLabel ?? activeBatchGrant.scopeId,
      batchId: activeBatchGrant.scopeId,
      sectionCode: null,
    }
  }

  const activeScopeGrant = faculty.roleGrants
    .filter(grant => isActiveRow(grant.status, grant.endDate))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.grantId.localeCompare(right.grantId))[0]
  if (activeScopeGrant) {
    const normalizedScopeType = normalizeProvenanceScopeType(activeScopeGrant.scopeType)
    return {
      scopeType: normalizedScopeType,
      scopeId: activeScopeGrant.scopeId,
      label: activeScopeGrant.scopeLabel ?? `${activeScopeGrant.scopeType}:${activeScopeGrant.scopeId}`,
      sectionCode: null,
    }
  }

  const primaryAppointment = faculty.appointments.find(appointment => appointment.isPrimary && appointment.status === 'active')
    ?? faculty.appointments.find(appointment => appointment.status === 'active')
    ?? null
  if (primaryAppointment?.branchId) {
    return {
      scopeType: 'branch',
      scopeId: primaryAppointment.branchId,
      label: primaryAppointment.branchName ?? primaryAppointment.branchId,
      sectionCode: null,
    }
  }
  if (primaryAppointment) {
    return {
      scopeType: 'department',
      scopeId: primaryAppointment.departmentId,
      label: primaryAppointment.departmentName ?? primaryAppointment.departmentId,
      sectionCode: null,
    }
  }
  if (references.institution) {
    return {
      scopeType: 'institution',
      scopeId: references.institution.institutionId,
      label: references.institution.name,
      sectionCode: null,
    }
  }
  return null
}

async function enrichFacultyRecordWithProvenance(
  context: RouteContext,
  faculty: FacultyRecord,
  references: PeopleReferenceData,
  cache: Map<string, ResolvedBatchPolicySnapshot>,
): Promise<FacultyRecordWithProvenance> {
  const scopeSource = pickFacultyScopeSource(faculty, references)
  if (!scopeSource) {
    return {
      ...faculty,
      scopeDescriptor: null,
      resolvedFrom: null,
      scopeMode: null,
      countSource: null,
      activeOperationalSemester: null,
    }
  }

  if (scopeSource.batchId) {
    const cacheKey = `${scopeSource.batchId}::${(scopeSource.sectionCode ?? '').trim().toUpperCase()}`
    let resolvedPolicy = cache.get(cacheKey)
    if (!resolvedPolicy) {
      resolvedPolicy = await resolveBatchPolicy(context, scopeSource.batchId, { sectionCode: scopeSource.sectionCode ?? null })
      cache.set(cacheKey, resolvedPolicy)
    }
    return {
      ...faculty,
      scopeDescriptor: resolvedPolicy.scopeDescriptor,
      resolvedFrom: resolvedPolicy.resolvedFrom,
      scopeMode: resolvedPolicy.scopeMode,
      countSource: resolvedPolicy.countSource,
      activeOperationalSemester: resolvedPolicy.activeOperationalSemester,
    }
  }

  return {
    ...faculty,
    scopeDescriptor: {
      scopeType: scopeSource.scopeType as ProvenanceScopeType,
      scopeId: scopeSource.scopeId,
      label: scopeSource.label,
      batchId: null,
      sectionCode: null,
      branchName: scopeSource.scopeType === 'branch' ? scopeSource.label : null,
      simulationRunId: null,
      simulationStageCheckpointId: null,
      studentId: null,
    },
    resolvedFrom: {
      kind: 'proof-unavailable',
      scopeType: scopeSource.scopeType as ProvenanceScopeType,
      scopeId: scopeSource.scopeId,
      label: scopeSource.label,
    },
    scopeMode: scopeSource.scopeType as ProvenanceScopeType,
    countSource: 'unavailable',
    activeOperationalSemester: null,
  }
}

export async function registerPeopleRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/faculty', {
    schema: { tags: ['people'], summary: 'List faculty master records' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const filter = parseOrThrow(facultyDirectoryScopeQuerySchema, request.query ?? {})
    const [profiles, users, credentials, setupTokens, appointments, grants, references] = await Promise.all([
      context.db.select().from(facultyProfiles),
      context.db.select().from(userAccounts),
      context.db.select().from(userPasswordCredentials),
      context.db.select().from(userPasswordSetupTokens),
      context.db.select().from(facultyAppointments),
      context.db.select().from(roleGrants),
      loadPeopleReferenceData(context),
    ])
    const provenanceCache = new Map<string, ResolvedBatchPolicySnapshot>()
    const mappedFaculty = profiles
      .map(profile => mapFacultyRecord({
        profile,
        user: users.find(item => item.userId === profile.userId),
        credentialStatus: deriveFacultyCredentialStatus({
          now: context.now(),
          passwordConfigured: credentials.some(item => item.userId === profile.userId),
          tokens: setupTokens.filter(item => item.userId === profile.userId),
        }),
        appointments: appointments.filter(item => item.facultyId === profile.facultyId),
        grants: grants.filter(item => item.facultyId === profile.facultyId),
        references,
      }))
      .filter(faculty => matchesFacultyDirectoryScope(faculty, references, filter))
    return {
      items: await Promise.all(mappedFaculty.map(faculty => enrichFacultyRecordWithProvenance(context, faculty, references, provenanceCache))),
    }
  })

  app.post('/api/admin/faculty', {
    schema: { tags: ['people'], summary: 'Create faculty profile and user' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(facultyCreateSchema, request.body)
    const institution = (await context.db.select().from(institutions).limit(1))[0]?.institutionId
    if (!institution) throw notFound('Institution-backed user setup is missing')
    const now = context.now()
    const userId = createId('user')
    const facultyId = createId('faculty')
    await context.db.insert(userAccounts).values({
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
      await context.db.insert(userPasswordCredentials).values({
        userId,
        passwordHash: await hashPassword(body.password),
        updatedAt: now,
      })
    } else {
      const issued = issuePasswordSetupToken(context.config, now)
      await context.db.insert(userPasswordSetupTokens).values({
        passwordSetupTokenId: issued.passwordSetupTokenId,
        userId,
        purpose: 'invite',
        tokenHash: issued.tokenHash,
        issuedToEmail: body.email,
        requestedByUserId: auth.userId,
        expiresAt: issued.expiresAt,
        consumedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    await context.db.insert(uiPreferences).values({
      userId,
      themeMode: context.config.defaultThemeMode,
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
    await context.db.insert(facultyProfiles).values(created)
    await emitAuditEvent(context, {
      entityType: 'FacultyProfile',
      entityId: facultyId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        ...created,
        username: body.username,
        email: body.email,
        phone: body.phone ?? null,
        credentialProvisioning: body.password ? 'admin-password' : 'invite-link',
      },
    })
    const [createdProfile] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, facultyId))
    const [createdUser] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, userId))
    const createdCredentialRows = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, userId))
    const createdTokenRows = await context.db.select().from(userPasswordSetupTokens).where(eq(userPasswordSetupTokens.userId, userId))
    const references = await loadPeopleReferenceData(context)
    return enrichFacultyRecordWithProvenance(context, mapFacultyRecord({
      profile: createdProfile,
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
  })

  app.patch('/api/admin/faculty/:facultyId', {
    schema: { tags: ['people'], summary: 'Update faculty profile and user account' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(facultyPatchSchema, request.body)
    const [current] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId))
    if (!current) throw notFound('Faculty not found')
    expectVersion(current.version, body.version, 'FacultyProfile', current)
    const [currentUser] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, current.userId))
    const now = context.now()
    await context.db.update(userAccounts).set({
      username: body.username,
      email: body.email,
      phone: body.phone ?? null,
      status: body.status,
      version: currentUser.version + 1,
      updatedAt: now,
    }).where(eq(userAccounts.userId, current.userId))
    await context.db.update(facultyProfiles).set({
      employeeCode: body.employeeCode,
      displayName: body.displayName,
      designation: body.designation,
      joinedOn: body.joinedOn ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(facultyProfiles.facultyId, params.facultyId))

    const cascadeMetadata = {
      appointmentsDeleted: 0,
      roleGrantsDeleted: 0,
      ownershipsDeleted: 0,
      mentorAssignmentsEnded: 0,
    }
    if (body.status === 'deleted' && current.status !== 'deleted') {
      const effectiveTo = now.slice(0, 10)
      const [appointments, grants, ownerships, assignments] = await Promise.all([
        context.db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, params.facultyId)),
        context.db.select().from(roleGrants).where(eq(roleGrants.facultyId, params.facultyId)),
        context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, params.facultyId)),
        context.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, params.facultyId)),
      ])

      for (const appointment of appointments.filter(item => item.status !== 'deleted')) {
        const next = {
          ...appointment,
          status: 'deleted',
          version: appointment.version + 1,
          updatedAt: now,
        }
        await context.db.update(facultyAppointments).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(facultyAppointments.appointmentId, appointment.appointmentId))
        await emitAuditEvent(context, {
          entityType: 'FacultyAppointment',
          entityId: appointment.appointmentId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapAppointment(appointment),
          after: mapAppointment(next),
          metadata: { reason: 'faculty_profile_deleted', facultyId: params.facultyId },
        })
        cascadeMetadata.appointmentsDeleted += 1
      }

      for (const grant of grants.filter(item => item.status !== 'deleted')) {
        const next = {
          ...grant,
          status: 'deleted',
          version: grant.version + 1,
          updatedAt: now,
        }
        await context.db.update(roleGrants).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(roleGrants.grantId, grant.grantId))
        await emitAuditEvent(context, {
          entityType: 'RoleGrant',
          entityId: grant.grantId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapRoleGrant(grant),
          after: mapRoleGrant(next),
          metadata: { reason: 'faculty_profile_deleted', facultyId: params.facultyId },
        })
        cascadeMetadata.roleGrantsDeleted += 1
      }

      for (const ownership of ownerships.filter(item => item.status !== 'deleted')) {
        const next = {
          ...ownership,
          status: 'deleted',
          version: ownership.version + 1,
          updatedAt: now,
        }
        await context.db.update(facultyOfferingOwnerships).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(facultyOfferingOwnerships.ownershipId, ownership.ownershipId))
        await emitAuditEvent(context, {
          entityType: 'faculty_offering_ownership',
          entityId: ownership.ownershipId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: ownership,
          after: next,
          metadata: { reason: 'faculty_profile_deleted', facultyId: params.facultyId },
        })
        cascadeMetadata.ownershipsDeleted += 1
      }

      for (const assignment of assignments.filter(item => !item.effectiveTo || item.effectiveTo > effectiveTo)) {
        const next = {
          ...assignment,
          effectiveTo,
          version: assignment.version + 1,
          updatedAt: now,
        }
        await context.db.update(mentorAssignments).set({
          effectiveTo: next.effectiveTo,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(mentorAssignments.assignmentId, assignment.assignmentId))
        await emitAuditEvent(context, {
          entityType: 'MentorAssignment',
          entityId: assignment.assignmentId,
          action: 'cascade_ended',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapMentorAssignment(assignment),
          after: mapMentorAssignment(next),
          metadata: { reason: 'faculty_profile_deleted', facultyId: params.facultyId },
        })
        cascadeMetadata.mentorAssignmentsEnded += 1
      }
    }

    const [next] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId))
    const [nextUser] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, current.userId))
    const nextCredentialRows = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, current.userId))
    const nextSetupTokenRows = await context.db.select().from(userPasswordSetupTokens).where(eq(userPasswordSetupTokens.userId, current.userId))
    const appointments = await context.db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, params.facultyId))
    const grants = await context.db.select().from(roleGrants).where(eq(roleGrants.facultyId, params.facultyId))
    const references = await loadPeopleReferenceData(context)
    const payload = mapFacultyRecord({
      profile: next,
      user: nextUser,
      credentialStatus: deriveFacultyCredentialStatus({
        now,
        passwordConfigured: nextCredentialRows.length > 0,
        tokens: nextSetupTokenRows,
      }),
      appointments,
      grants,
      references,
    })
    await emitAuditEvent(context, {
      entityType: 'FacultyProfile',
      entityId: params.facultyId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: {
        ...current,
        username: currentUser.username,
        email: currentUser.email,
        phone: currentUser.phone,
      },
      after: payload,
      metadata: body.status === 'deleted' && current.status !== 'deleted'
        ? {
            reason: 'faculty_profile_deleted',
            cascade: cascadeMetadata,
          }
        : undefined,
    })
    return enrichFacultyRecordWithProvenance(context, payload, references, new Map())
  })

  app.post('/api/admin/faculty/:facultyId/password-setup', {
    schema: { tags: ['people'], summary: 'Issue a faculty password setup or reset link' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const [profile] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId))
    if (!profile || profile.status !== 'active') throw notFound('Active faculty profile not found')
    const [user] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, profile.userId))
    if (!user || user.status !== 'active') throw notFound('Active user account not found for this faculty profile')
    const credentialRows = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, user.userId))
    const now = context.now()
    const issued = issuePasswordSetupToken(context.config, now)
    const purpose = credentialRows.length > 0 ? 'reset' : 'invite'
    await context.db.insert(userPasswordSetupTokens).values({
      passwordSetupTokenId: issued.passwordSetupTokenId,
      userId: user.userId,
      purpose,
      tokenHash: issued.tokenHash,
      issuedToEmail: user.email,
      requestedByUserId: auth.userId,
      expiresAt: issued.expiresAt,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    await emitAuditEvent(context, {
      entityType: 'FacultyProfile',
      entityId: profile.facultyId,
      action: purpose === 'invite' ? 'password_invite_issued' : 'password_reset_issued',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        purpose,
        issuedToEmail: user.email,
        expiresAt: issued.expiresAt,
        previewEnabled: context.config.passwordSetupPreviewEnabled,
      },
    })
    const setupLink = buildPasswordSetupLink(context.config, issued.rawToken)
    const transport = context.emailTransport ?? createNoopEmailTransport()
    const rateLimitResult = adminPasswordSetupRateLimiter.check(user.email, Date.now())
    let emailDelivered = false
    if (rateLimitResult.allowed) {
      const deliveryResult = await transport.sendPasswordSetupEmail({
        to: user.email,
        recipientName: profile.displayName ?? user.username,
        setupLink,
        purpose,
        expiresAt: issued.expiresAt,
        fromAddress: context.config.emailFromAddress,
        fromName: context.config.emailFromName,
      })
      emailDelivered = deliveryResult.delivered
    }
    return {
      facultyId: profile.facultyId,
      purpose,
      issuedToEmail: user.email,
      expiresAt: issued.expiresAt,
      previewEnabled: context.config.passwordSetupPreviewEnabled,
      setupUrl: context.config.passwordSetupPreviewEnabled ? setupLink : null,
      emailDelivered,
      rateLimited: !rateLimitResult.allowed,
    }
  })

  app.post('/api/admin/faculty/:facultyId/appointments', {
    schema: { tags: ['people'], summary: 'Create faculty appointment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(appointmentCreateSchema, { ...rawBody, facultyId: params.facultyId })
    const created = {
      appointmentId: createId('appointment'),
      facultyId: body.facultyId,
      departmentId: body.departmentId,
      branchId: body.branchId ?? null,
      isPrimary: body.isPrimary ? 1 : 0,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(facultyAppointments).values(created)
    await emitAuditEvent(context, {
      entityType: 'FacultyAppointment',
      entityId: created.appointmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapAppointment(created),
    })
    return mapAppointment(created, await loadPeopleReferenceData(context))
  })

  app.patch('/api/admin/appointments/:appointmentId', {
    schema: { tags: ['people'], summary: 'Update faculty appointment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ appointmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(appointmentPatchSchema, request.body)
    const [current] = await context.db.select().from(facultyAppointments).where(eq(facultyAppointments.appointmentId, params.appointmentId))
    if (!current) throw notFound('Faculty appointment not found')
    expectVersion(current.version, body.version, 'FacultyAppointment', mapAppointment(current))
    await context.db.update(facultyAppointments).set({
      facultyId: body.facultyId,
      departmentId: body.departmentId,
      branchId: body.branchId ?? null,
      isPrimary: body.isPrimary ? 1 : 0,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(facultyAppointments.appointmentId, params.appointmentId))
    const [next] = await context.db.select().from(facultyAppointments).where(eq(facultyAppointments.appointmentId, params.appointmentId))
    await emitAuditEvent(context, {
      entityType: 'FacultyAppointment',
      entityId: params.appointmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapAppointment(current),
      after: mapAppointment(next),
    })
    return mapAppointment(next, await loadPeopleReferenceData(context))
  })

  app.post('/api/admin/faculty/:facultyId/role-grants', {
    schema: { tags: ['people'], summary: 'Create role grant' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(roleGrantCreateSchema, { ...rawBody, facultyId: params.facultyId })
    const created = {
      grantId: createId('grant'),
      facultyId: body.facultyId,
      roleCode: body.roleCode,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(roleGrants).values(created)
    await emitAuditEvent(context, {
      entityType: 'RoleGrant',
      entityId: created.grantId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapRoleGrant(created),
    })
    return mapRoleGrant(created, await loadPeopleReferenceData(context))
  })

  app.patch('/api/admin/role-grants/:grantId', {
    schema: { tags: ['people'], summary: 'Update role grant' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ grantId: z.string().min(1) }), request.params)
    const body = parseOrThrow(roleGrantPatchSchema, request.body)
    const [current] = await context.db.select().from(roleGrants).where(eq(roleGrants.grantId, params.grantId))
    if (!current) throw notFound('Role grant not found')
    expectVersion(current.version, body.version, 'RoleGrant', mapRoleGrant(current))
    await context.db.update(roleGrants).set({
      facultyId: body.facultyId,
      roleCode: body.roleCode,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(roleGrants.grantId, params.grantId))
    const [next] = await context.db.select().from(roleGrants).where(eq(roleGrants.grantId, params.grantId))
    await emitAuditEvent(context, {
      entityType: 'RoleGrant',
      entityId: params.grantId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapRoleGrant(current),
      after: mapRoleGrant(next),
    })
    return mapRoleGrant(next, await loadPeopleReferenceData(context))
  })
}
