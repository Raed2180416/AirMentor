import { Activity } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { Role } from '@kernel/shared/domain'
import type { ApiFeatureCompleteness, ApiStudentRiskExplorer } from '@web/shared/api/types'
import { describeProofModelUsefulness, describeProofProvenance } from '@web/simulation/proof-provenance'
import { ProofSurfaceHero } from '@web/simulation/proof-surface-shell'
import { Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { renderAuthorityBannerMessage, renderFeatureCompletenessLabel, renderFeatureProvenanceValue } from './helpers'

export function RiskExplorerHero({
  role,
  explorer,
  featureCompleteness,
}: {
  role: Role
  explorer: ApiStudentRiskExplorer
  featureCompleteness: ApiFeatureCompleteness | null
}) {
  const featureProvenance = explorer.featureProvenance ?? null
  return (
    <ProofSurfaceHero
      surface="risk-explorer"
      entityId={explorer.checkpointContext?.simulationStageCheckpointId ?? undefined}
      studentId={explorer.student.studentId}
      eyebrow="Student Success Profile"
      title={explorer.student.studentName}
      description={explorer.disclaimer}
      icon={<Activity size={22} color={T.accent} />}
      badges={(
        <>
          <Chip color={T.accent}>{role}</Chip>
          <Chip color={T.success}>{explorer.runContext.runLabel}</Chip>
          {explorer.modelProvenance.calibrationMethod ? <Chip color={T.orange}>{`Cal ${explorer.modelProvenance.calibrationMethod}`}</Chip> : null}
          {explorer.modelProvenance.displayProbabilityAllowed === false ? <Chip color={T.warning}>Band only</Chip> : null}
          {explorer.modelProvenance.coEvidenceMode ? <Chip color={T.dim}>{explorer.modelProvenance.coEvidenceMode}</Chip> : null}
          {featureCompleteness ? <Chip color={featureCompleteness.complete ? T.success : T.warning}>{renderFeatureCompletenessLabel(featureCompleteness)}</Chip> : null}
          {explorer.checkpointContext ? <Chip color={T.orange}>{`Sem ${explorer.checkpointContext.semesterNumber} · ${explorer.checkpointContext.stageLabel}`}</Chip> : null}
          {explorer.checkpointContext?.stageAdvanceBlocked ? <Chip color={T.danger}>Stage blocked</Chip> : null}
          {explorer.trainedRiskHeads.currentRiskBand ? <Chip color={explorer.trainedRiskHeads.currentRiskBand === 'High' ? T.danger : explorer.trainedRiskHeads.currentRiskBand === 'Medium' ? T.warning : T.success}>{explorer.trainedRiskHeads.currentRiskBand}</Chip> : null}
        </>
      )}
      notices={(
        <>
          <InfoBanner message={`Proof context ${explorer.runContext.runLabel} · ${explorer.runContext.status} · created ${new Date(explorer.runContext.createdAt).toLocaleString('en-IN')} · model ${explorer.modelProvenance.modelVersion ?? 'fallback'}${explorer.modelProvenance.calibrationVersion ? ` · calibration ${explorer.modelProvenance.calibrationVersion}` : ''}${explorer.checkpointContext ? ` · checkpoint ${explorer.checkpointContext.stageLabel}` : ''}.`} />
          {explorer.modelProvenance.supportWarning ? <InfoBanner tone="neutral" message={explorer.modelProvenance.supportWarning} /> : null}
          {featureCompleteness && !featureCompleteness.complete ? (
            <InfoBanner
              tone="neutral"
              message={`Feature fallback is ${featureCompleteness.fallbackMode}. Missing: ${featureCompleteness.missing.join(' · ') || 'none'}.`}
            />
          ) : null}
          {explorer.checkpointContext?.stageAdvanceBlocked ? (
            <InfoBanner
              tone="error"
              message={`Playback progression is blocked at this checkpoint until ${explorer.checkpointContext.blockingQueueItemCount ?? 0} queue item(s) are resolved. This risk explorer remains read-only on the selected proof stage.`}
            />
          ) : null}
          <div data-proof-section="authority-banner">
            <InfoBanner message={renderAuthorityBannerMessage(explorer)} />
            <InfoBanner tone="neutral" message={describeProofProvenance(explorer)} />
            <InfoBanner tone="neutral" message={describeProofModelUsefulness(explorer)} />
          </div>
        </>
      )}
    >
      <Card style={{ padding: 14, display: 'grid', gap: 10, background: T.surface2 }}>
      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Feature Completeness</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {featureCompleteness ? (
            <>
              <Chip color={featureCompleteness.complete ? T.success : T.warning}>{featureCompleteness.complete ? 'Complete' : 'Incomplete'}</Chip>
              <Chip color={featureCompleteness.fallbackMode === 'graph-aware' ? T.success : T.warning}>{renderFeatureCompletenessLabel(featureCompleteness)}</Chip>
              <Chip color={featureCompleteness.confidenceClass === 'high' ? T.success : featureCompleteness.confidenceClass === 'medium' ? T.warning : T.danger}>{`Confidence ${featureCompleteness.confidenceClass}`}</Chip>
              <Chip color={featureCompleteness.graphAvailable ? T.success : T.danger}>Graph {featureCompleteness.graphAvailable ? 'available' : 'missing'}</Chip>
              <Chip color={featureCompleteness.historyAvailable ? T.success : T.danger}>History {featureCompleteness.historyAvailable ? 'available' : 'missing'}</Chip>
            </>
          ) : (
            <Chip color={T.dim}>Unavailable</Chip>
          )}
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          {featureCompleteness ? `Missing dimensions: ${featureCompleteness.missing.join(' · ') || 'none'} · confidence ${featureCompleteness.confidenceClass}.` : 'No feature-completeness metadata is attached to this proof payload.'}
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
          {renderFeatureProvenanceValue(featureProvenance)}
        </div>
      </Card>
    </ProofSurfaceHero>
  )
}
