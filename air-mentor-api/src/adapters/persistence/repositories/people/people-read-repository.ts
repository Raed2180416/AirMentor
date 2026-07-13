/**
 * Drizzle reads for the people routes — the full-table directory scans, the
 * institution lookup, and the by-id / by-faculty re-reads used across the
 * create/update/password-setup/appointment/role-grant handlers. Query shapes are
 * moved verbatim from modules/people.ts; rows are returned as the framework-free
 * domain shapes (Drizzle rows are structural supersets).
 */
import { eq } from 'drizzle-orm'
import {
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  institutions,
  mentorAssignments,
  roleGrants,
  userAccounts,
  userPasswordCredentials,
  userPasswordSetupTokens,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  FacultyAppointmentRow,
  FacultyOfferingOwnershipRow,
  FacultyProfileRow,
  MentorAssignmentRow,
  PasswordCredentialRow,
  PasswordSetupTokenRow,
  RoleGrantRow,
  UserAccountRow,
} from '../../../../application/use-cases/people/people-domain.js'

export function listFacultyProfiles(db: AppDb): Promise<FacultyProfileRow[]> {
  return db.select().from(facultyProfiles)
}

export function listUserAccounts(db: AppDb): Promise<UserAccountRow[]> {
  return db.select().from(userAccounts)
}

export function listPasswordCredentials(db: AppDb): Promise<PasswordCredentialRow[]> {
  return db.select().from(userPasswordCredentials)
}

export function listPasswordSetupTokens(db: AppDb): Promise<PasswordSetupTokenRow[]> {
  return db.select().from(userPasswordSetupTokens)
}

export function listFacultyAppointments(db: AppDb): Promise<FacultyAppointmentRow[]> {
  return db.select().from(facultyAppointments)
}

export function listRoleGrants(db: AppDb): Promise<RoleGrantRow[]> {
  return db.select().from(roleGrants)
}

export async function getFirstInstitutionId(db: AppDb): Promise<string | undefined> {
  return (await db.select().from(institutions).limit(1))[0]?.institutionId
}

export async function getFacultyProfileById(db: AppDb, facultyId: string): Promise<FacultyProfileRow | undefined> {
  const [row] = await db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, facultyId))
  return row
}

export async function getUserAccountById(db: AppDb, userId: string): Promise<UserAccountRow | undefined> {
  const [row] = await db.select().from(userAccounts).where(eq(userAccounts.userId, userId))
  return row
}

export function listPasswordCredentialsByUser(db: AppDb, userId: string): Promise<PasswordCredentialRow[]> {
  return db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, userId))
}

export function listPasswordSetupTokensByUser(db: AppDb, userId: string): Promise<PasswordSetupTokenRow[]> {
  return db.select().from(userPasswordSetupTokens).where(eq(userPasswordSetupTokens.userId, userId))
}

export function listAppointmentsByFaculty(db: AppDb, facultyId: string): Promise<FacultyAppointmentRow[]> {
  return db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, facultyId))
}

export function listRoleGrantsByFaculty(db: AppDb, facultyId: string): Promise<RoleGrantRow[]> {
  return db.select().from(roleGrants).where(eq(roleGrants.facultyId, facultyId))
}

export function listOwnershipsByFaculty(db: AppDb, facultyId: string): Promise<FacultyOfferingOwnershipRow[]> {
  return db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, facultyId))
}

export function listMentorAssignmentsByFaculty(db: AppDb, facultyId: string): Promise<MentorAssignmentRow[]> {
  return db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyId))
}

export async function getAppointmentById(db: AppDb, appointmentId: string): Promise<FacultyAppointmentRow | undefined> {
  const [row] = await db.select().from(facultyAppointments).where(eq(facultyAppointments.appointmentId, appointmentId))
  return row
}

export async function getRoleGrantById(db: AppDb, grantId: string): Promise<RoleGrantRow | undefined> {
  const [row] = await db.select().from(roleGrants).where(eq(roleGrants.grantId, grantId))
  return row
}
