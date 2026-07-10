import { AnimatePresence, motion } from 'framer-motion'

import { Btn } from '../../ui-primitives'
import {
  FieldLabel,
  ModalFrame,
  SelectInput,
  TextAreaInput,
  TextInput,
} from '../../system-admin-ui'
import type { HierarchyEditorModalsProps } from './entity-editor-modal-types'

export function HierarchyEditorModals({
  editingEntity,
  setEditingEntity,
  selectedAcademicFaculty,
  selectedDepartment,
  selectedBranch,
  selectedBatch,
  entityEditors,
  setEntityEditors,
  handleUpdateAcademicFaculty,
  handleArchiveAcademicFaculty,
  handleRestoreAcademicFaculty,
  handleDeleteAcademicFaculty,
  handleUpdateDepartment,
  handleArchiveDepartment,
  handleUpdateBranch,
  handleArchiveBranch,
  handleUpdateBatch,
  handleArchiveBatch,
}: HierarchyEditorModalsProps) {
  return (
    <AnimatePresence>
      {editingEntity === 'academic-faculty' && selectedAcademicFaculty ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame eyebrow="Hierarchy Edit" title={`Edit ${selectedAcademicFaculty.name}`} caption="Adjust faculty qualities here, then return to the same hierarchy layer with the rail preserved." onClose={() => setEditingEntity(null)}>
            <form onSubmit={handleUpdateAcademicFaculty} style={{ display: 'grid', gap: 10 }}>
              <div><FieldLabel>Faculty Code</FieldLabel><TextInput name="academicFacultyCode" aria-label="Faculty Code" value={entityEditors.academicFaculty.code} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} /></div>
              <div><FieldLabel>Faculty Name</FieldLabel><TextInput name="academicFacultyName" aria-label="Faculty Name" value={entityEditors.academicFaculty.name} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} /></div>
              <div><FieldLabel>Overview</FieldLabel><TextAreaInput name="academicFacultyOverview" aria-label="Faculty Overview" value={entityEditors.academicFaculty.overview} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} rows={4} /></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {selectedAcademicFaculty.status === 'archived'
                    ? <Btn type="button" variant="ghost" onClick={() => void handleRestoreAcademicFaculty()}>Restore Faculty</Btn>
                    : <Btn type="button" variant="ghost" onClick={() => void handleArchiveAcademicFaculty()}>Archive Faculty</Btn>}
                  <Btn type="button" variant="danger" onClick={() => void handleDeleteAcademicFaculty()}>Delete Faculty</Btn>
                </div>
                <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                <Btn type="submit">Save Faculty</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}

      {editingEntity === 'department' && selectedDepartment ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame eyebrow="Hierarchy Edit" title={`Edit ${selectedDepartment.name}`} caption="Department edits now live in a focused dialog so the rail and next-level branch workspace stay stable behind it." onClose={() => setEditingEntity(null)}>
            <form onSubmit={handleUpdateDepartment} style={{ display: 'grid', gap: 10 }}>
              <div><FieldLabel>Department Code</FieldLabel><TextInput name="departmentCode" aria-label="Department Code" value={entityEditors.department.code} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} /></div>
              <div><FieldLabel>Department Name</FieldLabel><TextInput name="departmentName" aria-label="Department Name" value={entityEditors.department.name} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} /></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <Btn type="button" variant="danger" onClick={() => void handleArchiveDepartment()}>Archive Department</Btn>
                <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                <Btn type="submit">Save Department</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}

      {editingEntity === 'branch' && selectedBranch ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame eyebrow="Hierarchy Edit" title={`Edit ${selectedBranch.name}`} caption="Branch metadata opens in a modal so year-level work in the subpanel stays visible and easier to reason about." onClose={() => setEditingEntity(null)}>
            <form onSubmit={handleUpdateBranch} style={{ display: 'grid', gap: 10 }}>
              <div><FieldLabel>Branch Code</FieldLabel><TextInput name="branchCode" aria-label="Branch Code" value={entityEditors.branch.code} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} /></div>
              <div><FieldLabel>Branch Name</FieldLabel><TextInput name="branchName" aria-label="Branch Name" value={entityEditors.branch.name} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} /></div>
              <div><FieldLabel>Program Level</FieldLabel><SelectInput name="branchProgramLevel" aria-label="Branch Program Level" value={entityEditors.branch.programLevel} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}><option value="UG">UG</option><option value="PG">PG</option></SelectInput></div>
              <div><FieldLabel>Semester Count</FieldLabel><TextInput name="branchSemesterCount" aria-label="Branch Semester Count" value={entityEditors.branch.semesterCount} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} /></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <Btn type="button" variant="danger" onClick={() => void handleArchiveBranch()}>Archive Branch</Btn>
                <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                <Btn type="submit">Save Branch</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}

      {editingEntity === 'batch' && selectedBatch ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame eyebrow="Hierarchy Edit" title={`Edit Batch ${selectedBatch.batchLabel}`} caption="Year-level edits now happen in a compact popup, while policy tabs and section-level actions stay in the main subpanel." onClose={() => setEditingEntity(null)}>
            <form onSubmit={handleUpdateBatch} style={{ display: 'grid', gap: 10 }}>
              <div><FieldLabel>Admission Year</FieldLabel><TextInput name="batchAdmissionYear" aria-label="Batch Admission Year" value={entityEditors.batch.admissionYear} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value } }))} /></div>
              <div><FieldLabel>Batch Label</FieldLabel><TextInput name="batchLabel" aria-label="Batch Label" value={entityEditors.batch.batchLabel} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, batchLabel: event.target.value } }))} /></div>
              <div><FieldLabel>Active Semester</FieldLabel><TextInput name="batchCurrentSemester" aria-label="Batch Active Semester" value={entityEditors.batch.currentSemester} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} /></div>
              <div><FieldLabel>Section Labels</FieldLabel><TextInput name="batchSectionLabels" aria-label="Batch Section Labels" value={entityEditors.batch.sectionLabels} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} /></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <Btn type="button" variant="danger" onClick={() => void handleArchiveBatch()}>Archive Batch</Btn>
                <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                <Btn type="submit">Save Batch</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
