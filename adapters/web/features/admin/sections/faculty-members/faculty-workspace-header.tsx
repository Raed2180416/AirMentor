import type { Dispatch, SetStateAction } from 'react'
import { T } from '@web/simulation/fixtures'
import { Card } from '@web/shared/ui/primitives'
import { SectionHeading } from '../../system-admin-ui'
import { ADMIN_SECTION_TONES, type FacultyDetailTab, fadeColor } from '../../live-app-model'
import { isLightTheme } from '@web/shared/ui/theme'
import type { ThemeMode } from '@kernel/shared/domain'
import { AdminDetailTabs, AdminMiniStat } from '../../live-app-chrome'
import type { ApiAuditEvent, ApiFacultyRecord } from '@web/shared/api/types'
import type { LiveAdminDataset } from '../../system-admin-live-data'

type FacultyWorkspaceHeaderProps = {
  themeMode: ThemeMode
  selectedFacultyMember: ApiFacultyRecord | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyAssignments: any[]
  facultyAuditEvents: ApiAuditEvent[]
  facultyDetailTab: FacultyDetailTab
  setFacultyDetailTab: Dispatch<SetStateAction<FacultyDetailTab>>
  operatorData: LiveAdminDataset
}

export function FacultyWorkspaceHeader({
  themeMode,
  selectedFacultyMember,
  selectedFacultyAssignments,
  facultyAuditEvents,
  facultyDetailTab,
  setFacultyDetailTab,
  operatorData,
}: FacultyWorkspaceHeaderProps) {
  return (
              <Card
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  padding: 18,
                  display: 'grid',
                  gap: 14,
                  minHeight: 238,
                  alignContent: 'start',
                  background: isLightTheme(themeMode) ? fadeColor(T.surface, 'f0') : fadeColor(T.surface, 'ea'),
                  backdropFilter: 'blur(12px)',
                }}
              >
                <SectionHeading
                  title={selectedFacultyMember ? selectedFacultyMember.displayName : 'Create Faculty'}
                  eyebrow="Faculty Workspace"
                  caption={selectedFacultyMember
                    ? 'Identity, appointments, permissions, teaching coverage, timetable planning, and history now stay in a tighter working loop.'
                    : 'Create the faculty profile first, then use the tabs to manage appointments, permissions, teaching coverage, and planning.'}
                />
                {selectedFacultyMember ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                    <AdminMiniStat label="Appointments" value={String(selectedFacultyMember.appointments.length)} tone={T.warning} />
                    <AdminMiniStat label="Permissions" value={String(selectedFacultyMember.roleGrants.length)} tone={T.success} />
                    <AdminMiniStat label="Classes" value={String(selectedFacultyAssignments.length)} tone={T.accent} />
                    <AdminMiniStat label="Mentor Load" value={String(operatorData.students.filter(item => item.activeMentorAssignment?.facultyId === selectedFacultyMember.facultyId).length)} tone={ADMIN_SECTION_TONES.students} />
                    <AdminMiniStat label="Audit Events" value={String(facultyAuditEvents.length)} tone={T.orange} />
                  </div>
                ) : null}
                <AdminDetailTabs
                  activeTab={facultyDetailTab}
                  onChange={tabId => setFacultyDetailTab(tabId as FacultyDetailTab)}
                  ariaLabel="Faculty detail sections"
                  idBase="faculty-detail"
                  tabs={[
                    { id: 'profile', label: 'Profile' },
                    { id: 'appointments', label: 'Appointments', count: selectedFacultyMember?.appointments.length ?? 0, disabled: !selectedFacultyMember },
                    { id: 'permissions', label: 'Permissions', count: selectedFacultyMember?.roleGrants.length ?? 0, disabled: !selectedFacultyMember },
                    { id: 'teaching', label: 'Teaching', count: selectedFacultyAssignments.length, disabled: !selectedFacultyMember },
                    { id: 'timetable', label: 'Timetable', disabled: !selectedFacultyMember },
                    { id: 'history', label: 'History', count: facultyAuditEvents.length, disabled: !selectedFacultyMember },
                  ]}
                />
              </Card>
  )
}
