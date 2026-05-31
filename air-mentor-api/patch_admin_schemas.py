with open('src/modules/admin-structure.ts', 'r') as f:
    content = f.read()

new_schemas = """
const remediationRulesSchema = z.object({
  allowReSit: z.boolean(),
  maxReSitAttempts: z.number().int().min(0),
  reSitEligibilityMinCe: z.number().min(0),
  reSitEligibilityMinAttendance: z.number().min(0),
  allowReRegister: z.boolean(),
  maxReRegisterAttempts: z.number().int().min(0),
  reRegisterRequiresAttendanceReset: z.boolean(),
  supplementaryExamWindowDays: z.number().int().min(0),
  supplementaryExamMaxBacklogCredits: z.number().int().min(0),
  carryForwardCeForReSit: z.boolean(),
})

const durationRulesSchema = z.object({
  maximumDegreeDurationYears: z.number().int().min(0),
  maximumDegreeDurationSemesters: z.number().int().min(0),
  maximumAttemptsPerCourse: z.number().int().min(0),
  maximumSemesterGapYears: z.number().int().min(0),
  requireContinuousEnrollment: z.boolean(),
  allowSemesterLeave: z.boolean(),
  maxSemesterLeaveCount: z.number().int().min(0),
  degreeCompletionGraceSemesters: z.number().int().min(0),
})

const yearBackRulesSchema = z.object({
  enableYearBack: z.boolean(),
  yearBackTriggerCredits: z.number().int().min(0),
  yearBackTriggerFailedCourses: z.number().int().min(0),
  yearBackMinimumSemester: z.number().int().min(0),
  lowerYearBlockers: z.number().int().min(0),
  allowPromotionWithBacklogs: z.boolean(),
  promotionBacklogCreditLimit: z.number().int().min(0),
  detentionAfterConsecutiveFailures: z.number().int().min(0),
})
"""

content = content.replace("const policyPayloadSchema = z.object({", new_schemas + "\nconst policyPayloadSchema = z.object({")
content = content.replace("riskRules: riskRulesSchema.optional(),", "riskRules: riskRulesSchema.optional(),\n  remediationRules: remediationRulesSchema.optional(),\n  durationRules: durationRulesSchema.optional(),\n  yearBackRules: yearBackRulesSchema.optional(),")

content = content.replace("riskRules: z.infer<typeof riskRulesSchema>", "riskRules: z.infer<typeof riskRulesSchema>\n  remediationRules: z.infer<typeof remediationRulesSchema>\n  durationRules: z.infer<typeof durationRulesSchema>\n  yearBackRules: z.infer<typeof yearBackRulesSchema>")

defaults = """
  remediationRules: {
    allowReSit: true,
    maxReSitAttempts: 3,
    reSitEligibilityMinCe: 20,
    reSitEligibilityMinAttendance: 65,
    allowReRegister: true,
    maxReRegisterAttempts: 2,
    reRegisterRequiresAttendanceReset: true,
    supplementaryExamWindowDays: 45,
    supplementaryExamMaxBacklogCredits: 10,
    carryForwardCeForReSit: true,
  },
  durationRules: {
    maximumDegreeDurationYears: 8,
    maximumDegreeDurationSemesters: 16,
    maximumAttemptsPerCourse: 4,
    maximumSemesterGapYears: 2,
    requireContinuousEnrollment: true,
    allowSemesterLeave: true,
    maxSemesterLeaveCount: 2,
    degreeCompletionGraceSemesters: 2,
  },
  yearBackRules: {
    enableYearBack: true,
    yearBackTriggerCredits: 12,
    yearBackTriggerFailedCourses: 3,
    yearBackMinimumSemester: 2,
    lowerYearBlockers: 1,
    allowPromotionWithBacklogs: true,
    promotionBacklogCreditLimit: 15,
    detentionAfterConsecutiveFailures: 3,
  },
"""

content = content.replace("riskRules: {", defaults + "\n  riskRules: {")

with open('src/modules/admin-structure.ts', 'w') as f:
    f.write(content)
