import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner, SectionHeading, formatDate } from '../../system-admin-ui'
import { type AppointmentFormState, type EditingEntity, defaultAppointmentForm, formatFacultyAppointmentLabel } from '../../live-app-model'
import { AdminDetailTabPanel } from '../../live-app-chrome'
import type { ApiFacultyAppointment, ApiFacultyRecord } from '@web/shared/api/types'

type FacultyAppointmentsTabProps = {
  selectedFacultyMember: ApiFacultyRecord | null
  setAppointmentForm: (value: AppointmentFormState | ((prev: AppointmentFormState) => AppointmentFormState)) => void
  setEditingEntity: (value: EditingEntity | null) => void
  startEditingAppointment: (appointment: ApiFacultyAppointment) => void
  handleArchiveAppointment: (appointment: ApiFacultyAppointment) => void
}

export function FacultyAppointmentsTab({
  selectedFacultyMember,
  setAppointmentForm,
  setEditingEntity,
  startEditingAppointment,
  handleArchiveAppointment,
}: FacultyAppointmentsTabProps) {
  return (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="appointments">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Appointments" eyebrow="Canonical Affiliation" caption="Department and branch affiliation stay canonical here, even when HoD visibility rolls up external teaching activity." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Appointments become available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyMember.appointments.length === 0 ? <InfoBanner message="No appointments recorded yet." /> : selectedFacultyMember.appointments.map(appointment => {
                        return (
                          <Card key={appointment.appointmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{formatFacultyAppointmentLabel(appointment)}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{appointment.isPrimary ? 'Primary appointment' : 'Supporting appointment'} · {formatDate(appointment.startDate)} to {appointment.endDate ? formatDate(appointment.endDate) : 'Active'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => { startEditingAppointment(appointment); setEditingEntity('faculty-appointment') }}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveAppointment(appointment)}>Delete</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <Btn type="button" size="sm" onClick={() => {
                        setAppointmentForm(defaultAppointmentForm())
                        setEditingEntity('faculty-appointment')
                      }}>Add New Appointment</Btn>
                    </div>
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
  )
}
