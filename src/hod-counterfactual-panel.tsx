import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { T, mono, sora } from './data'
import type {
  ApiAcademicHodProofCounterfactualReport,
  ApiAcademicHodProofCounterfactualScalar,
} from './api/types'
import { Btn, Card, Chip } from './ui-primitives'
import { EmptyState, InfoBanner } from './system-admin-ui'

// Phase-11 counterfactual impact panel (2026-04-23).
//
// Given two seeded proof runs for the same pilot cohort — a baseline run
// advanced with AIRMENTOR_STAGE_REALIZATION_V1 off and a realized run with
// the flag on plus interventions applied — this panel diffs the per-student
// per-stage mark snapshots to answer: "how much did interventions actually
// move the needle?".
//
// The underlying reader is
// `@air-mentor-api/src/lib/proof-counterfactual-reader.ts` (10/10 tests) and
// the fetcher is `@air-mentor-api/src/lib/proof-counterfactual-fetcher.ts`,
// both wired through the
// `GET /api/academic/hod/proof-counterfactual?runIdBaseline=...&runIdRealized=...`
// endpoint.

const SCALAR_DISPLAY: ReadonlyArray<{ key: ApiAcademicHodProofCounterfactualScalar; label: string; hint: string }> = [
  { key: 'tt1Pct', label: 'TT1', hint: 'Test 1 score' },
  { key: 'tt2Pct', label: 'TT2', hint: 'Test 2 score' },
  { key: 'quizPct', label: 'Quiz', hint: 'Quiz aggregate' },
  { key: 'assignmentPct', label: 'Assignment', hint: 'Assignment aggregate' },
  { key: 'seePct', label: 'SEE', hint: 'Semester-end exam' },
  { key: 'totalPct', label: 'Total', hint: 'Overall (mean)' },
]

function deltaColor(delta: number): string {
  if (delta > 0.5) return T.success
  if (delta < -0.5) return T.warning
  return T.dim
}

function deltaIcon(delta: number) {
  if (delta > 0.5) return <TrendingUp size={12} />
  if (delta < -0.5) return <TrendingDown size={12} />
  return <Minus size={12} />
}

type HodCounterfactualPanelProps = {
  runIdBaseline: string
  runIdRealized: string
  loadReport: (input: { runIdBaseline: string; runIdRealized: string }) => Promise<ApiAcademicHodProofCounterfactualReport>
}

export function HodCounterfactualPanel({
  runIdBaseline,
  runIdRealized,
  loadReport,
}: HodCounterfactualPanelProps) {
  const [report, setReport] = useState<ApiAcademicHodProofCounterfactualReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!runIdBaseline || !runIdRealized) return
      if (runIdBaseline === runIdRealized) {
        setError('Baseline and realized runs must be different runs')
        setReport(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await loadReport({ runIdBaseline, runIdRealized })
        if (!cancelled) setReport(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load counterfactual report')
          setReport(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [loadReport, runIdBaseline, runIdRealized])

  const aggregateRows = useMemo(() => {
    if (!report) return []
    return SCALAR_DISPLAY.map(scalar => {
      const stats = report.aggregate.byScalar[scalar.key]
      return { scalar, stats }
    })
  }, [report])

  const topMovers = useMemo(() => {
    if (!report) return []
    // Sort by the total delta (sum of absolute deltas across scalars) to
    // surface the largest swingers at the top. For ties, prefer positive
    // swingers. Deterministic tie-breaker by studentId.
    return [...report.studentStageDiffs]
      .map(diff => {
        const sumAbs = Object.values(diff.deltas).reduce((acc, v) => acc + Math.abs(v ?? 0), 0)
        const sumSigned = Object.values(diff.deltas).reduce((acc, v) => acc + (v ?? 0), 0)
        return { diff, sumAbs, sumSigned }
      })
      .sort((a, b) => {
        if (Math.abs(b.sumAbs - a.sumAbs) > 0.001) return b.sumAbs - a.sumAbs
        if (Math.abs(b.sumSigned - a.sumSigned) > 0.001) return b.sumSigned - a.sumSigned
        return a.diff.studentId.localeCompare(b.diff.studentId)
      })
      .slice(0, 10)
  }, [report])

  if (error) {
    return (
      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <InfoBanner tone="error" message={error} />
      </Card>
    )
  }

  if (loading && !report) {
    return (
      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <InfoBanner message="Computing counterfactual diff…" />
      </Card>
    )
  }

  if (!report) {
    return (
      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <EmptyState
          title="No counterfactual selected"
          body="Select a baseline run (flag-off seeded trajectory) and a realized run (flag-on with interventions) to compute the diff."
        />
      </Card>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }} data-proof-section="hod-counterfactual">
      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Counterfactual Impact</div>
          <Chip color={T.accent}>{report.aggregate.totalStudents} students</Chip>
          <Chip color={T.dim}>{report.aggregate.totalStages} stages</Chip>
          <Chip color={T.dim}>{report.aggregate.totalStudentStagePairs} comparisons</Chip>
        </div>
        <InfoBanner
          message={`Comparing baseline run ${report.runIdBaseline} to realized run ${report.runIdRealized}. Positive deltas indicate the realized run out-performed the baseline at that mark scalar, i.e. interventions raised the score.`}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {aggregateRows.map(row => {
            const stats = row.stats
            const mean = stats.meanDelta
            const median = stats.medianDelta
            const positives = stats.positiveCount
            const negatives = stats.negativeCount
            return (
              <Card key={row.scalar.key} style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.scalar.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: deltaColor(mean) }}>
                    {deltaIcon(mean)}
                  </div>
                </div>
                <div style={{ ...sora, fontSize: 22, fontWeight: 700, color: deltaColor(mean) }}>
                  {mean > 0 ? '+' : ''}{mean.toFixed(2)}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                  {row.scalar.hint} · {stats.samples} samples
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Chip color={T.success}>{positives} up</Chip>
                  <Chip color={T.warning}>{negatives} down</Chip>
                  <Chip color={T.dim}>median {median > 0 ? '+' : ''}{median.toFixed(2)}</Chip>
                </div>
              </Card>
            )
          })}
        </div>
      </Card>

      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Top Movers</div>
          <Chip color={T.dim}>{topMovers.length} of {report.studentStageDiffs.length}</Chip>
        </div>
        {topMovers.length === 0 ? (
          <EmptyState title="No mark-scalar diffs found" body="Both runs produced identical mark snapshots. Either no interventions were applied or the flag-off run also had matching adjustments." />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {topMovers.map(item => {
              const { diff } = item
              return (
                <Card key={`${diff.studentId}::${diff.semesterNumber}::${diff.stageKey}`} style={{ padding: 10, background: T.surface, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>{diff.studentId}</div>
                    <Chip color={T.muted}>Sem {diff.semesterNumber}</Chip>
                    <Chip color={T.dim}>{diff.stageKey}</Chip>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SCALAR_DISPLAY.map(scalar => {
                      const value = diff.deltas[scalar.key]
                      if (value == null) return null
                      return (
                        <Chip key={scalar.key} color={deltaColor(value)}>
                          {scalar.label} {value > 0 ? '+' : ''}{value.toFixed(1)}
                        </Chip>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Card>

      <Btn
        size="sm"
        onClick={() => {
          const payload = JSON.stringify(report, null, 2)
          const blob = new Blob([payload], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `counterfactual-${report.runIdBaseline}-vs-${report.runIdRealized}.json`
          link.click()
          URL.revokeObjectURL(url)
        }}
      >
        Download full counterfactual JSON
      </Btn>
    </div>
  )
}

