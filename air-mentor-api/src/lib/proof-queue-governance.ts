export const PROOF_QUEUE_DEFAULT_ACTIONABLE_RATE_LIMIT = 0.3
export const PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT = 0.35
export const PROOF_QUEUE_SECTION_EXCESS_TOLERANCE = 0.1
export const PROOF_QUEUE_WATCH_RATE_LIMIT = 0.45
export const PROOF_QUEUE_ACTIONABLE_PPV_PROXY_MINIMUM = 0.55
export const PROOF_QUEUE_ACTIONABLE_LIFT_THRESHOLD = 5
export const PROOF_QUEUE_HIGH_RISK_LIFT_THRESHOLD = 2

export type ProofQueueGovernanceStageKey =
  | 'semester-start'
  | 'post-tt1'
  | 'post-reassessment'
  | 'post-tt2'
  | 'post-see'
  | 'semester-close'

export type ProofQueueBand = 'High' | 'Medium' | 'Low'
export type ProofQueueRole = 'Course Leader' | 'Mentor' | 'HoD'

export type ProofQueueCandidate = {
  caseKey: string
  sourceKey: string
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
}

export type ProofQueuePriorCaseState = {
  open: boolean
  primarySourceKey: string | null
}

export type ProofQueueCaseDecision = {
  caseKey: string
  studentId: string
  semesterNumber: number
  sectionCode: string
  stageKey: ProofQueueGovernanceStageKey
  status: 'opened' | 'open' | 'watch' | 'resolved' | 'idle'
  primarySourceKey: string | null
  supportingSourceKeys: string[]
  countsTowardCapacity: boolean
  priorityRank: number | null
  governanceReason: string
  assignedRole: ProofQueueRole | null
  assignedFacultyId: string | null
  recommendedAction: string | null
}

type RankedCaseCandidate = {
  caseKey: string
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
  return stageKey === 'post-see' || stageKey === 'semester-close'
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
  if (candidate.stageKey === 'semester-start') {
    return {
      openEligible: false,
      watchEligible: false,
      reason: 'semester_start_observation_only',
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
  countsTowardCapacity: boolean
  priorityRank: number | null
  governanceReason: string
}) {
  const candidate = input.candidate
  return {
    caseKey: candidate?.caseKey ?? input.priorCaseState?.primarySourceKey ?? 'unknown',
    studentId: candidate?.studentId ?? '',
    semesterNumber: candidate?.semesterNumber ?? 0,
    sectionCode: candidate?.sectionCode ?? '',
    stageKey: candidate?.stageKey ?? 'semester-start',
    status: input.status,
    primarySourceKey: candidate?.primaryCandidate.sourceKey ?? input.priorCaseState?.primarySourceKey ?? null,
    supportingSourceKeys: input.status === 'watch'
      ? candidate?.watchSupportingSourceKeys ?? []
      : candidate?.supportingSourceKeys ?? [],
    countsTowardCapacity: input.countsTowardCapacity,
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
    openCandidates: ProofQueueCandidate[]
    watchCandidates: ProofQueueCandidate[]
    allCandidates: ProofQueueCandidate[]
  }>()

  input.candidates.forEach(candidate => {
    const eligibility = candidateEligibility(candidate)
    const group = candidateGroups.get(candidate.caseKey) ?? {
      openCandidates: [],
      watchCandidates: [],
      allCandidates: [],
    }
    if (eligibility.openEligible) group.openCandidates.push(candidate)
    if (eligibility.watchEligible) group.watchCandidates.push(candidate)
    group.allCandidates.push(candidate)
    candidateGroups.set(candidate.caseKey, group)
  })

  const openCaseCandidates: RankedCaseCandidate[] = []
  const watchCaseCandidates = new Map<string, RankedCaseCandidate>()

  candidateGroups.forEach((group, caseKey) => {
    const rankedOpen = group.openCandidates
      .slice()
      .sort((left, right) => compareLexicographic(buildCandidateRankVector(left), buildCandidateRankVector(right))
        || left.sourceKey.localeCompare(right.sourceKey))
    const rankedWatch = (group.watchCandidates.length > 0 ? group.watchCandidates : group.allCandidates)
      .slice()
      .sort((left, right) => compareLexicographic(buildCandidateRankVector(left), buildCandidateRankVector(right))
        || left.sourceKey.localeCompare(right.sourceKey))
    const primaryOpen = rankedOpen[0] ?? null
    const primaryWatch = rankedWatch[0] ?? null
    if (primaryOpen) {
      openCaseCandidates.push({
        caseKey,
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
        deterministicKey: `${primaryOpen.studentId}::${primaryOpen.semesterNumber}::${primaryOpen.courseCode}`,
      })
    }
    if (primaryWatch) {
      watchCaseCandidates.set(caseKey, {
        caseKey,
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
        deterministicKey: `${primaryWatch.studentId}::${primaryWatch.semesterNumber}::${primaryWatch.courseCode}`,
      })
    }
  })

  const sectionUsageByKey = new Map<string, number>()
  const facultyUsageByKey = new Map<string, number>()
  const admittedCaseKeys = new Set<string>()
  const decisions = new Map<string, ProofQueueCaseDecision>()

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
      const priorCaseState = priorCaseStateByKey.get(candidate.caseKey) ?? null
      decisions.set(candidate.caseKey, createCaseDecision({
        candidate,
        status: priorCaseState?.open ? 'open' : 'opened',
        priorCaseState,
        countsTowardCapacity: true,
        priorityRank: index + 1,
        governanceReason: 'admitted_under_section_and_faculty_caps',
      }))
    })

  candidateGroups.forEach((group, caseKey) => {
    if (admittedCaseKeys.has(caseKey)) return
    const priorCaseState = priorCaseStateByKey.get(caseKey) ?? null
    const watchCandidate = watchCaseCandidates.get(caseKey) ?? null
    if (watchCandidate) {
      const governanceReason = input.stageKey === 'semester-start'
        ? 'semester_start_watch_only'
        : openCaseCandidates.some(candidate => candidate.caseKey === caseKey)
          ? 'open_candidate_pruned_by_caps'
          : 'watch_only_after_governance'
      decisions.set(caseKey, createCaseDecision({
        candidate: watchCandidate,
        status: priorCaseState?.open && input.stageKey === 'semester-close' ? 'resolved' : 'watch',
        priorCaseState,
        countsTowardCapacity: false,
        priorityRank: null,
        governanceReason,
      }))
      return
    }
    if (priorCaseState?.open) {
      decisions.set(caseKey, {
        caseKey,
        studentId: '',
        semesterNumber: 0,
        sectionCode: '',
        stageKey: input.stageKey,
        status: 'resolved',
        primarySourceKey: priorCaseState.primarySourceKey,
        supportingSourceKeys: [],
        countsTowardCapacity: false,
        priorityRank: null,
        governanceReason: 'no_longer_actionable',
        assignedRole: null,
        assignedFacultyId: null,
        recommendedAction: null,
      })
    }
  })

  return {
    decisions,
    sectionUsageByKey,
    facultyUsageByKey,
  }
}
