import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentCard } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { PanelLabel } from './shared'

export function StudentShellInterventionsTab({ card }: { card: ApiStudentAgentCard }) {
  return (
    <div data-proof-section="interventions-panel" style={{ display: 'grid', gap: 14 }}>
      <Card data-proof-section="reassessments" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label={card.interventions.panelLabel} />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Reassessments</div>
        {card.interventions.currentReassessments.length > 0 ? card.interventions.currentReassessments.map(item => (
          <Card key={item.reassessmentEventId} style={{ padding: 10, background: T.surface2 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.courseTitle}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
              {item.status} · assigned to {item.assignedToRole} · due {new Date(item.dueAt).toLocaleString('en-IN')}
            </div>
          </Card>
        )) : <Chip color={T.success}>No active reassessments</Chip>}
      </Card>
      <Card data-proof-section="intervention-history" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <PanelLabel label={card.interventions.panelLabel} />
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Intervention history</div>
        {card.interventions.interventionHistory.length > 0 ? card.interventions.interventionHistory.map(item => (
          <Card key={item.interventionId} style={{ padding: 10, background: T.surface2 }}>
            <div data-proof-field="intervention-type-label" style={{ ...mono, fontSize: 10, color: T.text }}>{humanLabelForActionCode(item.interventionType) ?? item.interventionType}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{item.note}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Chip color={item.accepted === true ? T.success : item.accepted === false ? T.warning : T.dim}>Accepted {item.accepted == null ? 'n/a' : item.accepted ? 'Yes' : 'No'}</Chip>
              <Chip color={item.completed === true ? T.success : item.completed === false ? T.warning : T.dim}>Completed {item.completed == null ? 'n/a' : item.completed ? 'Yes' : 'No'}</Chip>
              {item.recoveryConfirmed != null ? <Chip color={item.recoveryConfirmed ? T.success : T.warning}>Recovery {item.recoveryConfirmed ? 'Confirmed' : 'Watch'}</Chip> : null}
            </div>
          </Card>
        )) : <Chip color={T.dim}>No intervention history</Chip>}
      </Card>
    </div>
  )
}
