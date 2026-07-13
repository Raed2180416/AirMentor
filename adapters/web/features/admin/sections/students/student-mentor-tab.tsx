import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card } from '@web/shared/ui/primitives'
import {
  EmptyState,
  InfoBanner,
  SectionHeading,
  formatDate,
} from '../../system-admin-ui'
import { defaultMentorAssignmentForm } from '../../live-app-model'
import { resolveFacultyMember } from '../../system-admin-live-data'
import type { StudentsSectionProps } from './types'

type StudentMentorTabProps = Pick<
  StudentsSectionProps,
  | 'data'
  | 'selectedStudent'
  | 'setMentorForm'
  | 'setEditingEntity'
  | 'handleEndMentorAssignment'
  | 'startEditingMentorAssignment'
>

export function StudentMentorTab({
  data,
  selectedStudent,
  setMentorForm,
  setEditingEntity,
  handleEndMentorAssignment,
  startEditingMentorAssignment,
}: StudentMentorTabProps) {
  return (
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
  )
}
