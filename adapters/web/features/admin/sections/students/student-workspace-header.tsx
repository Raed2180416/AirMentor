import { T } from '@web/simulation/fixtures'
import { Card, Chip } from '@web/shared/ui/primitives'
import { SectionHeading } from '../../system-admin-ui'
import { ADMIN_SECTION_TONES, type StudentDetailTab, fadeColor } from '../../live-app-model'
import { AdminDetailTabs, AdminMiniStat } from '../../live-app-chrome'
import { isLightTheme } from '@web/shared/ui/theme'
import type { StudentsSectionProps } from './types'

type StudentWorkspaceHeaderProps = Pick<
  StudentsSectionProps,
  | 'themeMode'
  | 'selectedStudent'
  | 'selectedStudentRouteIsExplicit'
  | 'selectedStudentScopeMismatch'
  | 'selectedStudentDisplayCgpa'
  | 'selectedStudentDisplaySemester'
  | 'selectedStudentCheckpointCgpaVisible'
  | 'selectedStudentCheckpointSummary'
  | 'selectedStudentPolicy'
  | 'selectedStudentPolicyLoading'
  | 'selectedProofCheckpoint'
  | 'studentDetailTab'
  | 'setStudentDetailTab'
  | 'studentAuditEvents'
>

export function StudentWorkspaceHeader({
  themeMode,
  selectedStudent,
  selectedStudentRouteIsExplicit,
  selectedStudentScopeMismatch,
  selectedStudentDisplayCgpa,
  selectedStudentDisplaySemester,
  selectedStudentCheckpointCgpaVisible,
  selectedStudentCheckpointSummary,
  selectedStudentPolicy,
  selectedStudentPolicyLoading,
  selectedProofCheckpoint,
  studentDetailTab,
  setStudentDetailTab,
  studentAuditEvents,
}: StudentWorkspaceHeaderProps) {
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
                data-proof-surface="system-admin-student-drilldown"
                data-proof-student-id={selectedStudent?.studentId ?? undefined}
              >
                <SectionHeading
                  title={selectedStudent ? selectedStudent.name : 'Create Student'}
                  eyebrow="Student Workspace"
                  caption={selectedStudent
                    ? `Identity, academic context, mentor linkage, progression review, and history stay in one focused workspace.${selectedStudentRouteIsExplicit ? ' Opened from the explicit /admin/students/:id path.' : ''}`
                    : 'Create the student identity first, then move through academic context, mentoring, and progression from the tabs below.'}
                />
                {selectedStudent ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={selectedStudentRouteIsExplicit ? T.accent : T.dim}>{selectedStudentRouteIsExplicit ? 'Direct drilldown' : 'Filtered registry'}</Chip>
                      <Chip color={selectedStudentScopeMismatch ? T.warning : T.success}>{selectedStudentScopeMismatch ? 'Outside current scope' : 'Scope aligned'}</Chip>
                      {selectedStudentCheckpointSummary && selectedProofCheckpoint ? <Chip color={T.orange}>{`Proof snapshot · Sem ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}`}</Chip> : null}
                      <Chip color={selectedStudentPolicyLoading ? T.dim : selectedStudentPolicy ? T.success : T.dim}>{selectedStudentPolicyLoading ? 'Loading policy…' : selectedStudentPolicy ? 'Policy loaded' : 'Policy unavailable'}</Chip>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                      <AdminMiniStat label="CGPA" value={selectedStudentCheckpointCgpaVisible ? selectedStudentDisplayCgpa.toFixed(2) : 'Deferred'} tone={T.success} />
                      <AdminMiniStat label="Semester" value={String(selectedStudentDisplaySemester ?? '—')} tone={T.accent} />
                      <AdminMiniStat label="Enrollments" value={String(selectedStudent.enrollments.length)} tone={T.warning} />
                      <AdminMiniStat label="Mentor Links" value={String(selectedStudent.mentorAssignments.length)} tone={ADMIN_SECTION_TONES['faculty-members']} />
                      <AdminMiniStat label="Audit Events" value={String(studentAuditEvents.length)} tone={T.orange} />
                    </div>
                  </>
                ) : null}
                <AdminDetailTabs
                  activeTab={studentDetailTab}
                  onChange={tabId => setStudentDetailTab(tabId as StudentDetailTab)}
                  ariaLabel="Student detail sections"
                  idBase="student-detail"
                  tabs={[
                    { id: 'profile', label: 'Profile' },
                    { id: 'academic', label: 'Academic', count: selectedStudent?.enrollments.length ?? 0, disabled: !selectedStudent },
                    { id: 'mentor', label: 'Mentor', count: selectedStudent?.mentorAssignments.length ?? 0, disabled: !selectedStudent },
                    { id: 'progression', label: 'Progression', disabled: !selectedStudent },
                    { id: 'history', label: 'History', count: studentAuditEvents.length, disabled: !selectedStudent },
                  ]}
                />
              </Card>
  )
}
