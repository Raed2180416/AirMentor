import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { T, mono } from '../../data'
import {
  Btn,
  FieldLabel,
  ModalFrame,
  SelectInput,
  TextAreaInput,
  TextInput,
} from '../../ui-primitives'
import {
  type AppointmentFormState,
  type EditingEntity,
  type EnrollmentFormState,
  type EntityEditorsState,
  type FacultyFormState,
  type MentorAssignmentFormState,
  type RoleGrantFormState,
  type StudentFormState,
} from '../live-app-model'
import type { ApiRoleCode } from '../../api/types'

type EntityEditorModalsProps = {
  editingEntity: EditingEntity | null
  setEditingEntity: (value: EditingEntity | null) => void
  // Selected entities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedStudent: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyMember: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedAcademicFaculty: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedDepartment: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedBranch: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedBatch: any | null
  // Forms
  studentForm: StudentFormState
  setStudentForm: (value: StudentFormState | ((prev: StudentFormState) => StudentFormState)) => void
  enrollmentForm: EnrollmentFormState
  setEnrollmentForm: (value: EnrollmentFormState | ((prev: EnrollmentFormState) => EnrollmentFormState)) => void
  mentorForm: MentorAssignmentFormState
  setMentorForm: (value: MentorAssignmentFormState | ((prev: MentorAssignmentFormState) => MentorAssignmentFormState)) => void
  facultyForm: FacultyFormState
  setFacultyForm: (value: FacultyFormState | ((prev: FacultyFormState) => FacultyFormState)) => void
  roleGrantForm: RoleGrantFormState
  setRoleGrantForm: (value: RoleGrantFormState | ((prev: RoleGrantFormState) => RoleGrantFormState)) => void
  appointmentForm: AppointmentFormState
  setAppointmentForm: (value: AppointmentFormState | ((prev: AppointmentFormState) => AppointmentFormState)) => void
  entityEditors: EntityEditorsState
  setEntityEditors: (value: EntityEditorsState | ((prev: EntityEditorsState) => EntityEditorsState)) => void
  // Reference data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visibleBranches: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visibleTerms: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visibleDepartments: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  termsForEnrollment: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mentorEligibleFaculty: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  branchesForAppointment: any[]
  scopeOptions: { value: string; label: string }[]
  // Handlers
  handleSaveStudent: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveStudent: () => void
  handleSaveEnrollment: (event: FormEvent<HTMLFormElement>) => void
  handleSaveMentorAssignment: (event: FormEvent<HTMLFormElement>) => void
  handleSaveFaculty: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveFaculty: () => void
  handleSaveRoleGrant: (event: FormEvent<HTMLFormElement>) => void
  handleSaveAppointment: (event: FormEvent<HTMLFormElement>) => void
  handleUpdateAcademicFaculty: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveAcademicFaculty: () => void
  handleRestoreAcademicFaculty: () => void
  handleDeleteAcademicFaculty: () => void
  handleUpdateDepartment: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveDepartment: () => void
  handleUpdateBranch: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveBranch: () => void
  handleUpdateBatch: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveBatch: () => void
}

export function EntityEditorModals(props: EntityEditorModalsProps) {
  const {
    editingEntity, setEditingEntity,
    selectedStudent, selectedFacultyMember,
    selectedAcademicFaculty, selectedDepartment, selectedBranch, selectedBatch,
    studentForm, setStudentForm,
    enrollmentForm, setEnrollmentForm,
    mentorForm, setMentorForm,
    facultyForm, setFacultyForm,
    roleGrantForm, setRoleGrantForm,
    appointmentForm, setAppointmentForm,
    entityEditors, setEntityEditors,
    visibleBranches, visibleTerms, visibleDepartments,
    termsForEnrollment, mentorEligibleFaculty, branchesForAppointment, scopeOptions,
    handleSaveStudent, handleArchiveStudent,
    handleSaveEnrollment, handleSaveMentorAssignment,
    handleSaveFaculty, handleArchiveFaculty,
    handleSaveRoleGrant, handleSaveAppointment,
    handleUpdateAcademicFaculty, handleArchiveAcademicFaculty, handleRestoreAcademicFaculty, handleDeleteAcademicFaculty,
    handleUpdateDepartment, handleArchiveDepartment,
    handleUpdateBranch, handleArchiveBranch,
    handleUpdateBatch, handleArchiveBatch,
  } = props

  return (
      <AnimatePresence>
        {editingEntity === 'student-profile' && selectedStudent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Student Edit"
              title={`Edit ${selectedStudent.name}`}
              caption="Update the core student identity from a focused dialog instead of the stretched workspace card."
              onClose={() => {
                setStudentForm({ name: selectedStudent.name, usn: selectedStudent.usn, rollNumber: selectedStudent.rollNumber ?? '', admissionDate: selectedStudent.admissionDate, email: selectedStudent.email ?? '', phone: selectedStudent.phone ?? '' })
                setEditingEntity(null)
              }}
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
                  <Btn type="button" variant="ghost" onClick={() => {
                    setStudentForm({ name: selectedStudent.name, usn: selectedStudent.usn, rollNumber: selectedStudent.rollNumber ?? '', admissionDate: selectedStudent.admissionDate, email: selectedStudent.email ?? '', phone: selectedStudent.phone ?? '' })
                    setEditingEntity(null)
                  }}>Cancel</Btn>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn>
                  <Btn type="submit">Save Student</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'student-enrollment' && selectedStudent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Student Enrollment"
              title={enrollmentForm.enrollmentId ? `Edit Enrollment` : `Add Enrollment`}
              caption={`Maintain academic context for ${selectedStudent.name}.`}
              onClose={() => setEditingEntity(null)}
            >
              <form onSubmit={e => { void handleSaveEnrollment(e); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
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

        {editingEntity === 'student-mentor' && selectedStudent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Mentor Assignment"
              title={mentorForm.assignmentId ? `Edit Mentor Assignment` : `Assign Mentor`}
              caption={`Establish or update mentoring linkage for ${selectedStudent.name}.`}
              onClose={() => setEditingEntity(null)}
            >
              <form onSubmit={e => { void handleSaveMentorAssignment(e); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
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

        {editingEntity === 'faculty-profile' && selectedFacultyMember ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Faculty Edit"
              title={`Edit ${selectedFacultyMember.displayName}`}
              caption="Keep faculty identity edits in a focused dialog while the workspace stays reserved for appointments, permissions, classes, and planning."
              onClose={() => {
                setFacultyForm({ displayName: selectedFacultyMember.displayName, employeeCode: selectedFacultyMember.employeeCode, username: selectedFacultyMember.username, email: selectedFacultyMember.email, phone: selectedFacultyMember.phone ?? '', designation: selectedFacultyMember.designation, joinedOn: selectedFacultyMember.joinedOn ?? '', password: '' })
                setEditingEntity(null)
              }}
            >
              <form onSubmit={handleSaveFaculty} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div><FieldLabel>Display Name</FieldLabel><TextInput aria-label="Faculty Display Name" value={facultyForm.displayName} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} /></div>
                  <div><FieldLabel>Employee Code</FieldLabel><TextInput aria-label="Faculty Employee Code" value={facultyForm.employeeCode} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} /></div>
                  <div><FieldLabel>Username</FieldLabel><TextInput aria-label="Faculty Username" value={facultyForm.username} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} /></div>
                  <div><FieldLabel>Email</FieldLabel><TextInput aria-label="Faculty Email" value={facultyForm.email} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div><FieldLabel>Phone</FieldLabel><TextInput aria-label="Faculty Phone" value={facultyForm.phone} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
                  <div><FieldLabel>Designation</FieldLabel><TextInput aria-label="Faculty Designation" value={facultyForm.designation} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Btn type="button" variant="ghost" onClick={() => {
                    setFacultyForm({ displayName: selectedFacultyMember.displayName, employeeCode: selectedFacultyMember.employeeCode, username: selectedFacultyMember.username, email: selectedFacultyMember.email, phone: selectedFacultyMember.phone ?? '', designation: selectedFacultyMember.designation, joinedOn: selectedFacultyMember.joinedOn ?? '', password: '' })
                    setEditingEntity(null)
                  }}>Cancel</Btn>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn>
                  <Btn type="submit">Save Faculty</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'faculty-permission' && selectedFacultyMember ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Permission Detail"
              title={roleGrantForm.grantId ? `Edit Permission` : `Grant Permission`}
              caption={`Manage access and boundaries for this faculty member.`}
              onClose={() => setEditingEntity(null)}
            >
              <form onSubmit={e => { void handleSaveRoleGrant(e); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Role</FieldLabel>
                          <SelectInput value={roleGrantForm.roleCode} onChange={event => setRoleGrantForm(prev => ({ ...prev, roleCode: event.target.value as ApiRoleCode }))}>
                            <option value="MENTOR">MENTOR</option>
                            <option value="HOD">HOD</option>
                            <option value="COURSE_LEADER">COURSE_LEADER</option>
                            <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Scope Type</FieldLabel>
                          <SelectInput value={roleGrantForm.scopeType} onChange={event => setRoleGrantForm(prev => ({ ...prev, scopeType: event.target.value, scopeId: '' }))}>
                            <option value="institution">institution</option>
                            <option value="academic-faculty">academic-faculty</option>
                            <option value="department">department</option>
                            <option value="branch">branch</option>
                            <option value="batch">batch</option>
                            <option value="offering">offering</option>
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Scope</FieldLabel>
                          {scopeOptions.length > 0 ? (
                            <SelectInput value={roleGrantForm.scopeId} onChange={event => setRoleGrantForm(prev => ({ ...prev, scopeId: event.target.value }))}>
                              <option value="">Select scope</option>
                              {scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </SelectInput>
                          ) : (
                            <TextInput value={roleGrantForm.scopeId} onChange={event => setRoleGrantForm(prev => ({ ...prev, scopeId: event.target.value }))} placeholder="Scope id" />
                          )}
                        </div>
                        <div><FieldLabel>Start Date</FieldLabel><TextInput value={roleGrantForm.startDate} onChange={event => setRoleGrantForm(prev => ({ ...prev, startDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                        <div><FieldLabel>End Date</FieldLabel><TextInput value={roleGrantForm.endDate} onChange={event => setRoleGrantForm(prev => ({ ...prev, endDate: event.target.value }))} placeholder="Leave blank while active" /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                  <Btn type="submit">{roleGrantForm.grantId ? 'Save Permission' : 'Grant Permission'}</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'faculty-appointment' && selectedFacultyMember ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Appointment Detail"
              title={appointmentForm.appointmentId ? `Edit Appointment` : `Add Appointment`}
              caption={`Maintain formal appointments and cross-department affiliations for this faculty member.`}
              onClose={() => setEditingEntity(null)}
            >
              <form onSubmit={e => { void handleSaveAppointment(e); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Department</FieldLabel>
                          <SelectInput value={appointmentForm.departmentId} onChange={event => setAppointmentForm(prev => ({ ...prev, departmentId: event.target.value, branchId: '' }))}>
                            <option value="">Select department</option>
                            {visibleDepartments.map(department => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Branch</FieldLabel>
                          <SelectInput value={appointmentForm.branchId} onChange={event => setAppointmentForm(prev => ({ ...prev, branchId: event.target.value }))}>
                            <option value="">No branch / department-wide</option>
                            {branchesForAppointment.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
                          </SelectInput>
                        </div>
                        <div><FieldLabel>Start Date</FieldLabel><TextInput value={appointmentForm.startDate} onChange={event => setAppointmentForm(prev => ({ ...prev, startDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                        <div><FieldLabel>End Date</FieldLabel><TextInput value={appointmentForm.endDate} onChange={event => setAppointmentForm(prev => ({ ...prev, endDate: event.target.value }))} placeholder="Leave blank while active" /></div>
                        <div>
                          <FieldLabel>Primary Appointment</FieldLabel>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                            <input type="checkbox" checked={appointmentForm.isPrimary} onChange={event => setAppointmentForm(prev => ({ ...prev, isPrimary: event.target.checked }))} />
                            Mark as primary
                          </label>
                        </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                  <Btn type="submit">{appointmentForm.appointmentId ? 'Save Appointment' : 'Add Appointment'}</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

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
