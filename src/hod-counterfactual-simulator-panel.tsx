import { useEffect, useMemo, useState } from 'react'
import { TrendingDown, TrendingUp, Minus, AlertTriangle, ShieldCheck } from 'lucide-react'
import { T, mono, sora } from './data'
import type {
  ApiAcademicHodProofCounterfactualSimulatorReport,
  ApiAcademicHodProofSimulatorScalarKey,
  ApiAcademicHodProofSimulatorStudentStage,
} from './api/types'
import { Btn, Card, Chip } from './ui-primitives'
import { EmptyState, InfoBanner } from './system-admin-ui'

// Phase-11 simulator counterfactual panel (2026-04-23).
//
// Prompt §C.13 + §G.6 + §L.10. Replaces the legacy
// `hod-counterfactual-panel.tsx` (which consumes the diagnostic flag-diff
// route) as the authoritative HOD analytics surface for final demo.
//
// The underlying reader/aggregator is
// `@air-mentor-api/src/lib/proof-counterfactual-simulator-aggregator.ts`
// (17/17 unit tests green), fed by
// `@air-mentor-api/src/lib/proof-counterfactual-simulator-fetcher.ts` and
// served via
// `GET /api/academic/hod/proof-counterfactual-simulator?runId=...`.
//
// Language discipline (§C.13):
//   - NEVER "the model prevented"
//   - ALWAYS "projected", "simulated", "counterfactual", "would-have-been"

const SCALAR_DISPLAY: ReadonlyArray<{ key: ApiAcademicHodProofSimulatorScalarKey; label: string; hint: string }> = [
  { key: 'attendancePct', label: 'Attendance', hint: 'Attendance %' },
  { key: 'tt1Pct', label: 'TT1', hint: 'Test 1' },
  { key: 'tt2Pct', label: 'TT2', hint: 'Test 2' },
  { key: 'quizPct', label: 'Quiz', hint: 'Quiz aggregate' },
  { key: 'assignmentPct', label: 'Assignment', hint: 'Assignment aggregate' },
  { key: 'seePct', label: 'SEE', hint: 'Semester-end exam' },
]

function liftColor(value: number): string {
  if (value > 2) return T.success
  if (value < -2) return T.warning
  return T.dim
}

function liftIcon(value: number) {
  if (value > 2) return <TrendingUp size={12} />
  if (value < -2) return <TrendingDown size={12} />
  return <Minus size={12} />
}

function formatScaled(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}

type HodCounterfactualSimulatorPanelProps = {
  runId: string
  loadReport: (input: { runId: string }) => Promise<ApiAcademicHodProofCounterfactualSimulatorReport>
}

export function HodCounterfactualSimulatorPanel({
  runId,
  loadReport,
}: HodCounterfactualSimulatorPanelProps) {
  const [report, setReport] = useState<ApiAcademicHodProofCounterfactualSimulatorReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!runId) return
      setLoading(true)
      setError(null)
      try {
        const data = await loadReport({ runId })
        if (!cancelled) setReport(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load simulator counterfactual report')
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
  }, [loadReport, runId])

  const topPreventedRows = useMemo(() => {
    if (!report) return [] as ApiAcademicHodProofSimulatorStudentStage[]
    return [...report.perStudentPerStage]
      .filter(row => row.bandTransition === 'prevented-high' || row.bandTransition === 'prevented-medium')
      .sort((a, b) => {
        if (Math.abs(b.liftProbScaled - a.liftProbScaled) > 0.01) return b.liftProbScaled - a.liftProbScaled
        return a.studentId.localeCompare(b.studentId)
      })
      .slice(0, 10)
  }, [report])

  const regressionRows = useMemo(() => {
    if (!report) return [] as ApiAcademicHodProofSimulatorStudentStage[]
    return [...report.perStudentPerStage]
      .filter(row => row.bandTransition === 'regression')
      .sort((a, b) => {
        if (Math.abs(a.liftProbScaled - b.liftProbScaled) > 0.01) return a.liftProbScaled - b.liftProbScaled
        return a.studentId.localeCompare(b.studentId)
      })
      .slice(0, 5)
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
        <InfoBanner message="Computing simulator counterfactual…" />
      </Card>
    )
  }

  if (!report) {
    return (
      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <EmptyState
          title="No simulator counterfactual available"
          body="The Phase-11 analytics require a run whose stage projections include stored no-action risk. Re-run the simulation if this persists."
        />
      </Card>
    )
  }

  const pf = report.projectedFinal

  return (
    <div style={{ display: 'grid', gap: 16 }} data-proof-section="hod-counterfactual-simulator">
      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Projected Counterfactual (simulator)</div>
          <Chip color={T.accent}>{pf.totalStudents} students</Chip>
          <Chip color={T.dim}>{pf.totalSemesters} semesters</Chip>
          <Chip color={T.dim}>{pf.totalStagePoints} stage points</Chip>
        </div>
        <InfoBanner
          message={`Projected with-vs-without-intervention report for run ${report.runId}. Values are simulated counterfactuals derived from stored no-action risk scoring and mark-penalty reconstruction — they are projected, not causally proven.`}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mean risk (with intervention)</div>
            <div style={{ ...sora, fontSize: 22, fontWeight: 700, color: T.text }}>
              {pf.meanRealizedRiskProbScaled.toFixed(1)}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>scaled 0–100</div>
          </Card>
          <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mean risk (no action)</div>
            <div style={{ ...sora, fontSize: 22, fontWeight: 700, color: T.warning }}>
              {pf.meanNoActionRiskProbScaled.toFixed(1)}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>counterfactual baseline</div>
          </Card>
          <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mean lift</div>
            <div style={{ ...sora, fontSize: 22, fontWeight: 700, color: liftColor(pf.meanLiftProbScaled) }}>
              {formatScaled(pf.meanLiftProbScaled)}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>
              {liftIcon(pf.meanLiftProbScaled)} positive = simulated reduction in risk
            </div>
          </Card>
          <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Projected failures prevented</div>
            <div style={{ ...sora, fontSize: 22, fontWeight: 700, color: T.success }}>
              {pf.projectedFailuresPreventedTotal}
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted }}>
              <ShieldCheck size={12} /> unique students whose final-stage band improved
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Lift distribution (per stage point)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
            {pf.liftDistribution.map(bin => (
              <Card key={bin.binLabel} style={{ padding: 8, background: T.surface, display: 'grid', gap: 2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{bin.binLabel}</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{bin.count}</div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>By semester</div>
          <Chip color={T.dim}>{report.bySemester.length} rollups</Chip>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {report.bySemester.map(sem => (
            <Card key={sem.semesterNumber} style={{ padding: 10, background: T.surface, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>Semester {sem.semesterNumber}</div>
                <Chip color={T.muted}>{sem.studentCount} students</Chip>
                <Chip color={liftColor(sem.meanLiftProbScaled)}>lift {formatScaled(sem.meanLiftProbScaled)}</Chip>
                <Chip color={T.success}>{sem.preventedHighTotal} prevented-high</Chip>
                <Chip color={T.accent}>{sem.preventedMediumTotal} prevented-medium</Chip>
                {sem.regressionTotal > 0 ? (
                  <Chip color={T.warning}>{sem.regressionTotal} regression</Chip>
                ) : null}
                <Chip color={T.success}>{sem.projectedFailuresPrevented} projected failures prevented</Chip>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Top projected uplift (per-student, per-stage)</div>
          <Chip color={T.dim}>{topPreventedRows.length} of {report.perStudentPerStage.length}</Chip>
        </div>
        {topPreventedRows.length === 0 ? (
          <EmptyState title="No projected band improvements in this run" body="Every (student, stage) point shows the same band in realized vs no-action. Interventions may not have reached the decisive threshold." />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {topPreventedRows.map(row => (
              <Card
                key={`${row.studentId}::${row.semesterNumber}::${row.stageKey}`}
                style={{ padding: 10, background: T.surface, display: 'grid', gap: 6 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>{row.studentId}</div>
                  <Chip color={T.muted}>Sem {row.semesterNumber}</Chip>
                  <Chip color={T.dim}>{row.stageKey}</Chip>
                  <Chip color={T.warning}>no-action band {row.noActionRiskBand}</Chip>
                  <Chip color={T.success}>realized band {row.realizedRiskBand}</Chip>
                  <Chip color={liftColor(row.liftProbScaled)}>lift {formatScaled(row.liftProbScaled)}</Chip>
                  {row.simulatedActionTaken ? (
                    <Chip color={T.accent}>action {row.simulatedActionTaken}</Chip>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SCALAR_DISPLAY.map(scalar => {
                    const delta = row.markDeltas[scalar.key]
                    if (delta == null) return null
                    return (
                      <Chip key={scalar.key} color={liftColor(delta)}>
                        {scalar.label} {formatScaled(delta)}
                      </Chip>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {regressionRows.length > 0 ? (
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.warning }}>Band regressions to investigate</div>
            <Chip color={T.warning}>{regressionRows.length} rows</Chip>
          </div>
          <InfoBanner tone="error" message="Realized band is worse than no-action band. Usually indicates evidence realization triggered deterioration elsewhere — review these rows before presenting the dashboard." />
          <div style={{ display: 'grid', gap: 6 }}>
            {regressionRows.map(row => (
              <Card
                key={`reg::${row.studentId}::${row.semesterNumber}::${row.stageKey}`}
                style={{ padding: 8, background: T.surface, display: 'grid', gap: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text }}>{row.studentId}</div>
                  <Chip color={T.muted}>Sem {row.semesterNumber}</Chip>
                  <Chip color={T.dim}>{row.stageKey}</Chip>
                  <Chip color={T.warning}>
                    <AlertTriangle size={10} /> no-action {row.noActionRiskBand} → realized {row.realizedRiskBand}
                  </Chip>
                  <Chip color={T.warning}>lift {formatScaled(row.liftProbScaled)}</Chip>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      ) : null}

      <Btn
        size="sm"
        onClick={() => {
          const payload = JSON.stringify(report, null, 2)
          const blob = new Blob([payload], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `counterfactual-simulator-${report.runId}.json`
          link.click()
          URL.revokeObjectURL(url)
        }}
      >
        Download simulator counterfactual JSON
      </Btn>
    </div>
  )
}
