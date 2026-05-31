import { type ResolvedPolicy } from '../modules/admin-structure.js'

export type PromotionStatus = 'promoted' | 'year-back' | 'detained'

export type PromotionDecision = {
  status: PromotionStatus
  reason: string
}

export function evaluateStudentProgression(input: {
  currentSemester: number
  cgpa: number
  activeBacklogs: number
  activeBacklogCredits: number
  consecutiveFailures: number
  policy: Pick<ResolvedPolicy, 'progressionRules' | 'yearBackRules'>
}): PromotionDecision {
  const p = input.policy.progressionRules
  const yb = input.policy.yearBackRules

  // Detention checked first as it overrides everything
  if (yb.enableYearBack && yb.detentionAfterConsecutiveFailures > 0 && input.consecutiveFailures >= yb.detentionAfterConsecutiveFailures) {
    return { status: 'detained', reason: `Detained due to ${input.consecutiveFailures} consecutive failures` }
  }

  // If year back is disabled, simply enforce promotion rules
  if (!yb.enableYearBack) {
    if (p.requireNoActiveBacklogs && input.activeBacklogs > 0) {
      return { status: 'year-back', reason: 'Active backlogs not allowed for promotion' }
    }
    if (input.cgpa < p.minimumCgpaForPromotion) {
      return { status: 'year-back', reason: `CGPA ${input.cgpa} is below minimum ${p.minimumCgpaForPromotion}` }
    }
    return { status: 'promoted', reason: 'Passed progression rules' }
  }

  // Enforce year-back rules if past the minimum semester trigger
  if (input.currentSemester >= yb.yearBackMinimumSemester) {
    if (!yb.allowPromotionWithBacklogs && input.activeBacklogs > 0) {
      return { status: 'year-back', reason: 'Promotion with backlogs is not allowed' }
    }

    if (yb.allowPromotionWithBacklogs) {
      if (yb.promotionBacklogCreditLimit > 0 && input.activeBacklogCredits > yb.promotionBacklogCreditLimit) {
        return { status: 'year-back', reason: `Active backlog credits (${input.activeBacklogCredits}) exceed promotion limit (${yb.promotionBacklogCreditLimit})` }
      }
      if (yb.yearBackTriggerCredits > 0 && input.activeBacklogCredits >= yb.yearBackTriggerCredits) {
        return { status: 'year-back', reason: `Active backlog credits (${input.activeBacklogCredits}) reached or exceeded trigger limit (${yb.yearBackTriggerCredits})` }
      }
      if (yb.yearBackTriggerFailedCourses > 0 && input.activeBacklogs >= yb.yearBackTriggerFailedCourses) {
        return { status: 'year-back', reason: `Failed courses (${input.activeBacklogs}) reached or exceeded trigger limit (${yb.yearBackTriggerFailedCourses})` }
      }
    }
  }

  if (input.cgpa < p.minimumCgpaForPromotion) {
    return { status: 'year-back', reason: `CGPA ${input.cgpa} is below minimum ${p.minimumCgpaForPromotion}` }
  }

  return { status: 'promoted', reason: 'Cleared all progression and year-back rules' }
}
