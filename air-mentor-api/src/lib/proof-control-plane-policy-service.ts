import { parseJson } from './json.js'
import type { PolicyPhenotype } from './msruas-proof-control-plane.js'

const POLICY_PHENOTYPE_ORDER: PolicyPhenotype[] = [
  'late-semester-acute',
  'persistent-nonresponse',
  'prerequisite-dominant',
  'academic-weakness',
  'attendance-dominant',
  'diffuse-amber',
]

const POLICY_EFFICACY_SUPPORT_THRESHOLD = 250

type PolicyDiagnosticCheckpointRow = {
  simulationStageCheckpointId: string
  stageOrder: number
}

type PolicyDiagnosticStudentRow = {
  simulationRunId: string
  simulationStageCheckpointId: string
  studentId: string
  offeringId: string | null
  semesterNumber: number
  courseCode: string
  riskProbScaled: number
  riskBand: string
  noActionRiskProbScaled: number
  simulatedActionTaken: string | null
  projectionJson: string
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000
}

function riskBandRank(value: string | null | undefined) {
  switch (value) {
    case 'High':
      return 3
    case 'Medium':
      return 2
    case 'Low':
      return 1
    default:
      return 0
  }
}

export function buildPolicyDiagnostics(input: {
  checkpointRows: PolicyDiagnosticCheckpointRow[]
  studentRows: PolicyDiagnosticStudentRow[]
}) {
  if (input.studentRows.length === 0) return null
  const checkpointById = new Map(input.checkpointRows.map(row => [row.simulationStageCheckpointId, row]))
  const grouped = new Map<string, PolicyDiagnosticStudentRow[]>()
  input.studentRows.forEach(row => {
    const key = `${row.simulationRunId}::${row.studentId}::${row.offeringId ?? row.courseCode}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  })

  const counterfactualActionStats = new Map<string, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>()
  const counterfactualPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>()
  const counterfactualPhenotypeActionStats = new Map<PolicyPhenotype, Map<string, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>>()
  const realizedActionStats = new Map<string, {
    support: number
    nextCheckpointImprovementTotal: number
    nextCheckpointSupport: number
    semesterCloseImprovementTotal: number
    semesterCloseSupport: number
    stableRecoveryCount: number
    stableRecoverySupport: number
    relapseCount: number
    relapseSupport: number
  }>()
  const realizedPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    nextCheckpointImprovementTotal: number
    nextCheckpointSupport: number
    semesterCloseImprovementTotal: number
    semesterCloseSupport: number
    stableRecoveryCount: number
    stableRecoverySupport: number
    relapseCount: number
    relapseSupport: number
  }>()
  let totalRecommendedActionCount = 0
  let totalActionCount = 0

  grouped.forEach(rows => {
    const ordered = rows
      .slice()
      .sort((left, right) => {
        const leftCheckpoint = checkpointById.get(left.simulationStageCheckpointId)
        const rightCheckpoint = checkpointById.get(right.simulationStageCheckpointId)
        return (left.semesterNumber - right.semesterNumber)
          || ((leftCheckpoint?.stageOrder ?? 0) - (rightCheckpoint?.stageOrder ?? 0))
      })
    ordered.forEach((row, index) => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      const actionPath = (payload.actionPath ?? {}) as Record<string, unknown>
      const counterfactualPolicyDiagnostics = (payload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>
      const actionPolicyComparison = (actionPath.policyComparison ?? {}) as Record<string, unknown>
      const candidates = parseJson(JSON.stringify(actionPolicyComparison.candidates ?? []), [] as Array<{
        action: string
        utility: number
      }>)
      const recommendedAction = typeof counterfactualPolicyDiagnostics.recommendedAction === 'string'
        ? counterfactualPolicyDiagnostics.recommendedAction
        : typeof actionPolicyComparison.recommendedAction === 'string'
          ? actionPolicyComparison.recommendedAction
          : null
      const policyPhenotype = (
        typeof counterfactualPolicyDiagnostics.policyPhenotype === 'string'
          ? counterfactualPolicyDiagnostics.policyPhenotype
          : typeof actionPolicyComparison.policyPhenotype === 'string'
            ? actionPolicyComparison.policyPhenotype
            : 'diffuse-amber'
      ) as PolicyPhenotype
      const simulatedActionTaken = typeof actionPath.simulatedActionTaken === 'string'
        ? actionPath.simulatedActionTaken
        : typeof counterfactualPolicyDiagnostics.simulatedActionTaken === 'string'
          ? counterfactualPolicyDiagnostics.simulatedActionTaken
          : null
      const counterfactualLiftScaled = Number(
        counterfactualPolicyDiagnostics.counterfactualLiftScaled
        ?? payload.counterfactualLiftScaled
        ?? row.noActionRiskProbScaled - row.riskProbScaled,
      )

      if (recommendedAction) {
        totalRecommendedActionCount += 1
        const stats = counterfactualActionStats.get(recommendedAction) ?? {
          support: 0,
          regretTotal: 0,
          counterfactualLiftTotal: 0,
        }
        stats.support += 1
        stats.counterfactualLiftTotal += counterfactualLiftScaled
        const selectedUtility = candidates.find(candidate => candidate.action === recommendedAction)?.utility ?? 0
        const bestUtility = candidates[0]?.utility ?? selectedUtility
        stats.regretTotal += Math.max(0, bestUtility - selectedUtility)
        counterfactualActionStats.set(recommendedAction, stats)

        const phenotypeStats = counterfactualPhenotypeStats.get(policyPhenotype) ?? {
          support: 0,
          regretTotal: 0,
          counterfactualLiftTotal: 0,
        }
        phenotypeStats.support += 1
        phenotypeStats.regretTotal += Math.max(0, bestUtility - selectedUtility)
        phenotypeStats.counterfactualLiftTotal += counterfactualLiftScaled
        counterfactualPhenotypeStats.set(policyPhenotype, phenotypeStats)

        const phenotypeActionStats = counterfactualPhenotypeActionStats.get(policyPhenotype) ?? new Map<string, {
          support: number
          regretTotal: number
          counterfactualLiftTotal: number
        }>()
        const actionStats = phenotypeActionStats.get(recommendedAction) ?? {
          support: 0,
          regretTotal: 0,
          counterfactualLiftTotal: 0,
        }
        actionStats.support += 1
        actionStats.regretTotal += Math.max(0, bestUtility - selectedUtility)
        actionStats.counterfactualLiftTotal += counterfactualLiftScaled
        phenotypeActionStats.set(recommendedAction, actionStats)
        counterfactualPhenotypeActionStats.set(policyPhenotype, phenotypeActionStats)
      }

      if (!simulatedActionTaken) return

      totalActionCount += 1
      const realized = realizedActionStats.get(simulatedActionTaken) ?? {
        support: 0,
        nextCheckpointImprovementTotal: 0,
        nextCheckpointSupport: 0,
        semesterCloseImprovementTotal: 0,
        semesterCloseSupport: 0,
        stableRecoveryCount: 0,
        stableRecoverySupport: 0,
        relapseCount: 0,
        relapseSupport: 0,
      }
      realized.support += 1

      const nextRow = ordered[index + 1] ?? null
      if (nextRow) {
        const nextImprovement = row.riskProbScaled - nextRow.riskProbScaled
        realized.nextCheckpointImprovementTotal += nextImprovement
        realized.nextCheckpointSupport += 1
        const recovered = nextRow.riskProbScaled <= (row.riskProbScaled - 8)
          || riskBandRank(nextRow.riskBand) < riskBandRank(row.riskBand)
        realized.stableRecoverySupport += 1
        if (recovered) realized.stableRecoveryCount += 1
        const laterRows = ordered.slice(index + 2).filter(candidate => candidate.semesterNumber === row.semesterNumber)
        const relapsed = recovered && laterRows.some(candidate => (
          candidate.riskProbScaled >= (nextRow.riskProbScaled + 6)
          || riskBandRank(candidate.riskBand) > riskBandRank(nextRow.riskBand)
        ))
        realized.relapseSupport += 1
        if (relapsed) realized.relapseCount += 1
      }

      const semesterCloseRow = ordered
        .slice(index)
        .reverse()
        .find(candidate => candidate.semesterNumber === row.semesterNumber)
      if (semesterCloseRow) {
        realized.semesterCloseImprovementTotal += row.riskProbScaled - semesterCloseRow.riskProbScaled
        realized.semesterCloseSupport += 1
      }

      realizedActionStats.set(simulatedActionTaken, realized)
      const nextCheckpointImprovement = nextRow ? row.riskProbScaled - nextRow.riskProbScaled : null
      const stableRecovered = nextRow
        ? nextRow.riskProbScaled <= (row.riskProbScaled - 8) || riskBandRank(nextRow.riskBand) < riskBandRank(row.riskBand)
        : false
      const relapsedAfterRecovery = nextRow
        ? stableRecovered && ordered.slice(index + 2).filter(candidate => candidate.semesterNumber === row.semesterNumber).some(candidate => (
          candidate.riskProbScaled >= (nextRow.riskProbScaled + 6)
          || riskBandRank(candidate.riskBand) > riskBandRank(nextRow.riskBand)
        ))
        : false
      const semesterCloseImprovement = semesterCloseRow ? row.riskProbScaled - semesterCloseRow.riskProbScaled : null
      const realizedPhenotype = realizedPhenotypeStats.get(policyPhenotype) ?? {
        support: 0,
        nextCheckpointImprovementTotal: 0,
        nextCheckpointSupport: 0,
        semesterCloseImprovementTotal: 0,
        semesterCloseSupport: 0,
        stableRecoveryCount: 0,
        stableRecoverySupport: 0,
        relapseCount: 0,
        relapseSupport: 0,
      }
      realizedPhenotype.support += 1
      if (nextCheckpointImprovement != null) {
        realizedPhenotype.nextCheckpointImprovementTotal += nextCheckpointImprovement
        realizedPhenotype.nextCheckpointSupport += 1
        realizedPhenotype.stableRecoverySupport += 1
        if (stableRecovered) realizedPhenotype.stableRecoveryCount += 1
        realizedPhenotype.relapseSupport += 1
        if (relapsedAfterRecovery) realizedPhenotype.relapseCount += 1
      }
      if (semesterCloseImprovement != null) {
        realizedPhenotype.semesterCloseImprovementTotal += semesterCloseImprovement
        realizedPhenotype.semesterCloseSupport += 1
      }
      realizedPhenotypeStats.set(policyPhenotype, realizedPhenotype)
    })
  })

  const counterfactualByAction = Object.fromEntries([...counterfactualActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
    }]))

  const counterfactualByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = counterfactualPhenotypeStats.get(phenotype) ?? {
      support: 0,
      regretTotal: 0,
      counterfactualLiftTotal: 0,
    }
    const actionStats = counterfactualPhenotypeActionStats.get(phenotype) ?? new Map<string, {
      support: number
      regretTotal: number
      counterfactualLiftTotal: number
    }>()
    return [phenotype, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
      byAction: Object.fromEntries([...actionStats.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([action, actionStat]) => [action, {
          support: actionStat.support,
          counterfactualLiftTotal: roundToTwo(actionStat.counterfactualLiftTotal),
          regretTotal: roundToFour(actionStat.regretTotal),
          averageCounterfactualLiftScaled: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) : 0,
          averageRegret: actionStat.support > 0 ? roundToFour(actionStat.regretTotal / actionStat.support) : 0,
          beatsNoActionOnAverage: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) >= 0 : true,
          teacherFacingEfficacyAllowed: actionStat.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
        }])),
    }]
  }))

  const realizedByAction = Object.fromEntries([...realizedActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]))

  const realizedByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = realizedPhenotypeStats.get(phenotype) ?? {
      support: 0,
      nextCheckpointImprovementTotal: 0,
      nextCheckpointSupport: 0,
      semesterCloseImprovementTotal: 0,
      semesterCloseSupport: 0,
      stableRecoveryCount: 0,
      stableRecoverySupport: 0,
      relapseCount: 0,
      relapseSupport: 0,
    }
    return [phenotype, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]
  }))

  const structuredStudyPlan = counterfactualActionStats.get('structured-study-plan')
  const academicWeaknessActionStats = counterfactualPhenotypeActionStats.get('academic-weakness') ?? new Map<string, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>()
  const academicWeaknessTargetedTutoring = academicWeaknessActionStats.get('targeted-tutoring')
  const academicWeaknessStructuredStudyPlan = academicWeaknessActionStats.get('structured-study-plan')

  const noRecommendedActionUnderperformsNoAction = [...counterfactualActionStats.values()]
    .every(stats => stats.support === 0 || roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0)
  const academicWeaknessTargetedTutoringLift = academicWeaknessTargetedTutoring?.support
    ? roundToTwo(academicWeaknessTargetedTutoring.counterfactualLiftTotal / academicWeaknessTargetedTutoring.support)
    : null
  const academicWeaknessStructuredStudyPlanLift = academicWeaknessStructuredStudyPlan?.support
    ? roundToTwo(academicWeaknessStructuredStudyPlan.counterfactualLiftTotal / academicWeaknessStructuredStudyPlan.support)
    : null

  const acceptanceGates = {
    structuredStudyPlanWithinLimit: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount) < 0.5
      : true,
    targetedTutoringBeatsStructuredStudyPlanAcademicSlice: (academicWeaknessTargetedTutoring?.support ?? 0) > 0
      ? (academicWeaknessTargetedTutoringLift ?? Number.NEGATIVE_INFINITY)
        > (academicWeaknessStructuredStudyPlanLift ?? Number.NEGATIVE_INFINITY)
      : false,
    noRecommendedActionUnderperformsNoAction,
  }

  return {
    recommendedActionCount: totalRecommendedActionCount,
    simulatedActionCount: totalActionCount,
    structuredStudyPlanShare: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount)
      : 0,
    acceptanceGates,
    counterfactualPolicyDiagnostics: {
      metricNote: 'Counterfactual lift is measured at the same checkpoint against the stored no-action replay. Positive values always mean the recommended action beat no-action. Teacher-facing efficacy claims are suppressed below the replay support threshold.',
      efficacySupportThreshold: POLICY_EFFICACY_SUPPORT_THRESHOLD,
      targetedTutoringVsStructuredStudyPlanAcademicSlice: {
        phenotype: 'academic-weakness',
        targetedTutoringSupport: academicWeaknessTargetedTutoring?.support ?? 0,
        targetedTutoringAverageCounterfactualLiftScaled: academicWeaknessTargetedTutoringLift ?? 0,
        structuredStudyPlanSupport: academicWeaknessStructuredStudyPlan?.support ?? 0,
        structuredStudyPlanAverageCounterfactualLiftScaled: academicWeaknessStructuredStudyPlanLift ?? 0,
      },
      acceptanceGates,
      byAction: counterfactualByAction,
      byPhenotype: counterfactualByPhenotype,
    },
    realizedPathDiagnostics: {
      metricNote: 'Realized-path improvements compare the current checkpoint to later checkpoints on the carried simulated action path. Positive values mean risk fell later. For pre-see-rescue, semester-close improvement is the primary realized outcome; stable recovery is not the primary acceptance target.',
      byAction: realizedByAction,
      byPhenotype: realizedByPhenotype,
    },
    byAction: counterfactualByAction,
    byPhenotype: counterfactualByPhenotype,
  }
}

export function mergePolicyDiagnostics(
  summaries: Array<ReturnType<typeof buildPolicyDiagnostics> | null | undefined>,
) {
  const valid = summaries.filter((summary): summary is NonNullable<ReturnType<typeof buildPolicyDiagnostics>> => !!summary)
  if (valid.length === 0) return null

  const counterfactualActionStats = new Map<string, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>()
  const counterfactualPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>()
  const counterfactualPhenotypeActionStats = new Map<PolicyPhenotype, Map<string, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>>()
  const realizedActionStats = new Map<string, {
    support: number
    nextCheckpointSupport: number
    nextCheckpointImprovementTotal: number
    semesterCloseSupport: number
    semesterCloseImprovementTotal: number
    stableRecoverySupport: number
    stableRecoveryCount: number
    relapseSupport: number
    relapseCount: number
  }>()
  const realizedPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    nextCheckpointSupport: number
    nextCheckpointImprovementTotal: number
    semesterCloseSupport: number
    semesterCloseImprovementTotal: number
    stableRecoverySupport: number
    stableRecoveryCount: number
    relapseSupport: number
    relapseCount: number
  }>()
  let totalRecommendedActionCount = 0
  let totalActionCount = 0

  valid.forEach(summary => {
    totalRecommendedActionCount += Number(summary.recommendedActionCount ?? 0)
    totalActionCount += Number(summary.simulatedActionCount ?? 0)

    Object.entries((summary.counterfactualPolicyDiagnostics?.byAction ?? {}) as Record<string, Record<string, unknown>>).forEach(([action, raw]) => {
      const stats = counterfactualActionStats.get(action) ?? {
        support: 0,
        counterfactualLiftTotal: 0,
        regretTotal: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.counterfactualLiftTotal += Number(raw.counterfactualLiftTotal ?? 0)
      stats.regretTotal += Number(raw.regretTotal ?? 0)
      counterfactualActionStats.set(action, stats)
    })

    Object.entries((summary.counterfactualPolicyDiagnostics?.byPhenotype ?? {}) as Record<string, Record<string, unknown>>).forEach(([phenotypeKey, raw]) => {
      const phenotype = phenotypeKey as PolicyPhenotype
      const stats = counterfactualPhenotypeStats.get(phenotype) ?? {
        support: 0,
        counterfactualLiftTotal: 0,
        regretTotal: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.counterfactualLiftTotal += Number(raw.counterfactualLiftTotal ?? 0)
      stats.regretTotal += Number(raw.regretTotal ?? 0)
      counterfactualPhenotypeStats.set(phenotype, stats)
      const actionStats = counterfactualPhenotypeActionStats.get(phenotype) ?? new Map<string, {
        support: number
        counterfactualLiftTotal: number
        regretTotal: number
      }>()
      Object.entries((raw.byAction ?? {}) as Record<string, Record<string, unknown>>).forEach(([action, actionRaw]) => {
        const current = actionStats.get(action) ?? {
          support: 0,
          counterfactualLiftTotal: 0,
          regretTotal: 0,
        }
        current.support += Number(actionRaw.support ?? 0)
        current.counterfactualLiftTotal += Number(actionRaw.counterfactualLiftTotal ?? 0)
        current.regretTotal += Number(actionRaw.regretTotal ?? 0)
        actionStats.set(action, current)
      })
      counterfactualPhenotypeActionStats.set(phenotype, actionStats)
    })

    Object.entries((summary.realizedPathDiagnostics?.byAction ?? {}) as Record<string, Record<string, unknown>>).forEach(([action, raw]) => {
      const stats = realizedActionStats.get(action) ?? {
        support: 0,
        nextCheckpointSupport: 0,
        nextCheckpointImprovementTotal: 0,
        semesterCloseSupport: 0,
        semesterCloseImprovementTotal: 0,
        stableRecoverySupport: 0,
        stableRecoveryCount: 0,
        relapseSupport: 0,
        relapseCount: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.nextCheckpointSupport += Number(raw.nextCheckpointSupport ?? 0)
      stats.nextCheckpointImprovementTotal += Number(raw.nextCheckpointImprovementTotal ?? 0)
      stats.semesterCloseSupport += Number(raw.semesterCloseSupport ?? 0)
      stats.semesterCloseImprovementTotal += Number(raw.semesterCloseImprovementTotal ?? 0)
      stats.stableRecoverySupport += Number(raw.stableRecoverySupport ?? 0)
      stats.stableRecoveryCount += Number(raw.stableRecoveryCount ?? 0)
      stats.relapseSupport += Number(raw.relapseSupport ?? 0)
      stats.relapseCount += Number(raw.relapseCount ?? 0)
      realizedActionStats.set(action, stats)
    })

    Object.entries((summary.realizedPathDiagnostics?.byPhenotype ?? {}) as Record<string, Record<string, unknown>>).forEach(([phenotypeKey, raw]) => {
      const phenotype = phenotypeKey as PolicyPhenotype
      const stats = realizedPhenotypeStats.get(phenotype) ?? {
        support: 0,
        nextCheckpointSupport: 0,
        nextCheckpointImprovementTotal: 0,
        semesterCloseSupport: 0,
        semesterCloseImprovementTotal: 0,
        stableRecoverySupport: 0,
        stableRecoveryCount: 0,
        relapseSupport: 0,
        relapseCount: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.nextCheckpointSupport += Number(raw.nextCheckpointSupport ?? 0)
      stats.nextCheckpointImprovementTotal += Number(raw.nextCheckpointImprovementTotal ?? 0)
      stats.semesterCloseSupport += Number(raw.semesterCloseSupport ?? 0)
      stats.semesterCloseImprovementTotal += Number(raw.semesterCloseImprovementTotal ?? 0)
      stats.stableRecoverySupport += Number(raw.stableRecoverySupport ?? 0)
      stats.stableRecoveryCount += Number(raw.stableRecoveryCount ?? 0)
      stats.relapseSupport += Number(raw.relapseSupport ?? 0)
      stats.relapseCount += Number(raw.relapseCount ?? 0)
      realizedPhenotypeStats.set(phenotype, stats)
    })
  })

  const counterfactualByAction = Object.fromEntries([...counterfactualActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
    }]))

  const counterfactualByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = counterfactualPhenotypeStats.get(phenotype) ?? {
      support: 0,
      counterfactualLiftTotal: 0,
      regretTotal: 0,
    }
    const actionStats = counterfactualPhenotypeActionStats.get(phenotype) ?? new Map<string, {
      support: number
      counterfactualLiftTotal: number
      regretTotal: number
    }>()
    return [phenotype, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
      byAction: Object.fromEntries([...actionStats.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([action, actionStat]) => [action, {
          support: actionStat.support,
          counterfactualLiftTotal: roundToTwo(actionStat.counterfactualLiftTotal),
          regretTotal: roundToFour(actionStat.regretTotal),
          averageCounterfactualLiftScaled: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) : 0,
          averageRegret: actionStat.support > 0 ? roundToFour(actionStat.regretTotal / actionStat.support) : 0,
          beatsNoActionOnAverage: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) >= 0 : true,
          teacherFacingEfficacyAllowed: actionStat.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
        }])),
    }]
  }))

  const realizedByAction = Object.fromEntries([...realizedActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]))

  const realizedByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = realizedPhenotypeStats.get(phenotype) ?? {
      support: 0,
      nextCheckpointSupport: 0,
      nextCheckpointImprovementTotal: 0,
      semesterCloseSupport: 0,
      semesterCloseImprovementTotal: 0,
      stableRecoverySupport: 0,
      stableRecoveryCount: 0,
      relapseSupport: 0,
      relapseCount: 0,
    }
    return [phenotype, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]
  }))

  const structuredStudyPlan = counterfactualActionStats.get('structured-study-plan')
  const academicWeaknessActionStats = counterfactualPhenotypeActionStats.get('academic-weakness') ?? new Map<string, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>()
  const academicWeaknessTargetedTutoring = academicWeaknessActionStats.get('targeted-tutoring')
  const academicWeaknessStructuredStudyPlan = academicWeaknessActionStats.get('structured-study-plan')
  const academicWeaknessTargetedTutoringLift = academicWeaknessTargetedTutoring?.support
    ? roundToTwo(academicWeaknessTargetedTutoring.counterfactualLiftTotal / academicWeaknessTargetedTutoring.support)
    : null
  const academicWeaknessStructuredStudyPlanLift = academicWeaknessStructuredStudyPlan?.support
    ? roundToTwo(academicWeaknessStructuredStudyPlan.counterfactualLiftTotal / academicWeaknessStructuredStudyPlan.support)
    : null

  const acceptanceGates = {
    structuredStudyPlanWithinLimit: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount) < 0.5
      : true,
    targetedTutoringBeatsStructuredStudyPlanAcademicSlice: (academicWeaknessTargetedTutoring?.support ?? 0) > 0
      ? (academicWeaknessTargetedTutoringLift ?? Number.NEGATIVE_INFINITY)
        > (academicWeaknessStructuredStudyPlanLift ?? Number.NEGATIVE_INFINITY)
      : false,
    noRecommendedActionUnderperformsNoAction: [...counterfactualActionStats.values()]
      .every(stats => stats.support === 0 || roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0),
  }

  return {
    recommendedActionCount: totalRecommendedActionCount,
    simulatedActionCount: totalActionCount,
    structuredStudyPlanShare: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount)
      : 0,
    acceptanceGates,
    counterfactualPolicyDiagnostics: {
      metricNote: 'Counterfactual lift is measured at the same checkpoint against the stored no-action replay. Positive values always mean the recommended action beat no-action. Teacher-facing efficacy claims are suppressed below the replay support threshold.',
      efficacySupportThreshold: POLICY_EFFICACY_SUPPORT_THRESHOLD,
      targetedTutoringVsStructuredStudyPlanAcademicSlice: {
        phenotype: 'academic-weakness',
        targetedTutoringSupport: academicWeaknessTargetedTutoring?.support ?? 0,
        targetedTutoringAverageCounterfactualLiftScaled: academicWeaknessTargetedTutoringLift ?? 0,
        structuredStudyPlanSupport: academicWeaknessStructuredStudyPlan?.support ?? 0,
        structuredStudyPlanAverageCounterfactualLiftScaled: academicWeaknessStructuredStudyPlanLift ?? 0,
      },
      acceptanceGates,
      byAction: counterfactualByAction,
      byPhenotype: counterfactualByPhenotype,
    },
    realizedPathDiagnostics: {
      metricNote: 'Realized-path improvements compare the current checkpoint to later checkpoints on the carried simulated action path. Positive values mean risk fell later. For pre-see-rescue, semester-close improvement is the primary realized outcome; stable recovery is not the primary acceptance target.',
      byAction: realizedByAction,
      byPhenotype: realizedByPhenotype,
    },
    byAction: counterfactualByAction,
    byPhenotype: counterfactualByPhenotype,
  }
}
