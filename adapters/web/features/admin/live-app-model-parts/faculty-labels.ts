import type {
  ApiFacultyAppointment,
  ApiFacultyRecord,
  ApiRoleGrant,
} from '@web/shared/api/types'

export function formatFacultyGrantScopeLabel(grant: Pick<ApiRoleGrant, 'scopeLabel' | 'scopeType' | 'scopeId'>) {
  return grant.scopeLabel ?? `${grant.scopeType}:${grant.scopeId}`
}

export function formatFacultyAppointmentLabel(appointment: Pick<ApiFacultyAppointment, 'departmentId' | 'departmentName' | 'departmentCode' | 'branchId' | 'branchName' | 'branchCode'>) {
  const departmentLabel = appointment.departmentName ?? appointment.departmentCode ?? appointment.departmentId
  const branchLabel = appointment.branchName ?? appointment.branchCode ?? appointment.branchId
  return branchLabel ? `${departmentLabel} · ${branchLabel}` : departmentLabel
}

export function resolveFacultyCredentialStatus(faculty: ApiFacultyRecord | null | undefined) {
  return faculty?.credentialStatus ?? {
    passwordConfigured: false,
    activeSetupRequest: false,
    latestPurpose: null,
    latestRequestedAt: null,
    latestExpiresAt: null,
  }
}
