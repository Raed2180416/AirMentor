import { Plus } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import {
  EntityButton,
  FieldLabel,
  InfoBanner,
  SearchField,
  SectionHeading,
  SelectInput,
} from '../../system-admin-ui'
import { ADMIN_SECTION_TONES } from '../../live-app-model'
import { deriveCurrentYearLabel, hydrateRegistryFilter } from '../../system-admin-live-data'
import type { StudentsSectionProps } from './types'

type StudentsRegistryPanelProps = Pick<
  StudentsSectionProps,
  | 'route'
  | 'registryFilterColumns'
  | 'registryIsSingleColumn'
  | 'registryScope'
  | 'navigate'
  | 'studentRegistryItems'
  | 'studentRegistryViewItems'
  | 'studentRegistryCaption'
  | 'studentRegistryEmptyMessage'
  | 'studentRegistryScopeLabel'
  | 'studentRegistryProofOverlayActive'
  | 'studentRegistrySearch'
  | 'setStudentRegistrySearch'
  | 'effectiveStudentRegistryFilter'
  | 'setStudentRegistryFilter'
  | 'studentFilterDepartments'
  | 'studentFilterBranches'
  | 'studentFilterBatches'
  | 'studentFilterSections'
  | 'visibleAcademicFaculties'
  | 'selectedProofCheckpoint'
  | 'resetStudentEditors'
>

export function StudentsRegistryPanel({
  route,
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
  selectedProofCheckpoint,
  resetStudentEditors,
}: StudentsRegistryPanelProps) {
  return (
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
  )
}
