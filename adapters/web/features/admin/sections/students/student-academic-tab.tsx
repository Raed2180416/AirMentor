import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card } from '@web/shared/ui/primitives'
import {
  EmptyState,
  InfoBanner,
  SectionHeading,
  formatDate,
} from '../../system-admin-ui'
import { defaultEnrollmentForm } from '../../live-app-model'
import { resolveBranch } from '../../system-admin-live-data'
import type { StudentsSectionProps } from './types'

type StudentAcademicTabProps = Pick<
  StudentsSectionProps,
  | 'data'
  | 'selectedStudent'
  | 'setEnrollmentForm'
  | 'setEditingEntity'
  | 'handleCloseEnrollment'
  | 'startEditingEnrollment'
>

export function StudentAcademicTab({
  data,
  selectedStudent,
  setEnrollmentForm,
  setEditingEntity,
  handleCloseEnrollment,
  startEditingEnrollment,
}: StudentAcademicTabProps) {
  return (
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
  )
}
