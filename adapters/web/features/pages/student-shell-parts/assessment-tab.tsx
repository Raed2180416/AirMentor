import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentCard } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { PanelLabel, formatEvidencePct } from './shared'

export function StudentShellAssessmentTab({ card }: { card: ApiStudentAgentCard }) {
  return (
    <div data-proof-section="assessment-panel" style={{ display: 'grid', gap: 14 }}>
      <Card data-proof-section="assessment-evidence" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label={card.assessmentEvidence.panelLabel} />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Observed course evidence</div>
        {card.assessmentEvidence.components.map(item => (
          <Card key={`${item.courseCode}-${item.sectionCode ?? 'na'}`} style={{ padding: 10, background: T.surface2 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.courseTitle}{item.sectionCode ? ` · Section ${item.sectionCode}` : ''}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
              Attendance {Math.round(item.attendancePct)}% · TT1 {formatEvidencePct(item.tt1Pct)} · TT2 {formatEvidencePct(item.tt2Pct)} · quiz {formatEvidencePct(item.quizPct)} · assignment {formatEvidencePct(item.assignmentPct)} · SEE {formatEvidencePct(item.seePct)}.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Chip color={T.warning}>Weak COs {item.weakCoCount}</Chip>
              <Chip color={T.danger}>Weak questions {item.weakQuestionCount}</Chip>
              {item.drivers.slice(0, 3).map((driver, index) => (
                <Chip key={`${item.courseCode}-${driver.feature}-${index}-${driver.label}`} color={driver.impact >= 0 ? T.warning : T.success}>{driver.label}</Chip>
              ))}
            </div>
          </Card>
        ))}
      </Card>
      <Card data-proof-section="question-pattern-summary" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label="Observed" />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Question-pattern summary</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
          Weak questions {card.topicAndCo.questionPatterns.weakQuestionCount} · careless errors {card.topicAndCo.questionPatterns.carelessErrorCount} · transfer-gap signals {card.topicAndCo.questionPatterns.transferGapCount}.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {card.topicAndCo.questionPatterns.commonWeakTopics.map(topic => <Chip key={`weak-topic-${topic}`} color={T.danger}>{topic}</Chip>)}
          {card.topicAndCo.questionPatterns.commonWeakCourseOutcomes.map(coCode => <Chip key={`weak-co-${coCode}`} color={T.warning}>{coCode}</Chip>)}
        </div>
      </Card>
    </div>
  )
}
