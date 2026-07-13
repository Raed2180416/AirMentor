import { useState } from 'react'
import { T, mono, sora, type Offering, type YearGroup } from '@web/simulation/fixtures'
import { type EntryKind } from '@kernel/shared/domain'
import { useAppSelectors } from '@web/shared/state/selectors'
import { inferKindFromPendingAction } from '@web/shared/state/page-utils'
import { Card, Chip, StagePips, withAlpha } from '@web/shared/ui/primitives'

export function YearSection({
  group,
  onOpenCourse,
  onOpenUpload,
}: {
  group: YearGroup
  onOpenCourse: (offering: Offering) => void
  onOpenUpload: (offering?: Offering, kind?: EntryKind) => void
}) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const { year, stageInfo, offerings } = group
  const [collapsed, setCollapsed] = useState(false)
  const totalStudents = offerings.reduce((count, offering) => count + getStudentsPatched(offering).length, 0)
  const avgAtt = Math.round(offerings.reduce((count, offering) => count + getOfferingAttendancePatched(offering), 0) / (offerings.length || 1))
  const highRiskCount = offerings.filter(offering => offering.stage >= 2).reduce((count, offering) => count + getStudentsPatched(offering).filter(student => student.riskBand === 'High').length, 0)
  const pendingCount = offerings.filter(offering => offering.pendingAction).length

  return (
    <div style={{ marginBottom: 22 }}>
      <div data-pressable="true" onClick={() => setCollapsed(current => !current)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: collapsed ? 10 : '10px 10px 0 0', marginBottom: collapsed ? 0 : 12, cursor: 'pointer', transition: 'background-color 0.2s ease, border-color 0.2s ease, border-radius 0.2s ease, margin-bottom 0.2s ease', flexWrap: 'wrap' }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 13, color: T.accent, background: withAlpha(T.accent, '12'), border: `1px solid ${withAlpha(T.accent, '30')}`, padding: '3px 12px', borderRadius: 6 }}>{year}</div>
        <Chip color={stageInfo.color}>{stageInfo.label} · {stageInfo.desc}</Chip>
        <StagePips current={stageInfo.stage} />
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{offerings.length} class{offerings.length > 1 ? 'es' : ''} · {totalStudents} students · {avgAtt}% att</div>
        {highRiskCount > 0 ? <Chip color={T.danger} size={9}>🔴 {highRiskCount} high risk</Chip> : null}
        {pendingCount > 0 ? <Chip color={T.warning} size={9}>⚡ {pendingCount} data flags</Chip> : null}
        <div style={{ ...mono, fontSize: 12, color: T.dim, marginLeft: 'auto' }}>{collapsed ? '▸' : '▾'}</div>
      </div>
      {!collapsed ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {offerings.map(offering => <OfferingCard key={offering.offId} offering={offering} onOpen={onOpenCourse} onOpenUpload={onOpenUpload} />)}
        </div>
      ) : null}
    </div>
  )
}

function OfferingCard({
  offering,
  onOpen,
  onOpenUpload,
}: {
  offering: Offering
  onOpen: (offering: Offering) => void
  onOpenUpload: (offering?: Offering, kind?: EntryKind) => void
}) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const stageColor = offering.stageInfo.color
  const avgAtt = getOfferingAttendancePatched(offering)
  const attendanceColor = avgAtt >= 75 ? T.success : avgAtt >= 65 ? T.warning : T.danger
  const studentCount = getStudentsPatched(offering).length
  const checks = [offering.tt1Done, offering.tt2Done, avgAtt >= 75]
  const highRisk = offering.stage >= 2 ? getStudentsPatched(offering).filter(student => student.riskBand === 'High').length : 0

  return (
    <Card onClick={() => onOpen(offering)} style={{ position: 'relative', overflow: 'hidden', padding: '16px 18px', borderRadius: 12 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${withAlpha(T.accent, '44')}, ${withAlpha(T.accent, '22')})` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 2 }}>{offering.code} · {offering.dept} · Sec {offering.section}</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, lineHeight: 1.25 }}>{offering.title}</div>
        </div>
        <Chip color={stageColor} size={10}>{offering.stageInfo.label}</Chip>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip color={T.dim} size={9}>{studentCount} students</Chip>
        <Chip color={attendanceColor} size={9}>{avgAtt}% att</Chip>
        {highRisk > 0 ? <Chip color={T.danger} size={9}>🔴 {highRisk} at risk</Chip> : null}
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}>
        {['TT1', 'TT2', 'Att'].map((label, index) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: checks[index] ? T.success : T.border2, border: `1.5px solid ${checks[index] ? T.success : T.dim}` }} />
            <span style={{ ...mono, fontSize: 9, color: T.dim }}>{label}</span>
          </div>
        ))}
        <StagePips current={offering.stageInfo.stage} />
      </div>
      {offering.pendingAction ? (
        <div style={{ background: '#f59e0b0c', border: '1px solid #f59e0b25', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>⚡</span>
          <span style={{ ...mono, fontSize: 10, color: T.warning }}>{offering.pendingAction}</span>
          <button
            onClick={event => {
              event.stopPropagation()
              onOpenUpload(offering, inferKindFromPendingAction(offering.pendingAction))
            }}
            style={{ ...mono, fontSize: 9, color: T.accent, marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Open in Hub →
          </button>
        </div>
      ) : (
        <div style={{ background: '#10b9810c', border: '1px solid #10b98125', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>✓</span>
          <span style={{ ...mono, fontSize: 10, color: T.success }}>All caught up</span>
        </div>
      )}
    </Card>
  )
}
