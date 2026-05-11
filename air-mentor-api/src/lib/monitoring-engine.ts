export type MonitoringDecisionInput = {
  riskProb: number
  riskBand: 'High' | 'Medium' | 'Low'
  previousRiskBand?: 'High' | 'Medium' | 'Low' | null
  cooldownUntil?: string | null
  evidenceWindowCount?: number
  interventionResidual?: number | null
  manualConcernCreated?: boolean
  manualInterventionCount?: number | null
  concernFamily?: string | null
  offeringId?: string | null
  currentOwnerRole?: 'Course Leader' | 'Mentor' | null
  nowIso: string
}

export type MonitoringDecision = {
  decisionType: 'alert' | 'watch' | 'suppress'
  queueOwnerRole: 'Course Leader' | 'Mentor'
  reassessmentDueAt: string | null
  cooldownUntil: string | null
  workflowTaskAction: 'create' | 'reassign' | 'monitor' | 'close' | 'none'
  ownershipChanged: boolean
  manualInterventionCount: number
  manualConcernCountsAsIntervention: boolean
  oversightOwnerRole: 'HoD'
  concernFamily: string | null
  offeringId: string | null
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
  const manualConcernCreated = input.manualConcernCreated === true
  const manualInterventionCount = Math.max(0, input.manualInterventionCount ?? 0) + (manualConcernCreated ? 1 : 0)
  const queueOwnerRole: MonitoringDecision['queueOwnerRole'] = input.riskBand === 'High' ? 'Mentor' : 'Course Leader'
  const ownershipChanged = !!input.currentOwnerRole && input.currentOwnerRole !== queueOwnerRole
  if (input.cooldownUntil && input.cooldownUntil > now) {
    return {
      decisionType: 'suppress',
      queueOwnerRole,
      reassessmentDueAt: input.cooldownUntil,
      cooldownUntil: input.cooldownUntil,
      workflowTaskAction: ownershipChanged ? 'reassign' : 'monitor',
      ownershipChanged,
      manualInterventionCount,
      manualConcernCountsAsIntervention: manualConcernCreated,
      oversightOwnerRole: 'HoD',
      concernFamily: input.concernFamily ?? null,
      offeringId: input.offeringId ?? null,
      note: 'Alert suppressed because the evidence window is still inside the active cooldown.',
    }
  }

  if (input.riskBand === 'High') {
    return {
      decisionType: 'alert',
      queueOwnerRole,
      reassessmentDueAt: addDays(now, 3),
      cooldownUntil: addDays(now, 7),
      workflowTaskAction: ownershipChanged
        ? 'reassign'
        : input.previousRiskBand === 'High'
          ? 'monitor'
          : 'create',
      ownershipChanged,
      manualInterventionCount,
      manualConcernCountsAsIntervention: manualConcernCreated,
      oversightOwnerRole: 'HoD',
      concernFamily: input.concernFamily ?? null,
      offeringId: input.offeringId ?? null,
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
      : manualConcernCreated || manualInterventionCount > 0
        ? 'Medium-risk evidence plus manual teacher concern or prior interventions require a scheduled watchlist reassessment.'
      : interventionResidual != null && interventionResidual < -0.03
        ? 'Medium-risk evidence and weak recovery after support require a scheduled watchlist reassessment.'
        : 'Medium-risk evidence warrants a scheduled watchlist reassessment without immediate escalation.'
    return {
      decisionType: 'watch',
      queueOwnerRole,
      reassessmentDueAt: addDays(now, 7),
      cooldownUntil: addDays(now, 10),
      workflowTaskAction: ownershipChanged
        ? 'reassign'
        : input.previousRiskBand === 'Medium'
          ? 'monitor'
          : 'create',
      ownershipChanged,
      manualInterventionCount,
      manualConcernCountsAsIntervention: manualConcernCreated,
      oversightOwnerRole: 'HoD',
      concernFamily: input.concernFamily ?? null,
      offeringId: input.offeringId ?? null,
      note,
    }
  }

  return {
    decisionType: 'suppress',
    queueOwnerRole,
    reassessmentDueAt: addDays(now, 14),
    cooldownUntil: addDays(now, 14),
    workflowTaskAction: 'close',
    ownershipChanged,
    manualInterventionCount,
    manualConcernCountsAsIntervention: manualConcernCreated,
    oversightOwnerRole: 'HoD',
    concernFamily: input.concernFamily ?? null,
    offeringId: input.offeringId ?? null,
    note: 'Low-risk evidence remains below the alert thresholds; continue routine monitoring only.',
  }
}
