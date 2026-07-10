import { AnimatePresence, motion } from 'framer-motion'

import { Btn } from '../../ui-primitives'
import {
  FieldLabel,
  ModalFrame,
  SelectInput,
  TextInput,
} from '../../system-admin-ui'
import type { StudentEditorModalsProps } from './entity-editor-modal-types'

export function StudentEditorModals({
  editingEntity,
  setEditingEntity,
  selectedStudent,
  studentForm,
  setStudentForm,
  enrollmentForm,
  setEnrollmentForm,
  mentorForm,
  setMentorForm,
  visibleBranches,
  visibleTerms,
  termsForEnrollment,
  mentorEligibleFaculty,
  handleSaveStudent,
  handleArchiveStudent,
  handleSaveEnrollment,
  handleSaveMentorAssignment,
}: StudentEditorModalsProps) {
  if (!selectedStudent) return null

  const resetStudentForm = () => {
    setStudentForm({
      name: selectedStudent.name,
      usn: selectedStudent.usn,
      rollNumber: selectedStudent.rollNumber ?? '',
      admissionDate: selectedStudent.admissionDate,
      email: selectedStudent.email ?? '',
      phone: selectedStudent.phone ?? '',
    })
    setEditingEntity(null)
  }

  return (
    <AnimatePresence>
      {editingEntity === 'student-profile' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame
            eyebrow="Student Edit"
            title={`Edit ${selectedStudent.name}`}
            caption="Update the core student identity from a focused dialog instead of the stretched workspace card."
            onClose={resetStudentForm}
          >
            <form onSubmit={handleSaveStudent} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div><FieldLabel>Name</FieldLabel><TextInput aria-label="Student Name" value={studentForm.name} onChange={event => setStudentForm(prev => ({ ...prev, name: event.target.value }))} /></div>
                <div><FieldLabel>USN</FieldLabel><TextInput aria-label="Student USN" value={studentForm.usn} onChange={event => setStudentForm(prev => ({ ...prev, usn: event.target.value }))} /></div>
                <div><FieldLabel>Roll Number</FieldLabel><TextInput aria-label="Student Roll Number" value={studentForm.rollNumber} onChange={event => setStudentForm(prev => ({ ...prev, rollNumber: event.target.value }))} /></div>
                <div><FieldLabel>Admission Date</FieldLabel><TextInput aria-label="Student Admission Date" value={studentForm.admissionDate} onChange={event => setStudentForm(prev => ({ ...prev, admissionDate: event.target.value }))} /></div>
                <div><FieldLabel>Email</FieldLabel><TextInput aria-label="Student Email" value={studentForm.email} onChange={event => setStudentForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                <div><FieldLabel>Phone</FieldLabel><TextInput aria-label="Student Phone" value={studentForm.phone} onChange={event => setStudentForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Btn type="button" variant="ghost" onClick={resetStudentForm}>Cancel</Btn>
                <Btn type="button" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn>
                <Btn type="submit">Save Student</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}

      {editingEntity === 'student-enrollment' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame
            eyebrow="Student Enrollment"
            title={enrollmentForm.enrollmentId ? 'Edit Enrollment' : 'Add Enrollment'}
            caption={`Maintain academic context for ${selectedStudent.name}.`}
            onClose={() => setEditingEntity(null)}
          >
            <form onSubmit={event => { void handleSaveEnrollment(event); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div>
                  <FieldLabel>Branch</FieldLabel>
                  <SelectInput value={enrollmentForm.branchId} onChange={event => setEnrollmentForm(prev => ({ ...prev, branchId: event.target.value, termId: '' }))}>
                    <option value="">Select branch</option>
                    {visibleBranches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Term</FieldLabel>
                  <SelectInput value={enrollmentForm.termId} onChange={event => {
                    const nextTerm = visibleTerms.find(item => item.termId === event.target.value)
                    setEnrollmentForm(prev => ({
                      ...prev,
                      termId: event.target.value,
                      branchId: nextTerm?.branchId ?? prev.branchId,
                      startDate: nextTerm?.startDate ?? prev.startDate,
                    }))
                  }}>
                    <option value="">Select term</option>
                    {termsForEnrollment.map(term => <option key={term.termId} value={term.termId}>{term.academicYearLabel} · Semester {term.semesterNumber}</option>)}
                  </SelectInput>
                </div>
                <div><FieldLabel>Section</FieldLabel><TextInput value={enrollmentForm.sectionCode} onChange={event => setEnrollmentForm(prev => ({ ...prev, sectionCode: event.target.value.toUpperCase() }))} placeholder="A" /></div>
                <div><FieldLabel>Academic Status</FieldLabel><TextInput value={enrollmentForm.academicStatus} onChange={event => setEnrollmentForm(prev => ({ ...prev, academicStatus: event.target.value }))} placeholder="regular / repeat / backlog" /></div>
                <div><FieldLabel>Roster Order</FieldLabel><TextInput value={enrollmentForm.rosterOrder} onChange={event => setEnrollmentForm(prev => ({ ...prev, rosterOrder: event.target.value }))} placeholder="0" /></div>
                <div><FieldLabel>Start Date</FieldLabel><TextInput value={enrollmentForm.startDate} onChange={event => setEnrollmentForm(prev => ({ ...prev, startDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                <div><FieldLabel>End Date</FieldLabel><TextInput value={enrollmentForm.endDate} onChange={event => setEnrollmentForm(prev => ({ ...prev, endDate: event.target.value }))} placeholder="Leave blank while active" /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                <Btn type="submit">{enrollmentForm.enrollmentId ? 'Save Enrollment' : 'Add Enrollment'}</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}

      {editingEntity === 'student-mentor' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame
            eyebrow="Mentor Assignment"
            title={mentorForm.assignmentId ? 'Edit Mentor Assignment' : 'Assign Mentor'}
            caption={`Establish or update mentoring linkage for ${selectedStudent.name}.`}
            onClose={() => setEditingEntity(null)}
          >
            <form onSubmit={event => { void handleSaveMentorAssignment(event); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div>
                  <FieldLabel>Eligible Mentor</FieldLabel>
                  <SelectInput value={mentorForm.facultyId} onChange={event => setMentorForm(prev => ({ ...prev, facultyId: event.target.value }))}>
                    <option value="">Select mentor</option>
                    {mentorEligibleFaculty.map(member => <option key={member.facultyId} value={member.facultyId}>{member.displayName} · {member.employeeCode}</option>)}
                  </SelectInput>
                </div>
                <div><FieldLabel>Effective From</FieldLabel><TextInput value={mentorForm.effectiveFrom} onChange={event => setMentorForm(prev => ({ ...prev, effectiveFrom: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                <div><FieldLabel>Effective To</FieldLabel><TextInput value={mentorForm.effectiveTo} onChange={event => setMentorForm(prev => ({ ...prev, effectiveTo: event.target.value }))} placeholder="Leave blank while active" /></div>
                <div><FieldLabel>Source</FieldLabel><TextInput value={mentorForm.source} onChange={event => setMentorForm(prev => ({ ...prev, source: event.target.value }))} placeholder="sysadmin-manual" /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                <Btn type="submit">{mentorForm.assignmentId ? 'Save Mentor Link' : 'Assign Mentor'}</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
