/**
 * Academic scope authorization resolvers — course-outcome scope existence,
 * single-active-owner enforcement, enrollment checks, and the per-role
 * (course-leader / mentor / HOD) offering-read, task-manage, and
 * student-supervision guards.
 *
 * DB-touching orchestration keeping the `context: RouteContext` signature.
 * Moved verbatim from modules/academic.ts.
 */
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { RouteContext } from '../../../../app.js'
import {
  academicTerms,
  batches,
  branches,
  facultyAppointments,
  facultyOfferingOwnerships,
  institutions,
  mentorAssignments,
  sectionOfferings,
  studentEnrollments,
  students,
} from '../../../../db/schema.js'
import { badRequest, forbidden, notFound } from '../../../../lib/http-errors.js'
import { requireAuth } from '../../../../modules/support.js'
import {
  assertAcademicAccess,
  evaluateCourseLeaderOfferingManagementAccess,
  evaluateFacultyContextAccess,
  evaluateHodOfferingScopeAccess,
  evaluateHodStudentScopeAccess,
  evaluateMentorStudentScopeAccess,
  evaluateOfferingReadRoleAccess,
} from '../../../../modules/academic-access.js'
import { courseOutcomeScopeSchema } from '../../../../application/use-cases/academic/academic-contracts.js'
import { sharedTaskSchema } from '../../../../application/use-cases/academic/academic-task-contracts.js'
import {
  isLeaderLikeOwnershipRole,
  normalizeAcademicStudentId,
} from '../../../../application/use-cases/academic/academic-utils.js'
import { getOfferingContext } from './academic-offering-eligibility.js'

export async function assertCourseOutcomeScopeExists(
  context: RouteContext,
  scopeType: z.infer<typeof courseOutcomeScopeSchema>,
  scopeId: string,
) {
  if (scopeType === 'institution') {
    const [row] = await context.db.select().from(institutions).where(eq(institutions.institutionId, scopeId))
    if (!row) throw notFound('Institution scope not found')
    return
  }
  if (scopeType === 'branch') {
    const [row] = await context.db.select().from(branches).where(eq(branches.branchId, scopeId))
    if (!row) throw notFound('Branch scope not found')
    return
  }
  if (scopeType === 'batch') {
    const [row] = await context.db.select().from(batches).where(eq(batches.batchId, scopeId))
    if (!row) throw notFound('Batch scope not found')
    return
  }
  const [row] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, scopeId))
  if (!row) throw notFound('Offering scope not found')
}

export async function assertSingleActiveOfferingOwner(
  context: RouteContext,
  offeringId: string,
  facultyId: string,
  excludeOwnershipId?: string,
) {
  const activeOwnerships = await context.db
    .select()
    .from(facultyOfferingOwnerships)
    .where(and(
      eq(facultyOfferingOwnerships.offeringId, offeringId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))

  const conflicting = activeOwnerships.filter(item => item.ownershipId !== excludeOwnershipId)
  if (conflicting.length === 0) return
  if (conflicting.some(item => item.facultyId === facultyId)) {
    throw badRequest('This class is already assigned to the selected faculty member.')
  }
  throw badRequest('This class already has an active faculty owner. Remove the existing assignment before reassigning it.')
}

export async function assertStudentEnrolledInOffering(
  context: RouteContext,
  offering: typeof sectionOfferings.$inferSelect,
  studentId: string,
) {
  const normalizedStudentId = normalizeAcademicStudentId(studentId)
  const [enrollment] = await context.db
    .select()
    .from(studentEnrollments)
    .where(and(
      eq(studentEnrollments.studentId, normalizedStudentId),
      eq(studentEnrollments.termId, offering.termId),
      eq(studentEnrollments.sectionCode, offering.sectionCode),
      eq(studentEnrollments.academicStatus, 'active'),
    ))
  if (!enrollment) {
    throw badRequest('The selected student is not actively enrolled in this offering', {
      offeringId: offering.offeringId,
      studentId: normalizedStudentId,
    })
  }
  return enrollment
}

export async function assertCourseLeaderCanManageOffering(context: RouteContext, facultyId: string, offeringId: string) {
  const [ownership] = await context.db
    .select()
    .from(facultyOfferingOwnerships)
    .where(and(
      eq(facultyOfferingOwnerships.facultyId, facultyId),
      eq(facultyOfferingOwnerships.offeringId, offeringId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
  assertAcademicAccess(evaluateCourseLeaderOfferingManagementAccess(
    !!ownership && isLeaderLikeOwnershipRole(ownership.ownershipRole),
  ))
  return ownership
}

export async function assertViewerCanReadOffering(context: RouteContext, auth: ReturnType<typeof requireAuth>, offeringId: string) {
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') return
  assertAcademicAccess(evaluateFacultyContextAccess(auth))
  const facultyId = auth.facultyId as string
  if (auth.activeRoleGrant.roleCode === 'COURSE_LEADER') {
    await assertCourseLeaderCanManageOffering(context, facultyId, offeringId)
    return
  }
  assertAcademicAccess(evaluateOfferingReadRoleAccess(auth.activeRoleGrant.roleCode))

  const { offering, branch } = await getOfferingContext(context, offeringId)
  const appointments = await context.db
    .select()
    .from(facultyAppointments)
    .where(and(
      eq(facultyAppointments.facultyId, facultyId),
      eq(facultyAppointments.status, 'active'),
    ))
  const scopedDepartmentIds = new Set(appointments.map(row => row.departmentId))
  const explicitBranchIds = new Set(appointments.map(row => row.branchId).filter((value): value is string => !!value))
  const termInScope = appointments.some(row => row.branchId === offering.branchId || row.departmentId === branch.departmentId)
  assertAcademicAccess(evaluateHodOfferingScopeAccess(
    termInScope || scopedDepartmentIds.has(branch.departmentId) || explicitBranchIds.has(offering.branchId),
  ))
}

export async function assertViewerCanManageTask(context: RouteContext, auth: ReturnType<typeof requireAuth>, task: z.infer<typeof sharedTaskSchema>) {
  // SYSTEM_ADMIN bypass matches assertViewerCanReadOffering pattern (§K.4
  // admin-override). Needed so the admin control-plane + the HOD correction-
  // cycle E2E fixture can seed tasks without faculty scope friction.
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') return
  assertAcademicAccess(evaluateFacultyContextAccess(auth))
  const facultyId = auth.facultyId as string
  const normalizedStudentId = normalizeAcademicStudentId(task.studentId)
  if (auth.activeRoleGrant.roleCode === 'COURSE_LEADER') {
    await assertCourseLeaderCanManageOffering(context, facultyId, task.offeringId)
    return
  }
  if (auth.activeRoleGrant.roleCode === 'MENTOR') {
    const [assignment] = await context.db
      .select()
      .from(mentorAssignments)
      .where(and(
        eq(mentorAssignments.facultyId, facultyId),
        eq(mentorAssignments.studentId, normalizedStudentId),
      ))
    assertAcademicAccess(evaluateMentorStudentScopeAccess(!!assignment && !assignment.effectiveTo))
    return
  }
  await assertViewerCanReadOffering(context, auth, task.offeringId)
}

export async function assertViewerCanSuperviseStudent(input: {
  context: RouteContext
  auth: ReturnType<typeof requireAuth>
  studentId: string
  offeringId?: string | null
}) {
  const normalizedStudentId = normalizeAcademicStudentId(input.studentId)
  assertAcademicAccess(evaluateFacultyContextAccess(input.auth))
  const facultyId = input.auth.facultyId as string
  const [student] = await input.context.db
    .select()
    .from(students)
    .where(eq(students.studentId, normalizedStudentId))
  if (!student) throw notFound('Student not found')

  if (input.auth.activeRoleGrant.roleCode === 'MENTOR') {
    const [assignment] = await input.context.db
      .select()
      .from(mentorAssignments)
      .where(and(
        eq(mentorAssignments.facultyId, facultyId),
        eq(mentorAssignments.studentId, normalizedStudentId),
      ))
    assertAcademicAccess(evaluateMentorStudentScopeAccess(!!assignment && !assignment.effectiveTo))
    return { student, studentId: normalizedStudentId }
  }

  if (input.auth.activeRoleGrant.roleCode === 'COURSE_LEADER') {
    if (input.offeringId) {
      await assertCourseLeaderCanManageOffering(input.context, facultyId, input.offeringId)
      const { offering } = await getOfferingContext(input.context, input.offeringId)
      await assertStudentEnrolledInOffering(input.context, offering, normalizedStudentId)
      return { student, studentId: normalizedStudentId }
    }

    const activeEnrollments = await input.context.db
      .select()
      .from(studentEnrollments)
      .where(and(
        eq(studentEnrollments.studentId, normalizedStudentId),
        eq(studentEnrollments.academicStatus, 'active'),
      ))
    const ownedOfferingRows = await input.context.db
      .select()
      .from(facultyOfferingOwnerships)
      .where(and(
        eq(facultyOfferingOwnerships.facultyId, facultyId),
        eq(facultyOfferingOwnerships.status, 'active'),
      ))
    const ownedOfferingIds = new Set(
      ownedOfferingRows
        .filter(row => isLeaderLikeOwnershipRole(row.ownershipRole))
        .map(row => row.offeringId),
    )
    const matchingOffering = await input.context.db
      .select()
      .from(sectionOfferings)
      .where(eq(sectionOfferings.status, 'active'))
      .then(rows => rows.find(row => ownedOfferingIds.has(row.offeringId) && activeEnrollments.some(enrollment => enrollment.termId === row.termId && enrollment.sectionCode === row.sectionCode)))
    assertAcademicAccess(evaluateCourseLeaderOfferingManagementAccess(
      !!matchingOffering,
      'This course leader does not supervise the selected student',
    ))
    return { student, studentId: normalizedStudentId }
  }

  if (input.auth.activeRoleGrant.roleCode === 'HOD') {
    const activeEnrollments = await input.context.db
      .select()
      .from(studentEnrollments)
      .where(and(
        eq(studentEnrollments.studentId, normalizedStudentId),
        eq(studentEnrollments.academicStatus, 'active'),
      ))
    const appointments = await input.context.db
      .select()
      .from(facultyAppointments)
      .where(and(
        eq(facultyAppointments.facultyId, facultyId),
        eq(facultyAppointments.status, 'active'),
      ))
    const scopedDepartmentIds = new Set(appointments.map(row => row.departmentId))
    const scopedBranchIds = new Set(appointments.map(row => row.branchId).filter((value): value is string => !!value))
    const [branchRows, termRows] = await Promise.all([
      input.context.db.select().from(branches),
      input.context.db.select().from(academicTerms),
    ])
    const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
    const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
    const inScope = activeEnrollments.some(enrollment => {
      const branch = branchById[enrollment.branchId]
      const term = termById[enrollment.termId]
      return !!branch && (scopedBranchIds.has(branch.branchId) || scopedDepartmentIds.has(branch.departmentId) || (term?.branchId ? scopedBranchIds.has(term.branchId) : false))
    })
    assertAcademicAccess(evaluateHodStudentScopeAccess(inScope))
    return { student, studentId: normalizedStudentId }
  }

  throw forbidden('This role cannot manage meetings')
}
