import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicTerms,
  batches,
  branches,
  departments,
  facultyAppointments,
  facultyProfiles,
  institutions,
  mentorAssignments,
  roleGrants,
  studentAcademicProfiles,
  studentEnrollments,
  students,
} from '../db/schema.js'
import {
  getFacultyMentorProvisioningEligibility,
  getIsoDayBefore,
} from '../lib/academic-provisioning.js'
import { badRequest, conflict, notFound } from '../lib/http-errors.js'
import { createId } from '../lib/ids.js'
import { parseJson } from '../lib/json.js'
import { normalizeSectionCode } from '../lib/stage-policy.js'
import { resolveBatchPolicy } from './admin-structure.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const studentCreateSchema = z.object({
  usn: z.string().min(1),
  rollNumber: z.string().optional().nullable(),
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  admissionDate: z.string().min(1),
  status: z.string().min(1).default('active'),
})

const studentPatchSchema = studentCreateSchema.extend({
  version: z.number().int().positive(),
})

const enrollmentCreateSchema = z.object({
  studentId: z.string().min(1),
  branchId: z.string().min(1),
  termId: z.string().min(1),
  sectionCode: z.string().min(1),
  rosterOrder: z.number().int().nonnegative().optional(),
  academicStatus: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
})

const enrollmentPatchSchema = enrollmentCreateSchema.extend({
  version: z.number().int().positive(),
})

const mentorAssignmentCreateSchema = z.object({
  studentId: z.string().min(1),
  facultyId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
  source: z.string().min(1),
})

const mentorAssignmentPatchSchema = mentorAssignmentCreateSchema.extend({
  version: z.number().int().positive(),
})

const mentorAssignmentBulkApplySchema = z.object({
  facultyId: z.string().min(1),
  batchId: z.string().min(1),
  sectionCode: z.string().trim().min(1).optional().nullable(),
  effectiveFrom: z.string().min(1),
  source: z.string().min(1),
  selectionMode: z.enum(['missing-only', 'replace-all']).optional(),
  applyMode: z.enum(['missing-only', 'replace-all']).optional(),
  previewOnly: z.boolean().default(false),
  expectedStudentIds: z.array(z.string().min(1)).optional(),
}).transform(value => ({
  ...value,
  selectionMode: value.selectionMode ?? value.applyMode ?? 'replace-all',
})).superRefine((value, ctx) => {
  if (!value.previewOnly && (!value.expectedStudentIds || value.expectedStudentIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expectedStudentIds'],
      message: 'Confirmation requires the previewed student ids.',
    })
  }
})

type MentorAssignmentBulkApplyPreviewStudent = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string | null
  currentMentorFacultyId: string | null
  currentMentorAssignmentId: string | null
  action: 'assign' | 'reassign' | 'keep'
  actionReason: string
}

function mapEnrollment(row: typeof studentEnrollments.$inferSelect) {
  return {
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    branchId: row.branchId,
    termId: row.termId,
    sectionCode: row.sectionCode,
    rosterOrder: row.rosterOrder,
    academicStatus: row.academicStatus,
    startDate: row.startDate,
    endDate: row.endDate,
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

function mapStudentRecord(params: {
  student: typeof students.$inferSelect
  enrollmentRows: Array<typeof studentEnrollments.$inferSelect>
  assignmentRows: Array<typeof mentorAssignments.$inferSelect>
  profileRows: Array<typeof studentAcademicProfiles.$inferSelect>
  termRows: Array<typeof academicTerms.$inferSelect>
  branchRows: Array<typeof branches.$inferSelect>
  departmentRows: Array<typeof departments.$inferSelect>
  batchRows: Array<typeof batches.$inferSelect>
}) {
  const termById = Object.fromEntries(params.termRows.map(row => [row.termId, row]))
  const branchById = Object.fromEntries(params.branchRows.map(row => [row.branchId, row]))
  const departmentById = Object.fromEntries(params.departmentRows.map(row => [row.departmentId, row]))
  const batchById = Object.fromEntries(params.batchRows.map(row => [row.batchId, row]))
  return {
    ...params.student,
    currentCgpa: (params.profileRows.find(item => item.studentId === params.student.studentId)?.prevCgpaScaled ?? 0) / 100,
    activeAcademicContext: (() => {
      const currentEnrollment = params.enrollmentRows
        .filter(item => item.studentId === params.student.studentId)
        .sort((left, right) => {
          if (left.endDate === null && right.endDate !== null) return -1
          if (left.endDate !== null && right.endDate === null) return 1
          return right.startDate.localeCompare(left.startDate)
        })[0]
      if (!currentEnrollment) return null
      const term = termById[currentEnrollment.termId]
      const branch = branchById[currentEnrollment.branchId]
      const department = branch ? departmentById[branch.departmentId] : null
      const batch = term?.batchId ? batchById[term.batchId] : null
      return {
        enrollmentId: currentEnrollment.enrollmentId,
        branchId: currentEnrollment.branchId,
        branchName: branch?.name ?? null,
        departmentId: department?.departmentId ?? null,
        departmentName: department?.name ?? null,
        termId: currentEnrollment.termId,
        academicYearLabel: term?.academicYearLabel ?? null,
        semesterNumber: term?.semesterNumber ?? null,
        sectionCode: currentEnrollment.sectionCode,
        batchId: batch?.batchId ?? term?.batchId ?? null,
        batchLabel: batch?.batchLabel ?? null,
        admissionYear: batch?.admissionYear ?? null,
        academicStatus: currentEnrollment.academicStatus,
      }
    })(),
    activeMentorAssignment: (() => {
      const activeAssignment = params.assignmentRows
        .filter(item => item.studentId === params.student.studentId)
        .sort((left, right) => {
          if (left.effectiveTo === null && right.effectiveTo !== null) return -1
          if (left.effectiveTo !== null && right.effectiveTo === null) return 1
          return right.effectiveFrom.localeCompare(left.effectiveFrom)
        })[0]
      return activeAssignment ? mapMentorAssignment(activeAssignment) : null
    })(),
    enrollments: params.enrollmentRows.filter(item => item.studentId === params.student.studentId).map(mapEnrollment),
    mentorAssignments: params.assignmentRows.filter(item => item.studentId === params.student.studentId).map(mapMentorAssignment),
  }
}

type StudentRecord = ReturnType<typeof mapStudentRecord>
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
type StudentRecordWithProvenance = StudentRecord & Partial<RecordProofProvenance>

function buildStudentScopeCacheKey(batchId: string, sectionCode?: string | null) {
  return `${batchId}::${(sectionCode ?? '').trim().toUpperCase()}`
}

async function enrichStudentRecordWithProvenance(
  context: RouteContext,
  student: StudentRecord,
  cache: Map<string, ResolvedBatchPolicySnapshot>,
): Promise<StudentRecordWithProvenance> {
  const batchId = student.activeAcademicContext?.batchId
  if (!batchId) return student
  const sectionCode = student.activeAcademicContext?.sectionCode ?? null
  const cacheKey = buildStudentScopeCacheKey(batchId, sectionCode)
  let resolvedPolicy = cache.get(cacheKey)
  if (!resolvedPolicy) {
    resolvedPolicy = await resolveBatchPolicy(context, batchId, { sectionCode })
    cache.set(cacheKey, resolvedPolicy)
  }
  return {
    ...student,
    scopeDescriptor: {
      ...resolvedPolicy.scopeDescriptor,
      studentId: student.studentId,
    },
    resolvedFrom: resolvedPolicy.resolvedFrom,
    scopeMode: resolvedPolicy.scopeMode,
    countSource: resolvedPolicy.countSource,
    activeOperationalSemester: resolvedPolicy.activeOperationalSemester,
  }
}

function normalizeStudentIdSet(studentIds: string[] | undefined) {
  return Array.from(new Set((studentIds ?? []).map(item => item.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

function isVisibleStudentStatus(status: string | null | undefined) {
  const normalizedStatus = (status ?? 'active').toLowerCase()
  return normalizedStatus !== 'deleted' && normalizedStatus !== 'archived' && normalizedStatus !== 'hidden'
}

function buildBulkMentorScopeLabel(batchLabel: string, sectionCode: string | null) {
  return sectionCode ? `Batch ${batchLabel} · Section ${sectionCode}` : `Batch ${batchLabel}`
}

export async function registerStudentRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/students', {
    schema: { tags: ['students'], summary: 'List students with enrollment and mentor assignment context' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const studentRows = await context.db.select().from(students)
    const enrollmentRows = await context.db.select().from(studentEnrollments)
    const assignmentRows = await context.db.select().from(mentorAssignments)
    const profileRows = await context.db.select().from(studentAcademicProfiles)
    const termRows = await context.db.select().from(academicTerms)
    const branchRows = await context.db.select().from(branches)
    const departmentRows = await context.db.select().from(departments)
    const batchRows = await context.db.select().from(batches)
    const provenanceCache = new Map<string, ResolvedBatchPolicySnapshot>()
    return {
      items: await Promise.all(studentRows.map(student => enrichStudentRecordWithProvenance(
        context,
        mapStudentRecord({
          student,
          enrollmentRows,
          assignmentRows,
          profileRows,
          termRows,
          branchRows,
          departmentRows,
          batchRows,
        }),
        provenanceCache,
      ))),
    }
  })

  app.post('/api/admin/students', {
    schema: { tags: ['students'], summary: 'Create student' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(studentCreateSchema, request.body)
    const institutionId = (await context.db.select().from(students).limit(1))[0]?.institutionId
      ?? (await context.db.select().from(institutions).limit(1))[0]?.institutionId
    if (!institutionId) throw notFound('Institution is not configured')
    const created = {
      studentId: createId('student'),
      institutionId,
      usn: body.usn,
      rollNumber: body.rollNumber ?? null,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      admissionDate: body.admissionDate,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(students).values(created)
    await emitAuditEvent(context, {
      entityType: 'Student',
      entityId: created.studentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: created,
    })
    const enrollmentRows = await context.db.select().from(studentEnrollments)
    const assignmentRows = await context.db.select().from(mentorAssignments)
    const profileRows = await context.db.select().from(studentAcademicProfiles)
    const termRows = await context.db.select().from(academicTerms)
    const branchRows = await context.db.select().from(branches)
    const departmentRows = await context.db.select().from(departments)
    const batchRows = await context.db.select().from(batches)
    return enrichStudentRecordWithProvenance(context, mapStudentRecord({
      student: created,
      enrollmentRows,
      assignmentRows,
      profileRows,
      termRows,
      branchRows,
      departmentRows,
      batchRows,
    }), new Map())
  })

  app.patch('/api/admin/students/:studentId', {
    schema: { tags: ['students'], summary: 'Update student' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentPatchSchema, request.body)
    const [current] = await context.db.select().from(students).where(eq(students.studentId, params.studentId))
    if (!current) throw notFound('Student not found')
    expectVersion(current.version, body.version, 'Student', current)
    await context.db.update(students).set({
      usn: body.usn,
      rollNumber: body.rollNumber ?? null,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      admissionDate: body.admissionDate,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(students.studentId, params.studentId))
    const [next] = await context.db.select().from(students).where(eq(students.studentId, params.studentId))
    await emitAuditEvent(context, {
      entityType: 'Student',
      entityId: params.studentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: current,
      after: next,
    })
    const enrollmentRows = await context.db.select().from(studentEnrollments)
    const assignmentRows = await context.db.select().from(mentorAssignments)
    const profileRows = await context.db.select().from(studentAcademicProfiles)
    const termRows = await context.db.select().from(academicTerms)
    const branchRows = await context.db.select().from(branches)
    const departmentRows = await context.db.select().from(departments)
    const batchRows = await context.db.select().from(batches)
    return enrichStudentRecordWithProvenance(context, mapStudentRecord({
      student: next,
      enrollmentRows,
      assignmentRows,
      profileRows,
      termRows,
      branchRows,
      departmentRows,
      batchRows,
    }), new Map())
  })

  app.post('/api/admin/students/:studentId/enrollments', {
    schema: { tags: ['students'], summary: 'Create student enrollment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(enrollmentCreateSchema, { ...rawBody, studentId: params.studentId })
    const created = {
      enrollmentId: createId('enrollment'),
      studentId: body.studentId,
      branchId: body.branchId,
      termId: body.termId,
      sectionCode: body.sectionCode,
      rosterOrder: body.rosterOrder ?? 0,
      academicStatus: body.academicStatus,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(studentEnrollments).values(created)
    await emitAuditEvent(context, {
      entityType: 'StudentEnrollment',
      entityId: created.enrollmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapEnrollment(created),
    })
    return mapEnrollment(created)
  })

  app.patch('/api/admin/enrollments/:enrollmentId', {
    schema: { tags: ['students'], summary: 'Update student enrollment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ enrollmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(enrollmentPatchSchema, request.body)
    const [current] = await context.db.select().from(studentEnrollments).where(eq(studentEnrollments.enrollmentId, params.enrollmentId))
    if (!current) throw notFound('Enrollment not found')
    expectVersion(current.version, body.version, 'StudentEnrollment', mapEnrollment(current))
    await context.db.update(studentEnrollments).set({
      studentId: body.studentId,
      branchId: body.branchId,
      termId: body.termId,
      sectionCode: body.sectionCode,
      rosterOrder: body.rosterOrder ?? current.rosterOrder,
      academicStatus: body.academicStatus,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(studentEnrollments.enrollmentId, params.enrollmentId))
    const [next] = await context.db.select().from(studentEnrollments).where(eq(studentEnrollments.enrollmentId, params.enrollmentId))
    await emitAuditEvent(context, {
      entityType: 'StudentEnrollment',
      entityId: params.enrollmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapEnrollment(current),
      after: mapEnrollment(next),
    })
    return mapEnrollment(next)
  })

  app.post('/api/admin/mentor-assignments/bulk-apply', {
    schema: { tags: ['students'], summary: 'Preview or apply mentor assignment changes across a scoped student cohort' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(mentorAssignmentBulkApplySchema, request.body)
    const effectiveFrom = body.effectiveFrom.trim().slice(0, 10)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
    if (!batch) throw notFound('Batch not found')
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
    if (!branch) throw notFound('Branch not found')
    const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
    if (!department) throw notFound('Department not found')
    const [selectedFaculty] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, body.facultyId))
    if (!selectedFaculty) throw notFound('Faculty not found')
    if (!isVisibleStudentStatus(selectedFaculty.status)) {
      throw badRequest('Selected faculty member is not active.')
    }

    const sectionCode = body.sectionCode ? normalizeSectionCode(body.sectionCode) : null
    const knownSectionLabels = parseJson(batch.sectionLabelsJson, [] as string[])
      .map(label => normalizeSectionCode(label))
      .filter(Boolean)
    if (sectionCode && !knownSectionLabels.includes(sectionCode)) {
      throw notFound('Section scope not found')
    }

    const [studentRows, enrollmentRows, assignmentRows, profileRows, termRows, appointmentRows, grantRows] = await Promise.all([
      context.db.select().from(students),
      context.db.select().from(studentEnrollments),
      context.db.select().from(mentorAssignments),
      context.db.select().from(studentAcademicProfiles),
      context.db.select().from(academicTerms),
      context.db.select().from(facultyAppointments),
      context.db.select().from(roleGrants),
    ])

    const facultyEligibility = getFacultyMentorProvisioningEligibility({
      facultyId: selectedFaculty.facultyId,
      effectiveFrom,
      scope: {
        academicFacultyId: department.academicFacultyId,
        departmentId: department.departmentId,
        branchId: branch.branchId,
        batchId: batch.batchId,
        sectionCode,
      },
      appointments: appointmentRows,
      roleGrants: grantRows,
    })
    if (!facultyEligibility.eligible) {
      throw badRequest(
        `Faculty ${selectedFaculty.displayName} is not mentor-eligible for ${buildBulkMentorScopeLabel(batch.batchLabel, sectionCode)}. ${facultyEligibility.reasons.join(' ')}`.trim(),
        { reasons: facultyEligibility.reasons },
      )
    }

    const studentRecords = studentRows
      .filter(student => isVisibleStudentStatus(student.status))
      .map(student => mapStudentRecord({
        student,
        enrollmentRows,
        assignmentRows,
        profileRows,
        termRows,
        branchRows: [branch],
        departmentRows: [department],
        batchRows: [batch],
      }))

    const currentMentorAssignmentByStudentId = new Map<string, typeof mentorAssignments.$inferSelect>()
    assignmentRows
      .filter(assignment => assignment.effectiveFrom <= effectiveFrom && (!assignment.effectiveTo || assignment.effectiveTo >= effectiveFrom))
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom) || right.updatedAt.localeCompare(left.updatedAt))
      .forEach(assignment => {
        if (!currentMentorAssignmentByStudentId.has(assignment.studentId)) {
          currentMentorAssignmentByStudentId.set(assignment.studentId, assignment)
        }
      })

    const scopedStudents = studentRecords
      .filter(student => student.activeAcademicContext?.batchId === batch.batchId)
      .filter(student => !sectionCode || student.activeAcademicContext?.sectionCode === sectionCode)
      .sort((left, right) => (
        (left.activeAcademicContext?.sectionCode ?? '').localeCompare(right.activeAcademicContext?.sectionCode ?? '')
        || (left.rollNumber ?? '').localeCompare(right.rollNumber ?? '')
        || left.usn.localeCompare(right.usn)
        || left.name.localeCompare(right.name)
      ))

    const previewStudents = scopedStudents.flatMap<MentorAssignmentBulkApplyPreviewStudent>(student => {
      const currentAssignment = currentMentorAssignmentByStudentId.get(student.studentId) ?? null
      if (body.selectionMode === 'missing-only' && currentAssignment) {
        return []
      }
      if (!currentAssignment) {
        return [{
          studentId: student.studentId,
          studentName: student.name,
          usn: student.usn,
          sectionCode: student.activeAcademicContext?.sectionCode ?? null,
          currentMentorFacultyId: null,
          currentMentorAssignmentId: null,
          action: 'assign' as const,
          actionReason: 'No active mentor assignment exists in the selected scope.',
        }]
      }
      if (currentAssignment.facultyId === body.facultyId) {
        return [{
          studentId: student.studentId,
          studentName: student.name,
          usn: student.usn,
          sectionCode: student.activeAcademicContext?.sectionCode ?? null,
          currentMentorFacultyId: currentAssignment.facultyId,
          currentMentorAssignmentId: currentAssignment.assignmentId,
          action: 'keep' as const,
          actionReason: 'The selected faculty is already the active mentor.',
        }]
      }
      if (currentAssignment.effectiveFrom >= effectiveFrom) {
        return [{
          studentId: student.studentId,
          studentName: student.name,
          usn: student.usn,
          sectionCode: student.activeAcademicContext?.sectionCode ?? null,
          currentMentorFacultyId: currentAssignment.facultyId,
          currentMentorAssignmentId: currentAssignment.assignmentId,
          action: 'keep' as const,
          actionReason: 'The current mentor assignment already starts on or after the requested effective date.',
        }]
      }
      return [{
        studentId: student.studentId,
        studentName: student.name,
        usn: student.usn,
        sectionCode: student.activeAcademicContext?.sectionCode ?? null,
        currentMentorFacultyId: currentAssignment.facultyId,
        currentMentorAssignmentId: currentAssignment.assignmentId,
        action: 'reassign' as const,
        actionReason: 'The existing active mentor assignment will be end-dated and replaced.',
      }]
    })

    const previewStudentIds = normalizeStudentIdSet(previewStudents.map(student => student.studentId))
    const response = {
      ok: true,
      preview: body.previewOnly,
      bulkApplyId: null,
      facultyId: selectedFaculty.facultyId,
      facultyDisplayName: selectedFaculty.displayName,
      batchId: batch.batchId,
      batchLabel: batch.batchLabel,
      sectionCode,
      scopeLabel: buildBulkMentorScopeLabel(batch.batchLabel, sectionCode),
      effectiveFrom,
      source: body.source,
      selectionMode: body.selectionMode,
      mentorEligibility: facultyEligibility,
      studentIds: previewStudentIds,
      students: previewStudents,
      summary: {
        targetedStudentCount: previewStudents.length,
        unchangedCount: previewStudents.filter(student => student.action === 'keep').length,
        endedAssignmentCount: previewStudents.filter(student => student.action === 'reassign').length,
        createdAssignmentCount: previewStudents.filter(student => student.action !== 'keep').length,
      },
    }

    if (body.previewOnly) {
      return response
    }

    if (previewStudents.length === 0) {
      throw badRequest(`No students matched ${buildBulkMentorScopeLabel(batch.batchLabel, sectionCode)} for bulk mentor apply.`)
    }

    const expectedStudentIds = normalizeStudentIdSet(body.expectedStudentIds)
    if (expectedStudentIds.length !== previewStudentIds.length || expectedStudentIds.some((studentId, index) => studentId !== previewStudentIds[index])) {
      throw conflict('Bulk mentor preview changed. Refresh the preview and confirm again.', { studentIds: previewStudentIds })
    }

    const now = context.now()
    const bulkApplyId = createId('mentor_bulk_apply')
    const assignmentRowById = new Map(assignmentRows.map(assignment => [assignment.assignmentId, assignment]))
    let endedAssignmentCount = 0
    let createdAssignmentCount = 0
    for (const previewStudent of previewStudents) {
      if (previewStudent.action === 'reassign' && previewStudent.currentMentorAssignmentId) {
        const currentAssignment = assignmentRowById.get(previewStudent.currentMentorAssignmentId)
        if (!currentAssignment) {
          throw conflict('Bulk mentor apply encountered a missing mentor assignment. Refresh the preview and confirm again.')
        }
        const dayBeforeEffectiveFrom = getIsoDayBefore(effectiveFrom)
        const nextEffectiveTo = dayBeforeEffectiveFrom < currentAssignment.effectiveFrom
          ? currentAssignment.effectiveFrom
          : dayBeforeEffectiveFrom
        const endedAssignment = {
          ...currentAssignment,
          effectiveTo: nextEffectiveTo,
          version: currentAssignment.version + 1,
          updatedAt: now,
        }
        await context.db.update(mentorAssignments).set({
          effectiveTo: endedAssignment.effectiveTo,
          version: endedAssignment.version,
          updatedAt: endedAssignment.updatedAt,
        }).where(eq(mentorAssignments.assignmentId, currentAssignment.assignmentId))
        await emitAuditEvent(context, {
          entityType: 'MentorAssignment',
          entityId: currentAssignment.assignmentId,
          action: 'bulk_reassigned',
          actorRole: auth.activeRoleGrant.roleCode,
          actorId: auth.facultyId,
          before: mapMentorAssignment(currentAssignment),
          after: mapMentorAssignment(endedAssignment),
          metadata: {
            bulkApplyId,
            batchId: batch.batchId,
            sectionCode,
            nextFacultyId: selectedFaculty.facultyId,
            scopeLabel: buildBulkMentorScopeLabel(batch.batchLabel, sectionCode),
          },
        })
        assignmentRowById.set(currentAssignment.assignmentId, endedAssignment)
        endedAssignmentCount += 1
      }
      if (previewStudent.action === 'keep') continue
      const createdAssignment = {
        assignmentId: createId('mentor_assignment'),
        studentId: previewStudent.studentId,
        facultyId: selectedFaculty.facultyId,
        effectiveFrom,
        effectiveTo: null,
        source: body.source,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      await context.db.insert(mentorAssignments).values(createdAssignment)
      await emitAuditEvent(context, {
        entityType: 'MentorAssignment',
        entityId: createdAssignment.assignmentId,
        action: 'bulk_created',
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        after: mapMentorAssignment(createdAssignment),
          metadata: {
            bulkApplyId,
            batchId: batch.batchId,
            sectionCode,
            previousFacultyId: previewStudent.currentMentorFacultyId,
            scopeLabel: buildBulkMentorScopeLabel(batch.batchLabel, sectionCode),
          },
        })
      createdAssignmentCount += 1
    }

    await emitAuditEvent(context, {
      entityType: 'MentorAssignmentBulkApply',
      entityId: bulkApplyId,
      action: 'applied',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        facultyId: selectedFaculty.facultyId,
        batchId: batch.batchId,
        sectionCode,
        selectionMode: body.selectionMode,
        effectiveFrom,
        source: body.source,
        studentIds: previewStudentIds,
        summary: {
          targetedStudentCount: previewStudents.length,
          unchangedCount: previewStudents.filter(student => student.action === 'keep').length,
          endedAssignmentCount,
          createdAssignmentCount,
        },
      },
    })

    return {
      ...response,
      preview: false,
      bulkApplyId,
      summary: {
        ...response.summary,
        endedAssignmentCount,
        createdAssignmentCount,
      },
    }
  })

  app.post('/api/admin/mentor-assignments', {
    schema: { tags: ['students'], summary: 'Create mentor assignment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(mentorAssignmentCreateSchema, request.body)
    const created = {
      assignmentId: createId('mentor_assignment'),
      studentId: body.studentId,
      facultyId: body.facultyId,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
      source: body.source,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(mentorAssignments).values(created)
    await emitAuditEvent(context, {
      entityType: 'MentorAssignment',
      entityId: created.assignmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapMentorAssignment(created),
    })
    return mapMentorAssignment(created)
  })

  app.patch('/api/admin/mentor-assignments/:assignmentId', {
    schema: { tags: ['students'], summary: 'Update mentor assignment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ assignmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(mentorAssignmentPatchSchema, request.body)
    const [current] = await context.db.select().from(mentorAssignments).where(eq(mentorAssignments.assignmentId, params.assignmentId))
    if (!current) throw notFound('Mentor assignment not found')
    expectVersion(current.version, body.version, 'MentorAssignment', mapMentorAssignment(current))
    await context.db.update(mentorAssignments).set({
      studentId: body.studentId,
      facultyId: body.facultyId,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
      source: body.source,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(mentorAssignments.assignmentId, params.assignmentId))
    const [next] = await context.db.select().from(mentorAssignments).where(eq(mentorAssignments.assignmentId, params.assignmentId))
    await emitAuditEvent(context, {
      entityType: 'MentorAssignment',
      entityId: params.assignmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapMentorAssignment(current),
      after: mapMentorAssignment(next),
    })
    return mapMentorAssignment(next)
  })
}
