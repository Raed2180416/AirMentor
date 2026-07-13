/**
 * People (faculty master) repository port.
 *
 * Framework-free interface for every DB access the people use-cases need:
 * the faculty directory dataset + reference data, the faculty/user/credential
 * writes and re-reads for create/update, the deletion cascade updates, and the
 * appointment/role-grant CRUD. MUST NOT import db/schema or drizzle-orm — the
 * Drizzle implementation lives under adapters/persistence (ESLint enforces this).
 *
 * Row shapes are defined in the people domain; write-input shapes below mirror
 * the exact column writes performed by the legacy module.
 */
import type {
  FacultyAppointmentRow,
  FacultyOfferingOwnershipRow,
  FacultyProfileRow,
  MentorAssignmentRow,
  PasswordCredentialRow,
  PasswordSetupTokenRow,
  PeopleReferenceData,
  RoleGrantRow,
  UserAccountRow,
} from '../use-cases/people/people-domain.js'

export type InsertUserAccountInput = {
  userId: string
  institutionId: string
  username: string
  email: string
  phone: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type InsertPasswordCredentialInput = {
  userId: string
  passwordHash: string
  updatedAt: string
}

export type InsertPasswordSetupTokenInput = {
  passwordSetupTokenId: string
  userId: string
  purpose: string
  tokenHash: string
  issuedToEmail: string
  requestedByUserId: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string
  updatedAt: string
}

export type InsertUiPreferenceInput = {
  userId: string
  themeMode: string
  version: number
  updatedAt: string
}

export type InsertFacultyProfileInput = {
  facultyId: string
  userId: string
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type UpdateUserAccountFields = {
  username: string
  email: string
  phone: string | null
  status: string
  version: number
  updatedAt: string
}

export type UpdateFacultyProfileFields = {
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string | null
  status: string
  version: number
  updatedAt: string
}

export type StatusVersionUpdate = {
  status: string
  version: number
  updatedAt: string
}

export type MentorAssignmentEndUpdate = {
  effectiveTo: string
  version: number
  updatedAt: string
}

export type InsertAppointmentInput = {
  appointmentId: string
  facultyId: string
  departmentId: string
  branchId: string | null
  isPrimary: number
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type UpdateAppointmentFields = {
  facultyId: string
  departmentId: string
  branchId: string | null
  isPrimary: number
  startDate: string
  endDate: string | null
  status: string
  version: number
  updatedAt: string
}

export type InsertRoleGrantInput = {
  grantId: string
  facultyId: string
  roleCode: string
  scopeType: string
  scopeId: string
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type UpdateRoleGrantFields = {
  facultyId: string
  roleCode: string
  scopeType: string
  scopeId: string
  startDate: string
  endDate: string | null
  status: string
  version: number
  updatedAt: string
}

export interface PeopleRepository {
  // GET /api/admin/faculty
  listFacultyProfiles(): Promise<FacultyProfileRow[]>
  listUserAccounts(): Promise<UserAccountRow[]>
  listPasswordCredentials(): Promise<PasswordCredentialRow[]>
  listPasswordSetupTokens(): Promise<PasswordSetupTokenRow[]>
  listFacultyAppointments(): Promise<FacultyAppointmentRow[]>
  listRoleGrants(): Promise<RoleGrantRow[]>
  loadReferenceData(): Promise<PeopleReferenceData>

  // POST /api/admin/faculty
  getFirstInstitutionId(): Promise<string | undefined>
  insertUserAccount(input: InsertUserAccountInput): Promise<void>
  insertPasswordCredential(input: InsertPasswordCredentialInput): Promise<void>
  insertPasswordSetupToken(input: InsertPasswordSetupTokenInput): Promise<void>
  insertUiPreference(input: InsertUiPreferenceInput): Promise<void>
  insertFacultyProfile(input: InsertFacultyProfileInput): Promise<void>

  // shared re-reads (POST/PATCH /api/admin/faculty, password-setup)
  getFacultyProfileById(facultyId: string): Promise<FacultyProfileRow | undefined>
  getUserAccountById(userId: string): Promise<UserAccountRow | undefined>
  listPasswordCredentialsByUser(userId: string): Promise<PasswordCredentialRow[]>
  listPasswordSetupTokensByUser(userId: string): Promise<PasswordSetupTokenRow[]>
  listAppointmentsByFaculty(facultyId: string): Promise<FacultyAppointmentRow[]>
  listRoleGrantsByFaculty(facultyId: string): Promise<RoleGrantRow[]>
  listOwnershipsByFaculty(facultyId: string): Promise<FacultyOfferingOwnershipRow[]>
  listMentorAssignmentsByFaculty(facultyId: string): Promise<MentorAssignmentRow[]>

  // PATCH /api/admin/faculty/:facultyId
  updateUserAccount(userId: string, fields: UpdateUserAccountFields): Promise<void>
  updateFacultyProfile(facultyId: string, fields: UpdateFacultyProfileFields): Promise<void>
  updateAppointmentStatus(appointmentId: string, fields: StatusVersionUpdate): Promise<void>
  updateRoleGrantStatus(grantId: string, fields: StatusVersionUpdate): Promise<void>
  updateOwnershipStatus(ownershipId: string, fields: StatusVersionUpdate): Promise<void>
  updateMentorAssignmentEffectiveTo(assignmentId: string, fields: MentorAssignmentEndUpdate): Promise<void>

  // POST /api/admin/faculty/:facultyId/appointments, PATCH /api/admin/appointments/:appointmentId
  getAppointmentById(appointmentId: string): Promise<FacultyAppointmentRow | undefined>
  insertAppointment(input: InsertAppointmentInput): Promise<void>
  updateAppointment(appointmentId: string, fields: UpdateAppointmentFields): Promise<void>

  // POST /api/admin/faculty/:facultyId/role-grants, PATCH /api/admin/role-grants/:grantId
  getRoleGrantById(grantId: string): Promise<RoleGrantRow | undefined>
  insertRoleGrant(input: InsertRoleGrantInput): Promise<void>
  updateRoleGrant(grantId: string, fields: UpdateRoleGrantFields): Promise<void>
}
