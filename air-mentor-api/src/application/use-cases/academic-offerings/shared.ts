/**
 * Shared domain shapes for the academic-offerings use-cases.
 *
 * These structural types mirror the exact db/schema columns / injected-dep
 * signatures the use-cases read, so the application layer can hand raw rows to
 * the controller-bound closures (mapCourseOutcomeOverride,
 * resolveCourseOutcomesForOffering, buildOfferingStageEligibility, …) WITHOUT
 * importing db/schema or drizzle-orm (ESLint enforces that ban). The
 * controller wraps each injected dep so the strict db/schema types collapse
 * onto these structural aliases.
 */
export type { AuditEmitter } from '../curriculum-graph/shared.js'

// Mirrors z.infer<typeof courseOutcomeScopeSchema> in modules/academic.ts.
export type CourseOutcomeScope = 'institution' | 'branch' | 'batch' | 'offering'

export type CourseOutcomeItem = {
  id: string
  desc: string
  bloom: string
}

// Mirrors courseOutcomeOverrides.$inferSelect exactly so the row can be passed
// to the injected mapCourseOutcomeOverride / resolveCourseOutcomesForOffering.
export type CourseOutcomeOverrideRow = {
  courseOutcomeOverrideId: string
  courseId: string
  scopeType: string
  scopeId: string
  outcomesJson: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

// Mirrors sectionOfferings.$inferSelect for the rows returned to the client.
export type SectionOfferingRow = {
  offeringId: string
  courseId: string
  termId: string
  branchId: string
  sectionCode: string
  yearLabel: string
  attendance: number
  studentCount: number
  stage: number
  stageLabel: string
  stageDescription: string
  stageColor: string
  tt1Done: number
  tt2Done: number
  tt1Locked: number
  tt2Locked: number
  quizLocked: number
  assignmentLocked: number
  finalsLocked: number
  pendingAction: string | null
  status: string
  demoWorkspaceId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

// Mirrors facultyOfferingOwnerships.$inferSelect for the rows returned.
export type OwnershipRow = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  demoWorkspaceId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type CourseRef = { courseId: string }

// Supertype of the injected getOfferingContext(...) result — only the fields
// the resolved-course-outcomes use-case reads.
export type OfferingContextResult = {
  offering: { offeringId: string; courseId: string; branchId: string }
  course: { courseCode: string; title: string }
  term: { batchId: string | null }
  department: { institutionId: string }
}

// Supertype of the injected buildOfferingStageEligibility(...) result — only
// the fields the advance-stage use-case reads (the whole object is still
// returned verbatim to the client via pass-through).
export type StageEligibilityResult = {
  offeringId: string
  batchId: string | null
  eligible: boolean
  blockingReasons: unknown
  currentStage: { key: string }
  nextStage: { order: number; label: string; description: string; color: string; key: string } | null | undefined
  queueBurden: unknown
  evidenceStatus: unknown
}

// Supertype of the injected buildAcademicBootstrap(...) result.
export type AcademicBootstrapResult = {
  offerings: unknown
}

// Mirrors the resolveCourseOutcomesForOffering(...) input.
export type ResolveCourseOutcomesInput = {
  institutionId: string
  branchId: string
  batchId?: string | null
  offeringId: string
  courseId: string
  courseCode: string
  courseTitle: string
  overrides: CourseOutcomeOverrideRow[]
}
