import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import {
  Btn,
  Card,
  Chip,
} from '@web/shared/ui/primitives'
import {
  EmptyState,
  EntityButton,
  FieldLabel,
  InfoBanner,
  SearchField,
  SectionHeading,
  SelectInput,
  TextInput,
  formatDate,
  formatDateTime,
} from '../system-admin-ui'
import {
  ADMIN_SECTION_TONES,
  type StudentDetailTab,
  type StudentFormState,
  type EnrollmentFormState,
  type MentorAssignmentFormState,
  type EditingEntity,
  defaultEnrollmentForm,
  defaultMentorAssignmentForm,
  fadeColor,
  summarizeAuditEvent,
} from '../live-app-model'
import {
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminMiniStat,
} from '../live-app-chrome'
import { isLightTheme } from '@web/shared/ui/theme'
import type { ThemeMode } from '@kernel/shared/domain'
import type {
  ApiAuditEvent,
  ApiBatch,
  ApiStudentEnrollment,
  ApiMentorAssignment,
  ApiProofRunCheckpointStudentSummary,
  ApiSimulationStageCheckpointSummary,
  ApiStudentRecord,
} from '@web/shared/api/types'
import type { LiveAdminDataset, LiveAdminRoute, RegistryFilterState, UniversityScopeState } from '../system-admin-live-data'
import { resolveBranch, resolveFacultyMember, deriveCurrentYearLabel, hydrateRegistryFilter } from '../system-admin-live-data'

type StudentsSectionProps = {
  data: LiveAdminDataset
  route: LiveAdminRoute
  themeMode: ThemeMode
  registryPageColumns: string
  registryFilterColumns: string
  registryIsSingleColumn: boolean
  registryScope: UniversityScopeState | null
  navigate: (route: LiveAdminRoute) => void
  // Student registry state
  studentRegistryItems: ApiStudentRecord[]
  studentRegistryViewItems: Array<{
    student: ApiStudentRecord
    proofOverlayActive: boolean
    checkpointSummary: ApiProofRunCheckpointStudentSummary | null
    displayCgpa: number | null
    displaySemester: number | null
    showCheckpointCgpa: boolean
  }>
  studentRegistryCaption: string
  studentRegistryEmptyMessage: string
  studentRegistryScopeLabel: string | null
  studentRegistryProofOverlayActive: boolean
  studentRegistrySearch: string
  setStudentRegistrySearch: (value: string) => void
  effectiveStudentRegistryFilter: RegistryFilterState
  setStudentRegistryFilter: (value: RegistryFilterState | ((prev: RegistryFilterState) => RegistryFilterState)) => void
  studentFilterDepartments: Array<{ departmentId: string; name: string }>
  studentFilterBranches: Array<{ branchId: string; name: string }>
  studentFilterBatches: ApiBatch[]
  studentFilterSections: string[]
  visibleAcademicFaculties: Array<{ academicFacultyId: string; name: string }>
  // Selected student state
  selectedStudent: ApiStudentRecord | null
  selectedStudentRouteIsExplicit: boolean
  selectedStudentScopeMismatch: boolean
  selectedStudentDisplayCgpa: number
  selectedStudentDisplaySemester: number | null
  selectedStudentDisplayBacklogCount: number | null
  selectedStudentCheckpointCgpaVisible: boolean
  selectedStudentCheckpointSummary: ApiProofRunCheckpointStudentSummary | null
  selectedStudentCheckpointBanner: string | null
  selectedStudentProofBanner: string | null
  selectedStudentPolicy: unknown
  selectedStudentPolicyLoading: boolean
  selectedStudentPromotionRecommended: boolean
  selectedStudentPromotionRules: {
    minimumCgpaForPromotion: number
    passMarkPercent: number
    requireNoActiveBacklogs: boolean
  }
  selectedStudentNextTerms: Array<{
    termId: string
    academicYearLabel: string
    semesterNumber: number
    startDate: string
    endDate: string
  }>
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  // Student detail tab
  studentDetailTab: StudentDetailTab
  setStudentDetailTab: Dispatch<SetStateAction<StudentDetailTab>>
  // Forms
  studentForm: StudentFormState
  setStudentForm: (value: StudentFormState | ((prev: StudentFormState) => StudentFormState)) => void
  enrollmentForm: EnrollmentFormState
  setEnrollmentForm: (value: EnrollmentFormState | ((prev: EnrollmentFormState) => EnrollmentFormState)) => void
  mentorForm: MentorAssignmentFormState
  setMentorForm: (value: MentorAssignmentFormState | ((prev: MentorAssignmentFormState) => MentorAssignmentFormState)) => void
  // Audit
  studentAuditLoading: boolean
  studentAuditEvents: ApiAuditEvent[]
  // Handlers
  handleSaveStudent: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveStudent: () => void
  handleCloseEnrollment: (enrollment: ApiStudentEnrollment) => void
  handleEndMentorAssignment: (assignment: ApiMentorAssignment) => void
  handlePromoteStudent: (termId: string) => void
  // Editor helpers
  setEditingEntity: (value: EditingEntity | null) => void
  resetStudentEditors: () => void
  startEditingEnrollment: (enrollment: ApiStudentEnrollment) => void
  startEditingMentorAssignment: (assignment: ApiMentorAssignment) => void
}

export function StudentsSection(props: StudentsSectionProps) {
  const {
    data,
    route,
    themeMode,
    registryPageColumns,
    registryFilterColumns,
    registryIsSingleColumn,
    registryScope,
    navigate,
    studentRegistryItems,
    studentRegistryViewItems,
    studentRegistryCaption,
    studentRegistryEmptyMessage,
    studentRegistryScopeLabel,
    studentRegistryProofOverlayActive,
    studentRegistrySearch,
    setStudentRegistrySearch,
    effectiveStudentRegistryFilter,
    setStudentRegistryFilter,
    studentFilterDepartments,
    studentFilterBranches,
    studentFilterBatches,
    studentFilterSections,
    visibleAcademicFaculties,
    selectedStudent,
    selectedStudentRouteIsExplicit,
    selectedStudentScopeMismatch,
    selectedStudentDisplayCgpa,
    selectedStudentDisplaySemester,
    selectedStudentDisplayBacklogCount,
    selectedStudentCheckpointCgpaVisible,
    selectedStudentCheckpointSummary,
    selectedStudentCheckpointBanner,
    selectedStudentProofBanner,
    selectedStudentPolicy,
    selectedStudentPolicyLoading,
    selectedStudentPromotionRecommended,
    selectedStudentPromotionRules,
    selectedStudentNextTerms,
    selectedProofCheckpoint,
    studentDetailTab,
    setStudentDetailTab,
    studentForm,
    setStudentForm,
    setEnrollmentForm,
    setMentorForm,
    studentAuditLoading,
    studentAuditEvents,
    handleSaveStudent,
    handleArchiveStudent,
    handleCloseEnrollment,
    handleEndMentorAssignment,
    handlePromoteStudent,
    setEditingEntity,
    resetStudentEditors,
    startEditingEnrollment,
    startEditingMentorAssignment,
  } = props

  return (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, gridTemplateRows: 'auto auto auto minmax(0, 1fr)', alignContent: 'start', maxHeight: registryIsSingleColumn ? 'none' : 'calc(100vh - 200px)', overflow: registryIsSingleColumn ? 'visible' : 'hidden' }}>
              <SectionHeading
                title="Students"
                eyebrow="Registry"
                caption={studentRegistryCaption}
                toneColor={ADMIN_SECTION_TONES.students}
              />
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}><Plus size={14} /> New Student</Btn>
                  <Chip color={T.accent}>{studentRegistryItems.length} active</Chip>
                  <Chip color={T.warning}>{studentRegistryItems.filter(item => !item.activeMentorAssignment).length} mentor gaps</Chip>
                  {studentRegistryProofOverlayActive && selectedProofCheckpoint ? <Chip color={T.success}>{`Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}`}</Chip> : null}
                  {studentRegistryScopeLabel ? <Chip color={ADMIN_SECTION_TONES.students}>{studentRegistryScopeLabel}</Chip> : <Chip color={T.dim}>All students</Chip>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: registryFilterColumns, gap: 10 }}>
                  <div>
                    <FieldLabel>Faculty</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.academicFacultyId} onChange={event => setStudentRegistryFilter({
                      academicFacultyId: event.target.value,
                      departmentId: '',
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    })}>
                      <option value="">All Faculties</option>
                      {visibleAcademicFaculties.map(item => <option key={item.academicFacultyId} value={item.academicFacultyId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Department</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.departmentId} onChange={event => setStudentRegistryFilter(prev => ({
                      ...prev,
                      departmentId: event.target.value,
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Departments</option>
                      {studentFilterDepartments.map(item => <option key={item.departmentId} value={item.departmentId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Branch</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.branchId} onChange={event => setStudentRegistryFilter(prev => ({
                      ...prev,
                      branchId: event.target.value,
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Branches</option>
                      {studentFilterBranches.map(item => <option key={item.branchId} value={item.branchId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Year</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.batchId} onChange={event => setStudentRegistryFilter(prev => ({
                      ...prev,
                      batchId: event.target.value,
                      sectionCode: '',
                    }))}>
                      <option value="">All Years</option>
                      {studentFilterBatches.map(item => <option key={item.batchId} value={item.batchId}>{deriveCurrentYearLabel(item.currentSemester)} · {item.batchLabel}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Section</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.sectionCode} onChange={event => setStudentRegistryFilter(prev => ({ ...prev, sectionCode: event.target.value }))}>
                      <option value="">All Sections</option>
                      {studentFilterSections.map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>)}
                    </SelectInput>
                  </div>
                </div>
                <SearchField
                  value={studentRegistrySearch}
                  onChange={setStudentRegistrySearch}
                  placeholder="Search student, USN, branch, section, email..."
                  ariaLabel="Student registry search"
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={() => setStudentRegistryFilter(hydrateRegistryFilter(registryScope))}>Reset Filters</Btn>
                  <Chip color={T.dim}>Sorted A-Z</Chip>
                </div>
              </div>
              <div className="scroll-pane" style={{ display: 'grid', gap: 8, minHeight: 0, overflowY: registryIsSingleColumn ? 'visible' : 'auto', paddingRight: 4 }}>
                {studentRegistryViewItems.map(({ student, proofOverlayActive, checkpointSummary, displayCgpa, displaySemester, showCheckpointCgpa }) => (
                  <EntityButton key={student.studentId} selected={route.studentId === student.studentId} onClick={() => navigate({ section: 'students', studentId: student.studentId })}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 12, background: `${ADMIN_SECTION_TONES.students}18`, color: ADMIN_SECTION_TONES.students, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...sora, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                            {student.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'ST'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{student.name}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{student.usn} · {student.activeAcademicContext?.branchName ?? 'No branch mapped'}</div>
                          </div>
                        </div>
                        <Chip color={student.activeMentorAssignment ? T.success : T.warning} size={9}>{student.activeMentorAssignment ? 'Mentored' : 'Mentor missing'}</Chip>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {student.activeAcademicContext?.departmentName ? <Chip color={T.warning} size={9}>{student.activeAcademicContext.departmentName}</Chip> : null}
                        {student.activeAcademicContext?.sectionCode ? <Chip color={T.accent} size={9}>Sec {student.activeAcademicContext.sectionCode}</Chip> : null}
                        {checkpointSummary?.currentRiskBand ? <Chip color={checkpointSummary.currentRiskBand.toLowerCase() === 'high' ? T.danger : checkpointSummary.currentRiskBand.toLowerCase() === 'medium' ? T.warning : T.success} size={9}>{`${checkpointSummary.currentRiskBand} risk`}</Chip> : null}
                        {checkpointSummary?.currentQueueState ? <Chip color={T.orange} size={9}>{checkpointSummary.currentQueueState}</Chip> : null}
                        {showCheckpointCgpa && typeof displayCgpa === 'number' ? <Chip color={T.success} size={9}>CGPA {displayCgpa.toFixed(2)}</Chip> : null}
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.success, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        Semester {displaySemester ?? '—'}{checkpointSummary?.primaryCourseCode ? ` · ${checkpointSummary.primaryCourseCode}` : ''}{proofOverlayActive && selectedProofCheckpoint ? ` · ${selectedProofCheckpoint.stageLabel}` : ''} · {student.email ?? 'Email not set'} · {student.phone ?? 'Phone not set'}
                      </div>
                    </div>
                  </EntityButton>
                ))}
                {studentRegistryItems.length === 0 ? <InfoBanner message={studentRegistryEmptyMessage} /> : null}
              </div>
            </Card>

            <div style={{ display: 'grid', gap: 16 }}>
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

              {studentDetailTab === 'profile' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="profile">
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
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'academic' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="academic">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Academic Context" eyebrow="Enrollment" caption="Keep branch, term, section, and academic standing aligned with the canonical term structure." />
                {!selectedStudent ? <EmptyState title="Save the student first" body="Enrollment editing becomes available after the student record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedStudent.enrollments.length === 0 ? <InfoBanner message="No enrollment trail exists yet for this student." /> : selectedStudent.enrollments.map(enrollment => {
                        const term = data.terms.find(item => item.termId === enrollment.termId)
                        const branch = resolveBranch(data, enrollment.branchId)
                        return (
                          <Card key={enrollment.enrollmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{branch?.name ?? 'Unknown branch'} · Semester {term?.semesterNumber ?? '—'} · Section {enrollment.sectionCode}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{term?.academicYearLabel ?? enrollment.termId} · {formatDate(enrollment.startDate)} to {enrollment.endDate ? formatDate(enrollment.endDate) : 'Active'} · {enrollment.academicStatus}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => { startEditingEnrollment(enrollment); setEditingEntity('student-enrollment') }}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleCloseEnrollment(enrollment)}>Close</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <Btn type="button" size="sm" onClick={() => {
                        setEnrollmentForm({
                          ...defaultEnrollmentForm(),
                          branchId: selectedStudent.activeAcademicContext?.branchId ?? '',
                          termId: selectedStudent.activeAcademicContext?.termId ?? '',
                          sectionCode: selectedStudent.activeAcademicContext?.sectionCode ?? 'A',
                        })
                        setEditingEntity('student-enrollment')
                      }}>Add New Enrollment</Btn>
                    </div>
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'mentor' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="mentor">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Mentor Linkage" eyebrow="Faculty" caption="Only faculty with an active mentor permission are shown as eligible mentors." />
                {!selectedStudent ? <EmptyState title="Save the student first" body="Mentor assignment becomes available after the student record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedStudent.mentorAssignments.length === 0 ? <InfoBanner message="No mentor assignments recorded yet." /> : selectedStudent.mentorAssignments.map(assignment => {
                        const mentor = resolveFacultyMember(data, assignment.facultyId)
                        return (
                          <Card key={assignment.assignmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{mentor?.displayName ?? assignment.facultyId}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{assignment.source} · {formatDate(assignment.effectiveFrom)} to {assignment.effectiveTo ? formatDate(assignment.effectiveTo) : 'Active'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => { startEditingMentorAssignment(assignment); setEditingEntity('student-mentor') }}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleEndMentorAssignment(assignment)}>End</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <Btn type="button" size="sm" onClick={() => {
                        setMentorForm(defaultMentorAssignmentForm())
                        setEditingEntity('student-mentor')
                      }}>Add Mentor Link</Btn>
                    </div>
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'progression' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="progression">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Promotion Review" eyebrow="Semester Progression" caption="Recommendations use the configured CGPA rule and backlog guard, then wait for explicit admin confirmation." />
                {!selectedStudent ? <EmptyState title="Select a student" body="Promotion review appears when a student with an academic context is selected." /> : !selectedStudent.activeAcademicContext ? (
                  <EmptyState title="No active academic context" body="Create or restore an enrollment before using the promotion panel." />
                ) : (
                  <>
                    {!selectedStudentPolicy && !selectedStudentPolicyLoading ? <InfoBanner message="No resolved scope policy snapshot is loaded for this student. The progression panel is using the default guardrails only." /> : null}
                    {selectedStudentCheckpointBanner ? <InfoBanner tone="neutral" message={selectedStudentCheckpointBanner} /> : null}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={selectedStudentPromotionRecommended ? T.success : T.warning}>{selectedStudentPromotionRecommended ? 'Recommended' : 'Hold for review'}</Chip>
                      {selectedStudentCheckpointCgpaVisible ? <Chip color={T.accent}>Current CGPA {selectedStudentDisplayCgpa.toFixed(2)}</Chip> : <Chip color={T.dim}>CGPA deferred at this checkpoint</Chip>}
                      <Chip color={T.warning}>Min CGPA {selectedStudentPromotionRules.minimumCgpaForPromotion.toFixed(1)}</Chip>
                      {selectedStudentCheckpointSummary?.currentQueueState ? <Chip color={T.orange}>{selectedStudentCheckpointSummary.currentQueueState}</Chip> : null}
                      {selectedStudentPolicyLoading ? <Chip color={T.dim}>Loading policy…</Chip> : null}
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.9 }}>
                      Current semester: {selectedStudentDisplaySemester ?? '—'} · Academic status: {selectedStudent.activeAcademicContext.academicStatus}{selectedStudentDisplayBacklogCount != null ? ` · Backlogs ${selectedStudentDisplayBacklogCount}` : ''}<br />
                      Promotion rule: {selectedStudentPromotionRules.requireNoActiveBacklogs ? 'Require no active backlogs' : 'Backlog check disabled'} · Pass threshold {selectedStudentPromotionRules.passMarkPercent}%
                    </div>
                    {selectedStudentNextTerms.length === 0 ? <InfoBanner message="No next-semester term is configured yet for this branch. Add the next term in the university workspace first." /> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedStudentNextTerms.map(term => (
                          <Card key={term.termId} style={{ padding: 12, background: T.surface2, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{term.academicYearLabel} · Semester {term.semesterNumber}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(term.startDate)} to {formatDate(term.endDate)}</div>
                            </div>
                            <Btn type="button" onClick={() => void handlePromoteStudent(term.termId)}>Promote Into This Term</Btn>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'history' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="history">
              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <SectionHeading title="History" eyebrow="Audit Trail" caption="Every student, enrollment, and mentor change lands here so deletions and corrections stay traceable." />
                {studentAuditLoading ? <InfoBanner message="Loading audit history…" /> : null}
                {!studentAuditLoading && studentAuditEvents.length === 0 ? <EmptyState title="No audit trail yet" body="Student create/update activity will appear here." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {studentAuditEvents.slice(0, 16).map(item => (
                      <Card key={item.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{item.entityType} · {summarizeAuditEvent(item)}</div>
                          <Chip color={T.accent} size={9}>{formatDateTime(item.createdAt)}</Chip>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.entityId}{item.actorRole ? ` · ${item.actorRole}` : ''}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}
            </div>
          </div>
  )
}
