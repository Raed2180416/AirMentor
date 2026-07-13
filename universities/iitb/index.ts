import type { SgpaCgpaRules } from '../../kernel/grading/index.js'
import type { UniversityPlugin } from '../../kernel/policy/index.js'
import { createIitbAssessmentTemplate } from './assessment-template.js'
import { createIitbAttendanceRules, createIitbCondonationRules, createIitbEligibilityRules, createIitbPassRules } from './pass-rules.js'
import { createIitbGradingSystem } from './grading-system.js'

const IITB_SGPA_CGPA_RULES: SgpaCgpaRules = {
  includeFailedCredits: false,
  repeatedCoursePolicy: 'latest-attempt',
}

export const iitbPlugin: UniversityPlugin = {
  universityId: 'iitb',
  displayName: 'IIT Bombay (stub)',
  getGradingSystem: createIitbGradingSystem,
  getPassRules: createIitbPassRules,
  getPromotionRules: () => ({
    passMarkPercent: 50,
    minimumCgpaForPromotion: 5,
    requireNoActiveBacklogs: false,
  }),
  getAssessmentTemplate: createIitbAssessmentTemplate,
  getAttendanceRules: createIitbAttendanceRules,
  getCondonationRules: createIitbCondonationRules,
  getEligibilityRules: createIitbEligibilityRules,
  getSgpaCgpaRules: () => IITB_SGPA_CGPA_RULES,
  getRiskRules: () => ({
    highRiskAttendancePercentBelow: 70,
    mediumRiskAttendancePercentBelow: 80,
    highRiskCgpaBelow: 6.5,
    mediumRiskCgpaBelow: 7.5,
    highRiskBacklogCount: 1,
    mediumRiskBacklogCount: 0,
  }),
}
