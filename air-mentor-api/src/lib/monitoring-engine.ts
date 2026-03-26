export type MonitoringDecisionInput = {
  riskProb: number
  riskBand: 'High' | 'Medium' | 'Low'
  previousRiskBand?: 'High' | 'Medium' | 'Low' | null
  cooldownUntil?: string | null
  evidenceWindowCount?: number
  interventionResidual?: number | null
  nowIso: string
}

export type MonitoringDecision = {
  decisionType: 'alert' | 'watch' | 'suppress'
  queueOwnerRole: 'Course Leader' | 'Mentor' | 'HoD'
  reassessmentDueAt: string | null
  cooldownUntil: string | null
  note: string
}

function addDays(isoString: string, days: number) {
  const date = new Date(isoString)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function buildMonitoringDecision(input: MonitoringDecisionInput): MonitoringDecision {
  const now = new Date(input.nowIso).toISOString()
  const evidenceWindowCount = input.evidenceWindowCount ?? 1
  const interventionResidual = input.interventionResidual ?? null
  if (input.cooldownUntil && input.cooldownUntil > now) {
    return {
      decisionType: 'suppress',
      queueOwnerRole: 'Course Leader',
      reassessmentDueAt: input.cooldownUntil,
      cooldownUntil: input.cooldownUntil,
      note: 'Alert suppressed because the evidence window is still inside the active cooldown.',
    }
  }

  if (input.riskBand === 'High') {
    return {
      decisionType: 'alert',
      queueOwnerRole: 'Mentor',
      reassessmentDueAt: addDays(now, 3),
      cooldownUntil: addDays(now, 7),
      note: input.previousRiskBand === 'High'
        ? 'High-risk evidence persists across reassessment windows; keep the case active and escalate if no improvement appears.'
        : evidenceWindowCount >= 2
          ? 'High-risk evidence persists across multiple checkpoints; open a reassessment immediately.'
          : 'High-risk evidence crossed the alert threshold; open a mentor-led reassessment immediately.',
    }
  }

  if (input.riskBand === 'Medium') {
    const note = input.previousRiskBand === 'High'
      ? 'Risk eased from high to medium; keep the case on watch until another evidence window confirms recovery.'
      : interventionResidual != null && interventionResidual < -0.03
        ? 'Medium-risk evidence and weak recovery after support require a scheduled watchlist reassessment.'
        : 'Medium-risk evidence warrants a scheduled watchlist reassessment without immediate escalation.'
    return {
      decisionType: 'watch',
      queueOwnerRole: 'Course Leader',
      reassessmentDueAt: addDays(now, 7),
      cooldownUntil: addDays(now, 10),
      note,
    }
  }

  return {
    decisionType: 'suppress',
    queueOwnerRole: 'Course Leader',
    reassessmentDueAt: addDays(now, 14),
    cooldownUntil: addDays(now, 14),
    note: 'Low-risk evidence remains below the alert thresholds; continue routine monitoring only.',
  }
}
