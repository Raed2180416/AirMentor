import { describe, expect, it } from 'vitest'
import type {
  ApiAcademicHodProofStudentWatch,
  ApiStudentAgentCard,
  ApiStudentRiskExplorer,
  ApiFacultyProofOperations,
} from '../src/api/types'
import {
  coreMetricsFromFacultyQueueItem,
  coreMetricsFromHodStudentWatch,
  coreMetricsFromRiskExplorer,
  coreMetricsFromStudentCard,
  type StudentCheckpointCoreMetrics,
} from '../src/student-checkpoint-parity'

// One canonical fixture — same student, same checkpoint window.
const CANONICAL: StudentCheckpointCoreMetrics = {
  riskBand: 'High',
  riskProbScaled: 78,
  riskChangeFromPreviousCheckpointScaled: 5,
  evidence: {
    attendancePct: 64,
    tt1Pct: 38,
    tt2Pct: 42,
    quizPct: 55,
    assignmentPct: 60,
    seePct: 47,
    weakCoCount: 3,
    weakQuestionCount: 5,
  },
}

const sharedCurrentEvidence = {
  attendancePct: CANONICAL.evidence.attendancePct,
  tt1Pct: CANONICAL.evidence.tt1Pct,
  tt2Pct: CANONICAL.evidence.tt2Pct,
  quizPct: CANONICAL.evidence.quizPct,
  assignmentPct: CANONICAL.evidence.assignmentPct,
  seePct: CANONICAL.evidence.seePct,
  weakCoCount: CANONICAL.evidence.weakCoCount,
  weakQuestionCount: CANONICAL.evidence.weakQuestionCount,
  interventionRecoveryStatus: null,
}

const sharedObservedEvidence = {
  ...sharedCurrentEvidence,
  cgpa: 7.1,
  backlogCount: 1,
}

const sharedCurrentStatus: ApiStudentAgentCard['overview']['currentStatus'] = {
  riskBand: CANONICAL.riskBand,
  riskProbScaled: CANONICAL.riskProbScaled,
  riskChangeFromPreviousCheckpointScaled: CANONICAL.riskChangeFromPreviousCheckpointScaled,
  reassessmentStatus: null,
  nextDueAt: null,
  recommendedAction: 'targeted-tutoring',
  queueState: 'open',
  simulatedActionTaken: null,
  attentionAreas: [],
}

describe('cross-surface parity contract: same student + same checkpoint → same core metrics', () => {
  it('P-PAR-01: student-shell card selector matches canonical fixture', () => {
    const card = {
      overview: {
        observedLabel: 'Observed' as const,
        policyLabel: 'Policy Derived' as const,
        currentEvidence: sharedCurrentEvidence,
        currentStatus: sharedCurrentStatus,
        semesterSummaries: [],
      },
    } as unknown as ApiStudentAgentCard

    expect(coreMetricsFromStudentCard(card)).toEqual(CANONICAL)
  })

  it('P-PAR-02: risk-explorer selector matches canonical fixture', () => {
    const explorer = {
      currentEvidence: sharedCurrentEvidence,
      currentStatus: sharedCurrentStatus,
    } as unknown as ApiStudentRiskExplorer

    expect(coreMetricsFromRiskExplorer(explorer)).toEqual(CANONICAL)
  })

  it('P-PAR-03: HoD student watch selector matches canonical fixture', () => {
    const hodStudent = {
      currentRiskBand: CANONICAL.riskBand,
      currentRiskProbScaled: CANONICAL.riskProbScaled,
      riskChangeFromPreviousCheckpointScaled: CANONICAL.riskChangeFromPreviousCheckpointScaled,
      observedEvidence: sharedObservedEvidence,
    } as unknown as ApiAcademicHodProofStudentWatch

    expect(coreMetricsFromHodStudentWatch(hodStudent)).toEqual(CANONICAL)
  })

  it('P-PAR-04: faculty monitoring-queue item selector matches canonical fixture', () => {
    const queueItem = {
      riskBand: CANONICAL.riskBand!,
      riskProbScaled: CANONICAL.riskProbScaled!,
      riskChangeFromPreviousCheckpointScaled: CANONICAL.riskChangeFromPreviousCheckpointScaled,
      observedEvidence: sharedObservedEvidence,
    } as unknown as ApiFacultyProofOperations['monitoringQueue'][number]

    expect(coreMetricsFromFacultyQueueItem(queueItem)).toEqual(CANONICAL)
  })

  it('P-PAR-05: all four selectors produce identical output for same underlying data', () => {
    const card = {
      overview: {
        observedLabel: 'Observed' as const,
        policyLabel: 'Policy Derived' as const,
        currentEvidence: sharedCurrentEvidence,
        currentStatus: sharedCurrentStatus,
        semesterSummaries: [],
      },
    } as unknown as ApiStudentAgentCard

    const explorer = {
      currentEvidence: sharedCurrentEvidence,
      currentStatus: sharedCurrentStatus,
    } as unknown as ApiStudentRiskExplorer

    const hodStudent = {
      currentRiskBand: CANONICAL.riskBand,
      currentRiskProbScaled: CANONICAL.riskProbScaled,
      riskChangeFromPreviousCheckpointScaled: CANONICAL.riskChangeFromPreviousCheckpointScaled,
      observedEvidence: sharedObservedEvidence,
    } as unknown as ApiAcademicHodProofStudentWatch

    const queueItem = {
      riskBand: CANONICAL.riskBand!,
      riskProbScaled: CANONICAL.riskProbScaled!,
      riskChangeFromPreviousCheckpointScaled: CANONICAL.riskChangeFromPreviousCheckpointScaled,
      observedEvidence: sharedObservedEvidence,
    } as unknown as ApiFacultyProofOperations['monitoringQueue'][number]

    const fromCard = coreMetricsFromStudentCard(card)
    const fromExplorer = coreMetricsFromRiskExplorer(explorer)
    const fromHod = coreMetricsFromHodStudentWatch(hodStudent)
    const fromFaculty = coreMetricsFromFacultyQueueItem(queueItem)

    expect(fromCard).toEqual(fromExplorer)
    expect(fromExplorer).toEqual(fromHod)
    expect(fromHod).toEqual(fromFaculty)
  })

  it('P-PAR-06: null risk band propagates identically across all selectors', () => {
    const nullStatus = { ...sharedCurrentStatus, riskBand: null, riskProbScaled: null, riskChangeFromPreviousCheckpointScaled: null }

    const card = {
      overview: {
        observedLabel: 'Observed' as const,
        policyLabel: 'Policy Derived' as const,
        currentEvidence: sharedCurrentEvidence,
        currentStatus: nullStatus,
        semesterSummaries: [],
      },
    } as unknown as ApiStudentAgentCard

    const explorer = {
      currentEvidence: sharedCurrentEvidence,
      currentStatus: nullStatus,
    } as unknown as ApiStudentRiskExplorer

    const fromCard = coreMetricsFromStudentCard(card)
    const fromExplorer = coreMetricsFromRiskExplorer(explorer)

    expect(fromCard.riskBand).toBeNull()
    expect(fromExplorer.riskBand).toBeNull()
    expect(fromCard.riskProbScaled).toBeNull()
    expect(fromExplorer.riskProbScaled).toBeNull()
    expect(fromCard).toEqual(fromExplorer)
  })
})
