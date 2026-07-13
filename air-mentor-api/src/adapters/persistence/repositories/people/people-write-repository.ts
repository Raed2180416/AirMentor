/**
 * Drizzle writes for the people routes — user/credential/profile creation, the
 * profile+user update, the faculty-deletion cascade updates, and the
 * appointment/role-grant inserts+updates. Each write sets exactly the columns
 * the legacy module set; ids/timestamps are supplied by the use-case layer.
 */
import { eq } from 'drizzle-orm'
import {
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  roleGrants,
  uiPreferences,
  userAccounts,
  userPasswordCredentials,
  userPasswordSetupTokens,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  InsertAppointmentInput,
  InsertFacultyProfileInput,
  InsertPasswordCredentialInput,
  InsertPasswordSetupTokenInput,
  InsertRoleGrantInput,
  InsertUiPreferenceInput,
  InsertUserAccountInput,
  MentorAssignmentEndUpdate,
  StatusVersionUpdate,
  UpdateAppointmentFields,
  UpdateFacultyProfileFields,
  UpdateRoleGrantFields,
  UpdateUserAccountFields,
} from '../../../../application/ports/people-repository.js'

export async function insertUserAccount(db: AppDb, input: InsertUserAccountInput): Promise<void> {
  await db.insert(userAccounts).values(input)
}

export async function insertPasswordCredential(db: AppDb, input: InsertPasswordCredentialInput): Promise<void> {
  await db.insert(userPasswordCredentials).values(input)
}

export async function insertPasswordSetupToken(db: AppDb, input: InsertPasswordSetupTokenInput): Promise<void> {
  await db.insert(userPasswordSetupTokens).values(input)
}

export async function insertUiPreference(db: AppDb, input: InsertUiPreferenceInput): Promise<void> {
  await db.insert(uiPreferences).values(input)
}

export async function insertFacultyProfile(db: AppDb, input: InsertFacultyProfileInput): Promise<void> {
  await db.insert(facultyProfiles).values(input)
}

export async function updateUserAccount(db: AppDb, userId: string, fields: UpdateUserAccountFields): Promise<void> {
  await db.update(userAccounts).set(fields).where(eq(userAccounts.userId, userId))
}

export async function updateFacultyProfile(db: AppDb, facultyId: string, fields: UpdateFacultyProfileFields): Promise<void> {
  await db.update(facultyProfiles).set(fields).where(eq(facultyProfiles.facultyId, facultyId))
}

export async function updateAppointmentStatus(db: AppDb, appointmentId: string, fields: StatusVersionUpdate): Promise<void> {
  await db.update(facultyAppointments).set(fields).where(eq(facultyAppointments.appointmentId, appointmentId))
}

export async function updateRoleGrantStatus(db: AppDb, grantId: string, fields: StatusVersionUpdate): Promise<void> {
  await db.update(roleGrants).set(fields).where(eq(roleGrants.grantId, grantId))
}

export async function updateOwnershipStatus(db: AppDb, ownershipId: string, fields: StatusVersionUpdate): Promise<void> {
  await db.update(facultyOfferingOwnerships).set(fields).where(eq(facultyOfferingOwnerships.ownershipId, ownershipId))
}

export async function updateMentorAssignmentEffectiveTo(db: AppDb, assignmentId: string, fields: MentorAssignmentEndUpdate): Promise<void> {
  await db.update(mentorAssignments).set(fields).where(eq(mentorAssignments.assignmentId, assignmentId))
}

export async function insertAppointment(db: AppDb, input: InsertAppointmentInput): Promise<void> {
  await db.insert(facultyAppointments).values(input)
}

export async function updateAppointment(db: AppDb, appointmentId: string, fields: UpdateAppointmentFields): Promise<void> {
  await db.update(facultyAppointments).set(fields).where(eq(facultyAppointments.appointmentId, appointmentId))
}

export async function insertRoleGrant(db: AppDb, input: InsertRoleGrantInput): Promise<void> {
  await db.insert(roleGrants).values(input)
}

export async function updateRoleGrant(db: AppDb, grantId: string, fields: UpdateRoleGrantFields): Promise<void> {
  await db.update(roleGrants).set(fields).where(eq(roleGrants.grantId, grantId))
}
