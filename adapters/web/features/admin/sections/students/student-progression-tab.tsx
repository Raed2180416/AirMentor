import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import {
  EmptyState,
  InfoBanner,
  SectionHeading,
  formatDate,
} from '../../system-admin-ui'
import type { StudentsSectionProps } from './types'

type StudentProgressionTabProps = Pick<
  StudentsSectionProps,
  | 'selectedStudent'
  | 'selectedStudentDisplayCgpa'
  | 'selectedStudentDisplaySemester'
  | 'selectedStudentDisplayBacklogCount'
  | 'selectedStudentCheckpointCgpaVisible'
  | 'selectedStudentCheckpointSummary'
  | 'selectedStudentCheckpointBanner'
  | 'selectedStudentPolicy'
  | 'selectedStudentPolicyLoading'
  | 'selectedStudentPromotionRecommended'
  | 'selectedStudentPromotionRules'
  | 'selectedStudentNextTerms'
  | 'handlePromoteStudent'
>

export function StudentProgressionTab({
  selectedStudent,
  selectedStudentDisplayCgpa,
  selectedStudentDisplaySemester,
  selectedStudentDisplayBacklogCount,
  selectedStudentCheckpointCgpaVisible,
  selectedStudentCheckpointSummary,
  selectedStudentCheckpointBanner,
  selectedStudentPolicy,
  selectedStudentPolicyLoading,
  selectedStudentPromotionRecommended,
  selectedStudentPromotionRules,
  selectedStudentNextTerms,
  handlePromoteStudent,
}: StudentProgressionTabProps) {
  return (
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Promotion Review" eyebrow="Semester Progression" caption="Recommendations use the configured CGPA rule and backlog guard, then wait for explicit admin confirmation." />
                {!selectedStudent ? <EmptyState title="Select a student" body="Promotion review appears when a student with an academic context is selected." /> : !selectedStudent.activeAcademicContext ? (
                  <EmptyState title="No active academic context" body="Create or restore an enrollment before using the promotion panel." />
                ) : (
                  <>
                    {!selectedStudentPolicy && !selectedStudentPolicyLoading ? <InfoBanner message="No resolved scope policy snapshot is loaded for this student. The progression panel is using the default guardrails only." /> : null}
                    {selectedStudentCheckpointBanner ? <InfoBanner tone="neutral" message={selectedStudentCheckpointBanner} /> : null}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={selectedStudentPromotionRecommended ? T.success : T.warning}>{selectedStudentPromotionRecommended ? 'Recommended' : 'Hold for review'}</Chip>
                      {selectedStudentCheckpointCgpaVisible ? <Chip color={T.accent}>Current CGPA {selectedStudentDisplayCgpa.toFixed(2)}</Chip> : <Chip color={T.dim}>CGPA deferred at this checkpoint</Chip>}
                      <Chip color={T.warning}>Min CGPA {selectedStudentPromotionRules.minimumCgpaForPromotion.toFixed(1)}</Chip>
                      {selectedStudentCheckpointSummary?.currentQueueState ? <Chip color={T.orange}>{selectedStudentCheckpointSummary.currentQueueState}</Chip> : null}
                      {selectedStudentPolicyLoading ? <Chip color={T.dim}>Loading policy…</Chip> : null}
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.9 }}>
                      Current semester: {selectedStudentDisplaySemester ?? '—'} · Academic status: {selectedStudent.activeAcademicContext.academicStatus}{selectedStudentDisplayBacklogCount != null ? ` · Backlogs ${selectedStudentDisplayBacklogCount}` : ''}<br />
                      Promotion rule: {selectedStudentPromotionRules.requireNoActiveBacklogs ? 'Require no active backlogs' : 'Backlog check disabled'} · Pass threshold {selectedStudentPromotionRules.passMarkPercent}%
                    </div>
                    {selectedStudentNextTerms.length === 0 ? <InfoBanner message="No next-semester term is configured yet for this branch. Add the next term in the university workspace first." /> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedStudentNextTerms.map(term => (
                          <Card key={term.termId} style={{ padding: 12, background: T.surface2, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{term.academicYearLabel} · Semester {term.semesterNumber}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(term.startDate)} to {formatDate(term.endDate)}</div>
                            </div>
                            <Btn type="button" onClick={() => void handlePromoteStudent(term.termId)}>Promote Into This Term</Btn>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
  )
}
