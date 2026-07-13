import { Plus } from 'lucide-react'
import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { EmptyState, SectionHeading, TextAreaInput, TextInput } from '../system-admin-ui'
import type { ApiAcademicFaculty, ApiBatch, ApiBranch, ApiDepartment } from '@web/shared/api/types'
import { deriveCurrentYearLabel, type LiveAdminDataset, type LiveAdminRoute } from '../system-admin-live-data'
import type { StructureFormState } from './types'
import { AdminMiniStat } from './workspace-primitives'

type EditingEntitySetter = Dispatch<SetStateAction<'academic-faculty' | 'department' | 'branch' | 'batch' | null>>
type NavigateFn = (route: LiveAdminRoute, options?: { recordHistory?: boolean }) => void

export function AcademicFacultyCreateForm({
  handleCreateAcademicFaculty,
  structureForms,
  setStructureForms,
}: {
  handleCreateAcademicFaculty: FormEventHandler<HTMLFormElement>
  structureForms: StructureFormState
  setStructureForms: Dispatch<SetStateAction<StructureFormState>>
}) {
  return (
    <form onSubmit={handleCreateAcademicFaculty} style={{ display: 'grid', gap: 8, marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Plus size={14} color={T.accent} />
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Academic Faculty</div>
      </div>
      <TextInput name="academicFacultyCode" value={structureForms.academicFaculty.code} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} placeholder="ENG" />
      <TextInput name="academicFacultyName" value={structureForms.academicFaculty.name} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} placeholder="Engineering and Technology" />
      <TextAreaInput name="academicFacultyOverview" value={structureForms.academicFaculty.overview} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} placeholder="Overview" rows={2} />
      <Btn type="submit">Add Faculty</Btn>
    </form>
  )
}

export function AcademicFacultyDetailCard({
  selectedAcademicFaculty,
  facultyDepartments,
  selectedAcademicFacultyImpact,
  data,
  setEditingEntity,
  navigate,
  structureForms,
  setStructureForms,
  handleCreateDepartment,
}: {
  selectedAcademicFaculty: ApiAcademicFaculty
  facultyDepartments: ApiDepartment[]
  selectedAcademicFacultyImpact: {
    departments: number
    branches: number
    batches: number
    students: number
    facultyMembers: number
    courses: number
  } | null
  data: LiveAdminDataset
  setEditingEntity: EditingEntitySetter
  navigate: NavigateFn
  structureForms: StructureFormState
  setStructureForms: Dispatch<SetStateAction<StructureFormState>>
  handleCreateDepartment: FormEventHandler<HTMLFormElement>
}) {
  return (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading
        title={selectedAcademicFaculty.name}
        eyebrow="Academic Faculty"
        caption={selectedAcademicFaculty.status === 'archived'
          ? 'This faculty is archived. Restore it to bring its departments and linked workspace scope back into the main admin views.'
          : 'Edit the faculty record, then add or organize departments underneath it.'}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Chip color={T.accent}>{selectedAcademicFaculty.code}</Chip>
        <Chip color={T.success}>{facultyDepartments.length} departments</Chip>
        <Chip color={selectedAcademicFaculty.status === 'archived' ? T.warning : T.success}>{selectedAcademicFaculty.status}</Chip>
      </div>
      {selectedAcademicFacultyImpact ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, marginTop: 16 }}>
          <AdminMiniStat label="Departments" value={String(selectedAcademicFacultyImpact.departments)} tone={T.accent} />
          <AdminMiniStat label="Branches" value={String(selectedAcademicFacultyImpact.branches)} tone={T.success} />
          <AdminMiniStat label="Years" value={String(selectedAcademicFacultyImpact.batches)} tone={T.warning} />
          <AdminMiniStat label="Students" value={String(selectedAcademicFacultyImpact.students)} tone={T.orange} />
          <AdminMiniStat label="Faculty" value={String(selectedAcademicFacultyImpact.facultyMembers)} tone={T.orange} />
          <AdminMiniStat label="Courses" value={String(selectedAcademicFacultyImpact.courses)} tone={T.orange} />
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overview</div>
        <Card style={{ padding: 14, background: T.surface2 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.9 }}>
            {selectedAcademicFaculty.overview?.trim() || 'No faculty overview has been added yet.'}
          </div>
        </Card>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn type="button" size="sm" onClick={() => setEditingEntity('academic-faculty' as never)}>Edit Faculty</Btn>
      </div>
      {selectedAcademicFaculty.status === 'archived' ? null : facultyDepartments.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Departments</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {facultyDepartments.map(department => {
              const previewBranches = data.branches.filter(branch => branch.departmentId === department.departmentId && branch.status !== 'deleted').sort((left, right) => left.name.localeCompare(right.name))
              return (
                <Card key={department.departmentId} style={{ padding: 14, background: T.surface2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{department.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{department.code} · {previewBranches.length} branches</div>
                    </div>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: department.departmentId })}>Open</Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {previewBranches.slice(0, 4).map(branch => (
                      <button
                        key={branch.branchId}
                        type="button"
                        data-pressable="true"
                        onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: department.departmentId, branchId: branch.branchId })}
                        style={{ ...mono, fontSize: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, padding: '6px 10px', cursor: 'pointer' }}
                      >
                        {branch.name}
                      </button>
                    ))}
                    {previewBranches.length > 4 ? <Chip color={T.dim}>+{previewBranches.length - 4} more</Chip> : null}
                    {previewBranches.length === 0 ? <span style={{ ...mono, fontSize: 10, color: T.dim }}>No branches yet.</span> : null}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : null}
      {selectedAcademicFaculty.status === 'archived' ? null : (
        <form onSubmit={handleCreateDepartment} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Department</div>
          <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Department Code</div><TextInput name="departmentCode" value={structureForms.department.code} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} placeholder="CSE" /></div>
          <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Department Name</div><TextInput name="departmentName" value={structureForms.department.name} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} placeholder="Computer Science and Engineering" /></div>
          <Btn type="submit">Add Department</Btn>
        </form>
      )}
    </Card>
  )
}

export function DepartmentDetailCard({
  selectedDepartment,
  departmentBranches,
  data,
  setEditingEntity,
  navigate,
  selectedAcademicFaculty,
  structureForms,
  setStructureForms,
  handleCreateBranch,
}: {
  selectedDepartment: ApiDepartment
  departmentBranches: ApiBranch[]
  data: LiveAdminDataset
  setEditingEntity: EditingEntitySetter
  navigate: NavigateFn
  selectedAcademicFaculty: ApiAcademicFaculty | null
  structureForms: StructureFormState
  setStructureForms: Dispatch<SetStateAction<StructureFormState>>
  handleCreateBranch: FormEventHandler<HTMLFormElement>
}) {
  return (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title={selectedDepartment.name} eyebrow="Department" caption="Edit the department record, then create or reorganize the branches it owns." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Chip color={T.accent}>{selectedDepartment.code}</Chip>
        <Chip color={T.success}>{departmentBranches.length} branches</Chip>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn type="button" size="sm" onClick={() => setEditingEntity('department' as never)}>Edit Department</Btn>
      </div>
      {departmentBranches.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Branches</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {departmentBranches.map(branch => {
              const previewBatches = data.batches.filter(batch => batch.branchId === branch.branchId && batch.status !== 'deleted').sort((left, right) => left.admissionYear - right.admissionYear)
              return (
                <Card key={branch.branchId} style={{ padding: 14, background: T.surface2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{branch.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{branch.code} · {branch.programLevel} · {previewBatches.length} years</div>
                    </div>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: branch.branchId })}>Open</Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {previewBatches.slice(0, 4).map(batch => (
                      <button
                        key={batch.batchId}
                        type="button"
                        data-pressable="true"
                        onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: branch.branchId, batchId: batch.batchId })}
                        style={{ ...mono, fontSize: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, padding: '6px 10px', cursor: 'pointer' }}
                      >
                        {deriveCurrentYearLabel(batch.currentSemester)}
                      </button>
                    ))}
                    {previewBatches.length > 4 ? <Chip color={T.dim}>+{previewBatches.length - 4} more</Chip> : null}
                    {previewBatches.length === 0 ? <span style={{ ...mono, fontSize: 10, color: T.dim }}>No years yet.</span> : null}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : null}
      <form onSubmit={handleCreateBranch} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Branch</div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Branch Code</div><TextInput name="branchCode" value={structureForms.branch.code} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} placeholder="CSE-AI" /></div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Branch Name</div><TextInput name="branchName" value={structureForms.branch.name} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} placeholder="AI and Data Science" /></div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Program Level</div><TextInput name="branchProgramLevel" value={structureForms.branch.programLevel} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))} placeholder="UG" /></div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Semester Count</div><TextInput name="branchSemesterCount" value={structureForms.branch.semesterCount} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} placeholder="8" /></div>
        <Btn type="submit">Add Branch</Btn>
      </form>
    </Card>
  )
}

export function BranchDetailCard({
  selectedBranch,
  branchBatches,
  setEditingEntity,
  navigate,
  selectedAcademicFaculty,
  selectedDepartment,
  structureForms,
  setStructureForms,
  handleCreateBatch,
}: {
  selectedBranch: ApiBranch
  branchBatches: ApiBatch[]
  setEditingEntity: EditingEntitySetter
  navigate: NavigateFn
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
  structureForms: StructureFormState
  setStructureForms: Dispatch<SetStateAction<StructureFormState>>
  handleCreateBatch: FormEventHandler<HTMLFormElement>
}) {
  return (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title={selectedBranch.name} eyebrow="Branch" caption="Edit core branch metadata, then add or maintain the batch versions that inherit from it." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Chip color={T.accent}>{selectedBranch.code}</Chip>
        <Chip color={T.warning}>{selectedBranch.programLevel}</Chip>
        <Chip color={T.success}>{branchBatches.length} batches</Chip>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
        {selectedBranch.semesterCount} semesters configured in this branch. Use the edit dialog for branch metadata or jump directly into a year below.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn type="button" size="sm" onClick={() => setEditingEntity('branch' as never)}>Edit Branch</Btn>
      </div>
      {branchBatches.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Years</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {branchBatches.map(batch => (
              <Card key={batch.batchId} style={{ padding: 14, background: T.surface2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Batch {batch.batchLabel} · sem {batch.currentSemester}</div>
                  </div>
                  <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: batch.batchId })}>Open</Btn>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {batch.sectionLabels.map(sectionCode => <Chip key={sectionCode} color={T.accent}>{sectionCode}</Chip>)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
      <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Batch</div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Admission Year</div><TextInput name="batchAdmissionYear" value={structureForms.batch.admissionYear} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value, batchLabel: event.target.value } }))} placeholder="2022" /></div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Active Semester</div><TextInput name="batchCurrentSemester" value={structureForms.batch.currentSemester} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} placeholder="5" /></div>
        <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Section Labels</div><TextInput name="batchSectionLabels" value={structureForms.batch.sectionLabels} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} placeholder="A, B" /></div>
        <Btn type="submit">Add Batch</Btn>
      </form>
    </Card>
  )
}

export function PickAYearFallback({
  selectedBranch,
  branchBatches,
  navigate,
  selectedAcademicFaculty,
  selectedDepartment,
}: {
  selectedBranch: ApiBranch | null
  branchBatches: ApiBatch[]
  navigate: NavigateFn
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
}) {
  return selectedBranch ? (
    <Card style={{ padding: 18, display: 'grid', gap: 10 }}>
      <SectionHeading title="Pick A Year" eyebrow="Courses" caption="Course editing unlocks at branch level, but semester-wise rows belong to a selected year." />
      {branchBatches.map(batch => (
        <button key={batch.batchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: batch.batchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '12px 14px', cursor: 'pointer' }}>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Batch {batch.batchLabel} · sections {batch.sectionLabels.join(', ')}</div>
        </button>
      ))}
    </Card>
  ) : (
    <EmptyState title="Select a branch" body="Courses are only editable after branch scope is selected." />
  )
}
