import { motion } from 'framer-motion'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Card, Tooltip } from '@web/shared/ui/primitives'
import { ProofSurfaceTabPanel } from '@web/simulation/proof-surface-shell'
import { summarizeCoEvidenceMix } from './proof-dashboard-helpers'
import type {
  DiagnosticsRecord,
  ModelDiagnosticsLike,
  ProductionDiagnosticsLike,
  ProofDashboardTabId,
} from './proof-dashboard-types'

type ProofDiagnosticsPanelProps = {
  activeTab: ProofDashboardTabId
  activeDiagnosticsTrainingManifestVersion: string | null | undefined
  activeDiagnosticsCalibrationVersion: string | null | undefined
  activeDiagnosticsSplitSummary: DiagnosticsRecord
  activeDiagnosticsWorldSplitSummary: DiagnosticsRecord
  activeModelDiagnostics: ModelDiagnosticsLike
  activeDiagnosticsScenarioFamilies: DiagnosticsRecord
  activeDiagnosticsHeadSupportSummary: DiagnosticsRecord
  activeDiagnosticsGovernedRunCount: number | null | undefined
  activeDiagnosticsSkippedRunCount: number | null | undefined
  activeDiagnosticsDisplayProbabilityAllowed: boolean | null | undefined
  activeDiagnosticsSupportWarning: string | null
  evaluationStatusLine: string
  activeDiagnosticsCoEvidence: DiagnosticsRecord
  activeDiagnosticsPolicyDiagnostics: DiagnosticsRecord
  activeDiagnosticsPolicyAcceptance: DiagnosticsRecord
  activeDiagnosticsOverallCourseRuntime: DiagnosticsRecord
  activeDiagnosticsQueueBurden: DiagnosticsRecord
  activeDiagnosticsUiParity: DiagnosticsRecord
  activeProductionDiagnostics: ProductionDiagnosticsLike
  formatSplitSummary: (summary: DiagnosticsRecord) => string
  formatKeyedCounts: (summary: DiagnosticsRecord) => string
  formatHeadSupportSummary: (summary: DiagnosticsRecord) => string
  formatDiagnosticSummary: (summary: DiagnosticsRecord) => string
}

export function ProofDiagnosticsPanel({
  activeTab,
  activeDiagnosticsTrainingManifestVersion,
  activeDiagnosticsCalibrationVersion,
  activeDiagnosticsSplitSummary,
  activeDiagnosticsWorldSplitSummary,
  activeModelDiagnostics,
  activeDiagnosticsScenarioFamilies,
  activeDiagnosticsHeadSupportSummary,
  activeDiagnosticsGovernedRunCount,
  activeDiagnosticsSkippedRunCount,
  activeDiagnosticsDisplayProbabilityAllowed,
  activeDiagnosticsSupportWarning,
  evaluationStatusLine,
  activeDiagnosticsCoEvidence,
  activeDiagnosticsPolicyDiagnostics,
  activeDiagnosticsPolicyAcceptance,
  activeDiagnosticsOverallCourseRuntime,
  activeDiagnosticsQueueBurden,
  activeDiagnosticsUiParity,
  activeProductionDiagnostics,
  formatSplitSummary,
  formatKeyedCounts,
  formatHeadSupportSummary,
  formatDiagnosticSummary,
}: ProofDiagnosticsPanelProps) {
  const coEvidenceMixSummary = summarizeCoEvidenceMix(activeDiagnosticsCoEvidence)

  return (
    <ProofSurfaceTabPanel
      idBase="system-admin-proof-dashboard"
      tabId="diagnostics"
      activeTab={activeTab}
      sectionId="proof-dashboard-diagnostics"
      minHeight={300}
      style={{ gap: 12 }}
    >
      <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Corpus + Split</div>
          <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.6 }}>Manifest {activeDiagnosticsTrainingManifestVersion ?? 'unknown'}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Splits: {formatSplitSummary(activeDiagnosticsSplitSummary)}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Worlds: {formatSplitSummary(activeDiagnosticsWorldSplitSummary)}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}><Tooltip label="Scenario families classify synthetic student trajectories into behavioural archetypes (e.g. attendance-driven, early-warning) so the risk model trains on a diverse, controlled mix of outcomes.">Scenario families</Tooltip>: {formatKeyedCounts(activeModelDiagnostics?.scenarioFamilySummary ?? activeDiagnosticsScenarioFamilies)}</div>
          {activeDiagnosticsHeadSupportSummary ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Head support: {formatHeadSupportSummary(activeDiagnosticsHeadSupportSummary)}</div> : null}
          {activeDiagnosticsGovernedRunCount != null || activeDiagnosticsSkippedRunCount != null ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Governed runs: {activeDiagnosticsGovernedRunCount ?? 'unknown'} · skipped runs: {activeDiagnosticsSkippedRunCount ?? 0}</div> : null}
        </Card>

        <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Calibration + Policy</div>
          <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.6 }}>Calibration {activeDiagnosticsCalibrationVersion ?? 'unknown'}</div>
          {activeDiagnosticsDisplayProbabilityAllowed != null ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Probability display: {activeDiagnosticsDisplayProbabilityAllowed ? 'allowed' : 'band only'}</div> : null}
          {activeDiagnosticsSupportWarning ? <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.6 }}>Support: {activeDiagnosticsSupportWarning}</div> : null}
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>{evaluationStatusLine}</div>
          {coEvidenceMixSummary ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>CO evidence mix: {coEvidenceMixSummary}</div> : null}
          {activeDiagnosticsPolicyDiagnostics ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Governed policy: {formatDiagnosticSummary(activeDiagnosticsPolicyDiagnostics)}</div> : null}
          {activeDiagnosticsCoEvidence ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Governed CO evidence: {formatDiagnosticSummary(activeDiagnosticsCoEvidence)}</div> : null}
          {activeDiagnosticsPolicyAcceptance ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Policy gates: {formatDiagnosticSummary(activeDiagnosticsPolicyAcceptance)}</div> : null}
          {activeDiagnosticsOverallCourseRuntime ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Overall-course runtime: {formatDiagnosticSummary(activeDiagnosticsOverallCourseRuntime)}</div> : null}
          {activeDiagnosticsQueueBurden ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Queue burden: {formatDiagnosticSummary(activeDiagnosticsQueueBurden)}</div> : null}
          {activeDiagnosticsUiParity ? <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.6 }}>Active-run parity: {formatDiagnosticSummary(activeDiagnosticsUiParity)}</div> : null}
          {activeProductionDiagnostics?.correlations ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>Correlations: {Object.keys(activeProductionDiagnostics.correlations).slice(0, 5).join(' · ') || 'none'}</div> : null}
        </Card>
      </motion.div>
    </ProofSurfaceTabPanel>
  )
}
