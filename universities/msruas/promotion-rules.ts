import type { PromotionRules, RiskRules } from '../../kernel/policy/index.js'

export function createMsruasPromotionRules(): PromotionRules {
  return {
    passMarkPercent: 40,
    minimumCgpaForPromotion: 5,
    requireNoActiveBacklogs: true,
  }
}

export function createMsruasRiskRules(): RiskRules {
  return {
    highRiskAttendancePercentBelow: 65,
    mediumRiskAttendancePercentBelow: 75,
    highRiskCgpaBelow: 6.5,
    mediumRiskCgpaBelow: 7.5,
    highRiskBacklogCount: 2,
    mediumRiskBacklogCount: 1,
  }
}
