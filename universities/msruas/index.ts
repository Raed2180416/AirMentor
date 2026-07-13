import type { SgpaCgpaRules } from '../../kernel/grading/index.js'
import type { UniversityPlugin } from '../../kernel/policy/index.js'
import { createMsruasAssessmentTemplate } from './assessment-template.js'
import { createMsruasAttendanceRules, createMsruasCondonationRules, createMsruasEligibilityRules, createMsruasPassRules } from './pass-rules.js'
import { createMsruasPromotionRules, createMsruasRiskRules } from './promotion-rules.js'
import { createMsruasGradingSystem } from './grading-system.js'

const MSRUAS_SGPA_CGPA_RULES: SgpaCgpaRules = {
  includeFailedCredits: false,
  repeatedCoursePolicy: 'latest-attempt',
}

export const msruasPlugin: UniversityPlugin = {
  universityId: 'msruas',
  displayName: 'M. S. Ramaiah University of Applied Sciences',
  getGradingSystem: createMsruasGradingSystem,
  getPassRules: createMsruasPassRules,
  getPromotionRules: createMsruasPromotionRules,
  getAssessmentTemplate: createMsruasAssessmentTemplate,
  getAttendanceRules: createMsruasAttendanceRules,
  getCondonationRules: createMsruasCondonationRules,
  getEligibilityRules: createMsruasEligibilityRules,
  getSgpaCgpaRules: () => MSRUAS_SGPA_CGPA_RULES,
  getRiskRules: createMsruasRiskRules,
}
