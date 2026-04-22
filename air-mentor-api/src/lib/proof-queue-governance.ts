export const PROOF_QUEUE_DEFAULT_ACTIONABLE_RATE_LIMIT = 0.3
export const PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT = 0.35
export const PROOF_QUEUE_SECTION_EXCESS_TOLERANCE = 0.1
export const PROOF_QUEUE_WATCH_RATE_LIMIT = 0.45
export const PROOF_QUEUE_ACTIONABLE_PPV_PROXY_MINIMUM = 0.55
export const PROOF_QUEUE_ACTIONABLE_LIFT_THRESHOLD = 5
export const PROOF_QUEUE_HIGH_RISK_LIFT_THRESHOLD = 2

export type ProofQueueGovernanceStageKey =
  | 'pre-tt1'
  | 'post-tt1'
  | 'post-tt2'
  | 'post-assignments'
  | 'post-see'

export type ProofQueueBand = 'High' | 'Medium' | 'Low'
export type ProofQueueRole = 'Course Leader' | 'Mentor' | 'HoD'
export type ProofQueueConcernFamily = string
export type ProofQueueCanonicalStatus = 'opened' | 'open' | 'watch' | 'dismissed' | 'resolved' | 'reopened' | 'idle'
export type ProofQueueWorkflowTaskAction = 'create' | 'reassign' | 'monitor' | 'close' | 'none'

export type ProofQueueCandidate = {
  caseKey: string
  sourceKey: string
  concernContextKey?: string | null
  concernFamily?: ProofQueueConcernFamily | null
  studentId: string
  semesterNumber: number
  sectionCode: string
  stageKey: ProofQueueGovernanceStageKey
  offeringId: string | null
  courseCode: string
  courseTitle: string
  riskBand: ProofQueueBand
  riskProbScaled: number
  noActionRiskProbScaled: number
  riskChangeFromPreviousCheckpointScaled: number
  counterfactualLiftScaled: number
  policyPhenotype: string
  recommendedAction: string | null
  utilityDelta: number
  nextCheckpointBenefitScaled: number
  capacityCost: number
  assignedRole: ProofQueueRole
  assignedFacultyId: string | null
  facultyBudgetKey: string | null
  manualInterventionCount?: number | null
}

export type ProofQueuePriorCaseState = {
  open: boolean
  primarySourceKey: string | null
  caseId?: string | null
  concernContextKey?: string | null
  concernFamily?: ProofQueueConcernFamily | null
  canonicalStatus?: Exclude<ProofQueueCanonicalStatus, 'opened' | 'idle'> | null
  assignedRole?: ProofQueueRole | null
}

export type ProofQueueCaseDecision = {
  caseKey: string
  legacyCaseKey: string
  concernContextKey: string
  concernFamily: ProofQueueConcernFamily
  caseId: string
  reopenedFromCaseId: string | null
  studentId: string
  semesterNumber: number
  sectionCode: string
  stageKey: ProofQueueGovernanceStageKey
  status: 'opened' | 'open' | 'watch' | 'resolved' | 'idle'
  canonicalStatus: ProofQueueCanonicalStatus
  primarySourceKey: string | null
  supportingSourceKeys: string[]
  primaryCase: boolean
  workflowTaskAction: ProofQueueWorkflowTaskAction
  manualInterventionCount: number
  ownershipChanged: boolean
  countsTowardCapacity: boolean
  priorityRank: number | null
  governanceReason: string
  assignedRole: ProofQueueRole | null
  assignedFacultyId: string | null
  recommendedAction: string | null
}

type RankedCaseCandidate = {
  caseKey: string
  legacyCaseKey: string
  concernContextKey: string
  concernFamily: ProofQueueConcernFamily
  studentId: string
  semesterNumber: number
  sectionCode: string
  stageKey: ProofQueueGovernanceStageKey
  primaryCandidate: ProofQueueCandidate
  supportingSourceKeys: string[]
  watchSupportingSourceKeys: string[]
  assignedRole: ProofQueueRole | null
  assignedFacultyId: string | null
  recommendedAction: string | null
  rankVector: [number, number, number, number, number, number]
  deterministicKey: string
}

export function proofQueueActionableRateLimitForStage(stageKey: ProofQueueGovernanceStageKey | string) {
  return stageKey === 'post-see'
    ? PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT
    : PROOF_QUEUE_DEFAULT_ACTIONABLE_RATE_LIMIT
}

export const PROOF_QUEUE_GOVERNANCE_THRESHOLDS = {
  defaultActionableOpenRateLimit: PROOF_QUEUE_DEFAULT_ACTIONABLE_RATE_LIMIT,
  lateStageActionableOpenRateLimit: PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT,
  sectionExcessTolerance: PROOF_QUEUE_SECTION_EXCESS_TOLERANCE,
  watchRateLimit: PROOF_QUEUE_WATCH_RATE_LIMIT,
  actionableQueuePpvProxyMinimum: PROOF_QUEUE_ACTIONABLE_PPV_PROXY_MINIMUM,
  actionableLiftThreshold: PROOF_QUEUE_ACTIONABLE_LIFT_THRESHOLD,
  highRiskLiftThreshold: PROOF_QUEUE_HIGH_RISK_LIFT_THRESHOLD,
} as const

function riskBandWeight(riskBand: ProofQueueBand) {
  if (riskBand === 'High') return 2
  if (riskBand === 'Medium') return 1
  return 0
}

function compareLexicographic(left: [number, number, number, number, number, number], right: [number, number, number, number, number, number]) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue
    return right[index]! - left[index]!
  }
  return 0
}

function compareRankedCases(left: RankedCaseCandidate, right: RankedCaseCandidate) {
  return compareLexicographic(left.rankVector, right.rankVector)
    || left.deterministicKey.localeCompare(right.deterministicKey)
}

function fallbackConcernFamily(candidate: ProofQueueCandidate) {
  return candidate.concernFamily
    ?? candidate.policyPhenotype
    ?? (candidate.offeringId ? 'course-offering-risk' : 'student-semester-risk')
}

function concernContextKeyForCandidate(candidate: ProofQueueCandidate) {
  if (candidate.concernContextKey) return candidate.concernContextKey
  return [
    candidate.studentId,
    candidate.semesterNumber,
    candidate.offeringId ?? candidate.sectionCode,
    candidate.courseCode,
    fallbackConcernFamily(candidate),
  ].join('::')
}

function caseIdForDecision(input: {
  concernContextKey: string
  primarySourceKey: string | null
  priorCaseState: ProofQueuePriorCaseState | null
  canonicalStatus: ProofQueueCanonicalStatus
}) {
  if ((input.canonicalStatus === 'open' || input.canonicalStatus === 'watch') && input.priorCaseState?.open && input.priorCaseState.caseId) {
    return input.priorCaseState.caseId
  }
  const caseToken = input.primarySourceKey ?? input.concernContextKey
  return `proof_case::${caseToken}`
}

export function proofQueueCountsTowardCapacity(status: ProofQueueCanonicalStatus) {
  return status === 'opened' || status === 'open' || status === 'reopened'
}

function canonicalStatusPriority(status: ProofQueueCanonicalStatus) {
  switch (status) {
    case 'reopened':
      return 5
    case 'opened':
      return 4
    case 'open':
      return 3
    case 'watch':
      return 2
    case 'dismissed':
      return 1
    case 'resolved':
      return 1
    default:
      return 0
  }
}

function resolvePriorCaseState(
  priorCaseStateByKey: Map<string, ProofQueuePriorCaseState>,
  concernContextKey: string,
  legacyCaseKey: string,
) {
  return priorCaseStateByKey.get(concernContextKey)
    ?? priorCaseStateByKey.get(legacyCaseKey)
    ?? null
}

function buildCandidateRankVector(candidate: ProofQueueCandidate) {
  const bandWeight = riskBandWeight(candidate.riskBand)
  if (candidate.stageKey === 'post-tt1') {
    return [
      bandWeight,
      candidate.utilityDelta,
      candidate.nextCheckpointBenefitScaled,
      candidate.riskProbScaled,
      candidate.noActionRiskProbScaled,
      -candidate.capacityCost,
    ] as [number, number, number, number, number, number]
  }
  return [
    bandWeight,
    candidate.counterfactualLiftScaled,
    candidate.riskProbScaled,
    candidate.utilityDelta,
    candidate.riskChangeFromPreviousCheckpointScaled,
    -candidate.capacityCost,
  ] as [number, number, number, number, number, number]
}

function candidateEligibility(candidate: ProofQueueCandidate) {
  if (!candidate.recommendedAction || candidate.riskBand === 'Low') {
    return {
      openEligible: false,
      watchEligible: false,
      reason: 'no_action_or_low_risk',
    }
  }
  if (candidate.stageKey === 'pre-tt1') {
    return {
      openEligible: false,
      watchEligible: false,
      reason: 'pre_tt1_observation_only',
    }
  }
  if (candidate.stageKey === 'post-tt1') {
    if (candidate.riskBand === 'Medium' && candidate.policyPhenotype === 'diffuse-amber') {
      return {
        openEligible: false,
        watchEligible: true,
        reason: 'diffuse_amber_watch_only',
      }
    }
    return {
      openEligible: true,
      watchEligible: true,
      reason: 'post_tt1_proxy_utility',
    }
  }
  if (candidate.riskBand === 'High' && candidate.counterfactualLiftScaled >= PROOF_QUEUE_HIGH_RISK_LIFT_THRESHOLD) {
    return {
      openEligible: true,
      watchEligible: true,
      reason: 'high_risk_lift_gate_passed',
    }
  }
  if (
    candidate.riskBand === 'Medium'
    && candidate.policyPhenotype !== 'diffuse-amber'
    && candidate.counterfactualLiftScaled >= PROOF_QUEUE_ACTIONABLE_LIFT_THRESHOLD
  ) {
    return {
      openEligible: true,
      watchEligible: true,
      reason: 'medium_risk_lift_gate_passed',
    }
  }
  return {
    openEligible: false,
    watchEligible: true,
    reason: candidate.policyPhenotype === 'diffuse-amber'
      ? 'diffuse_amber_watch_only'
      : 'insufficient_counterfactual_lift',
  }
}

function createCaseDecision(input: {
  candidate: RankedCaseCandidate | null
  status: ProofQueueCaseDecision['status']
  priorCaseState: ProofQueuePriorCaseState | null
  priorityRank: number | null
  governanceReason: string
}) {
  const candidate = input.candidate
  const legacyCaseKey = candidate?.legacyCaseKey
    ?? input.priorCaseState?.concernContextKey
    ?? input.priorCaseState?.primarySourceKey
    ?? 'unknown'
  const concernContextKey = candidate?.concernContextKey
    ?? input.priorCaseState?.concernContextKey
    ?? legacyCaseKey
  const concernFamily = candidate?.concernFamily
    ?? input.priorCaseState?.concernFamily
    ?? 'student-semester-risk'
  const priorCaseState = input.priorCaseState
  const canonicalStatus: ProofQueueCanonicalStatus = input.status === 'resolved'
    ? 'dismissed'
    : input.status === 'watch'
      ? 'watch'
      : input.status === 'opened'
        ? (!priorCaseState?.open && (priorCaseState?.canonicalStatus === 'dismissed' || priorCaseState?.canonicalStatus === 'resolved')
            ? 'reopened'
            : 'opened')
        : input.status === 'open'
          ? 'open'
          : 'idle'
  const ownershipChanged = !!candidate?.assignedRole
    && !!priorCaseState?.assignedRole
    && candidate.assignedRole !== priorCaseState.assignedRole
  const workflowTaskAction: ProofQueueWorkflowTaskAction = canonicalStatus === 'dismissed'
    ? 'close'
    : canonicalStatus === 'watch'
      ? (ownershipChanged ? 'reassign' : 'monitor')
      : canonicalStatus === 'opened' || canonicalStatus === 'reopened'
        ? (ownershipChanged ? 'reassign' : 'create')
        : canonicalStatus === 'open'
          ? (ownershipChanged ? 'reassign' : 'monitor')
          : 'none'
  const caseId = caseIdForDecision({
    concernContextKey,
    primarySourceKey: candidate?.primaryCandidate.sourceKey ?? priorCaseState?.primarySourceKey ?? null,
    priorCaseState,
    canonicalStatus,
  })
  return {
    caseKey: concernContextKey,
    legacyCaseKey,
    concernContextKey,
    concernFamily,
    caseId,
    reopenedFromCaseId: canonicalStatus === 'reopened' ? (priorCaseState?.caseId ?? null) : null,
    studentId: candidate?.studentId ?? '',
    semesterNumber: candidate?.semesterNumber ?? 0,
    sectionCode: candidate?.sectionCode ?? '',
    stageKey: candidate?.stageKey ?? 'pre-tt1',
    status: input.status,
    canonicalStatus,
    primarySourceKey: candidate?.primaryCandidate.sourceKey ?? input.priorCaseState?.primarySourceKey ?? null,
    supportingSourceKeys: input.status === 'watch'
      ? candidate?.watchSupportingSourceKeys ?? []
      : candidate?.supportingSourceKeys ?? [],
    primaryCase: true,
    workflowTaskAction,
    manualInterventionCount: candidate?.primaryCandidate.manualInterventionCount ?? 0,
    ownershipChanged,
    countsTowardCapacity: proofQueueCountsTowardCapacity(canonicalStatus),
    priorityRank: input.priorityRank,
    governanceReason: input.governanceReason,
    assignedRole: candidate?.assignedRole ?? null,
    assignedFacultyId: candidate?.assignedFacultyId ?? null,
    recommendedAction: candidate?.recommendedAction ?? null,
  } satisfies ProofQueueCaseDecision
}

export function governProofQueueStage(input: {
  stageKey: ProofQueueGovernanceStageKey
  candidates: ProofQueueCandidate[]
  priorCaseStateByKey?: Map<string, ProofQueuePriorCaseState>
  sectionStudentCountByKey: Map<string, number>
  facultyBudgetByKey: Map<string, number>
}) {
  const priorCaseStateByKey = input.priorCaseStateByKey ?? new Map<string, ProofQueuePriorCaseState>()
  const candidateGroups = new Map<string, {
    legacyCaseKey: string
    concernFamily: ProofQueueConcernFamily
    openCandidates: ProofQueueCandidate[]
    watchCandidates: ProofQueueCandidate[]
    allCandidates: ProofQueueCandidate[]
  }>()

  input.candidates.forEach(candidate => {
    const eligibility = candidateEligibility(candidate)
    const concernContextKey = concernContextKeyForCandidate(candidate)
    const group = candidateGroups.get(concernContextKey) ?? {
      legacyCaseKey: candidate.caseKey,
      concernFamily: fallbackConcernFamily(candidate),
      openCandidates: [],
      watchCandidates: [],
      allCandidates: [],
    }
    if (eligibility.openEligible) group.openCandidates.push(candidate)
    if (eligibility.watchEligible) group.watchCandidates.push(candidate)
    group.allCandidates.push(candidate)
    candidateGroups.set(concernContextKey, group)
  })

  const openCaseCandidates: RankedCaseCandidate[] = []
  const watchCaseCandidates = new Map<string, RankedCaseCandidate>()

  candidateGroups.forEach((group, concernContextKey) => {
    const rankedOpen = group.openCandidates
      .slice()
      .sort((left, right) => compareLexicographic(buildCandidateRankVector(left), buildCandidateRankVector(right))
        || left.sourceKey.localeCompare(right.sourceKey))
    const rankedWatch = group.watchCandidates
      .slice()
      .sort((left, right) => compareLexicographic(buildCandidateRankVector(left), buildCandidateRankVector(right))
        || left.sourceKey.localeCompare(right.sourceKey))
    const primaryOpen = rankedOpen[0] ?? null
    const primaryWatch = rankedWatch[0] ?? null
    if (primaryOpen) {
      openCaseCandidates.push({
        caseKey: concernContextKey,
        legacyCaseKey: group.legacyCaseKey,
        concernContextKey,
        concernFamily: group.concernFamily,
        studentId: primaryOpen.studentId,
        semesterNumber: primaryOpen.semesterNumber,
        sectionCode: primaryOpen.sectionCode,
        stageKey: primaryOpen.stageKey,
        primaryCandidate: primaryOpen,
        supportingSourceKeys: rankedOpen.slice(1).map(item => item.sourceKey),
        watchSupportingSourceKeys: rankedWatch.slice(1).map(item => item.sourceKey),
        assignedRole: primaryOpen.assignedRole,
        assignedFacultyId: primaryOpen.assignedFacultyId,
        recommendedAction: primaryOpen.recommendedAction,
        rankVector: buildCandidateRankVector(primaryOpen),
        deterministicKey: `${concernContextKey}::${primaryOpen.sourceKey}`,
      })
    }
    if (primaryWatch) {
      watchCaseCandidates.set(concernContextKey, {
        caseKey: concernContextKey,
        legacyCaseKey: group.legacyCaseKey,
        concernContextKey,
        concernFamily: group.concernFamily,
        studentId: primaryWatch.studentId,
        semesterNumber: primaryWatch.semesterNumber,
        sectionCode: primaryWatch.sectionCode,
        stageKey: primaryWatch.stageKey,
        primaryCandidate: primaryWatch,
        supportingSourceKeys: rankedOpen.slice(1).map(item => item.sourceKey),
        watchSupportingSourceKeys: rankedWatch.slice(1).map(item => item.sourceKey),
        assignedRole: primaryWatch.assignedRole,
        assignedFacultyId: primaryWatch.assignedFacultyId,
        recommendedAction: primaryWatch.recommendedAction,
        rankVector: buildCandidateRankVector(primaryWatch),
        deterministicKey: `${concernContextKey}::${primaryWatch.sourceKey}`,
      })
    }
  })

  const sectionUsageByKey = new Map<string, number>()
  const facultyUsageByKey = new Map<string, number>()
  const admittedCaseKeys = new Set<string>()
  const decisionsByConcernContextKey = new Map<string, ProofQueueCaseDecision>()
  const decisionContextKeysByLegacyCaseKey = new Map<string, string[]>()

  openCaseCandidates
    .sort(compareRankedCases)
    .forEach((candidate, index) => {
      const sectionKey = `${candidate.semesterNumber}::${candidate.sectionCode}`
      const sectionStudentCount = input.sectionStudentCountByKey.get(sectionKey) ?? 0
      const sectionLimit = Math.floor(sectionStudentCount * proofQueueActionableRateLimitForStage(candidate.stageKey))
      const currentSectionUsage = sectionUsageByKey.get(sectionKey) ?? 0
      const facultyKey = candidate.primaryCandidate.facultyBudgetKey
      const facultyBudget = facultyKey ? input.facultyBudgetByKey.get(facultyKey) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
      const currentFacultyUsage = facultyKey ? (facultyUsageByKey.get(facultyKey) ?? 0) : 0
      if (currentSectionUsage >= sectionLimit) return
      if (currentFacultyUsage >= facultyBudget) return
      admittedCaseKeys.add(candidate.caseKey)
      sectionUsageByKey.set(sectionKey, currentSectionUsage + 1)
      if (facultyKey) facultyUsageByKey.set(facultyKey, currentFacultyUsage + 1)
      const priorCaseState = resolvePriorCaseState(priorCaseStateByKey, candidate.concernContextKey, candidate.legacyCaseKey)
      decisionsByConcernContextKey.set(candidate.concernContextKey, createCaseDecision({
        candidate,
        status: priorCaseState?.open ? 'open' : 'opened',
        priorCaseState,
        priorityRank: index + 1,
        governanceReason: 'admitted_under_section_and_faculty_caps',
      }))
    })

  candidateGroups.forEach((group, concernContextKey) => {
    if (admittedCaseKeys.has(concernContextKey)) return
    const priorCaseState = resolvePriorCaseState(priorCaseStateByKey, concernContextKey, group.legacyCaseKey)
    const watchCandidate = watchCaseCandidates.get(concernContextKey) ?? null
    if (watchCandidate) {
      const governanceReason = input.stageKey === 'pre-tt1'
        ? 'pre_tt1_watch_only'
        : openCaseCandidates.some(candidate => candidate.caseKey === concernContextKey)
          ? 'open_candidate_pruned_by_caps'
          : 'watch_only_after_governance'
      decisionsByConcernContextKey.set(concernContextKey, createCaseDecision({
        candidate: watchCandidate,
        status: priorCaseState?.open && input.stageKey === 'post-see' ? 'resolved' : 'watch',
        priorCaseState,
        priorityRank: null,
        governanceReason,
      }))
      return
    }
    if (priorCaseState?.open) {
      decisionsByConcernContextKey.set(concernContextKey, {
        caseKey: concernContextKey,
        legacyCaseKey: group.legacyCaseKey,
        concernContextKey,
        concernFamily: priorCaseState.concernFamily ?? group.concernFamily,
        caseId: priorCaseState.caseId ?? caseIdForDecision({
          concernContextKey,
          primarySourceKey: priorCaseState.primarySourceKey,
          priorCaseState,
          canonicalStatus: 'dismissed',
        }),
        reopenedFromCaseId: null,
        studentId: '',
        semesterNumber: 0,
        sectionCode: '',
        stageKey: input.stageKey,
        status: 'resolved',
        canonicalStatus: 'dismissed',
        primarySourceKey: priorCaseState.primarySourceKey,
        supportingSourceKeys: [],
        primaryCase: true,
        workflowTaskAction: 'close',
        manualInterventionCount: 0,
        ownershipChanged: false,
        countsTowardCapacity: false,
        priorityRank: null,
        governanceReason: 'no_longer_actionable',
        assignedRole: null,
        assignedFacultyId: null,
        recommendedAction: null,
      })
    }
  })

  const decisions = new Map<string, ProofQueueCaseDecision>()
  const legacyDecisionPriority = (decision: ProofQueueCaseDecision) => ([
    Number(decision.countsTowardCapacity),
    canonicalStatusPriority(decision.canonicalStatus),
    -(decision.priorityRank ?? Number.POSITIVE_INFINITY),
  ] as const)
  decisionsByConcernContextKey.forEach(decision => {
    const current = decisionContextKeysByLegacyCaseKey.get(decision.legacyCaseKey) ?? []
    current.push(decision.concernContextKey)
    decisionContextKeysByLegacyCaseKey.set(decision.legacyCaseKey, current)
    const existing = decisions.get(decision.legacyCaseKey)
    if (!existing) {
      decisions.set(decision.legacyCaseKey, decision)
      return
    }
    const left = legacyDecisionPriority(existing)
    const right = legacyDecisionPriority(decision)
    if (
      right[0] > left[0]
      || (right[0] === left[0] && right[1] > left[1])
      || (right[0] === left[0] && right[1] === left[1] && right[2] > left[2])
    ) {
      decisions.set(decision.legacyCaseKey, decision)
    }
  })

  return {
    decisions,
    decisionsByConcernContextKey,
    decisionContextKeysByLegacyCaseKey,
    sectionUsageByKey,
    facultyUsageByKey,
  }
}
