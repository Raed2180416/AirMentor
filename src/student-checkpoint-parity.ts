import type {
  ApiAcademicHodProofStudentWatch,
  ApiStudentAgentCard,
  ApiStudentRiskExplorer,
  ApiFacultyProofOperations,
} from './api/types'

export type StudentCheckpointCoreMetrics = {
  riskBand: string | null
  riskProbScaled: number | null
  riskChangeFromPreviousCheckpointScaled: number | null | undefined
  evidence: {
    attendancePct: number
    tt1Pct: number
    tt2Pct: number
    quizPct: number
    assignmentPct: number
    seePct: number
    weakCoCount: number
    weakQuestionCount: number
  }
}

export function coreMetricsFromStudentCard(card: ApiStudentAgentCard): StudentCheckpointCoreMetrics {
  return {
    riskBand: card.overview.currentStatus.riskBand,
    riskProbScaled: card.overview.currentStatus.riskProbScaled,
    riskChangeFromPreviousCheckpointScaled: card.overview.currentStatus.riskChangeFromPreviousCheckpointScaled,
    evidence: {
      attendancePct: card.overview.currentEvidence.attendancePct,
      tt1Pct: card.overview.currentEvidence.tt1Pct,
      tt2Pct: card.overview.currentEvidence.tt2Pct,
      quizPct: card.overview.currentEvidence.quizPct,
      assignmentPct: card.overview.currentEvidence.assignmentPct,
      seePct: card.overview.currentEvidence.seePct,
      weakCoCount: card.overview.currentEvidence.weakCoCount,
      weakQuestionCount: card.overview.currentEvidence.weakQuestionCount,
    },
  }
}

export function coreMetricsFromRiskExplorer(explorer: ApiStudentRiskExplorer): StudentCheckpointCoreMetrics {
  return {
    riskBand: explorer.currentStatus.riskBand,
    riskProbScaled: explorer.currentStatus.riskProbScaled,
    riskChangeFromPreviousCheckpointScaled: explorer.currentStatus.riskChangeFromPreviousCheckpointScaled,
    evidence: {
      attendancePct: explorer.currentEvidence.attendancePct,
      tt1Pct: explorer.currentEvidence.tt1Pct,
      tt2Pct: explorer.currentEvidence.tt2Pct,
      quizPct: explorer.currentEvidence.quizPct,
      assignmentPct: explorer.currentEvidence.assignmentPct,
      seePct: explorer.currentEvidence.seePct,
      weakCoCount: explorer.currentEvidence.weakCoCount,
      weakQuestionCount: explorer.currentEvidence.weakQuestionCount,
    },
  }
}

export function coreMetricsFromHodStudentWatch(student: ApiAcademicHodProofStudentWatch): StudentCheckpointCoreMetrics {
  return {
    riskBand: student.currentRiskBand,
    riskProbScaled: student.currentRiskProbScaled,
    riskChangeFromPreviousCheckpointScaled: student.riskChangeFromPreviousCheckpointScaled,
    evidence: {
      attendancePct: student.observedEvidence.attendancePct,
      tt1Pct: student.observedEvidence.tt1Pct,
      tt2Pct: student.observedEvidence.tt2Pct,
      quizPct: student.observedEvidence.quizPct,
      assignmentPct: student.observedEvidence.assignmentPct,
      seePct: student.observedEvidence.seePct,
      weakCoCount: student.observedEvidence.weakCoCount,
      weakQuestionCount: student.observedEvidence.weakQuestionCount,
    },
  }
}

export function coreMetricsFromFacultyQueueItem(
  item: ApiFacultyProofOperations['monitoringQueue'][number],
): StudentCheckpointCoreMetrics {
  return {
    riskBand: item.riskBand,
    riskProbScaled: item.riskProbScaled,
    riskChangeFromPreviousCheckpointScaled: item.riskChangeFromPreviousCheckpointScaled,
    evidence: {
      attendancePct: item.observedEvidence.attendancePct,
      tt1Pct: item.observedEvidence.tt1Pct,
      tt2Pct: item.observedEvidence.tt2Pct,
      quizPct: item.observedEvidence.quizPct,
      assignmentPct: item.observedEvidence.assignmentPct,
      seePct: item.observedEvidence.seePct,
      weakCoCount: item.observedEvidence.weakCoCount,
      weakQuestionCount: item.observedEvidence.weakQuestionCount,
    },
  }
}
