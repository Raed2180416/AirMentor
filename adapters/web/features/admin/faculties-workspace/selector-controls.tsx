import { T, mono } from '@web/simulation/fixtures'
import { getFieldChromeStyle } from '@web/shared/ui/primitives'
import type { ApiAcademicFaculty, ApiBatch, ApiBranch, ApiDepartment } from '@web/shared/api/types'
import { deriveCurrentYearLabel, type LiveAdminDataset, type LiveAdminRoute } from '../system-admin-live-data'

type WorkspaceSelectorControlsProps = {
  data: LiveAdminDataset
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
  selectedBranch: ApiBranch | null
  selectedBatch: ApiBatch | null
  selectedSectionCode: string | null
  facultyDepartments: ApiDepartment[]
  departmentBranches: ApiBranch[]
  branchBatches: ApiBatch[]
  navigate: (route: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
  updateSelectedSectionCode: (sectionCode: string | null, options?: { recordHistory?: boolean }) => void
}

export function WorkspaceSelectorControls({
  data,
  selectedAcademicFaculty,
  selectedDepartment,
  selectedBranch,
  selectedBatch,
  selectedSectionCode,
  facultyDepartments,
  departmentBranches,
  branchBatches,
  navigate,
  updateSelectedSectionCode,
}: WorkspaceSelectorControlsProps) {
  const selectedBatchSectionOptions = selectedBatch
    ? Array.from(
      new Set(
        selectedBatch.sectionLabels
          .map(sectionCode => sectionCode.trim().toUpperCase())
          .filter(Boolean),
      ),
    )
    : []
  const sectionOptions = selectedSectionCode && !selectedBatchSectionOptions.includes(selectedSectionCode)
    ? [selectedSectionCode, ...selectedBatchSectionOptions]
    : selectedBatchSectionOptions

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Faculty</div>
        <select
          value={selectedAcademicFaculty?.academicFacultyId ?? ''}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({ section: 'faculties', academicFacultyId: event.target.value || undefined })
          }}
          style={{ ...getFieldChromeStyle({ dense: true }), cursor: 'pointer', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
        >
          <option value="">All Academic Faculties</option>
          {selectedAcademicFaculty && selectedAcademicFaculty.status !== 'deleted' && selectedAcademicFaculty.status !== 'hidden' && selectedAcademicFaculty.status !== 'archived' ? null : null}
          {selectedAcademicFaculty && !facultyDepartments.some(item => item.academicFacultyId === selectedAcademicFaculty.academicFacultyId) ? (
            <option value={selectedAcademicFaculty.academicFacultyId}>{selectedAcademicFaculty.name} ({selectedAcademicFaculty.status})</option>
          ) : null}
          {data.academicFaculties.filter(item => item.status !== 'deleted' && item.status !== 'hidden').map(faculty => <option key={faculty.academicFacultyId} value={faculty.academicFacultyId}>{faculty.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Department</div>
        <select
          value={selectedDepartment?.departmentId ?? ''}
          disabled={!selectedAcademicFaculty}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({
              section: 'faculties',
              academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
              departmentId: event.target.value || undefined,
            })
          }}
          style={{ ...getFieldChromeStyle({ dense: true }), cursor: !selectedAcademicFaculty ? 'not-allowed' : 'pointer', opacity: !selectedAcademicFaculty ? 0.55 : 1, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
        >
          <option value="">{selectedAcademicFaculty ? 'Select Department' : 'Pick Faculty First'}</option>
          {facultyDepartments.map(department => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Branch</div>
        <select
          value={selectedBranch?.branchId ?? ''}
          disabled={!selectedDepartment}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({
              section: 'faculties',
              academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
              departmentId: selectedDepartment?.departmentId,
              branchId: event.target.value || undefined,
            })
          }}
          style={{ ...getFieldChromeStyle({ dense: true }), cursor: !selectedDepartment ? 'not-allowed' : 'pointer', opacity: !selectedDepartment ? 0.55 : 1, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
        >
          <option value="">{selectedDepartment ? 'Select Branch' : 'Pick Department First'}</option>
          {departmentBranches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Year</div>
        <select
          value={selectedBatch?.batchId ?? ''}
          disabled={!selectedBranch}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({
              section: 'faculties',
              academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
              departmentId: selectedDepartment?.departmentId,
              branchId: selectedBranch?.branchId,
              batchId: event.target.value || undefined,
            })
          }}
          style={{ ...getFieldChromeStyle({ dense: true }), cursor: !selectedBranch ? 'not-allowed' : 'pointer', opacity: !selectedBranch ? 0.55 : 1, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
        >
          <option value="">{selectedBranch ? 'Select Year' : 'Pick Branch First'}</option>
          {branchBatches.map(batch => <option key={batch.batchId} value={batch.batchId}>{deriveCurrentYearLabel(batch.currentSemester)} · {batch.batchLabel}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Section</div>
        <select
          value={selectedSectionCode ?? ''}
          disabled={!selectedBatch}
          onChange={event => updateSelectedSectionCode(event.target.value || null)}
          style={{ ...getFieldChromeStyle({ dense: true }), cursor: !selectedBatch ? 'not-allowed' : 'pointer', opacity: !selectedBatch ? 0.55 : 1, WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
        >
          <option value="">{selectedBatch ? 'All Sections' : 'Pick Year First'}</option>
          {selectedBatch ? sectionOptions.map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>) : null}
        </select>
      </div>
    </div>
  )
}
