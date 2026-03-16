import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicFaculties,
  batches,
  branches,
  courses,
  curriculumCourses,
  departments,
  institutions,
  policyOverrides,
} from '../db/schema.js'
import { badRequest, conflict, notFound } from '../lib/http-errors.js'
import { createId } from '../lib/ids.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
const scopeTypeSchema = z.enum(['institution', 'academic-faculty', 'department', 'branch', 'batch'])

const gradeBandSchema = z.object({
  grade: z.string().min(1),
  minimumMark: z.number().min(0).max(100),
  maximumMark: z.number().min(0).max(100),
  gradePoint: z.number().min(0).max(10),
})

const ceSeeSplitSchema = z.object({
  ce: z.number().int().min(0).max(100),
  see: z.number().int().min(0).max(100),
}).refine(value => value.ce + value.see === 100, {
  message: 'CE and SEE must total 100',
})

const ceComponentCapsSchema = z.object({
  termTestsWeight: z.number().int().min(0).max(100),
  quizWeight: z.number().int().min(0).max(100),
  assignmentWeight: z.number().int().min(0).max(100),
  maxTermTests: z.number().int().min(0).max(10),
  maxQuizzes: z.number().int().min(0).max(10),
  maxAssignments: z.number().int().min(0).max(10),
})

const workingCalendarSchema = z.object({
  days: z.array(weekdaySchema).min(1),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/),
})

const sgpaCgpaRulesSchema = z.object({
  sgpaModel: z.enum(['credit-weighted']),
  cgpaModel: z.enum(['credit-weighted-cumulative']),
  rounding: z.enum(['2-decimal']),
  includeFailedCredits: z.boolean(),
  repeatedCoursePolicy: z.enum(['latest-attempt', 'best-attempt']),
})

const policyPayloadSchema = z.object({
  gradeBands: z.array(gradeBandSchema).min(1).optional(),
  ceSeeSplit: ceSeeSplitSchema.optional(),
  ceComponentCaps: ceComponentCapsSchema.optional(),
  workingCalendar: workingCalendarSchema.optional(),
  sgpaCgpaRules: sgpaCgpaRulesSchema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one policy segment must be provided.',
})

const academicFacultyCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  overview: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const academicFacultyPatchSchema = academicFacultyCreateSchema.extend({
  version: z.number().int().positive(),
})

const batchCreateSchema = z.object({
  branchId: z.string().min(1),
  admissionYear: z.number().int().min(2000).max(2100),
  batchLabel: z.string().min(1),
  currentSemester: z.number().int().positive(),
  sectionLabels: z.array(z.string().min(1)).default([]),
  status: z.string().min(1).default('active'),
})

const batchPatchSchema = batchCreateSchema.extend({
  version: z.number().int().positive(),
})

const curriculumCourseCreateSchema = z.object({
  batchId: z.string().min(1),
  semesterNumber: z.number().int().positive(),
  courseId: z.string().min(1).optional().nullable(),
  courseCode: z.string().min(1),
  title: z.string().min(1),
  credits: z.number().int().positive(),
  status: z.string().min(1).default('active'),
})

const curriculumCoursePatchSchema = curriculumCourseCreateSchema.extend({
  version: z.number().int().positive(),
})

const policyOverrideCreateSchema = z.object({
  scopeType: scopeTypeSchema,
  scopeId: z.string().min(1),
  policy: policyPayloadSchema,
  status: z.string().min(1).default('active'),
})

const policyOverridePatchSchema = policyOverrideCreateSchema.extend({
  version: z.number().int().positive(),
})

const policyFilterSchema = z.object({
  scopeType: scopeTypeSchema.optional(),
  scopeId: z.string().min(1).optional(),
})

type PolicyPayload = z.infer<typeof policyPayloadSchema>
type ResolvedPolicy = {
  gradeBands: z.infer<typeof gradeBandSchema>[]
  ceSeeSplit: z.infer<typeof ceSeeSplitSchema>
  ceComponentCaps: z.infer<typeof ceComponentCapsSchema>
  workingCalendar: z.infer<typeof workingCalendarSchema>
  sgpaCgpaRules: z.infer<typeof sgpaCgpaRulesSchema>
}

const DEFAULT_POLICY: ResolvedPolicy = {
  gradeBands: [
    { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
    { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
    { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
    { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
  ],
  ceSeeSplit: {
    ce: 50,
    see: 50,
  },
  ceComponentCaps: {
    termTestsWeight: 20,
    quizWeight: 10,
    assignmentWeight: 20,
    maxTermTests: 2,
    maxQuizzes: 2,
    maxAssignments: 2,
  },
  workingCalendar: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    dayStart: '08:30',
    dayEnd: '16:30',
  },
  sgpaCgpaRules: {
    sgpaModel: 'credit-weighted',
    cgpaModel: 'credit-weighted-cumulative',
    rounding: '2-decimal',
    includeFailedCredits: false,
    repeatedCoursePolicy: 'latest-attempt',
  },
}

function mapAcademicFaculty(row: typeof academicFaculties.$inferSelect) {
  return {
    academicFacultyId: row.academicFacultyId,
    institutionId: row.institutionId,
    code: row.code,
    name: row.name,
    overview: row.overview,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapBatch(row: typeof batches.$inferSelect) {
  return {
    batchId: row.batchId,
    branchId: row.branchId,
    admissionYear: row.admissionYear,
    batchLabel: row.batchLabel,
    currentSemester: row.currentSemester,
    sectionLabels: parseJson(row.sectionLabelsJson, [] as string[]),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCurriculumCourse(row: typeof curriculumCourses.$inferSelect) {
  return {
    curriculumCourseId: row.curriculumCourseId,
    batchId: row.batchId,
    semesterNumber: row.semesterNumber,
    courseId: row.courseId,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPolicyOverride(row: typeof policyOverrides.$inferSelect) {
  return {
    policyOverrideId: row.policyOverrideId,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    policy: parseJson(row.policyJson, {} as PolicyPayload),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mergePolicy(base: ResolvedPolicy, override: PolicyPayload): ResolvedPolicy {
  return {
    gradeBands: override.gradeBands ?? base.gradeBands,
    ceSeeSplit: override.ceSeeSplit ?? base.ceSeeSplit,
    ceComponentCaps: override.ceComponentCaps ?? base.ceComponentCaps,
    workingCalendar: override.workingCalendar ?? base.workingCalendar,
    sgpaCgpaRules: override.sgpaCgpaRules ?? base.sgpaCgpaRules,
  }
}

async function assertScopeExists(context: RouteContext, scopeType: z.infer<typeof scopeTypeSchema>, scopeId: string) {
  if (scopeType === 'institution') {
    const [row] = await context.db.select().from(institutions).where(eq(institutions.institutionId, scopeId))
    if (!row) throw notFound('Institution scope not found')
    return row
  }
  if (scopeType === 'academic-faculty') {
    const [row] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, scopeId))
    if (!row) throw notFound('Academic faculty scope not found')
    return row
  }
  if (scopeType === 'department') {
    const [row] = await context.db.select().from(departments).where(eq(departments.departmentId, scopeId))
    if (!row) throw notFound('Department scope not found')
    return row
  }
  if (scopeType === 'branch') {
    const [row] = await context.db.select().from(branches).where(eq(branches.branchId, scopeId))
    if (!row) throw notFound('Branch scope not found')
    return row
  }
  const [row] = await context.db.select().from(batches).where(eq(batches.batchId, scopeId))
  if (!row) throw notFound('Batch scope not found')
  return row
}

async function resolveBatchPolicy(context: RouteContext, batchId: string) {
  const [institution] = await context.db.select().from(institutions)
  if (!institution) throw notFound('Institution is not configured')

  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')

  const scopeChain = [
    { scopeType: 'institution', scopeId: institution.institutionId },
    ...(department.academicFacultyId ? [{ scopeType: 'academic-faculty', scopeId: department.academicFacultyId }] : []),
    { scopeType: 'department', scopeId: department.departmentId },
    { scopeType: 'branch', scopeId: branch.branchId },
    { scopeType: 'batch', scopeId: batch.batchId },
  ] as const

  const allOverrides = await context.db.select().from(policyOverrides)
  let effectivePolicy: ResolvedPolicy = DEFAULT_POLICY
  const appliedOverrides: Array<ReturnType<typeof mapPolicyOverride> & { appliedAtScope: string }> = []

  for (const scope of scopeChain) {
    const override = allOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && item.status === 'active')
    if (!override) continue
    const mapped = mapPolicyOverride(override)
    effectivePolicy = mergePolicy(effectivePolicy, mapped.policy)
    appliedOverrides.push({
      ...mapped,
      appliedAtScope: `${scope.scopeType}:${scope.scopeId}`,
    })
  }

  return {
    batch: mapBatch(batch),
    scopeChain,
    appliedOverrides,
    effectivePolicy,
  }
}

export async function registerAdminStructureRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/academic-faculties', {
    schema: { tags: ['admin-structure'], summary: 'List academic faculties' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(academicFaculties)
    return { items: rows.map(mapAcademicFaculty) }
  })

  app.post('/api/admin/academic-faculties', {
    schema: { tags: ['admin-structure'], summary: 'Create academic faculty' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(academicFacultyCreateSchema, request.body)
    const [institution] = await context.db.select().from(institutions)
    if (!institution) throw notFound('Institution is not configured')
    const created = {
      academicFacultyId: createId('academic_faculty'),
      institutionId: institution.institutionId,
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(academicFaculties).values(created)
    await emitAuditEvent(context, {
      entityType: 'AcademicFaculty',
      entityId: created.academicFacultyId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapAcademicFaculty(created),
    })
    return mapAcademicFaculty(created)
  })

  app.patch('/api/admin/academic-faculties/:academicFacultyId', {
    schema: { tags: ['admin-structure'], summary: 'Update academic faculty' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ academicFacultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(academicFacultyPatchSchema, request.body)
    const [current] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    if (!current) throw notFound('Academic faculty not found')
    expectVersion(current.version, body.version, 'AcademicFaculty', mapAcademicFaculty(current))
    await context.db.update(academicFaculties).set({
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    const [next] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    await emitAuditEvent(context, {
      entityType: 'AcademicFaculty',
      entityId: params.academicFacultyId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapAcademicFaculty(current),
      after: mapAcademicFaculty(next),
    })
    return mapAcademicFaculty(next)
  })

  app.get('/api/admin/batches', {
    schema: { tags: ['admin-structure'], summary: 'List batches' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(batches)
    return { items: rows.map(mapBatch) }
  })

  app.post('/api/admin/batches', {
    schema: { tags: ['admin-structure'], summary: 'Create batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(batchCreateSchema, request.body)
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, body.branchId))
    if (!branch) throw notFound('Branch not found')
    const created = {
      batchId: createId('batch'),
      branchId: body.branchId,
      admissionYear: body.admissionYear,
      batchLabel: body.batchLabel,
      currentSemester: body.currentSemester,
      sectionLabelsJson: stringifyJson(body.sectionLabels),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(batches).values(created)
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: created.batchId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapBatch(created),
    })
    return mapBatch(created)
  })

  app.patch('/api/admin/batches/:batchId', {
    schema: { tags: ['admin-structure'], summary: 'Update batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(batchPatchSchema, request.body)
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, body.branchId))
    if (!branch) throw notFound('Branch not found')
    const [current] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    if (!current) throw notFound('Batch not found')
    expectVersion(current.version, body.version, 'Batch', mapBatch(current))
    await context.db.update(batches).set({
      branchId: body.branchId,
      admissionYear: body.admissionYear,
      batchLabel: body.batchLabel,
      currentSemester: body.currentSemester,
      sectionLabelsJson: stringifyJson(body.sectionLabels),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(batches.batchId, params.batchId))
    const [next] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: params.batchId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapBatch(current),
      after: mapBatch(next),
    })
    return mapBatch(next)
  })

  app.get('/api/admin/curriculum-courses', {
    schema: { tags: ['admin-structure'], summary: 'List curriculum courses' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(z.object({ batchId: z.string().min(1).optional() }), request.query)
    const rows = await context.db.select().from(curriculumCourses)
    return {
      items: rows
        .filter(item => !query.batchId || item.batchId === query.batchId)
        .map(mapCurriculumCourse),
    }
  })

  app.post('/api/admin/curriculum-courses', {
    schema: { tags: ['admin-structure'], summary: 'Create curriculum course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(curriculumCourseCreateSchema, request.body)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
    if (!batch) throw notFound('Batch not found')
    if (body.courseId) {
      const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
      if (!course) throw notFound('Course not found')
    }
    const created = {
      curriculumCourseId: createId('curriculum_course'),
      batchId: body.batchId,
      semesterNumber: body.semesterNumber,
      courseId: body.courseId ?? null,
      courseCode: body.courseCode,
      title: body.title,
      credits: body.credits,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(curriculumCourses).values(created)
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: created.curriculumCourseId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapCurriculumCourse(created),
    })
    return mapCurriculumCourse(created)
  })

  app.patch('/api/admin/curriculum-courses/:curriculumCourseId', {
    schema: { tags: ['admin-structure'], summary: 'Update curriculum course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ curriculumCourseId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumCoursePatchSchema, request.body)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
    if (!batch) throw notFound('Batch not found')
    if (body.courseId) {
      const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
      if (!course) throw notFound('Course not found')
    }
    const [current] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    if (!current) throw notFound('Curriculum course not found')
    expectVersion(current.version, body.version, 'CurriculumCourse', mapCurriculumCourse(current))
    await context.db.update(curriculumCourses).set({
      batchId: body.batchId,
      semesterNumber: body.semesterNumber,
      courseId: body.courseId ?? null,
      courseCode: body.courseCode,
      title: body.title,
      credits: body.credits,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    const [next] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: params.curriculumCourseId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumCourse(current),
      after: mapCurriculumCourse(next),
    })
    return mapCurriculumCourse(next)
  })

  app.get('/api/admin/policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'List policy overrides' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(policyFilterSchema, request.query)
    const rows = await context.db.select().from(policyOverrides)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapPolicyOverride),
    }
  })

  app.post('/api/admin/policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'Create policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(policyOverrideCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(policyOverrides)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId)) {
      throw conflict('A policy override already exists for this scope')
    }
    const created = {
      policyOverrideId: createId('policy'),
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(policyOverrides).values(created)
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: created.policyOverrideId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapPolicyOverride(created),
    })
    return mapPolicyOverride(created)
  })

  app.patch('/api/admin/policy-overrides/:policyOverrideId', {
    schema: { tags: ['admin-structure'], summary: 'Update policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ policyOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(policyOverridePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    if (!current) throw notFound('Policy override not found')
    expectVersion(current.version, body.version, 'PolicyOverride', mapPolicyOverride(current))
    const rows = await context.db.select().from(policyOverrides)
    const duplicate = rows.find(item => item.policyOverrideId !== params.policyOverrideId && item.scopeType === body.scopeType && item.scopeId === body.scopeId)
    if (duplicate) throw conflict('A policy override already exists for this scope')
    await context.db.update(policyOverrides).set({
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    const [next] = await context.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: params.policyOverrideId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapPolicyOverride(current),
      after: mapPolicyOverride(next),
    })
    return mapPolicyOverride(next)
  })

  app.get('/api/admin/batches/:batchId/resolved-policy', {
    schema: { tags: ['admin-structure'], summary: 'Resolve the effective policy for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    return resolveBatchPolicy(context, params.batchId)
  })

  app.post('/api/admin/batches/:batchId/resolved-policy', {
    schema: { tags: ['admin-structure'], summary: 'Prevent unsupported writes to resolved policy endpoint' },
  }, async () => {
    throw badRequest('Resolved policy is derived. Update the relevant policy override scope instead.')
  })
}
