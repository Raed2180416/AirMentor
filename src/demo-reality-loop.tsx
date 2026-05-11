import { useMemo, useState } from 'react'
import type {
  ApiAcademicFacultyProfile,
  ApiProofReassessmentResolveResponse,
  ApiStudentAgentCard,
  ApiStudentRiskExplorer,
} from './api/types'
import { T, mono, sora, type Offering } from './data'
import type { ProofAdvanceControlMode } from './proof-simulation-controls'
import { buildDemoRealityLoopSnapshot, formatDemoDelta, type DemoRealityLoopSnapshot } from './demo-reality-loop-utils'
import { Btn, Card, Chip } from './ui-primitives'

type DemoRealityLoopQueueItem = ApiAcademicFacultyProfile['proofOperations']['monitoringQueue'][number]

type DemoRealityLoopPanelProps = {
  proofProfile?: ApiAcademicFacultyProfile | null
  offerings: Offering[]
  loadStudentRiskExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
  loadStudentAgentCard?: (studentId: string) => Promise<ApiStudentAgentCard>
  onCommitAttendanceEdit?: (offeringId: string, studentId: string, nextAttendancePct: number) => Promise<void>
  onRecomputeProofRunRisk?: (simulationRunId: string, options?: { refreshWorkspace?: boolean }) => Promise<void>
  onResolveReassessment?: (reassessmentEventId: string, options?: { refreshWorkspace?: boolean }) => Promise<ApiProofReassessmentResolveResponse>
  onAdvanceProofRun?: (simulationRunId: string, mode: ProofAdvanceControlMode, options?: { refreshWorkspace?: boolean }) => Promise<void> | void
}

type DemoRealityLoopRunState = 'idle' | 'busy' | 'complete' | 'error'

function selectDemoQueueItem(proofProfile: ApiAcademicFacultyProfile | null | undefined) {
  const queue = proofProfile?.proofOperations?.monitoringQueue ?? []
  return [...queue].sort((left, right) => right.riskProbScaled - left.riskProbScaled || left.studentName.localeCompare(right.studentName))[0] ?? null
}

function findOffering(offerings: Offering[], item: DemoRealityLoopQueueItem | null) {
  if (!item) return null
  return offerings.find(offering => offering.offId === item.offeringId)
    ?? offerings.find(offering => offering.code === item.courseCode && (item.sectionCode == null || offering.section === item.sectionCode))
    ?? null
}

function fallbackSnapshot(item: DemoRealityLoopQueueItem | null): DemoRealityLoopSnapshot | null {
  if (!item) return null
  return {
    attendancePct: item.observedEvidence.attendancePct,
    riskBand: item.riskBand,
    riskProbScaled: item.riskProbScaled,
    queueState: item.reassessmentStatus ? 'watchlist' : null,
    reassessmentStatus: item.reassessmentStatus,
  }
}

function deterministicAttendanceTarget(currentPct: number | null) {
  if (currentPct == null) return 60
  return currentPct >= 65 ? Math.max(40, currentPct - 14) : Math.min(95, currentPct + 12)
}

function selectCurrentReassessmentId(card: ApiStudentAgentCard, item: DemoRealityLoopQueueItem) {
  const current = card.interventions?.currentReassessments ?? []
  const matching = current.find(reassessment => {
    const status = reassessment.status.toLowerCase()
    return status !== 'resolved' && (reassessment.courseCode === item.courseCode || reassessment.courseTitle === item.courseTitle)
  }) ?? current.find(reassessment => reassessment.status.toLowerCase() !== 'resolved') ?? current[0]
  return matching?.reassessmentEventId ?? null
}

export function DemoRealityLoopPanel({
  proofProfile,
  offerings,
  loadStudentRiskExplorer,
  loadStudentAgentCard,
  onCommitAttendanceEdit,
  onRecomputeProofRunRisk,
  onResolveReassessment,
  onAdvanceProofRun,
}: DemoRealityLoopPanelProps) {
  const proofOperations = proofProfile?.proofOperations ?? null
  const checkpoint = proofOperations?.selectedCheckpoint ?? null
  const activeRun = proofOperations?.activeRunContexts?.[0] ?? null
  const simulationRunId = checkpoint?.simulationRunId ?? activeRun?.simulationRunId ?? proofOperations?.scopeDescriptor?.simulationRunId ?? null
  const queueItem = useMemo(() => selectDemoQueueItem(proofProfile), [proofProfile])
  const offering = useMemo(() => findOffering(offerings, queueItem), [offerings, queueItem])
  const [beforeSnapshot, setBeforeSnapshot] = useState<DemoRealityLoopSnapshot | null>(fallbackSnapshot(queueItem))
  const [afterSnapshot, setAfterSnapshot] = useState<DemoRealityLoopSnapshot | null>(null)
  const [nextStageSnapshot, setNextStageSnapshot] = useState<DemoRealityLoopSnapshot | null>(null)
  const [state, setState] = useState<DemoRealityLoopRunState>('idle')
  const [message, setMessage] = useState('')

  const currentSnapshot = afterSnapshot ?? beforeSnapshot ?? fallbackSnapshot(queueItem)
  const nextAttendancePct = deterministicAttendanceTarget(currentSnapshot?.attendancePct ?? null)

  const loadSnapshot = async () => {
    if (!queueItem || !loadStudentRiskExplorer) return fallbackSnapshot(queueItem)
    const explorer = await loadStudentRiskExplorer(queueItem.studentId)
    return buildDemoRealityLoopSnapshot(explorer) ?? fallbackSnapshot(queueItem)
  }

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setState('busy')
    setMessage('')
    try {
      await action()
      setState('complete')
      setMessage(successMessage)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Demo Reality Loop action failed.')
    }
  }

  const handleCaptureBefore = () => {
    void runAction(async () => {
      setBeforeSnapshot(await loadSnapshot())
    }, 'Before snapshot captured from the current proof surface.')
  }

  const handleAttendanceEdit = () => {
    void runAction(async () => {
      if (!queueItem || !offering || !onCommitAttendanceEdit) throw new Error('Attendance edit is unavailable for this proof student.')
      await onCommitAttendanceEdit(offering.offId, queueItem.studentId, nextAttendancePct)
      setAfterSnapshot({ ...(currentSnapshot ?? fallbackSnapshot(queueItem)!), attendancePct: nextAttendancePct })
    }, 'Demo attendance edit submitted through the academic attendance route.')
  }

  const handleRecompute = () => {
    void runAction(async () => {
      if (!simulationRunId || !onRecomputeProofRunRisk) throw new Error('Proof recompute is unavailable until a demo run is active.')
      await onRecomputeProofRunRisk(simulationRunId, { refreshWorkspace: false })
      const snapshot = await loadSnapshot()
      setAfterSnapshot(snapshot)
    }, 'Observed-only proof risk recomputed for the active local demo run.')
  }

  const handleResolve = () => {
    void runAction(async () => {
      if (!queueItem || !onResolveReassessment || !loadStudentAgentCard) throw new Error('No open intervention is available for this student/stage.')
      const card = await loadStudentAgentCard(queueItem.studentId)
      const reassessmentId = selectCurrentReassessmentId(card, queueItem)
      if (!reassessmentId) throw new Error('No open intervention is available for this student/stage.')
      await onResolveReassessment(reassessmentId, { refreshWorkspace: false })
      setAfterSnapshot(buildDemoRealityLoopSnapshot(card) ?? currentSnapshot)
    }, 'Intervention resolution recorded for the guided demo queue item.')
  }

  const handleNextStage = () => {
    void runAction(async () => {
      if (!simulationRunId || !onAdvanceProofRun) throw new Error('Next-stage advance is unavailable until a demo run is active.')
      await onAdvanceProofRun(simulationRunId, 'stage', { refreshWorkspace: false })
      const snapshot = await loadSnapshot()
      setNextStageSnapshot(snapshot)
    }, 'Next stage loaded for plausibility validation.')
  }

  const loadAgentCard = () => {
    void runAction(async () => {
      if (!queueItem || !loadStudentAgentCard) throw new Error('Student shell card is unavailable for this proof student.')
      const card = await loadStudentAgentCard(queueItem.studentId)
      setAfterSnapshot(buildDemoRealityLoopSnapshot(card) ?? currentSnapshot)
    }, 'Student shell proof card refreshed.')
  }

  if (!simulationRunId || !checkpoint) {
    return (
      <Card data-proof-surface="demo-reality-loop" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 16, color: T.text }}>Demo Reality Loop</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Start/provision a demo run first.</div>
      </Card>
    )
  }

  if (!queueItem) {
    return (
      <Card data-proof-surface="demo-reality-loop" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 16, color: T.text }}>Demo Reality Loop</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>No proof watchlist student is available at this checkpoint.</div>
      </Card>
    )
  }

  return (
    <Card data-proof-surface="demo-reality-loop" glow={T.accent} style={{ padding: '18px 22px', marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontWeight: 800, fontSize: 17, color: T.text }}>Demo Reality Loop</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 5 }}>Guided local synthetic MSRUAS demo: evidence edit -&gt; recompute -&gt; risk/queue delta -&gt; intervention -&gt; next-stage validation.</div>
        </div>
        <Chip color={T.accent}>Local synthetic proof</Chip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ background: T.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Student</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Demo student: {queueItem.studentName}</div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>{queueItem.usn}</div>
        </div>
        <div style={{ background: T.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Stage</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Sem {checkpoint.semesterNumber} · {checkpoint.stageLabel}</div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>{checkpoint.stageDescription}</div>
        </div>
        <div style={{ background: T.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Course</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{queueItem.courseCode}</div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>{queueItem.courseTitle} · Sec {queueItem.sectionCode ?? offering?.section ?? '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
        <div style={{ background: T.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Attendance</div>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.warning }}>{currentSnapshot?.attendancePct ?? '—'}%</div>
        </div>
        <div style={{ background: T.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Risk</div>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.danger }}>{currentSnapshot?.riskProbScaled ?? queueItem.riskProbScaled}%</div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>{currentSnapshot?.riskBand ?? queueItem.riskBand}</div>
        </div>
        <div style={{ background: T.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Queue</div>
          <div style={{ ...sora, fontWeight: 800, fontSize: 18, color: T.accent }}>{currentSnapshot?.reassessmentStatus ?? queueItem.reassessmentStatus ?? 'No case'}</div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>{queueItem.recommendedAction}</div>
        </div>
      </div>

      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 12 }}>Future TT2, quiz, assignment, and SEE evidence remains hidden until the proof checkpoint allows it. This is a deterministic simulated-world response to changed observed evidence and model rules.</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Btn size="sm" dataProofAction="demo-loop-capture-before" onClick={handleCaptureBefore}>Capture before snapshot</Btn>
        <Btn size="sm" dataProofAction="demo-loop-apply-attendance-edit" onClick={handleAttendanceEdit}>Apply attendance edit to {nextAttendancePct}%</Btn>
        <Btn size="sm" dataProofAction="demo-loop-recompute-risk" onClick={handleRecompute}>Recompute risk</Btn>
        <Btn size="sm" dataProofAction="demo-loop-resolve-intervention" onClick={handleResolve}>Resolve intervention</Btn>
        <Btn size="sm" dataProofAction="demo-loop-next-stage" onClick={handleNextStage}>Advance next stage</Btn>
        <Btn size="sm" dataProofAction="demo-loop-load-next-stage" onClick={loadAgentCard}>Refresh proof card</Btn>
      </div>

      <div data-proof-section="demo-loop-delta" style={{ marginTop: 14, background: T.surface2, borderRadius: 10, padding: 12 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Before/after delta</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Attendance: {formatDemoDelta(beforeSnapshot?.attendancePct ?? null, afterSnapshot?.attendancePct ?? null, '%')}</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Risk: {formatDemoDelta(beforeSnapshot?.riskProbScaled ?? null, afterSnapshot?.riskProbScaled ?? null, '%')}</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Queue: {(beforeSnapshot?.reassessmentStatus ?? 'No case')} -&gt; {(afterSnapshot?.reassessmentStatus ?? 'Pending refresh')}</div>
      </div>

      <div data-proof-section="demo-loop-next-stage-validation" style={{ marginTop: 10, background: T.surface2, borderRadius: 10, padding: 12 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Next-stage validation</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{nextStageSnapshot ? `Next checkpoint risk is ${nextStageSnapshot.riskProbScaled ?? 'not recorded'}%.` : 'Advance one stage to compare the next simulated checkpoint against this snapshot.'}</div>
      </div>

      {message ? <div role={state === 'error' ? 'alert' : 'status'} style={{ ...mono, fontSize: 11, color: state === 'error' ? T.danger : T.success, marginTop: 10 }}>{message}</div> : null}
    </Card>
  )
}
