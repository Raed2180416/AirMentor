/**
 * Faculty-profile proof-scoped projections — owned classes, mentored students,
 * and batch contexts derived from the proof monitoring view. Extracted verbatim
 * from the legacy handler; `proofView` keeps its exact inferred shape via a
 * type-only import of buildFacultyProofView (erased at build time).
 */
import type { buildFacultyProofView } from '../../../lib/msruas-proof-control-plane.js'
import type {
  FacultyProfileBatchRow,
  FacultyProfileBranchRow,
  FacultyProfileCourseRow,
  FacultyProfileDepartmentRow,
  FacultyProfileEnrollmentRow,
  FacultyProfileMentorAssignmentRow,
  FacultyProfileOfferingRow,
  FacultyProfileOwnershipRow,
  FacultyProfileTermRow,
} from './faculty-profile-domain.js'

type ProofView = Awaited<ReturnType<typeof buildFacultyProofView>>

export type BuildProofScopeInput = {
  proofView: ProofView
  proofBatchIds: string[]
  proofSemesterNumber: number | null
  viewerRoleCode: string
  offeringRows: FacultyProfileOfferingRow[]
  activeOwnerships: FacultyProfileOwnershipRow[]
  activeMentorAssignments: FacultyProfileMentorAssignmentRow[]
  enrollmentRows: FacultyProfileEnrollmentRow[]
  courseById: Record<string, FacultyProfileCourseRow>
  branchById: Record<string, FacultyProfileBranchRow>
  departmentById: Record<string, FacultyProfileDepartmentRow>
  termById: Record<string, FacultyProfileTermRow>
  batchById: Record<string, FacultyProfileBatchRow>
}

export function buildProofScope(input: BuildProofScopeInput) {
  const {
    proofView,
    proofBatchIds,
    proofSemesterNumber,
    viewerRoleCode,
    offeringRows,
    activeOwnerships,
    activeMentorAssignments,
    enrollmentRows,
    courseById,
    branchById,
    departmentById,
    termById,
    batchById,
  } = input

  const readProofQueueString = (item: Record<string, unknown>, key: string) => {
    const value = item[key]
    return typeof value === 'string' && value.length > 0 ? value : null
  }
  const proofOfferingRows = offeringRows.filter(row => {
    const term = termById[row.termId]
    if (!term) return false
    if (proofBatchIds.length > 0 && (!term.batchId || !proofBatchIds.includes(term.batchId))) return false
    if (proofSemesterNumber != null && term.semesterNumber !== proofSemesterNumber) return false
    return true
  })
  const proofOfferingRowById = Object.fromEntries(proofOfferingRows.map(row => [row.offeringId, row]))
  const proofOwnedClasses = Array.from(new Map(
    [
      ...proofOfferingRows
        .filter(row => activeOwnerships.some(ownership => ownership.offeringId === row.offeringId))
        .map(row => {
          const course = courseById[row.courseId]
          const branch = branchById[row.branchId]
          const department = branch ? departmentById[branch.departmentId] : null
          const ownershipRole = activeOwnerships.find(ownership => ownership.offeringId === row.offeringId)?.ownershipRole ?? 'proof-scope'
          return [row.offeringId, {
            offeringId: row.offeringId,
            courseCode: course?.courseCode ?? 'NA',
            title: course?.title ?? 'Untitled course',
            yearLabel: row.yearLabel,
            sectionCode: row.sectionCode,
            ownershipRole,
            departmentName: department?.name ?? null,
            branchName: branch?.name ?? null,
          }] as const
        }),
      ...proofView.monitoringQueue.flatMap(item => {
        const queueOfferingId = readProofQueueString(item, 'offeringId')
        const queueSectionCode = readProofQueueString(item, 'sectionCode')
        const queueBranchName = readProofQueueString(item, 'branchName')
        const queueCourseCode = readProofQueueString(item, 'courseCode') ?? 'NA'
        const queueCourseTitle = readProofQueueString(item, 'courseTitle') ?? 'Untitled course'
        const offering = queueOfferingId ? (proofOfferingRowById[queueOfferingId] ?? offeringRows.find(row => row.offeringId === queueOfferingId) ?? null) : null
        if (!offering) return []
        const branch = branchById[offering.branchId]
        const department = branch ? departmentById[branch.departmentId] : null
        const ownershipRole = activeOwnerships.find(ownership => ownership.offeringId === offering.offeringId)?.ownershipRole ?? 'proof-scope'
        return [[queueOfferingId, {
          offeringId: queueOfferingId,
          courseCode: queueCourseCode,
          title: queueCourseTitle,
          yearLabel: offering.yearLabel ?? (proofSemesterNumber != null ? `Semester ${proofSemesterNumber}` : 'Proof scope'),
          sectionCode: queueSectionCode ?? offering.sectionCode ?? 'NA',
          ownershipRole,
          departmentName: department?.name ?? null,
          branchName: (branch?.name ?? queueBranchName ?? null) as string,
        }] as const]
      }),
    ].filter((entry): entry is [string, {
      offeringId: string
      courseCode: string
      title: string
      yearLabel: string
      sectionCode: string
      ownershipRole: string
      departmentName: string | null
      branchName: string
    }] => !!entry[0]),
  ).values()).sort((left, right) => left.courseCode.localeCompare(right.courseCode) || left.sectionCode.localeCompare(right.sectionCode))
  const proofMentorStudentIds = Array.from(new Set(activeMentorAssignments
    .filter(assignment => {
      const enrollment = enrollmentRows.find(row => row.studentId === assignment.studentId && row.academicStatus === 'active')
      if (!enrollment) return false
      const term = termById[enrollment.termId]
      if (!term) return false
      if (proofBatchIds.length > 0 && (!term.batchId || !proofBatchIds.includes(term.batchId))) return false
      if (proofSemesterNumber != null && term.semesterNumber !== proofSemesterNumber) return false
      return true
    })
    .map(assignment => assignment.studentId))).sort((left, right) => left.localeCompare(right))
  const proofCurrentBatchContexts = Array.from(new Map(proofBatchIds.map(batchId => {
    const batch = batchById[batchId]
    const branch = batch ? branchById[batch.branchId] : null
    const runContext = proofView.activeRunContexts.find(item => item.batchId === batchId) ?? null
    const sectionCodes = new Set<string>()
    for (const item of proofOwnedClasses) sectionCodes.add(item.sectionCode)
    for (const item of proofView.monitoringQueue) {
      const queueSectionCode = readProofQueueString(item, 'sectionCode')
      if (queueSectionCode) sectionCodes.add(queueSectionCode)
    }
    const roleCoverage = new Set<string>()
    for (const item of proofOwnedClasses) roleCoverage.add(item.ownershipRole)
    if (proofMentorStudentIds.length > 0) roleCoverage.add('MENTOR')
    if (roleCoverage.size === 0) roleCoverage.add(viewerRoleCode)
    return [batchId, {
      batchId,
      batchLabel: runContext?.batchLabel ?? batch?.batchLabel ?? batchId,
      branchName: runContext?.branchName ?? branch?.name ?? null,
      currentSemester: proofSemesterNumber ?? batch?.currentSemester ?? 0,
      sectionCodes: Array.from(sectionCodes).sort(),
      roleCoverage: Array.from(roleCoverage).sort(),
    }] as const
  })).values())

  return {
    proofOwnedClasses,
    proofMentorStudentIds,
    proofCurrentBatchContexts,
  }
}
