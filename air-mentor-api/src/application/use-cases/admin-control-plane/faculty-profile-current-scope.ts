/**
 * Faculty-profile "live" (non-proof) scope derivations — owned classes, batch
 * contexts, subject-run leader scope, and related requests. Extracted from the
 * legacy handler verbatim to keep read-faculty-profile.ts under the 400-line
 * cap; return types are inferred so the shapes match the original expressions.
 */
import {
  isLeaderLikeOwnershipRole,
  type FacultyProfileAdminRequestRow,
  type FacultyProfileBatchRow,
  type FacultyProfileBranchRow,
  type FacultyProfileCourseRow,
  type FacultyProfileDepartmentRow,
  type FacultyProfileEnrollmentRow,
  type FacultyProfileMentorAssignmentRow,
  type FacultyProfileOfferingRow,
  type FacultyProfileOwnershipRow,
  type FacultyProfileTermRow,
} from './faculty-profile-domain.js'

export type BuildCurrentScopeInput = {
  facultyId: string
  ownershipRows: FacultyProfileOwnershipRow[]
  assignmentRows: FacultyProfileMentorAssignmentRow[]
  offeringRows: FacultyProfileOfferingRow[]
  enrollmentRows: FacultyProfileEnrollmentRow[]
  requestRows: FacultyProfileAdminRequestRow[]
  courseById: Record<string, FacultyProfileCourseRow>
  branchById: Record<string, FacultyProfileBranchRow>
  departmentById: Record<string, FacultyProfileDepartmentRow>
  termById: Record<string, FacultyProfileTermRow>
  batchById: Record<string, FacultyProfileBatchRow>
}

export function buildCurrentScope(input: BuildCurrentScopeInput) {
  const {
    facultyId,
    ownershipRows,
    assignmentRows,
    offeringRows,
    enrollmentRows,
    requestRows,
    courseById,
    branchById,
    departmentById,
    termById,
    batchById,
  } = input

  const activeOwnerships = ownershipRows.filter(row => row.status === 'active')
  const leaderLikeOwnerships = activeOwnerships.filter(row => isLeaderLikeOwnershipRole(row.ownershipRole))
  const activeMentorAssignments = assignmentRows.filter(row => row.effectiveTo === null)
  const currentOwnedClasses = activeOwnerships.flatMap(row => {
    const offering = offeringRows.find(item => item.offeringId === row.offeringId)
    if (!offering) return []
    const course = courseById[offering.courseId]
    const branch = branchById[offering.branchId]
    const department = branch ? departmentById[branch.departmentId] : null
    return [{
      offeringId: offering.offeringId,
      courseCode: course?.courseCode ?? 'NA',
      title: course?.title ?? 'Untitled course',
      yearLabel: offering.yearLabel,
      sectionCode: offering.sectionCode,
      ownershipRole: row.ownershipRole,
      departmentName: department?.name ?? null,
      branchName: branch?.name ?? null,
    }]
  })
  const currentBatchContextsMap = new Map<string, {
    batchId: string
    batchLabel: string
    branchName: string | null
    currentSemester: number
    sectionCodes: Set<string>
    roleCoverage: Set<string>
  }>()
  for (const item of currentOwnedClasses) {
    const offering = offeringRows.find(row => row.offeringId === item.offeringId)
    const term = offering ? termById[offering.termId] : null
    const batch = term?.batchId ? batchById[term.batchId] : null
    if (!batch) continue
    const existing = currentBatchContextsMap.get(batch.batchId) ?? {
      batchId: batch.batchId,
      batchLabel: batch.batchLabel,
      branchName: item.branchName,
      currentSemester: batch.currentSemester,
      sectionCodes: new Set<string>(),
      roleCoverage: new Set<string>(),
    }
    existing.sectionCodes.add(item.sectionCode)
    existing.roleCoverage.add(item.ownershipRole)
    currentBatchContextsMap.set(batch.batchId, existing)
  }
  const activeStudentIds = new Set(activeMentorAssignments.map(row => row.studentId))
  if (activeStudentIds.size > 0) {
    for (const enrollment of enrollmentRows.filter(row => activeStudentIds.has(row.studentId) && row.academicStatus === 'active')) {
      const batch = batchById[termById[enrollment.termId]?.batchId ?? '']
      const branch = branchById[enrollment.branchId]
      if (!batch) continue
      const existing = currentBatchContextsMap.get(batch.batchId) ?? {
        batchId: batch.batchId,
        batchLabel: batch.batchLabel,
        branchName: branch?.name ?? null,
        currentSemester: batch.currentSemester,
        sectionCodes: new Set<string>(),
        roleCoverage: new Set<string>(),
      }
      existing.sectionCodes.add(enrollment.sectionCode)
      existing.roleCoverage.add('MENTOR')
      currentBatchContextsMap.set(batch.batchId, existing)
    }
  }

  const subjectRunMap = new Map<string, {
    subjectRunId: string
    courseCode: string
    title: string
    termId: string
    yearLabel: string
    sectionCodes: Set<string>
  }>()
  for (const row of leaderLikeOwnerships) {
    const offering = offeringRows.find(item => item.offeringId === row.offeringId)
    if (!offering) continue
    const course = courseById[offering.courseId]
    const subjectRunId = `subject_run_${offering.termId}_${offering.courseId}_${offering.yearLabel}`
    const existing = subjectRunMap.get(subjectRunId) ?? {
      subjectRunId,
      courseCode: course?.courseCode ?? 'NA',
      title: course?.title ?? 'Untitled course',
      termId: offering.termId,
      yearLabel: offering.yearLabel,
      sectionCodes: new Set<string>(),
    }
    existing.sectionCodes.add(offering.sectionCode)
    subjectRunMap.set(subjectRunId, existing)
  }

  const relatedRequests = requestRows
    .filter(row => row.requestedByFacultyId === facultyId || row.ownedByFacultyId === facultyId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return {
    activeOwnerships,
    leaderLikeOwnerships,
    activeMentorAssignments,
    currentOwnedClasses,
    currentBatchContextsMap,
    subjectRunMap,
    relatedRequests,
  }
}
