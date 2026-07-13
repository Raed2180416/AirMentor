/**
 * POST /api/admin/mentor-assignments/bulk-apply — preview or apply mentor
 * assignment changes across a scoped student cohort.
 *
 * Moved verbatim from the legacy handler: the same lazy existence/eligibility
 * guards (short-circuiting before the heavy dataset load), the same preview
 * derivation, and the same apply loop. DB writes go through repository methods
 * and audit emission through the injected emitter; a single `now` timestamp is
 * captured once and threaded through every write + audit payload, exactly as
 * before. Ids come from the framework-free `createId`.
 */
import { getFacultyMentorProvisioningEligibility, getIsoDayBefore } from '../../../lib/academic-provisioning.js'
import { badRequest, conflict, notFound } from '../../../lib/http-errors.js'
import { createId } from '../../../lib/ids.js'
import { parseJson } from '../../../lib/json.js'
import { normalizeSectionCode } from '../../../lib/stage-policy.js'
import type { StudentsRepository } from '../../ports/students-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'
import { mapMentorAssignment, mapStudentRecord } from './student-record-mappers.js'
import { buildBulkMentorScopeLabel, isVisibleStudentStatus, normalizeStudentIdSet } from './student-scope.js'
import type { MentorAssignmentBulkApplyPreviewStudent, MentorAssignmentRow } from './students-domain.js'

export type BulkApplyMentorAssignmentsDeps = {
  repo: StudentsRepository
  emitAudit: AuditEmitter
  now: () => string
}

export type BulkApplyMentorAssignmentsInput = {
  actorRole: string
  actorId: string | null
  facultyId: string
  batchId: string
  sectionCode?: string | null
  effectiveFrom: string
  source: string
  selectionMode: 'missing-only' | 'replace-all'
  previewOnly: boolean
  expectedStudentIds?: string[]
}

export async function bulkApplyMentorAssignments(
  deps: BulkApplyMentorAssignmentsDeps,
  input: BulkApplyMentorAssignmentsInput,
): Promise<UseCaseResponse> {
  const { repo } = deps
  const effectiveFrom = input.effectiveFrom.trim().slice(0, 10)
  const batch = await repo.getBulkBatch(input.batchId)
  if (!batch) throw notFound('Batch not found')
  const branch = await repo.getBulkBranch(batch.branchId)
  if (!branch) throw notFound('Branch not found')
  const department = await repo.getBulkDepartment(branch.departmentId)
  if (!department) throw notFound('Department not found')
  const selectedFaculty = await repo.getBulkFaculty(input.facultyId)
  if (!selectedFaculty) throw notFound('Faculty not found')
  if (!isVisibleStudentStatus(selectedFaculty.status)) {
    throw badRequest('Selected faculty member is not active.')
  }

  const sectionCode = input.sectionCode ? normalizeSectionCode(input.sectionCode) : null
  const knownSectionLabels = parseJson(batch.sectionLabelsJson, [] as string[])
    .map(label => normalizeSectionCode(label))
    .filter(Boolean)
  if (sectionCode && !knownSectionLabels.includes(sectionCode)) {
    throw notFound('Section scope not found')
  }

  const { studentRows, enrollmentRows, assignmentRows, profileRows, termRows, appointmentRows, grantRows } =
    await repo.loadMentorBulkApplyRows()

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

  const currentMentorAssignmentByStudentId = new Map<string, MentorAssignmentRow>()
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
    if (input.selectionMode === 'missing-only' && currentAssignment) {
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
    if (currentAssignment.facultyId === input.facultyId) {
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
    preview: input.previewOnly,
    bulkApplyId: null,
    facultyId: selectedFaculty.facultyId,
    facultyDisplayName: selectedFaculty.displayName,
    batchId: batch.batchId,
    batchLabel: batch.batchLabel,
    sectionCode,
    scopeLabel: buildBulkMentorScopeLabel(batch.batchLabel, sectionCode),
    effectiveFrom,
    source: input.source,
    selectionMode: input.selectionMode,
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

  if (input.previewOnly) {
    return { status: 200, body: response }
  }

  if (previewStudents.length === 0) {
    throw badRequest(`No students matched ${buildBulkMentorScopeLabel(batch.batchLabel, sectionCode)} for bulk mentor apply.`)
  }

  const expectedStudentIds = normalizeStudentIdSet(input.expectedStudentIds)
  if (expectedStudentIds.length !== previewStudentIds.length || expectedStudentIds.some((studentId, index) => studentId !== previewStudentIds[index])) {
    throw conflict('Bulk mentor preview changed. Refresh the preview and confirm again.', { studentIds: previewStudentIds })
  }

  const now = deps.now()
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
      await repo.endMentorAssignment({
        assignmentId: currentAssignment.assignmentId,
        effectiveTo: endedAssignment.effectiveTo,
        version: endedAssignment.version,
        updatedAt: endedAssignment.updatedAt,
      })
      await deps.emitAudit({
        entityType: 'MentorAssignment',
        entityId: currentAssignment.assignmentId,
        action: 'bulk_reassigned',
        actorRole: input.actorRole,
        actorId: input.actorId,
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
      source: input.source,
      demoWorkspaceId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    await repo.insertMentorAssignment(createdAssignment)
    await deps.emitAudit({
      entityType: 'MentorAssignment',
      entityId: createdAssignment.assignmentId,
      action: 'bulk_created',
      actorRole: input.actorRole,
      actorId: input.actorId,
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

  await deps.emitAudit({
    entityType: 'MentorAssignmentBulkApply',
    entityId: bulkApplyId,
    action: 'applied',
    actorRole: input.actorRole,
    actorId: input.actorId,
    after: {
      facultyId: selectedFaculty.facultyId,
      batchId: batch.batchId,
      sectionCode,
      selectionMode: input.selectionMode,
      effectiveFrom,
      source: input.source,
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
    status: 200,
    body: {
      ...response,
      preview: false,
      bulkApplyId,
      summary: {
        ...response.summary,
        endedAssignmentCount,
        createdAssignmentCount,
      },
    },
  }
}
