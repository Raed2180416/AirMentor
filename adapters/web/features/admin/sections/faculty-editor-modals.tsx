import { AnimatePresence, motion } from 'framer-motion'

import type { ApiRoleCode } from '@web/shared/api/types'
import { T, mono } from '@web/simulation/fixtures'
import { Btn } from '@web/shared/ui/primitives'
import {
  FieldLabel,
  ModalFrame,
  SelectInput,
  TextInput,
} from '../system-admin-ui'
import type { FacultyEditorModalsProps } from './entity-editor-modal-types'

export function FacultyEditorModals({
  editingEntity,
  setEditingEntity,
  selectedFacultyMember,
  facultyForm,
  setFacultyForm,
  roleGrantForm,
  setRoleGrantForm,
  appointmentForm,
  setAppointmentForm,
  visibleDepartments,
  branchesForAppointment,
  scopeOptions,
  handleSaveFaculty,
  handleArchiveFaculty,
  handleSaveRoleGrant,
  handleSaveAppointment,
}: FacultyEditorModalsProps) {
  if (!selectedFacultyMember) return null

  const resetFacultyForm = () => {
    setFacultyForm({
      displayName: selectedFacultyMember.displayName,
      employeeCode: selectedFacultyMember.employeeCode,
      username: selectedFacultyMember.username,
      email: selectedFacultyMember.email,
      phone: selectedFacultyMember.phone ?? '',
      designation: selectedFacultyMember.designation,
      joinedOn: selectedFacultyMember.joinedOn ?? '',
      password: '',
    })
    setEditingEntity(null)
  }

  return (
    <AnimatePresence>
      {editingEntity === 'faculty-profile' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame
            eyebrow="Faculty Edit"
            title={`Edit ${selectedFacultyMember.displayName}`}
            caption="Keep faculty identity edits in a focused dialog while the workspace stays reserved for appointments, permissions, classes, and planning."
            onClose={resetFacultyForm}
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
                <Btn type="button" variant="ghost" onClick={resetFacultyForm}>Cancel</Btn>
                <Btn type="button" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn>
                <Btn type="submit">Save Faculty</Btn>
              </div>
            </form>
          </ModalFrame>
        </motion.div>
      ) : null}

      {editingEntity === 'faculty-permission' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame
            eyebrow="Permission Detail"
            title={roleGrantForm.grantId ? 'Edit Permission' : 'Grant Permission'}
            caption="Manage access and boundaries for this faculty member."
            onClose={() => setEditingEntity(null)}
          >
            <form onSubmit={event => { void handleSaveRoleGrant(event); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
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

      {editingEntity === 'faculty-appointment' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ModalFrame
            eyebrow="Appointment Detail"
            title={appointmentForm.appointmentId ? 'Edit Appointment' : 'Add Appointment'}
            caption="Maintain formal appointments and cross-department affiliations for this faculty member."
            onClose={() => setEditingEntity(null)}
          >
            <form onSubmit={event => { void handleSaveAppointment(event); setEditingEntity(null) }} style={{ display: 'grid', gap: 12 }}>
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
    </AnimatePresence>
  )
}
