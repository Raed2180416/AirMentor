/**
 * GET /api/admin/batches/:batchId/setup-readiness handler body — compute the
 * live-readiness blockers for a batch (optionally scoped to a section).
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import {
  academicTerms,
  batches,
  curriculumCourses,
  facultyAppointments,
  facultyOfferingOwnerships,
  mentorAssignments,
  roleGrants,
  sectionOfferings,
  studentEnrollments,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { notFound } from '../../../../lib/http-errors.js'
import { parseOrThrow, requireRole } from '../../../../modules/support.js'

export async function computeSetupReadiness(context: RouteContext, request: FastifyRequest) {
  requireRole(request, ['SYSTEM_ADMIN'])
  const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
  const query = parseOrThrow(z.object({ sectionCode: z.string().optional() }), request.query)

  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
  if (!batch) throw notFound('Batch not found')

  const sectionCode = query.sectionCode?.trim() || null
  const batchLabel = batch.batchLabel

  function isVisibleStatus(status: string) {
    const s = status.toLowerCase()
    return s !== 'archived' && s !== 'deleted' && s !== 'hidden'
  }

  const allBatchTerms = await context.db.select().from(academicTerms)
    .where(eq(academicTerms.batchId, params.batchId))
  const visibleBatchTerms = allBatchTerms.filter(t => isVisibleStatus(t.status))
  const batchTermIds = visibleBatchTerms.map(t => t.termId)
  const currentSemesterTerm = visibleBatchTerms.find(t => t.semesterNumber === batch.currentSemester)
    ?? visibleBatchTerms[0]
    ?? null

  const allCurriculumRows = await context.db.select().from(curriculumCourses)
    .where(eq(curriculumCourses.batchId, params.batchId))
  const activeCurriculumRows = allCurriculumRows.filter(c => isVisibleStatus(c.status))

  const allBranchAppointments = await context.db.select().from(facultyAppointments)
    .where(eq(facultyAppointments.branchId, batch.branchId))
  const activeBranchAppointments = allBranchAppointments.filter(a => isVisibleStatus(a.status))

  const allMentorGrants = await context.db.select().from(roleGrants)
    .where(eq(roleGrants.roleCode, 'MENTOR'))
  const activeMentorGrants = allMentorGrants.filter(g =>
    isVisibleStatus(g.status)
    && (
      (g.scopeType === 'batch' && g.scopeId === params.batchId)
      || (g.scopeType === 'branch' && g.scopeId === batch.branchId)
    ),
  )
  const uniqueMentorFacultyCount = new Set(activeMentorGrants.map(g => g.facultyId)).size

  const allBatchOfferings = batchTermIds.length > 0
    ? await context.db.select().from(sectionOfferings)
        .where(inArray(sectionOfferings.termId, batchTermIds))
    : []
  const scopedOfferings = sectionCode
    ? allBatchOfferings.filter(o => o.sectionCode === sectionCode)
    : allBatchOfferings
  const visibleOfferings = scopedOfferings.filter(o => isVisibleStatus(o.status))

  const offeringIds = visibleOfferings.map(o => o.offeringId)
  const allOwnerships = offeringIds.length > 0
    ? await context.db.select().from(facultyOfferingOwnerships)
        .where(inArray(facultyOfferingOwnerships.offeringId, offeringIds))
    : []
  const ownedOfferingIds = new Set(
    allOwnerships.filter(ow => ow.status === 'active').map(ow => ow.offeringId),
  )
  const offeringsWithoutOwnerCount = visibleOfferings.filter(o => !ownedOfferingIds.has(o.offeringId)).length

  const allEnrollments = batchTermIds.length > 0
    ? await context.db.select().from(studentEnrollments)
        .where(inArray(studentEnrollments.termId, batchTermIds))
    : []
  const scopedEnrollments = sectionCode
    ? allEnrollments.filter(e => e.sectionCode === sectionCode)
    : allEnrollments
  const batchStudentIds = new Set(scopedEnrollments.map(e => e.studentId))
  const studentsWithActiveEnrollment = new Set(
    scopedEnrollments.filter(e => e.endDate === null).map(e => e.studentId),
  )
  const studentsWithoutEnrollmentCount = Array.from(batchStudentIds)
    .filter(id => !studentsWithActiveEnrollment.has(id)).length

  const batchStudentIdsArray = Array.from(batchStudentIds)
  const allMentorAssignments = batchStudentIdsArray.length > 0
    ? await context.db.select().from(mentorAssignments)
        .where(inArray(mentorAssignments.studentId, batchStudentIdsArray))
    : []
  const activeAssignmentStudentIds = new Set(
    allMentorAssignments.filter(a => a.effectiveTo === null).map(a => a.studentId),
  )
  const studentsWithoutMentorCount = batchStudentIdsArray
    .filter(id => !activeAssignmentStudentIds.has(id)).length

  const rosterKeySet = new Set(
    scopedEnrollments.filter(e => e.endDate === null).map(e => `${e.termId}::${e.sectionCode}`),
  )
  const offeringsWithoutRosterCount = visibleOfferings
    .filter(o => !rosterKeySet.has(`${o.termId}::${o.sectionCode}`)).length

  const blockers: string[] = []
  if (!currentSemesterTerm) blockers.push(`Add the live semester term for ${batchLabel}.`)
  if (activeCurriculumRows.length === 0) blockers.push(`Add curriculum rows before moving ${batchLabel} forward.`)
  if (activeBranchAppointments.length === 0) blockers.push(`Add faculty appointments in scope for ${batchLabel}.`)
  if (uniqueMentorFacultyCount === 0) blockers.push(`Grant at least one mentor-ready faculty member in ${batchLabel}.`)
  if (batchStudentIds.size === 0) blockers.push(`Add or provision students for ${batchLabel}.`)
  if (visibleOfferings.length === 0) blockers.push(`Create teaching offerings for ${batchLabel}.`)
  if (offeringsWithoutOwnerCount > 0) blockers.push(`${offeringsWithoutOwnerCount} offering(s) still need a faculty owner.`)
  if (studentsWithoutEnrollmentCount > 0) blockers.push(`${studentsWithoutEnrollmentCount} student(s) still need an active enrollment.`)
  if (studentsWithoutMentorCount > 0) blockers.push(`${studentsWithoutMentorCount} student(s) still need a mentor.`)
  if (offeringsWithoutRosterCount > 0) blockers.push(`${offeringsWithoutRosterCount} offering(s) still have no roster.`)

  return { ready: blockers.length === 0, blockers, batchLabel }
}
