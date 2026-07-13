/**
 * Drizzle implementation of the AcademicRuntimeRepository port.
 *
 * Composition point for the academic-runtime data access; the per-group queries
 * live in sibling files to respect the 400-line architecture cap. Every query is
 * moved verbatim from modules/academic-runtime-routes.ts (`context.db` ->
 * injected `db`). `now` is injected so writes keep the legacy clock calls where
 * the repository owns the timestamp.
 */
import type { AppDb } from '../../../../db/client.js'
import type { AcademicRuntimeRepository } from '../../../../application/ports/academic-runtime-repository.js'
import {
  getRuntimeStateRow,
  insertRuntimeStateRow,
  updateRuntimeStateRow,
} from './runtime-state-repository.js'
import {
  getTaskById,
  getTaskTransitions,
  getTaskTransitionsOrderedAsc,
  insertTask,
  insertTaskTransition,
  listAllTaskTransitionsOrderedAsc,
  listAllTasks,
  updateTask,
  updateTaskDueDate,
} from './tasks-repository.js'
import {
  deletePlacement,
  getPlacementByTaskId,
  insertPlacement,
  listAllPlacements,
  updatePlacement,
} from './task-placements-repository.js'
import {
  getCalendarAuditEventById,
  getFacultyCalendarWorkspace,
  insertCalendarAuditEvent,
  insertFacultyCalendarWorkspace,
  listCalendarAuditEventsByFaculty,
  updateFacultyCalendarWorkspace,
} from './calendar-audit-repository.js'
import {
  getMeetingById,
  insertMeeting,
  updateMeeting,
} from './meetings-repository.js'
import {
  deleteStaleScores,
  deleteStudentScores,
  getQuestionPaperByOfferingKind,
  getSchemeByOffering,
  insertAssessmentScore,
  insertAttendanceSnapshot,
  insertQuestionPaper,
  insertScheme,
  listActiveCourseOutcomeOverrides,
  listScoreComponentTypes,
  updateOfferingFields,
  updateQuestionPaper,
  updateScheme,
} from './offering-data-entry-repository.js'

export function createAcademicRuntimeRepository(db: AppDb, now: () => string): AcademicRuntimeRepository {
  return {
    // runtime-state
    getRuntimeStateRow: stateKey => getRuntimeStateRow(db, stateKey),
    updateRuntimeStateRow: (stateKey, payloadJson, currentVersion) => updateRuntimeStateRow(db, now, stateKey, payloadJson, currentVersion),
    insertRuntimeStateRow: (stateKey, payloadJson) => insertRuntimeStateRow(db, now, stateKey, payloadJson),

    // tasks
    getTaskById: taskId => getTaskById(db, taskId),
    getTaskTransitions: taskId => getTaskTransitions(db, taskId),
    getTaskTransitionsOrderedAsc: taskId => getTaskTransitionsOrderedAsc(db, taskId),
    listAllTasks: () => listAllTasks(db),
    listAllTaskTransitionsOrderedAsc: () => listAllTaskTransitionsOrderedAsc(db),
    updateTask: (taskId, fields, nextVersion, updatedAt) => updateTask(db, taskId, fields, nextVersion, updatedAt),
    insertTask: (taskId, fields, createdByFacultyId, createdAt, updatedAt) => insertTask(db, taskId, fields, createdByFacultyId, createdAt, updatedAt),
    updateTaskDueDate: (taskId, fields) => updateTaskDueDate(db, taskId, fields),
    insertTaskTransition: input => insertTaskTransition(db, input),

    // task-placements
    getPlacementByTaskId: taskId => getPlacementByTaskId(db, taskId),
    listAllPlacements: () => listAllPlacements(db),
    updatePlacement: (taskId, fields, updatedAt) => updatePlacement(db, taskId, fields, updatedAt),
    insertPlacement: (taskId, fields, updatedAt) => insertPlacement(db, taskId, fields, updatedAt),
    deletePlacement: taskId => deletePlacement(db, taskId),

    // calendar-audit
    getCalendarAuditEventById: auditEventId => getCalendarAuditEventById(db, auditEventId),
    insertCalendarAuditEvent: (auditEventId, facultyId, payloadJson, createdAt) => insertCalendarAuditEvent(db, auditEventId, facultyId, payloadJson, createdAt),
    listCalendarAuditEventsByFaculty: facultyId => listCalendarAuditEventsByFaculty(db, facultyId),

    // faculty-calendar-workspace
    getFacultyCalendarWorkspace: facultyId => getFacultyCalendarWorkspace(db, facultyId),
    updateFacultyCalendarWorkspace: (facultyId, templateJson, nextVersion, updatedAt) => updateFacultyCalendarWorkspace(db, facultyId, templateJson, nextVersion, updatedAt),
    insertFacultyCalendarWorkspace: (facultyId, templateJson, createdAt, updatedAt) => insertFacultyCalendarWorkspace(db, facultyId, templateJson, createdAt, updatedAt),

    // meetings
    insertMeeting: (input, createdAt, updatedAt) => insertMeeting(db, input, createdAt, updatedAt),
    getMeetingById: meetingId => getMeetingById(db, meetingId),
    updateMeeting: (meetingId, fields, nextVersion, updatedAt) => updateMeeting(db, meetingId, fields, nextVersion, updatedAt),

    // offering data-entry
    insertAttendanceSnapshot: (input, createdAt, updatedAt) => insertAttendanceSnapshot(db, input, createdAt, updatedAt),
    updateOfferingFields: (offeringId, patch) => updateOfferingFields(db, offeringId, patch),
    getSchemeByOffering: offeringId => getSchemeByOffering(db, offeringId),
    listActiveCourseOutcomeOverrides: courseId => listActiveCourseOutcomeOverrides(db, courseId),
    getQuestionPaperByOfferingKind: (offeringId, kind) => getQuestionPaperByOfferingKind(db, offeringId, kind),
    listScoreComponentTypes: offeringId => listScoreComponentTypes(db, offeringId),
    deleteStaleScores: (offeringId, componentTypes, submittedStudentIds) => deleteStaleScores(db, offeringId, componentTypes, submittedStudentIds),
    deleteStudentScores: (studentId, offeringId, componentTypes) => deleteStudentScores(db, studentId, offeringId, componentTypes),
    insertAssessmentScore: (input, createdAt, updatedAt) => insertAssessmentScore(db, input, createdAt, updatedAt),
    updateScheme: (offeringId, fields, nextVersion, updatedAt) => updateScheme(db, offeringId, fields, nextVersion, updatedAt),
    insertScheme: (offeringId, fields, createdAt, updatedAt) => insertScheme(db, offeringId, fields, createdAt, updatedAt),
    updateQuestionPaper: (paperId, blueprintJson, updatedByFacultyId, nextVersion, updatedAt) => updateQuestionPaper(db, paperId, blueprintJson, updatedByFacultyId, nextVersion, updatedAt),
    insertQuestionPaper: (fields, createdAt, updatedAt) => insertQuestionPaper(db, fields, createdAt, updatedAt),
  }
}
