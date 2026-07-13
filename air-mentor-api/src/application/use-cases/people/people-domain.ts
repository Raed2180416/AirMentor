/**
 * People domain — framework-free row shapes, the faculty reference-data
 * aggregate, and the pure mappers/helpers shared by the people use-cases.
 *
 * Each row interface lists the columns the mappers/scope logic read (matched to
 * db/schema nullability). The repository loads Drizzle rows (structural
 * supersets) and returns them as these shapes; nothing here imports db/schema or
 * drizzle-orm. Mapper/helper bodies are moved verbatim from modules/people.ts.
 */
import type { FacultyCredentialStatus } from '../../../lib/password-setup.js'

// ---------------------------------------------------------------------------
// Framework-free row shapes (mirror the Drizzle $inferSelect columns used here)
// ---------------------------------------------------------------------------

export type InstitutionRow = {
  institutionId: string
  name: string
}

export type AcademicFacultyRow = {
  academicFacultyId: string
  name: string
}

export type DepartmentRow = {
  departmentId: string
  name: string
  code: string
  academicFacultyId: string | null
}

export type BranchRow = {
  branchId: string
  name: string
  code: string
  departmentId: string
}

export type BatchRow = {
  batchId: string
  batchLabel: string
  branchId: string
}

export type TermRow = {
  termId: string
  batchId: string | null
}

export type OfferingRow = {
  offeringId: string
  branchId: string
  termId: string
  sectionCode: string
}

export type FacultyOfferingOwnershipRow = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  demoWorkspaceId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type FacultyProfileRow = {
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

export type UserAccountRow = {
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

export type PasswordCredentialRow = {
  userId: string
  passwordHash: string
  updatedAt: string
}

export type PasswordSetupTokenRow = {
  passwordSetupTokenId: string
  userId: string
  purpose: string
  tokenHash: string
  issuedToEmail: string
  requestedByUserId: string | null
  expiresAt: string
  consumedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FacultyAppointmentRow = {
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

export type RoleGrantRow = {
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

export type MentorAssignmentRow = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  demoWorkspaceId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type PeopleReferenceData = {
  institution: InstitutionRow | null
  academicFacultyById: Map<string, AcademicFacultyRow>
  departmentById: Map<string, DepartmentRow>
  branchById: Map<string, BranchRow>
  batchById: Map<string, BatchRow>
  termById: Map<string, TermRow>
  offeringById: Map<string, OfferingRow>
  ownerships: Array<FacultyOfferingOwnershipRow>
}

export type FacultyRecord = ReturnType<typeof mapFacultyRecord>
export type RecordProofProvenance = {
  scopeDescriptor: {
    scopeType: string
    scopeId: string
    label: string
    batchId: string | null
    sectionCode: string | null
    branchName: string | null
    simulationRunId: string | null
    simulationStageCheckpointId: string | null
    studentId: string | null
  } | null
  resolvedFrom: {
    kind: string
    scopeType: string | null
    scopeId: string | null
    label: string
  } | null
  scopeMode: string | null
  countSource: 'operational-semester' | 'proof-run' | 'proof-checkpoint' | 'unavailable' | null
  activeOperationalSemester: number | null
}
export type FacultyRecordWithProvenance = FacultyRecord & Partial<RecordProofProvenance>
export type ProvenanceScopeType = 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch' | 'section' | 'proof'

/**
 * Structural view of the fields `resolveBatchPolicy` supplies to the provenance
 * enrichment. The controller binds the real (context-bound) resolver whose
 * return type is a superset of this shape, so no behaviour changes.
 */
export type ResolveBatchPolicyResult = {
  scopeDescriptor: RecordProofProvenance['scopeDescriptor']
  resolvedFrom: RecordProofProvenance['resolvedFrom']
  scopeMode: RecordProofProvenance['scopeMode']
  countSource: RecordProofProvenance['countSource']
  activeOperationalSemester: RecordProofProvenance['activeOperationalSemester']
}

export const SUPPORTED_PROVENANCE_SCOPE_TYPES = new Set([
  'institution',
  'academic-faculty',
  'department',
  'branch',
  'batch',
  'section',
] as const)

export function normalizeProvenanceScopeType(scopeType: string) {
  return SUPPORTED_PROVENANCE_SCOPE_TYPES.has(scopeType as 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch' | 'section')
    ? scopeType as ProvenanceScopeType
    : 'proof'
}

export function mapAppointment(row: FacultyAppointmentRow, references?: PeopleReferenceData) {
  const department = references?.departmentById.get(row.departmentId) ?? null
  const branch = row.branchId ? references?.branchById.get(row.branchId) ?? null : null
  return {
    appointmentId: row.appointmentId,
    facultyId: row.facultyId,
    departmentId: row.departmentId,
    departmentName: department?.name ?? null,
    departmentCode: department?.code ?? null,
    branchId: row.branchId,
    branchName: branch?.name ?? null,
    branchCode: branch?.code ?? null,
    isPrimary: row.isPrimary === 1,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function buildRoleGrantScopeLabel(row: RoleGrantRow, references?: PeopleReferenceData) {
  if (!references) return null
  if (row.scopeType === 'institution') return references.institution?.name ?? row.scopeId
  if (row.scopeType === 'academic-faculty') return references.academicFacultyById.get(row.scopeId)?.name ?? row.scopeId
  if (row.scopeType === 'department') return references.departmentById.get(row.scopeId)?.name ?? row.scopeId
  if (row.scopeType === 'branch') return references.branchById.get(row.scopeId)?.name ?? row.scopeId
  if (row.scopeType === 'batch') return references.batchById.get(row.scopeId)?.batchLabel ?? row.scopeId
  if (row.scopeType === 'offering') {
    const offering = references.offeringById.get(row.scopeId)
    if (!offering) return row.scopeId
    const branch = references.branchById.get(offering.branchId)
    return `${branch?.name ?? offering.branchId} · Section ${offering.sectionCode}`
  }
  if (row.scopeType === 'section') {
    const [batchId, sectionCode] = row.scopeId.split('::')
    const batchLabel = batchId ? references.batchById.get(batchId)?.batchLabel ?? batchId : row.scopeId
    return sectionCode ? `${batchLabel} · Section ${sectionCode}` : row.scopeId
  }
  return row.scopeId
}

export function mapRoleGrant(row: RoleGrantRow, references?: PeopleReferenceData) {
  return {
    grantId: row.grantId,
    facultyId: row.facultyId,
    roleCode: row.roleCode,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    scopeLabel: buildRoleGrantScopeLabel(row, references),
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapMentorAssignment(row: MentorAssignmentRow) {
  return {
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    facultyId: row.facultyId,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapFacultyRecord(params: {
  profile: FacultyProfileRow
  user: UserAccountRow | undefined
  appointments: Array<FacultyAppointmentRow>
  grants: Array<RoleGrantRow>
  credentialStatus: FacultyCredentialStatus
  references?: PeopleReferenceData
}) {
  return {
    facultyId: params.profile.facultyId,
    userId: params.profile.userId,
    username: params.user?.username ?? '',
    email: params.user?.email ?? '',
    phone: params.user?.phone ?? null,
    employeeCode: params.profile.employeeCode,
    displayName: params.profile.displayName,
    designation: params.profile.designation,
    joinedOn: params.profile.joinedOn,
    status: params.profile.status,
    version: params.profile.version,
    createdAt: params.profile.createdAt,
    updatedAt: params.profile.updatedAt,
    credentialStatus: params.credentialStatus,
    appointments: params.appointments.map(item => mapAppointment(item, params.references)),
    roleGrants: params.grants.map(item => mapRoleGrant(item, params.references)),
  }
}

export function isActiveRow(status: string, endDate?: string | null) {
  return status === 'active' && !endDate
}
