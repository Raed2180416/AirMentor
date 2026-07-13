import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentRiskExplorer } from '@web/shared/api/types'
import { Card } from '@web/shared/ui/primitives'
import { formatEvidencePct } from './helpers'

export function ComponentEvidenceGrid({ explorer }: { explorer: ApiStudentRiskExplorer }) {
  return (
    <Card data-proof-section="component-evidence-grid" style={{ padding: 16, display: 'grid', gap: 10, marginTop: 14 }}>
      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Component Evidence Grid</div>
      {explorer.assessmentComponents.length > 0 ? explorer.assessmentComponents.map(component => (
        <Card key={`${component.courseCode}-${component.sectionCode ?? 'na'}`} style={{ padding: 10, background: T.surface2 }}>
          <div style={{ ...mono, fontSize: 10, color: T.text }}>{component.courseCode} · {component.courseTitle}{component.sectionCode ? ` · Section ${component.sectionCode}` : ''}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8, marginTop: 4 }}>
            Attendance {component.attendancePct}% · TT1 {formatEvidencePct(component.tt1Pct)} · TT2 {formatEvidencePct(component.tt2Pct)} · Quiz {formatEvidencePct(component.quizPct)} · Assignment {formatEvidencePct(component.assignmentPct)} · SEE {formatEvidencePct(component.seePct)} · Focus Outcomes {component.weakCoCount} · Weak questions {component.weakQuestionCount}
          </div>
        </Card>
      )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No component-level evidence rows are available on this proof explorer.</div>}
    </Card>
  )
}
