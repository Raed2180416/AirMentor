import { T, mono, sora } from '@web/simulation/fixtures'
import { Card, Chip } from '@web/shared/ui/primitives'
import { formatDateLabel, type FacultyProfile } from './profile-helpers'

function displayPermission(permission: string) {
  if (permission === 'COURSE_LEADER') return 'Course Leader'
  if (permission === 'SYSTEM_ADMIN') return 'System Admin'
  if (permission === 'HOD') return 'HoD'
  if (permission === 'MENTOR') return 'Mentor'
  return permission
}

type FacultyIdentityCardsProps = {
  effectivePermissions: string[]
  profile: FacultyProfile | null
}

export function FacultyIdentityCards({
  effectivePermissions,
  profile,
}: FacultyIdentityCardsProps) {
  return (
    <>
      <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Permissions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {effectivePermissions.length > 0 ? effectivePermissions.map(permission => <Chip key={permission} color={T.accent}>{displayPermission(permission)}</Chip>) : <Chip color={T.dim}>No permissions</Chip>}
        </div>
        {profile?.permissions?.filter(permission => permission.roleCode !== 'SYSTEM_ADMIN').length ? profile.permissions.filter(permission => permission.roleCode !== 'SYSTEM_ADMIN').map(permission => (
          <Card key={permission.grantId} style={{ padding: 10, background: T.surface2 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>{displayPermission(permission.roleCode)}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
              {(permission.scopeLabel ?? `${permission.scopeType}:${permission.scopeId}`)} · {formatDateLabel(permission.startDate)} to {permission.endDate ? formatDateLabel(permission.endDate) : 'Active'} · {permission.status}
            </div>
          </Card>
        )) : null}
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          HoD, mentor, and course-leader visibility now comes from the same admin-managed permission source. Missing grants stay empty instead of inheriting from the session shell.
        </div>
      </Card>

      <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Appointments</div>
        {profile?.appointments?.length ? profile.appointments.map(appointment => (
          <Card key={appointment.appointmentId} style={{ padding: 10, background: T.surface2 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>
              {appointment.departmentName ?? appointment.departmentCode ?? appointment.departmentId}
              {appointment.branchName ?? appointment.branchCode ?? appointment.branchId ? ` · ${appointment.branchName ?? appointment.branchCode ?? appointment.branchId}` : ''}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
              {appointment.isPrimary ? 'Primary appointment' : 'Supporting appointment'} · {formatDateLabel(appointment.startDate)} to {appointment.endDate ? formatDateLabel(appointment.endDate) : 'Active'} · {appointment.status}
            </div>
          </Card>
        )) : (
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>No explicit appointment projection available in the current mode.</div>
        )}
      </Card>
    </>
  )
}
