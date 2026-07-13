/**
 * Drizzle implementation of the PeopleRepository port.
 *
 * Composition point for people (faculty master) data access; the reads,
 * reference-data load, and writes live in sibling files to respect the 400-line
 * cap. Ids and timestamps are supplied by the use-case layer (injected
 * createId/now), so this repository is a pure persistence adapter.
 */
import type { AppDb } from '../../../../db/client.js'
import type { PeopleRepository } from '../../../../application/ports/people-repository.js'
import { loadReferenceData } from './people-reference-repository.js'
import {
  getAppointmentById,
  getFacultyProfileById,
  getFirstInstitutionId,
  getRoleGrantById,
  getUserAccountById,
  listAppointmentsByFaculty,
  listFacultyAppointments,
  listFacultyProfiles,
  listMentorAssignmentsByFaculty,
  listOwnershipsByFaculty,
  listPasswordCredentials,
  listPasswordCredentialsByUser,
  listPasswordSetupTokens,
  listPasswordSetupTokensByUser,
  listRoleGrants,
  listRoleGrantsByFaculty,
  listUserAccounts,
} from './people-read-repository.js'
import {
  insertAppointment,
  insertFacultyProfile,
  insertPasswordCredential,
  insertPasswordSetupToken,
  insertRoleGrant,
  insertUiPreference,
  insertUserAccount,
  updateAppointment,
  updateAppointmentStatus,
  updateFacultyProfile,
  updateMentorAssignmentEffectiveTo,
  updateOwnershipStatus,
  updateRoleGrant,
  updateRoleGrantStatus,
  updateUserAccount,
} from './people-write-repository.js'

export function createPeopleRepository(db: AppDb): PeopleRepository {
  return {
    listFacultyProfiles: () => listFacultyProfiles(db),
    listUserAccounts: () => listUserAccounts(db),
    listPasswordCredentials: () => listPasswordCredentials(db),
    listPasswordSetupTokens: () => listPasswordSetupTokens(db),
    listFacultyAppointments: () => listFacultyAppointments(db),
    listRoleGrants: () => listRoleGrants(db),
    loadReferenceData: () => loadReferenceData(db),

    getFirstInstitutionId: () => getFirstInstitutionId(db),
    insertUserAccount: input => insertUserAccount(db, input),
    insertPasswordCredential: input => insertPasswordCredential(db, input),
    insertPasswordSetupToken: input => insertPasswordSetupToken(db, input),
    insertUiPreference: input => insertUiPreference(db, input),
    insertFacultyProfile: input => insertFacultyProfile(db, input),

    getFacultyProfileById: facultyId => getFacultyProfileById(db, facultyId),
    getUserAccountById: userId => getUserAccountById(db, userId),
    listPasswordCredentialsByUser: userId => listPasswordCredentialsByUser(db, userId),
    listPasswordSetupTokensByUser: userId => listPasswordSetupTokensByUser(db, userId),
    listAppointmentsByFaculty: facultyId => listAppointmentsByFaculty(db, facultyId),
    listRoleGrantsByFaculty: facultyId => listRoleGrantsByFaculty(db, facultyId),
    listOwnershipsByFaculty: facultyId => listOwnershipsByFaculty(db, facultyId),
    listMentorAssignmentsByFaculty: facultyId => listMentorAssignmentsByFaculty(db, facultyId),

    updateUserAccount: (userId, fields) => updateUserAccount(db, userId, fields),
    updateFacultyProfile: (facultyId, fields) => updateFacultyProfile(db, facultyId, fields),
    updateAppointmentStatus: (appointmentId, fields) => updateAppointmentStatus(db, appointmentId, fields),
    updateRoleGrantStatus: (grantId, fields) => updateRoleGrantStatus(db, grantId, fields),
    updateOwnershipStatus: (ownershipId, fields) => updateOwnershipStatus(db, ownershipId, fields),
    updateMentorAssignmentEffectiveTo: (assignmentId, fields) => updateMentorAssignmentEffectiveTo(db, assignmentId, fields),

    getAppointmentById: appointmentId => getAppointmentById(db, appointmentId),
    insertAppointment: input => insertAppointment(db, input),
    updateAppointment: (appointmentId, fields) => updateAppointment(db, appointmentId, fields),

    getRoleGrantById: grantId => getRoleGrantById(db, grantId),
    insertRoleGrant: input => insertRoleGrant(db, input),
    updateRoleGrant: (grantId, fields) => updateRoleGrant(db, grantId, fields),
  }
}
