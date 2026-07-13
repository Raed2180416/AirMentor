import { CO_COLORS, T, mono, sora, type CODef, type CoAttainmentRow } from '@web/simulation/fixtures'
import { Bar, Card, Chip, TD, TH } from '@web/shared/ui/primitives'
import { isProofEvidenceVisible } from './stage-helpers'

export function COTab({ cos, rows, proofStageKey }: { cos: CODef[]; rows: CoAttainmentRow[]; proofStageKey?: string | null }) {
  const rowByCoId = Object.fromEntries(rows.map(row => [row.coId, row])) as Record<string, CoAttainmentRow | undefined>
  const tt1Visible = isProofEvidenceVisible(proofStageKey, 'tt1')
  const tt2Visible = isProofEvidenceVisible(proofStageKey, 'tt2')
  const overallVisible = isProofEvidenceVisible(proofStageKey, 'see')

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ ...sora, fontWeight: 700, fontSize: 17, color: T.text, marginBottom: 16 }}>CO Attainment Report</div>
      {!overallVisible && <Card glow={T.blue} style={{ marginBottom: 14 }}><div style={{ ...mono, fontSize: 11, color: T.blue }}>CO attainment is stage-aware in proof playback: TT1 appears after TT1, TT2 after TT2, and final overall attainment after SEE.</div></Card>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {cos.map((co, index) => {
          const attainment = rowByCoId[co.id]
          const target = attainment?.target ?? 60
          const value = overallVisible
            ? attainment?.overallAttainment ?? null
            : tt2Visible
              ? attainment?.tt2Attainment ?? null
              : tt1Visible
                ? attainment?.tt1Attainment ?? null
                : null
          const evidenceLabel = overallVisible ? 'Overall' : tt2Visible ? 'TT2' : tt1Visible ? 'TT1' : 'No evidence yet'
          const color = CO_COLORS[index % CO_COLORS.length]
          return (
            <Card key={co.id} glow={color} style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ ...mono, fontSize: 10, color, marginBottom: 4 }}>{co.id}</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 28, color: value == null ? T.dim : value >= target ? T.success : T.danger }}>{value != null ? `${value}%` : '—'}</div>
              <div style={{ ...mono, fontSize: 9, color: T.dim, marginBottom: 6 }}>{value != null ? `${evidenceLabel} · ${value >= target ? '✓ Met' : '✗ Below'}` : 'No data'}</div>
              <div style={{ position: 'relative' }}>
                <Bar val={value ?? 0} color={value == null ? T.border : value >= target ? T.success : T.danger} h={6} />
                <div style={{ position: 'absolute', top: -1, left: `${target}%`, width: 1.5, height: 8, background: T.warning }} />
              </div>
            </Card>
          )
        })}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['CO', 'Description', 'Bloom', 'TT1', 'TT2', 'Overall', 'Students', 'Status'].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
          <tbody>
            {cos.map((co, index) => {
              const attainment = rowByCoId[co.id]
              const target = attainment?.target ?? 60
              const color = CO_COLORS[index % CO_COLORS.length]
              const tt1 = tt1Visible ? attainment?.tt1Attainment ?? null : null
              const tt2 = tt2Visible ? attainment?.tt2Attainment ?? null : null
              const overall = overallVisible ? attainment?.overallAttainment ?? null : null
              const latestVisible = overall ?? tt2 ?? tt1
              return (
                <tr key={co.id}>
                  <TD><Chip color={color} size={9}>{co.id}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 11, color: T.text, maxWidth: 200 }}>{co.desc}</TD>
                  <TD><Chip color={T.dim} size={9}>{co.bloom}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: tt1 != null ? (tt1 >= target ? T.success : T.danger) : T.dim }}>{tt1 != null ? `${tt1}%` : '—'}</TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: tt2 != null ? (tt2 >= target ? T.success : T.danger) : T.dim }}>{tt2 != null ? `${tt2}%` : '—'}</TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 700, color: overall != null ? (overall >= target ? T.success : T.danger) : T.dim }}>{overall != null ? `${overall}%` : '—'}</TD>
                  <TD style={{ ...mono, fontSize: 11, color: T.muted }}>{attainment?.studentsCounted ?? 0}</TD>
                  <TD>{latestVisible != null ? (latestVisible >= target ? <Chip color={T.success} size={9}>✓ Met</Chip> : <Chip color={T.danger} size={9}>✗ Below</Chip>) : <Chip color={T.dim} size={9}>Pending</Chip>}</TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
