import { createHash } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicFaculties,
  academicTerms,
  batches,
  bridgeModules,
  branches,
  courseOutcomeOverrides,
  courseTopicPartitions,
  courses,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  curriculumCourses,
  departments,
  electiveBaskets,
  electiveOptions,
  facultyAppointments,
  facultyOfferingOwnerships,
  institutions,
  policyOverrides,
  reassessmentEvents,
  roleGrants,
  riskAssessments,
  sectionOfferings,
  simulationRuns,
} from '../db/schema.js'
import { badRequest, conflict, notFound } from '../lib/http-errors.js'
import { createId } from '../lib/ids.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
export const scopeTypeSchema = z.enum(['institution', 'academic-faculty', 'department', 'branch', 'batch'])

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
  courseworkWeeks: z.number().int().min(1).max(52).default(16),
  examPreparationWeeks: z.number().int().min(0).max(52).default(1),
  seeWeeks: z.number().int().min(0).max(52).default(3),
  totalWeeks: z.number().int().min(1).max(52).default(20),
})

const attendanceRulesSchema = z.object({
  minimumRequiredPercent: z.number().min(0).max(100),
  condonationFloorPercent: z.number().min(0).max(100),
})

const condonationRulesSchema = z.object({
  maximumShortagePercent: z.number().min(0).max(100),
  requiresApproval: z.boolean(),
})

const eligibilityRulesSchema = z.object({
  minimumCeForSeeEligibility: z.number().min(0).max(100),
  allowCondonationForSeeEligibility: z.boolean(),
})

const passRulesSchema = z.object({
  minimumCeMark: z.number().min(0).max(100),
  minimumSeeMark: z.number().min(0).max(100),
  minimumOverallMark: z.number().min(0).max(100),
  ceMaximum: z.number().min(1).max(100),
  seeMaximum: z.number().min(1).max(100),
  overallMaximum: z.number().min(1).max(100),
})

const roundingRulesSchema = z.object({
  statusMarkRounding: z.enum(['nearest-integer']),
  applyBeforeStatusDetermination: z.boolean(),
  sgpaCgpaDecimals: z.number().int().min(0).max(4),
})

const sgpaCgpaRulesSchema = z.object({
  sgpaModel: z.enum(['credit-weighted']),
  cgpaModel: z.enum(['credit-weighted-cumulative']),
  rounding: z.enum(['2-decimal']),
  includeFailedCredits: z.boolean(),
  repeatedCoursePolicy: z.enum(['latest-attempt', 'best-attempt']),
})

const progressionRulesSchema = z.object({
  passMarkPercent: z.number().min(0).max(100),
  minimumCgpaForPromotion: z.number().min(0).max(10),
  requireNoActiveBacklogs: z.boolean(),
})

const riskRulesSchema = z.object({
  highRiskAttendancePercentBelow: z.number().min(0).max(100),
  mediumRiskAttendancePercentBelow: z.number().min(0).max(100),
  highRiskCgpaBelow: z.number().min(0).max(10),
  mediumRiskCgpaBelow: z.number().min(0).max(10),
  highRiskBacklogCount: z.number().int().min(0).max(50),
  mediumRiskBacklogCount: z.number().int().min(0).max(50),
}).refine(value => value.highRiskAttendancePercentBelow <= value.mediumRiskAttendancePercentBelow, {
  message: 'High risk attendance threshold must be less than or equal to medium risk attendance threshold',
}).refine(value => value.highRiskCgpaBelow <= value.mediumRiskCgpaBelow, {
  message: 'High risk CGPA threshold must be less than or equal to medium risk CGPA threshold',
}).refine(value => value.highRiskBacklogCount >= value.mediumRiskBacklogCount, {
  message: 'High risk backlog threshold must be greater than or equal to medium risk backlog threshold',
})

const policyPayloadSchema = z.object({
  gradeBands: z.array(gradeBandSchema).min(1).optional(),
  ceSeeSplit: ceSeeSplitSchema.optional(),
  ceComponentCaps: ceComponentCapsSchema.optional(),
  workingCalendar: workingCalendarSchema.optional(),
  attendanceRules: attendanceRulesSchema.optional(),
  condonationRules: condonationRulesSchema.optional(),
  eligibilityRules: eligibilityRulesSchema.optional(),
  passRules: passRulesSchema.optional(),
  roundingRules: roundingRulesSchema.optional(),
  sgpaCgpaRules: sgpaCgpaRulesSchema.optional(),
  progressionRules: progressionRulesSchema.optional(),
  riskRules: riskRulesSchema.optional(),
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

const curriculumFeatureOutcomeSchema = z.object({
  id: z.string().min(1),
  desc: z.string().min(1),
  bloom: z.string().min(1),
})

const curriculumFeatureEdgeSchema = z.object({
  sourceCourseCode: z.string().min(1),
  edgeKind: z.enum(['explicit', 'added']).default('explicit'),
  rationale: z.string().min(1),
})

const curriculumFeatureTopicSchema = z.object({
  tt1: z.array(z.string().min(1)).default([]),
  tt2: z.array(z.string().min(1)).default([]),
  see: z.array(z.string().min(1)).default([]),
  workbook: z.array(z.string().min(1)).default([]),
})

const curriculumFeatureConfigPatchSchema = z.object({
  assessmentProfile: z.string().min(1).default('admin-authored'),
  outcomes: z.array(curriculumFeatureOutcomeSchema).min(1),
  prerequisites: z.array(curriculumFeatureEdgeSchema).default([]),
  bridgeModules: z.array(z.string().min(1)).default([]),
  topicPartitions: curriculumFeatureTopicSchema,
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

export type PolicyPayload = z.infer<typeof policyPayloadSchema>
export type ResolvedPolicy = {
  gradeBands: z.infer<typeof gradeBandSchema>[]
  ceSeeSplit: z.infer<typeof ceSeeSplitSchema>
  ceComponentCaps: z.infer<typeof ceComponentCapsSchema>
  workingCalendar: z.infer<typeof workingCalendarSchema>
  attendanceRules: z.infer<typeof attendanceRulesSchema>
  condonationRules: z.infer<typeof condonationRulesSchema>
  eligibilityRules: z.infer<typeof eligibilityRulesSchema>
  passRules: z.infer<typeof passRulesSchema>
  roundingRules: z.infer<typeof roundingRulesSchema>
  sgpaCgpaRules: z.infer<typeof sgpaCgpaRulesSchema>
  progressionRules: z.infer<typeof progressionRulesSchema>
  riskRules: z.infer<typeof riskRulesSchema>
}

export const DEFAULT_POLICY: ResolvedPolicy = {
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
    ce: 60,
    see: 40,
  },
  ceComponentCaps: {
    termTestsWeight: 30,
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
    courseworkWeeks: 16,
    examPreparationWeeks: 1,
    seeWeeks: 3,
    totalWeeks: 20,
  },
  attendanceRules: {
    minimumRequiredPercent: 75,
    condonationFloorPercent: 65,
  },
  condonationRules: {
    maximumShortagePercent: 10,
    requiresApproval: true,
  },
  eligibilityRules: {
    minimumCeForSeeEligibility: 24,
    allowCondonationForSeeEligibility: true,
  },
  passRules: {
    minimumCeMark: 24,
    minimumSeeMark: 16,
    minimumOverallMark: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  },
  roundingRules: {
    statusMarkRounding: 'nearest-integer',
    applyBeforeStatusDetermination: true,
    sgpaCgpaDecimals: 2,
  },
  sgpaCgpaRules: {
    sgpaModel: 'credit-weighted',
    cgpaModel: 'credit-weighted-cumulative',
    rounding: '2-decimal',
    includeFailedCredits: false,
    repeatedCoursePolicy: 'latest-attempt',
  },
  progressionRules: {
    passMarkPercent: 40,
    minimumCgpaForPromotion: 5,
    requireNoActiveBacklogs: true,
  },
  riskRules: {
    highRiskAttendancePercentBelow: 65,
    mediumRiskAttendancePercentBelow: 75,
    highRiskCgpaBelow: 6,
    mediumRiskCgpaBelow: 7,
    highRiskBacklogCount: 2,
    mediumRiskBacklogCount: 1,
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

function mapCourseOutcomeOverride(row: typeof courseOutcomeOverrides.$inferSelect) {
  const parsed = z.array(curriculumFeatureOutcomeSchema).safeParse(parseJson(row.outcomesJson, []))
  return {
    courseOutcomeOverrideId: row.courseOutcomeOverrideId,
    courseId: row.courseId,
    scopeType: row.scopeType as 'institution' | 'branch' | 'batch' | 'offering',
    scopeId: row.scopeId,
    outcomes: parsed.success ? parsed.data : [],
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function buildDefaultCourseOutcomes(courseCode: string, courseTitle: string) {
  return [
    { id: 'CO1', desc: `Explain the core concepts covered in ${courseTitle}.`, bloom: 'Understand' },
    { id: 'CO2', desc: `Apply ${courseCode} methods to solve structured academic problems.`, bloom: 'Apply' },
    { id: 'CO3', desc: `Analyse common failure patterns, tradeoffs, and edge cases in ${courseTitle}.`, bloom: 'Analyse' },
    { id: 'CO4', desc: `Evaluate solution quality and justify implementation choices in ${courseTitle}.`, bloom: 'Evaluate' },
  ]
}

function normalizeFeatureStringList(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}

function sanitizeInternalCompilerId(courseCode: string, title: string) {
  const seed = courseCode.trim() || title.trim()
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || createId('course_seed')
}

function buildSnapshotChecksum(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

async function getLatestCurriculumImport(context: RouteContext, batchId: string) {
  const rows = await context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId))
  return rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))[0] ?? null
}

function findCurriculumNodeForCourse(
  nodeRows: Array<typeof curriculumNodes.$inferSelect>,
  course: {
    courseId?: string | null
    courseCode: string
    title: string
    semesterNumber: number
  },
) {
  return nodeRows.find(row =>
    (course.courseId && row.courseId === course.courseId)
    || (row.semesterNumber === course.semesterNumber && row.courseCode.toLowerCase() === course.courseCode.toLowerCase())
    || (row.semesterNumber === course.semesterNumber && row.title.toLowerCase() === course.title.toLowerCase())
  ) ?? null
}

async function ensureCourseRecordForCurriculumCourse(context: RouteContext, curriculumCourse: typeof curriculumCourses.$inferSelect) {
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, curriculumCourse.batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')

  let course = curriculumCourse.courseId
    ? (await context.db.select().from(courses).where(eq(courses.courseId, curriculumCourse.courseId)))[0] ?? null
    : null

  if (!course) {
    const departmentCourses = await context.db.select().from(courses).where(eq(courses.departmentId, department.departmentId))
    course = departmentCourses.find(row => row.courseCode.toLowerCase() === curriculumCourse.courseCode.toLowerCase()) ?? null
  }

  if (!course) {
    const createdCourse = {
      courseId: createId('course'),
      institutionId: department.institutionId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(courses).values(createdCourse)
    course = createdCourse
  } else if (
    course.courseCode !== curriculumCourse.courseCode
    || course.title !== curriculumCourse.title
    || course.defaultCredits !== curriculumCourse.credits
    || course.departmentId !== department.departmentId
    || course.status !== 'active'
  ) {
    await context.db.update(courses).set({
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: course.version + 1,
      updatedAt: context.now(),
    }).where(eq(courses.courseId, course.courseId))
    course = {
      ...course,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: course.version + 1,
      updatedAt: context.now(),
    }
  }

  if (curriculumCourse.courseId !== course.courseId) {
    await context.db.update(curriculumCourses).set({
      courseId: course.courseId,
      updatedAt: context.now(),
      version: curriculumCourse.version + 1,
    }).where(eq(curriculumCourses.curriculumCourseId, curriculumCourse.curriculumCourseId))
  }

  return course
}

async function ensureEditableCurriculumImport(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
}) {
  const existing = await getLatestCurriculumImport(context, input.batchId)
  if (existing) return existing

  const curriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))

  const checksum = buildSnapshotChecksum(curriculumRows.map(row => ({
    semesterNumber: row.semesterNumber,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    status: row.status,
  })))
  const firstSemester = curriculumRows[0]?.semesterNumber ?? 1
  const lastSemester = curriculumRows.at(-1)?.semesterNumber ?? firstSemester
  const importRow = {
    curriculumImportVersionId: createId('curriculum_import'),
    batchId: input.batchId,
    sourceLabel: 'system-admin-live',
    sourceChecksum: checksum,
    sourcePath: null,
    sourceType: 'admin',
    compilerVersion: 'system-admin-live-v1',
    outputChecksum: checksum,
    firstSemester,
    lastSemester,
    courseCount: curriculumRows.length,
    totalCredits: curriculumRows.reduce((sum, row) => sum + row.credits, 0),
    explicitEdgeCount: 0,
    addedEdgeCount: 0,
    bridgeModuleCount: 0,
    electiveOptionCount: 0,
    unresolvedMappingCount: 0,
    validationStatus: 'admin-managed',
    completenessCertificateJson: stringifyJson({
      sourceLabel: 'system-admin-live',
      managedBy: 'sysadmin',
      courseCount: curriculumRows.length,
      totalCredits: curriculumRows.reduce((sum, row) => sum + row.credits, 0),
    }),
    approvedByFacultyId: input.actorFacultyId ?? null,
    approvedAt: input.now,
    status: 'approved',
    createdAt: input.now,
    updatedAt: input.now,
  }
  await context.db.insert(curriculumImportVersions).values(importRow)

  for (const curriculumCourse of curriculumRows) {
    const course = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    await context.db.insert(curriculumNodes).values({
      curriculumNodeId: createId('curriculum_node'),
      curriculumImportVersionId: importRow.curriculumImportVersionId,
      batchId: input.batchId,
      semesterNumber: curriculumCourse.semesterNumber,
      courseId: course.courseId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      credits: curriculumCourse.credits,
      internalCompilerId: sanitizeInternalCompilerId(curriculumCourse.courseCode, curriculumCourse.title),
      officialWebCode: curriculumCourse.courseCode,
      officialWebTitle: curriculumCourse.title,
      matchStatus: 'admin-authored',
      mappingNote: 'System-admin managed curriculum snapshot.',
      assessmentProfile: 'admin-authored',
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  return importRow
}

async function upsertCurriculumNodeForCourse(context: RouteContext, input: {
  batchId: string
  curriculumImportVersionId: string
  curriculumCourse: typeof curriculumCourses.$inferSelect
  courseId: string
  assessmentProfile?: string | null
  now: string
}) {
  const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, input.curriculumImportVersionId))
  const current = findCurriculumNodeForCourse(nodeRows, {
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    semesterNumber: input.curriculumCourse.semesterNumber,
  })

  if (current) {
    await context.db.update(curriculumNodes).set({
      semesterNumber: input.curriculumCourse.semesterNumber,
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      credits: input.curriculumCourse.credits,
      internalCompilerId: current.internalCompilerId || sanitizeInternalCompilerId(input.curriculumCourse.courseCode, input.curriculumCourse.title),
      officialWebCode: input.curriculumCourse.courseCode,
      officialWebTitle: input.curriculumCourse.title,
      matchStatus: current.matchStatus || 'admin-authored',
      mappingNote: current.mappingNote ?? 'System-admin managed curriculum snapshot.',
      assessmentProfile: input.assessmentProfile ?? current.assessmentProfile ?? 'admin-authored',
      status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
      updatedAt: input.now,
    }).where(eq(curriculumNodes.curriculumNodeId, current.curriculumNodeId))
    return {
      ...current,
      semesterNumber: input.curriculumCourse.semesterNumber,
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      credits: input.curriculumCourse.credits,
      officialWebCode: input.curriculumCourse.courseCode,
      officialWebTitle: input.curriculumCourse.title,
      assessmentProfile: input.assessmentProfile ?? current.assessmentProfile ?? 'admin-authored',
      status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
      updatedAt: input.now,
    }
  }

  const created = {
    curriculumNodeId: createId('curriculum_node'),
    curriculumImportVersionId: input.curriculumImportVersionId,
    batchId: input.batchId,
    semesterNumber: input.curriculumCourse.semesterNumber,
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    credits: input.curriculumCourse.credits,
    internalCompilerId: sanitizeInternalCompilerId(input.curriculumCourse.courseCode, input.curriculumCourse.title),
    officialWebCode: input.curriculumCourse.courseCode,
    officialWebTitle: input.curriculumCourse.title,
    matchStatus: 'admin-authored',
    mappingNote: 'System-admin managed curriculum snapshot.',
    assessmentProfile: input.assessmentProfile ?? 'admin-authored',
    status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
    createdAt: input.now,
    updatedAt: input.now,
  }
  await context.db.insert(curriculumNodes).values(created)
  return created
}

async function refreshCurriculumImportSummary(context: RouteContext, input: {
  batchId: string
  curriculumImportVersionId: string
  now: string
}) {
  const [importRow] = await context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
  if (!importRow) return

  const [nodeRows, edgeRows, bridgeRows, basketRows, optionRows] = await Promise.all([
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(electiveBaskets).where(eq(electiveBaskets.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(electiveOptions),
  ])

  const activeNodes = nodeRows.filter(row => row.status === 'active').sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
  const basketIds = new Set(basketRows.map(row => row.electiveBasketId))
  const scopedOptions = optionRows.filter(row => basketIds.has(row.electiveBasketId))
  const snapshotPayload = {
    nodes: activeNodes.map(row => ({
      semesterNumber: row.semesterNumber,
      courseCode: row.courseCode,
      title: row.title,
      credits: row.credits,
      status: row.status,
      assessmentProfile: row.assessmentProfile,
    })),
    edges: edgeRows.filter(row => row.status === 'active').map(row => ({
      sourceCurriculumNodeId: row.sourceCurriculumNodeId,
      targetCurriculumNodeId: row.targetCurriculumNodeId,
      edgeKind: row.edgeKind,
      rationale: row.rationale,
      status: row.status,
    })),
    bridges: bridgeRows.filter(row => row.status === 'active').map(row => ({
      curriculumNodeId: row.curriculumNodeId,
      moduleTitlesJson: row.moduleTitlesJson,
      status: row.status,
    })),
    electiveOptions: scopedOptions.map(row => ({
      electiveBasketId: row.electiveBasketId,
      code: row.code,
      title: row.title,
      stream: row.stream,
      semesterSlot: row.semesterSlot,
    })),
  }
  const checksum = buildSnapshotChecksum(snapshotPayload)
  await context.db.update(curriculumImportVersions).set({
    sourceChecksum: importRow.sourceType === 'admin' ? checksum : importRow.sourceChecksum,
    outputChecksum: checksum,
    firstSemester: activeNodes[0]?.semesterNumber ?? importRow.firstSemester,
    lastSemester: activeNodes.at(-1)?.semesterNumber ?? importRow.lastSemester,
    courseCount: activeNodes.length,
    totalCredits: activeNodes.reduce((sum, row) => sum + row.credits, 0),
    explicitEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'explicit').length,
    addedEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'added').length,
    bridgeModuleCount: bridgeRows.filter(row => row.status === 'active').length,
    electiveOptionCount: scopedOptions.length,
    validationStatus: importRow.sourceType === 'admin' ? 'admin-managed' : importRow.validationStatus,
    completenessCertificateJson: stringifyJson({
      sourceLabel: importRow.sourceLabel,
      managedBy: importRow.sourceType === 'admin' ? 'sysadmin' : 'import',
      courseCount: activeNodes.length,
      totalCredits: activeNodes.reduce((sum, row) => sum + row.credits, 0),
      explicitEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'explicit').length,
      addedEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'added').length,
      bridgeModuleCount: bridgeRows.filter(row => row.status === 'active').length,
      electiveOptionCount: scopedOptions.length,
    }),
    updatedAt: input.now,
  }).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
}

async function syncCurriculumCourseIntoImport(context: RouteContext, input: {
  curriculumCourse: typeof curriculumCourses.$inferSelect
  actorFacultyId?: string | null
  now: string
}) {
  const latestImport = await getLatestCurriculumImport(context, input.curriculumCourse.batchId)
  if ((input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived') && !latestImport) return null
  const editableImport = latestImport ?? await ensureEditableCurriculumImport(context, {
    batchId: input.curriculumCourse.batchId,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
  })
  if (input.curriculumCourse.status !== 'deleted' && input.curriculumCourse.status !== 'archived') {
    const course = await ensureCourseRecordForCurriculumCourse(context, input.curriculumCourse)
    await upsertCurriculumNodeForCourse(context, {
      batchId: input.curriculumCourse.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumCourse: input.curriculumCourse,
      courseId: course.courseId,
      now: input.now,
    })
  } else {
    const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, editableImport.curriculumImportVersionId))
    const existingNode = findCurriculumNodeForCourse(nodeRows, {
      courseId: input.curriculumCourse.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      semesterNumber: input.curriculumCourse.semesterNumber,
    })
    if (existingNode) {
      await context.db.update(curriculumNodes).set({
        status: 'deleted',
        updatedAt: input.now,
      }).where(eq(curriculumNodes.curriculumNodeId, existingNode.curriculumNodeId))
    }
  }
  await refreshCurriculumImportSummary(context, {
    batchId: input.curriculumCourse.batchId,
    curriculumImportVersionId: editableImport.curriculumImportVersionId,
    now: input.now,
  })
  return editableImport
}

function mergePolicy(base: ResolvedPolicy, override: PolicyPayload): ResolvedPolicy {
  return {
    gradeBands: override.gradeBands ?? base.gradeBands,
    ceSeeSplit: override.ceSeeSplit ?? base.ceSeeSplit,
    ceComponentCaps: override.ceComponentCaps ?? base.ceComponentCaps,
    workingCalendar: override.workingCalendar ?? base.workingCalendar,
    attendanceRules: override.attendanceRules ?? base.attendanceRules,
    condonationRules: override.condonationRules ?? base.condonationRules,
    eligibilityRules: override.eligibilityRules ?? base.eligibilityRules,
    passRules: override.passRules ?? base.passRules,
    roundingRules: override.roundingRules ?? base.roundingRules,
    sgpaCgpaRules: override.sgpaCgpaRules ?? base.sgpaCgpaRules,
    progressionRules: override.progressionRules ?? base.progressionRules,
    riskRules: override.riskRules ?? base.riskRules,
  }
}

type AcademicFacultyCascadeSummary = {
  departmentsDeleted: number
  branchesDeleted: number
  batchesDeleted: number
  termsDeleted: number
  coursesDeleted: number
  curriculumCoursesDeleted: number
  policyOverridesDeleted: number
  offeringsDeleted: number
  ownershipsDeleted: number
  appointmentsDeleted: number
  roleGrantsDeleted: number
}

function createAcademicFacultyCascadeSummary(): AcademicFacultyCascadeSummary {
  return {
    departmentsDeleted: 0,
    branchesDeleted: 0,
    batchesDeleted: 0,
    termsDeleted: 0,
    coursesDeleted: 0,
    curriculumCoursesDeleted: 0,
    policyOverridesDeleted: 0,
    offeringsDeleted: 0,
    ownershipsDeleted: 0,
    appointmentsDeleted: 0,
    roleGrantsDeleted: 0,
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

async function buildProofSandboxSummary(context: RouteContext, batchId: string) {
  const [
    importRows,
    nodeRows,
    edgeRows,
    bridgeRows,
    simulationRows,
    assessmentRows,
    reassessmentRows,
  ] = await Promise.all([
    context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId)),
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.batchId, batchId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.batchId, batchId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.batchId, batchId)),
    context.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId)),
    context.db.select().from(riskAssessments),
    context.db.select().from(reassessmentEvents),
  ])

  const latestImport = importRows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  const latestRun = simulationRows.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const latestRunMetrics = latestRun ? parseJson(latestRun.metricsJson, {} as Record<string, unknown>) : {}
  const scopedAssessments = latestRun
    ? assessmentRows.filter(row => row.simulationRunId === latestRun.simulationRunId)
    : []
  const scopedAssessmentIds = new Set(scopedAssessments.map(row => row.riskAssessmentId))
  const activeReassessmentCount = reassessmentRows.filter(row => scopedAssessmentIds.has(row.riskAssessmentId) && row.status !== 'completed').length

  return {
    hasProofData: !!latestImport || !!latestRun,
    curriculumImport: latestImport
      ? {
          curriculumImportVersionId: latestImport.curriculumImportVersionId,
          sourceLabel: latestImport.sourceLabel,
          sourceChecksum: latestImport.sourceChecksum,
          semesterRange: [latestImport.firstSemester, latestImport.lastSemester] as [number, number],
          courseCount: latestImport.courseCount,
          totalCredits: latestImport.totalCredits,
          explicitEdgeCount: latestImport.explicitEdgeCount,
          addedEdgeCount: latestImport.addedEdgeCount,
          bridgeModuleCount: latestImport.bridgeModuleCount,
          electiveOptionCount: latestImport.electiveOptionCount,
          importedAt: latestImport.createdAt,
          status: latestImport.status,
        }
      : null,
    structureSummary: {
      nodeCount: nodeRows.length,
      explicitEdgeCount: edgeRows.filter(row => row.edgeKind === 'explicit').length,
      addedEdgeCount: edgeRows.filter(row => row.edgeKind === 'added').length,
      bridgeModuleCount: bridgeRows.length,
    },
    latestSimulationRun: latestRun
      ? {
          simulationRunId: latestRun.simulationRunId,
          runLabel: latestRun.runLabel,
          status: latestRun.status,
          seed: latestRun.seed,
          sectionCount: latestRun.sectionCount,
          studentCount: latestRun.studentCount,
          facultyCount: latestRun.facultyCount,
          semesterRange: [latestRun.semesterStart, latestRun.semesterEnd] as [number, number],
          createdAt: latestRun.createdAt,
          metrics: latestRunMetrics,
        }
      : null,
    monitoringSummary: {
      riskAssessmentCount: scopedAssessments.length,
      activeReassessmentCount,
    },
  }
}

export async function resolveBatchPolicy(context: RouteContext, batchId: string) {
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

  const proofSandbox = await buildProofSandboxSummary(context, batch.batchId)

  return {
    batch: mapBatch(batch),
    scopeChain,
    appliedOverrides,
    effectivePolicy,
    proofSandbox,
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
    const now = context.now()
    const cascadeSummary = createAcademicFacultyCascadeSummary()

    if (body.status === 'deleted' && current.status !== 'deleted') {
      const [
        departmentRows,
        branchRows,
        batchRows,
        termRows,
        courseRows,
        curriculumRows,
        policyRows,
        offeringRows,
        ownershipRows,
        appointmentRows,
        roleGrantRows,
      ] = await Promise.all([
        context.db.select().from(departments),
        context.db.select().from(branches),
        context.db.select().from(batches),
        context.db.select().from(academicTerms),
        context.db.select().from(courses),
        context.db.select().from(curriculumCourses),
        context.db.select().from(policyOverrides),
        context.db.select().from(sectionOfferings),
        context.db.select().from(facultyOfferingOwnerships),
        context.db.select().from(facultyAppointments),
        context.db.select().from(roleGrants),
      ])

      const departmentIds = new Set(
        departmentRows
          .filter(row => row.academicFacultyId === params.academicFacultyId)
          .map(row => row.departmentId),
      )
      const branchIds = new Set(
        branchRows
          .filter(row => departmentIds.has(row.departmentId))
          .map(row => row.branchId),
      )
      const batchIds = new Set(
        batchRows
          .filter(row => branchIds.has(row.branchId))
          .map(row => row.batchId),
      )
      const termIds = new Set(
        termRows
          .filter(row => branchIds.has(row.branchId) || (row.batchId ? batchIds.has(row.batchId) : false))
          .map(row => row.termId),
      )
      const courseIds = new Set(
        courseRows
          .filter(row => departmentIds.has(row.departmentId))
          .map(row => row.courseId),
      )
      const offeringIds = new Set(
        offeringRows
          .filter(row => branchIds.has(row.branchId) || termIds.has(row.termId) || courseIds.has(row.courseId))
          .map(row => row.offeringId),
      )

      for (const row of curriculumRows.filter(item => batchIds.has(item.batchId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(curriculumCourses).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(curriculumCourses.curriculumCourseId, row.curriculumCourseId))
        await emitAuditEvent(context, {
          entityType: 'CurriculumCourse',
          entityId: row.curriculumCourseId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapCurriculumCourse(row),
          after: mapCurriculumCourse(next),
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.curriculumCoursesDeleted += 1
      }

      for (const row of offeringRows.filter(item => offeringIds.has(item.offeringId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(sectionOfferings).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(sectionOfferings.offeringId, row.offeringId))
        await emitAuditEvent(context, {
          entityType: 'section_offering',
          entityId: row.offeringId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.offeringsDeleted += 1
      }

      for (const row of ownershipRows.filter(item => offeringIds.has(item.offeringId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(facultyOfferingOwnerships).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(facultyOfferingOwnerships.ownershipId, row.ownershipId))
        await emitAuditEvent(context, {
          entityType: 'faculty_offering_ownership',
          entityId: row.ownershipId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.ownershipsDeleted += 1
      }

      for (const row of courseRows.filter(item => courseIds.has(item.courseId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(courses).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(courses.courseId, row.courseId))
        await emitAuditEvent(context, {
          entityType: 'Course',
          entityId: row.courseId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.coursesDeleted += 1
      }

      for (const row of termRows.filter(item => termIds.has(item.termId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(academicTerms).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(academicTerms.termId, row.termId))
        await emitAuditEvent(context, {
          entityType: 'AcademicTerm',
          entityId: row.termId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.termsDeleted += 1
      }

      for (const row of batchRows.filter(item => batchIds.has(item.batchId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(batches).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(batches.batchId, row.batchId))
        await emitAuditEvent(context, {
          entityType: 'Batch',
          entityId: row.batchId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapBatch(row),
          after: mapBatch(next),
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.batchesDeleted += 1
      }

      for (const row of branchRows.filter(item => branchIds.has(item.branchId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(branches).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(branches.branchId, row.branchId))
        await emitAuditEvent(context, {
          entityType: 'Branch',
          entityId: row.branchId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.branchesDeleted += 1
      }

      for (const row of departmentRows.filter(item => departmentIds.has(item.departmentId) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(departments).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(departments.departmentId, row.departmentId))
        await emitAuditEvent(context, {
          entityType: 'Department',
          entityId: row.departmentId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.departmentsDeleted += 1
      }

      for (const row of policyRows.filter(item => (
        (item.scopeType === 'academic-faculty' && item.scopeId === params.academicFacultyId)
        || (item.scopeType === 'department' && departmentIds.has(item.scopeId))
        || (item.scopeType === 'branch' && branchIds.has(item.scopeId))
        || (item.scopeType === 'batch' && batchIds.has(item.scopeId))
      ) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(policyOverrides).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(policyOverrides.policyOverrideId, row.policyOverrideId))
        await emitAuditEvent(context, {
          entityType: 'PolicyOverride',
          entityId: row.policyOverrideId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapPolicyOverride(row),
          after: mapPolicyOverride(next),
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.policyOverridesDeleted += 1
      }

      for (const row of appointmentRows.filter(item => (
        departmentIds.has(item.departmentId)
        || (item.branchId ? branchIds.has(item.branchId) : false)
      ) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(facultyAppointments).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(facultyAppointments.appointmentId, row.appointmentId))
        await emitAuditEvent(context, {
          entityType: 'FacultyAppointment',
          entityId: row.appointmentId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.appointmentsDeleted += 1
      }

      for (const row of roleGrantRows.filter(item => (
        (item.scopeType === 'academic-faculty' && item.scopeId === params.academicFacultyId)
        || (item.scopeType === 'department' && departmentIds.has(item.scopeId))
        || (item.scopeType === 'branch' && branchIds.has(item.scopeId))
        || (item.scopeType === 'batch' && batchIds.has(item.scopeId))
      ) && item.status !== 'deleted')) {
        const next = {
          ...row,
          status: 'deleted',
          version: row.version + 1,
          updatedAt: now,
        }
        await context.db.update(roleGrants).set({
          status: next.status,
          version: next.version,
          updatedAt: next.updatedAt,
        }).where(eq(roleGrants.grantId, row.grantId))
        await emitAuditEvent(context, {
          entityType: 'RoleGrant',
          entityId: row.grantId,
          action: 'cascade_deleted',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: row,
          after: next,
          metadata: { reason: 'academic_faculty_deleted', academicFacultyId: params.academicFacultyId },
        })
        cascadeSummary.roleGrantsDeleted += 1
      }
    }

    await context.db.update(academicFaculties).set({
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: now,
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
      metadata: body.status === 'deleted' && current.status !== 'deleted'
        ? {
            reason: 'academic_faculty_deleted',
            cascade: cascadeSummary,
          }
        : undefined,
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
    await syncCurriculumCourseIntoImport(context, {
      curriculumCourse: created,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    const [persisted] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, created.curriculumCourseId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: created.curriculumCourseId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapCurriculumCourse(persisted ?? created),
    })
    return mapCurriculumCourse(persisted ?? created)
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
    if (!next) throw notFound('Curriculum course not found after update')
    await syncCurriculumCourseIntoImport(context, {
      curriculumCourse: next,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    const [persisted] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumCourse',
      entityId: params.curriculumCourseId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumCourse(current),
      after: mapCurriculumCourse(persisted ?? next),
    })
    return mapCurriculumCourse(persisted ?? next)
  })

  app.get('/api/admin/batches/:batchId/curriculum-feature-config', {
    schema: { tags: ['admin-structure'], summary: 'List sysadmin-owned model feature inputs for a batch curriculum' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    if (!batch) throw notFound('Batch not found')

    const latestImport = await getLatestCurriculumImport(context, params.batchId)
    const [curriculumRows, nodeRows, edgeRows, bridgeRows, topicRows, outcomeRows] = await Promise.all([
      context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, params.batchId)),
      latestImport ? context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
      latestImport ? context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
      latestImport ? context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
      latestImport ? context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
      context.db.select().from(courseOutcomeOverrides),
    ])

    const visibleCurriculumRows = curriculumRows
      .filter(row => row.status !== 'deleted' && row.status !== 'archived')
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
    const nodeById = new Map(nodeRows.map(row => [row.curriculumNodeId, row]))
    const nodeKeySet = new Set(visibleCurriculumRows.map(row => `${row.semesterNumber}::${row.courseCode.toLowerCase()}`))
    const nodeOnlyRows = nodeRows
      .filter(row => row.status === 'active')
      .filter(row => !nodeKeySet.has(`${row.semesterNumber}::${row.courseCode.toLowerCase()}`))
      .map(row => ({
        curriculumCourseId: `import:${row.curriculumNodeId}`,
        batchId: params.batchId,
        semesterNumber: row.semesterNumber,
        courseId: row.courseId,
        courseCode: row.courseCode,
        title: row.title,
        credits: row.credits,
        status: 'active',
        version: 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))

    const items = [...visibleCurriculumRows, ...nodeOnlyRows].map(curriculumCourse => {
      const node = findCurriculumNodeForCourse(nodeRows, curriculumCourse)
      const activeOutcomeOverride = curriculumCourse.courseId
        ? outcomeRows
          .filter(row => row.courseId === curriculumCourse.courseId && row.scopeType === 'batch' && row.scopeId === params.batchId && row.status === 'active')
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
        : null
      const prerequisiteRows = node
        ? edgeRows
          .filter(row => row.targetCurriculumNodeId === node.curriculumNodeId && row.status === 'active')
          .map(row => {
            const sourceNode = nodeById.get(row.sourceCurriculumNodeId) ?? null
            return {
              curriculumEdgeId: row.curriculumEdgeId,
              sourceCurriculumNodeId: row.sourceCurriculumNodeId,
              sourceCourseCode: sourceNode?.courseCode ?? row.sourceCurriculumNodeId,
              sourceTitle: sourceNode?.title ?? row.sourceCurriculumNodeId,
              edgeKind: row.edgeKind,
              rationale: row.rationale,
              status: row.status,
            }
          })
        : []
      const bridgeRow = node
        ? bridgeRows
          .filter(row => row.curriculumNodeId === node.curriculumNodeId && row.status === 'active')
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
        : null
      const topicByKind = new Map(
        (node ? topicRows.filter(row => row.curriculumNodeId === node.curriculumNodeId) : []).map(row => [
          row.partitionKind,
          normalizeFeatureStringList(parseJson(row.topicsJson, [] as string[])),
        ]),
      )
      return {
        curriculumCourseId: curriculumCourse.curriculumCourseId,
        curriculumImportVersionId: latestImport?.curriculumImportVersionId ?? null,
        curriculumNodeId: node?.curriculumNodeId ?? null,
        courseId: curriculumCourse.courseId ?? node?.courseId ?? null,
        semesterNumber: curriculumCourse.semesterNumber,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        credits: curriculumCourse.credits,
        assessmentProfile: node?.assessmentProfile ?? 'admin-authored',
        outcomes: activeOutcomeOverride ? mapCourseOutcomeOverride(activeOutcomeOverride).outcomes : buildDefaultCourseOutcomes(curriculumCourse.courseCode, curriculumCourse.title),
        outcomeOverride: activeOutcomeOverride ? mapCourseOutcomeOverride(activeOutcomeOverride) : null,
        prerequisites: prerequisiteRows,
        bridgeModules: bridgeRow ? normalizeFeatureStringList(parseJson(bridgeRow.moduleTitlesJson, [] as string[])) : [],
        topicPartitions: {
          tt1: topicByKind.get('tt1') ?? [],
          tt2: topicByKind.get('tt2') ?? [],
          see: topicByKind.get('see') ?? [],
          workbook: topicByKind.get('workbook') ?? [],
        },
      }
    })

    return {
      batchId: params.batchId,
      curriculumImportVersion: latestImport
        ? {
            curriculumImportVersionId: latestImport.curriculumImportVersionId,
            sourceLabel: latestImport.sourceLabel,
            sourceType: latestImport.sourceType,
            status: latestImport.status,
            validationStatus: latestImport.validationStatus,
            updatedAt: latestImport.updatedAt,
          }
        : null,
      items,
    }
  })

  app.put('/api/admin/batches/:batchId/curriculum-feature-config/:curriculumCourseId', {
    schema: { tags: ['admin-structure'], summary: 'Save sysadmin-owned model feature inputs for one curriculum course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({
      batchId: z.string().min(1),
      curriculumCourseId: z.string().min(1),
    }), request.params)
    const body = parseOrThrow(curriculumFeatureConfigPatchSchema, request.body)
    const [curriculumCourse] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
    if (!curriculumCourse || curriculumCourse.batchId !== params.batchId) throw notFound('Curriculum course not found')

    const editableImport = await ensureEditableCurriculumImport(context, {
      batchId: params.batchId,
      actorFacultyId: auth.facultyId,
      now: context.now(),
    })
    const course = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    const node = await upsertCurriculumNodeForCourse(context, {
      batchId: params.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumCourse,
      courseId: course.courseId,
      assessmentProfile: body.assessmentProfile,
      now: context.now(),
    })

    const batchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, params.batchId)))
      .filter(row => row.status !== 'deleted' && row.status !== 'archived')
    const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, editableImport.curriculumImportVersionId))
    const existingTargetEdgeRows = node
      ? (await context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
        .filter(row => row.targetCurriculumNodeId === node.curriculumNodeId)
      : []
    if (existingTargetEdgeRows.length > 0) {
      await context.db.delete(curriculumEdges).where(inArray(curriculumEdges.curriculumEdgeId, existingTargetEdgeRows.map(row => row.curriculumEdgeId)))
    }

    const prerequisiteRows: Array<typeof curriculumEdges.$inferInsert> = []
    for (const prerequisite of body.prerequisites) {
      const sourceCourse = batchCurriculumRows.find(row => row.courseCode.toLowerCase() === prerequisite.sourceCourseCode.toLowerCase())
      if (!sourceCourse) {
        throw badRequest(`Prerequisite course ${prerequisite.sourceCourseCode} is not present in the selected batch curriculum.`)
      }
      const sourceCourseRecord = await ensureCourseRecordForCurriculumCourse(context, sourceCourse)
      const sourceNode = findCurriculumNodeForCourse(nodeRows, {
        courseId: sourceCourseRecord.courseId,
        courseCode: sourceCourse.courseCode,
        title: sourceCourse.title,
        semesterNumber: sourceCourse.semesterNumber,
      }) ?? await upsertCurriculumNodeForCourse(context, {
        batchId: params.batchId,
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        curriculumCourse: sourceCourse,
        courseId: sourceCourseRecord.courseId,
        now: context.now(),
      })
      if (sourceNode.curriculumNodeId === node.curriculumNodeId) continue
      prerequisiteRows.push({
        curriculumEdgeId: createId('curriculum_edge'),
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        batchId: params.batchId,
        sourceCurriculumNodeId: sourceNode.curriculumNodeId,
        targetCurriculumNodeId: node.curriculumNodeId,
        edgeKind: prerequisite.edgeKind,
        rationale: prerequisite.rationale,
        status: 'active',
        createdAt: context.now(),
        updatedAt: context.now(),
      })
    }
    if (prerequisiteRows.length > 0) {
      await context.db.insert(curriculumEdges).values(prerequisiteRows)
    }

    const existingBridgeRows = (await context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.curriculumNodeId === node.curriculumNodeId)
    if (existingBridgeRows.length > 0) {
      await context.db.delete(bridgeModules).where(inArray(bridgeModules.bridgeModuleId, existingBridgeRows.map(row => row.bridgeModuleId)))
    }
    const bridgeModulesList = normalizeFeatureStringList(body.bridgeModules)
    if (bridgeModulesList.length > 0) {
      await context.db.insert(bridgeModules).values({
        bridgeModuleId: createId('bridge_module'),
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        curriculumNodeId: node.curriculumNodeId,
        batchId: params.batchId,
        moduleTitlesJson: stringifyJson(bridgeModulesList),
        status: 'active',
        createdAt: context.now(),
        updatedAt: context.now(),
      })
    }

    const existingTopicRows = (await context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.curriculumNodeId === node.curriculumNodeId)
    if (existingTopicRows.length > 0) {
      await context.db.delete(courseTopicPartitions).where(inArray(courseTopicPartitions.courseTopicPartitionId, existingTopicRows.map(row => row.courseTopicPartitionId)))
    }
    const topicPartitionRows = ([
      ['tt1', normalizeFeatureStringList(body.topicPartitions.tt1)],
      ['tt2', normalizeFeatureStringList(body.topicPartitions.tt2)],
      ['see', normalizeFeatureStringList(body.topicPartitions.see)],
      ['workbook', normalizeFeatureStringList(body.topicPartitions.workbook)],
    ] as const).map(([partitionKind, topics]) => ({
      courseTopicPartitionId: createId('course_topic_partition'),
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumNodeId: node.curriculumNodeId,
      partitionKind,
      topicsJson: stringifyJson(topics),
      createdAt: context.now(),
      updatedAt: context.now(),
    }))
    await context.db.insert(courseTopicPartitions).values(topicPartitionRows)

    const batchOutcomeRows = (await context.db.select().from(courseOutcomeOverrides))
      .filter(row => row.courseId === course.courseId && row.scopeType === 'batch' && row.scopeId === params.batchId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const currentOutcomeOverride = batchOutcomeRows[0] ?? null
    if (currentOutcomeOverride) {
      await context.db.update(courseOutcomeOverrides).set({
        courseId: course.courseId,
        scopeType: 'batch',
        scopeId: params.batchId,
        outcomesJson: stringifyJson(body.outcomes),
        status: 'active',
        version: currentOutcomeOverride.version + 1,
        updatedAt: context.now(),
      }).where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, currentOutcomeOverride.courseOutcomeOverrideId))
    } else {
      await context.db.insert(courseOutcomeOverrides).values({
        courseOutcomeOverrideId: createId('course_outcome_override'),
        courseId: course.courseId,
        scopeType: 'batch',
        scopeId: params.batchId,
        outcomesJson: stringifyJson(body.outcomes),
        status: 'active',
        version: 1,
        createdAt: context.now(),
        updatedAt: context.now(),
      })
    }

    await refreshCurriculumImportSummary(context, {
      batchId: params.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      now: context.now(),
    })

    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureConfig',
      entityId: `${params.batchId}:${params.curriculumCourseId}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        curriculumCourseId: params.curriculumCourseId,
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        assessmentProfile: body.assessmentProfile,
        outcomes: body.outcomes,
        prerequisites: body.prerequisites,
        bridgeModules: bridgeModulesList,
        topicPartitions: body.topicPartitions,
      },
    })

    return {
      ok: true,
      batchId: params.batchId,
      curriculumCourseId: params.curriculumCourseId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
    }
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
