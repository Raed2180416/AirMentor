import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import {
  FieldLabel,
  InfoBanner,
  SectionHeading,
  TextInput,
  formatDate,
} from '../../system-admin-ui'
import type { StudentsSectionProps } from './types'

type StudentProfileTabProps = Pick<
  StudentsSectionProps,
  | 'navigate'
  | 'selectedStudent'
  | 'selectedStudentDisplayCgpa'
  | 'selectedStudentDisplaySemester'
  | 'selectedStudentCheckpointCgpaVisible'
  | 'selectedStudentCheckpointSummary'
  | 'selectedStudentCheckpointBanner'
  | 'selectedStudentProofBanner'
  | 'selectedStudentPolicy'
  | 'selectedStudentPolicyLoading'
  | 'selectedStudentPromotionRules'
  | 'studentForm'
  | 'setStudentForm'
  | 'studentAuditLoading'
  | 'studentAuditEvents'
  | 'handleSaveStudent'
  | 'handleArchiveStudent'
  | 'setEditingEntity'
  | 'resetStudentEditors'
>

export function StudentProfileTab({
  navigate,
  selectedStudent,
  selectedStudentDisplayCgpa,
  selectedStudentDisplaySemester,
  selectedStudentCheckpointCgpaVisible,
  selectedStudentCheckpointSummary,
  selectedStudentCheckpointBanner,
  selectedStudentProofBanner,
  selectedStudentPolicy,
  selectedStudentPolicyLoading,
  selectedStudentPromotionRules,
  studentForm,
  setStudentForm,
  studentAuditLoading,
  studentAuditEvents,
  handleSaveStudent,
  handleArchiveStudent,
  setEditingEntity,
  resetStudentEditors,
}: StudentProfileTabProps) {
  return (
              <Card style={{ padding: 18, display: 'grid', gap: 14 }} data-proof-surface="system-admin-student-profile" data-proof-student-id={selectedStudent?.studentId ?? undefined}>
                <SectionHeading title={selectedStudent ? 'Student Detail' : 'Create Student'} eyebrow={selectedStudent ? selectedStudent.name : 'New record'} caption="Save the identity record first, then maintain enrollment, mentor, and promotion details below." />
                {selectedStudent ? (
                  <>
                    {!selectedStudentPolicy && !selectedStudentPolicyLoading ? <InfoBanner message="No resolved scope policy snapshot is loaded for this student yet. Progression guidance falls back to the default guardrails until a policy is available." /> : null}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={T.accent}>{selectedStudent.usn}</Chip>
                      {selectedStudentCheckpointCgpaVisible ? <Chip color={T.success}>CGPA {selectedStudentDisplayCgpa.toFixed(2)}</Chip> : null}
                      <Chip color={T.warning}>{selectedStudent.activeAcademicContext?.departmentName ?? 'No department'}</Chip>
                      {selectedStudentCheckpointSummary?.currentRiskBand ? <Chip color={selectedStudentCheckpointSummary.currentRiskBand.toLowerCase() === 'high' ? T.danger : selectedStudentCheckpointSummary.currentRiskBand.toLowerCase() === 'medium' ? T.warning : T.success}>{`${selectedStudentCheckpointSummary.currentRiskBand} risk`}</Chip> : null}
                      <Chip color={selectedStudent.status === 'active' ? T.success : T.danger}>{selectedStudent.status}</Chip>
                    </div>
                    {selectedStudentCheckpointBanner ? <InfoBanner tone="neutral" message={selectedStudentCheckpointBanner} /> : null}
                    {selectedStudentProofBanner ? <InfoBanner tone="neutral" message={selectedStudentProofBanner} /> : null}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Policy Snapshot</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>
                          {selectedStudentPolicyLoading ? 'Loading policy…' : selectedStudentPolicy ? `Min CGPA ${selectedStudentPromotionRules.minimumCgpaForPromotion.toFixed(1)}` : 'No policy snapshot'}
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                          {selectedStudentPolicyLoading ? 'Awaiting policy resolution…' : selectedStudentPolicy ? `Pass threshold ${selectedStudentPromotionRules.passMarkPercent}% · backlog guard ${selectedStudentPromotionRules.requireNoActiveBacklogs ? 'on' : 'off'}` : 'Configured defaults only until a resolved scope policy loads.'}
                        </div>
                      </Card>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Academic Lineage</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.activeAcademicContext ? `${selectedStudent.activeAcademicContext.branchName ?? 'Branch'} · Sem ${selectedStudentDisplaySemester ?? '—'}` : 'No active academic context'}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{selectedStudentCheckpointSummary?.primaryCourseCode ? `${selectedStudentCheckpointSummary.primaryCourseCode} · ${selectedStudentCheckpointSummary.primaryCourseTitle}` : selectedStudent.activeAcademicContext?.sectionCode ? `Section ${selectedStudent.activeAcademicContext.sectionCode}` : 'No section assigned'}</div>
                      </Card>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mentor Link</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.activeMentorAssignment ? 'Mentor linked' : 'No mentor linked'}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{selectedStudent.mentorAssignments.length} historical assignment{selectedStudent.mentorAssignments.length === 1 ? '' : 's'}</div>
                      </Card>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audit Trail</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{studentAuditEvents.length} events</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{studentAuditLoading ? 'Loading history…' : studentAuditEvents.length > 0 ? 'Change history is available.' : 'No audit events recorded yet.'}</div>
                      </Card>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.name}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Roll Number</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.rollNumber ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admission Date</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{formatDate(selectedStudent.admissionDate)}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedStudent.email ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedStudent.phone ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Context</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedStudent.activeAcademicContext ? `${selectedStudent.activeAcademicContext.branchName ?? 'Branch'} · Sem ${selectedStudentDisplaySemester ?? '—'} · Sec ${selectedStudent.activeAcademicContext.sectionCode}` : 'No active academic context'}</div></Card>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="button" size="sm" onClick={() => setEditingEntity('student-profile')}>Edit Student</Btn>
                      <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>Back to Registry</Btn>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>{selectedStudent ? 'Create Student' : 'New Student'}</Btn>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSaveStudent} style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>Name</FieldLabel><TextInput value={studentForm.name} onChange={event => setStudentForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Student name" /></div>
                      <div><FieldLabel>University ID / USN</FieldLabel><TextInput value={studentForm.usn} onChange={event => setStudentForm(prev => ({ ...prev, usn: event.target.value }))} placeholder="1MS22CS001" /></div>
                      <div><FieldLabel>Roll Number</FieldLabel><TextInput value={studentForm.rollNumber} onChange={event => setStudentForm(prev => ({ ...prev, rollNumber: event.target.value }))} placeholder="Optional" /></div>
                      <div><FieldLabel>Admission Date</FieldLabel><TextInput value={studentForm.admissionDate} onChange={event => setStudentForm(prev => ({ ...prev, admissionDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                      <div><FieldLabel>Email</FieldLabel><TextInput value={studentForm.email} onChange={event => setStudentForm(prev => ({ ...prev, email: event.target.value }))} placeholder="student@campus.edu" /></div>
                      <div><FieldLabel>Phone</FieldLabel><TextInput value={studentForm.phone} onChange={event => setStudentForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Create Student</Btn>
                      <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>Clear Form</Btn>
                    </div>
                  </form>
                )}
              </Card>
  )
}
