import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentAgentTimelineItem } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { EmptyState } from '@web/features/admin/system-admin-ui'
import { CitationList, PanelLabel } from './shared'

export function StudentShellTimelineTab({
  timelineBySemester,
  timelineLoading,
}: {
  timelineBySemester: [number, ApiStudentAgentTimelineItem[]][]
  timelineLoading: boolean
}) {
  return (
    <div>
      <Card data-proof-section="timeline-panel" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <PanelLabel label="Observed" />
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 6 }}>Bounded proof timeline</div>
          </div>
          {timelineLoading ? <Chip color={T.dim}>Loading timeline...</Chip> : null}
        </div>
        {timelineBySemester.length > 0 ? timelineBySemester.map(([semesterNumber, items]) => (
          <Card key={`timeline-${semesterNumber}`} style={{ padding: 12, background: T.surface2 }}>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>
              {semesterNumber > 0 ? `Semester ${semesterNumber}` : 'Cross-semester log'}
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {items.map(item => (
                <Card key={item.timelineItemId} style={{ padding: 10, background: T.surface }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PanelLabel label={item.panelLabel} />
                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.title}</div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>{item.detail}</div>
                  <CitationList citations={item.citations} />
                </Card>
              ))}
            </div>
          </Card>
        )) : <EmptyState title="No timeline entries" body="The proof card does not currently expose timeline items." />}
      </Card>
    </div>
  )
}
