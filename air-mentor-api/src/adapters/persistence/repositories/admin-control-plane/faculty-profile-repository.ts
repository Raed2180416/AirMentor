/**
 * Drizzle reads for GET /api/academic/faculty-profile/:facultyId — the
 * checkpoint run lookup and the 21-way profile dataset load. The Promise.all
 * query set (including the conditional HoD viewer-appointment read) is moved
 * verbatim from the legacy handler; calendar rows are pre-mapped to domain
 * templates/workspace so the application layer stays db/schema-free.
 */
import { eq } from 'drizzle-orm'
import {
  academicFaculties,
  academicTerms,
  adminRequests,
  alertDecisions,
  batches,
  branches,
  courses,
  departments,
  facultyAppointments,
  facultyCalendarAdminWorkspaces,
  facultyCalendarCanonicalTemplates,
  facultyCalendarWorkspaces,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  reassessmentEvents,
  roleGrants,
  sectionOfferings,
  simulationStageCheckpoints,
  studentEnrollments,
  userAccounts,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  FacultyProfileDataset,
} from '../../../../application/use-cases/admin-control-plane/faculty-profile-domain.js'
import type { LoadFacultyProfileDatasetInput } from '../../../../application/ports/admin-control-plane-repository.js'
import {
  mapFacultyCalendarAdminWorkspaceRow,
  mapFacultyCalendarCanonicalTemplateRow,
  mapFacultyCalendarTemplateRow,
} from './faculty-calendar-mappers.js'

export async function getCheckpointRunId(
  db: AppDb,
  simulationStageCheckpointId: string,
): Promise<{ simulationRunId: string } | null> {
  const [requestedCheckpoint] = await db
    .select({
      simulationRunId: simulationStageCheckpoints.simulationRunId,
    })
    .from(simulationStageCheckpoints)
    .where(eq(simulationStageCheckpoints.simulationStageCheckpointId, simulationStageCheckpointId))
  return requestedCheckpoint ?? null
}

export async function loadFacultyProfileDataset(
  db: AppDb,
  input: LoadFacultyProfileDatasetInput,
): Promise<FacultyProfileDataset> {
  const { facultyId, viewerRoleCode, viewerFacultyId } = input
  const [
    profileRows,
    userRows,
    appointmentRows,
    academicFacultyRows,
    departmentRows,
    batchRows,
    roleGrantRows,
    assignmentRows,
    ownershipRows,
    offeringRows,
    courseRows,
    branchRows,
    termRows,
    requestRows,
    reassessmentRows,
    alertDecisionRows,
    enrollmentRows,
    timetableRows,
    canonicalRows,
    calendarWorkspaceRows,
    viewerAppointmentRows,
  ] = await Promise.all([
    db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, facultyId)),
    db.select().from(userAccounts),
    db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, facultyId)),
    db.select().from(academicFaculties),
    db.select().from(departments),
    db.select().from(batches),
    db.select().from(roleGrants).where(eq(roleGrants.facultyId, facultyId)),
    db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyId)),
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, facultyId)),
    db.select().from(sectionOfferings),
    db.select().from(courses),
    db.select().from(branches),
    db.select().from(academicTerms),
    db.select().from(adminRequests),
    db.select().from(reassessmentEvents),
    db.select().from(alertDecisions),
    db.select().from(studentEnrollments),
    db.select().from(facultyCalendarWorkspaces).where(eq(facultyCalendarWorkspaces.facultyId, facultyId)),
    db.select().from(facultyCalendarCanonicalTemplates).where(eq(facultyCalendarCanonicalTemplates.facultyId, facultyId)),
    db.select().from(facultyCalendarAdminWorkspaces).where(eq(facultyCalendarAdminWorkspaces.facultyId, facultyId)),
    viewerRoleCode === 'HOD' && viewerFacultyId
      ? db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, viewerFacultyId))
      : Promise.resolve([]),
  ])

  const teacherLocalTemplate = timetableRows[0] ? mapFacultyCalendarTemplateRow(timetableRows[0]) : null
  const canonicalTemplate = canonicalRows[0] ? mapFacultyCalendarCanonicalTemplateRow(canonicalRows[0]) : null
  const calendarWorkspace = calendarWorkspaceRows[0] ? mapFacultyCalendarAdminWorkspaceRow(calendarWorkspaceRows[0]) : null
  const timetableUpdatedAt = timetableRows[0]?.updatedAt ?? null

  return {
    profileRows,
    userRows,
    appointmentRows,
    academicFacultyRows,
    departmentRows,
    batchRows,
    roleGrantRows,
    assignmentRows,
    ownershipRows,
    offeringRows,
    courseRows,
    branchRows,
    termRows,
    requestRows,
    reassessmentRows,
    alertDecisionRows,
    enrollmentRows,
    viewerAppointmentRows,
    teacherLocalTemplate,
    canonicalTemplate,
    calendarWorkspace,
    timetableUpdatedAt,
  }
}
