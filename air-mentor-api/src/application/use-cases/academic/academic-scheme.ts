/**
 * Academic assessment-scheme + question-paper domain — canonicalization,
 * policy validation, and default builders for offering schemes and term-test
 * blueprints.
 *
 * Framework/persistence-free: takes a resolved sysadmin policy plus the scheme /
 * blueprint contracts and returns canonical/validated values. Moved verbatim
 * from modules/academic.ts (structural relocation only). `ResolvedPolicy` is a
 * type-only import so the layer stays persistence-free.
 */
import { z } from 'zod'
import { badRequest } from '../../../lib/http-errors.js'
import type { ResolvedPolicy } from '../../../modules/admin-structure.js'
import {
  assessmentComponentSchema,
  schemeStateSchema,
  termTestBlueprintSchema,
  termTestNodeSchema,
  termTestWeightsSchema,
} from './academic-contracts.js'

export function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value ?? fallback)))
}

export function buildSchemePolicyContext(policy: ResolvedPolicy) {
  return {
    ce: policy.ceSeeSplit.ce,
    see: policy.ceSeeSplit.see,
    maxTermTests: policy.ceComponentCaps.maxTermTests,
    maxQuizzes: policy.ceComponentCaps.maxQuizzes,
    maxAssignments: policy.ceComponentCaps.maxAssignments,
  }
}

export function distributeWeightage(totalWeight: number, count: number) {
  if (count <= 0) return [] as number[]
  const base = Math.floor(totalWeight / count)
  const remainder = totalWeight - (base * count)
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? remainder : 0))
}

export function hasExplicitComponentWeightage(components?: Array<z.infer<typeof assessmentComponentSchema>>) {
  return (components ?? []).some(component => typeof component.weightage === 'number' && Number.isFinite(component.weightage))
}

export function sumAssessmentComponentWeightage(components: Array<z.infer<typeof assessmentComponentSchema>>) {
  return components.reduce((acc, component) => acc + clampInteger(component.weightage, 0, 100, 0), 0)
}

export function sanitizeAssessmentComponentsForScheme(
  kind: 'quiz' | 'assignment',
  count: number,
  components: Array<z.infer<typeof assessmentComponentSchema>> | undefined,
  totalWeight: number,
) {
  const base = components && components.length > 0
    ? components.slice(0, count)
    : []
  const distributedWeightage = distributeWeightage(totalWeight, count)
  const explicitWeightage = hasExplicitComponentWeightage(base)
  return Array.from({ length: count }, (_, index) => ({
    id: base[index]?.id ?? `${kind}-${index + 1}`,
    label: base[index]?.label?.trim() || `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${index + 1}`,
    rawMax: clampInteger(base[index]?.rawMax, 1, 100, 10),
    weightage: clampInteger(base[index]?.weightage, 0, 100, explicitWeightage ? 0 : (distributedWeightage[index] ?? 0)),
    cos: base[index]?.cos ?? [],
  }))
}

export function sanitizeTermTestWeights(
  weights: z.infer<typeof termTestWeightsSchema> | undefined,
  totalWeight: number,
  maxTermTests: number,
) {
  if (maxTermTests <= 0 || totalWeight <= 0) return { tt1: 0, tt2: 0 }
  if (maxTermTests === 1) {
    return { tt1: clampInteger(weights?.tt1, 0, totalWeight, totalWeight), tt2: 0 }
  }
  const fallbackTt1 = Math.round(totalWeight / 2)
  const fallbackTt2 = totalWeight - fallbackTt1
  return {
    tt1: clampInteger(weights?.tt1, 0, totalWeight, fallbackTt1),
    tt2: clampInteger(weights?.tt2, 0, totalWeight, fallbackTt2),
  }
}

export function canonicalizeSchemeState(
  input: z.infer<typeof schemeStateSchema>,
  policy: ResolvedPolicy,
) {
  const policyContext = buildSchemePolicyContext(policy)
  const quizCount = clampInteger(input.quizCount ?? input.quizComponents.length, 0, policyContext.maxQuizzes, 0)
  const assignmentCount = clampInteger(input.assignmentCount ?? input.assignmentComponents.length, 0, policyContext.maxAssignments, 0)
  const legacyQuizWeight = clampInteger(input.quizWeight, 0, 100, 0)
  const legacyAssignmentWeight = clampInteger(input.assignmentWeight, 0, 100, 0)
  const explicitQuizWeightage = hasExplicitComponentWeightage(input.quizComponents)
  const explicitAssignmentWeightage = hasExplicitComponentWeightage(input.assignmentComponents)
  const quizComponents = sanitizeAssessmentComponentsForScheme('quiz', quizCount, input.quizComponents, explicitQuizWeightage ? 0 : legacyQuizWeight)
  const assignmentComponents = sanitizeAssessmentComponentsForScheme('assignment', assignmentCount, input.assignmentComponents, explicitAssignmentWeightage ? 0 : legacyAssignmentWeight)
  const quizWeight = explicitQuizWeightage || quizCount === 0 ? sumAssessmentComponentWeightage(quizComponents) : legacyQuizWeight
  const assignmentWeight = explicitAssignmentWeightage || assignmentCount === 0 ? sumAssessmentComponentWeightage(assignmentComponents) : legacyAssignmentWeight
  const termTestTotal = Math.max(0, policyContext.ce - quizWeight - assignmentWeight)
  return {
    finalsMax: (input.finalsMax ?? (policyContext.see > 50 ? 100 : 50)) as 50 | 100,
    termTestWeights: sanitizeTermTestWeights(input.termTestWeights, termTestTotal, policyContext.maxTermTests),
    quizWeight,
    assignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents,
    assignmentComponents,
    policyContext,
    status: input.status,
    configuredAt: input.configuredAt,
    lockedAt: input.lockedAt,
    lastEditedBy: input.lastEditedBy,
  }
}

export function buildDefaultCourseOutcomes(courseCode: string, courseTitle: string) {
  return [
    { id: 'CO1', desc: `Explain the core concepts covered in ${courseTitle}.`, bloom: 'Understand' },
    { id: 'CO2', desc: `Apply ${courseCode} techniques to solve structured problems.`, bloom: 'Apply' },
    { id: 'CO3', desc: `Analyse trade-offs and results in ${courseTitle}.`, bloom: 'Analyze' },
    { id: 'CO4', desc: `Evaluate solution quality and academic decisions for ${courseCode}.`, bloom: 'Evaluate' },
  ]
}

export function buildDefaultSchemeFromPolicy(policy: ResolvedPolicy) {
  const policyContext = buildSchemePolicyContext(policy)
  const quizCount = Math.min(2, Math.max(0, policyContext.maxQuizzes))
  const assignmentCount = Math.min(2, Math.max(0, policyContext.maxAssignments))
  const defaultTermTestWeight = policyContext.maxTermTests > 0 ? Math.min(policyContext.ce, 30) : 0
  const remainingCe = Math.max(0, policyContext.ce - defaultTermTestWeight)
  const defaultQuizWeight = Math.min(remainingCe, quizCount > 1 ? Math.max(10, Math.floor(remainingCe * 0.5)) : Math.min(remainingCe, 20))
  const defaultAssignmentWeight = Math.max(0, remainingCe - defaultQuizWeight)
  return canonicalizeSchemeState({
    finalsMax: (policyContext.see > 50 ? 100 : 50) as 50 | 100,
    termTestWeights: policyContext.maxTermTests > 1
      ? { tt1: Math.round(defaultTermTestWeight / 2), tt2: defaultTermTestWeight - Math.round(defaultTermTestWeight / 2) }
      : { tt1: defaultTermTestWeight, tt2: 0 },
    quizWeight: defaultQuizWeight,
    assignmentWeight: defaultAssignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents: sanitizeAssessmentComponentsForScheme('quiz', quizCount, undefined, defaultQuizWeight),
    assignmentComponents: sanitizeAssessmentComponentsForScheme('assignment', assignmentCount, undefined, defaultAssignmentWeight),
    policyContext,
    status: 'Needs Setup',
  }, policy)
}

export function buildDefaultQuestionPaper(kind: 'tt1' | 'tt2', outcomes: Array<{ id: string }>) {
  const coIds = outcomes.length > 0 ? outcomes.map(item => item.id) : ['CO1', 'CO2', 'CO3', 'CO4']
  return {
    kind,
    totalMarks: 25,
    updatedAt: Date.now(),
    nodes: Array.from({ length: 5 }, (_, index) => ({
      id: `${kind}-q${index + 1}`,
      label: `Q${index + 1}`,
      text: `Question ${index + 1}`,
      maxMarks: 5,
      cos: [],
      children: [{
        id: `${kind}-q${index + 1}-p1`,
        label: `Q${index + 1}a`,
        text: `Part A`,
        maxMarks: 5,
        cos: [coIds[index % coIds.length]],
      }],
    })),
  }
}

export function collectBlueprintOutcomeIds(nodes: z.infer<typeof termTestNodeSchema>[]) {
  const collected = new Set<string>()
  const visit = (entries: z.infer<typeof termTestNodeSchema>[]) => {
    for (const entry of entries) {
      for (const coId of entry.cos) collected.add(coId)
      if (entry.children?.length) visit(entry.children)
    }
  }
  visit(nodes)
  return collected
}

export function validateSchemeAgainstPolicy(input: z.infer<typeof schemeStateSchema>, policy: ResolvedPolicy) {
  const scheme = canonicalizeSchemeState(input, policy)
  const policyContext = scheme.policyContext
  if (scheme.quizCount > policy.ceComponentCaps.maxQuizzes) {
    throw badRequest('Quiz count exceeds the sysadmin policy cap')
  }
  if (scheme.assignmentCount > policy.ceComponentCaps.maxAssignments) {
    throw badRequest('Assignment count exceeds the sysadmin policy cap')
  }
  if (scheme.quizComponents.length !== scheme.quizCount) {
    throw badRequest('Quiz components must match the configured quiz count')
  }
  if (scheme.assignmentComponents.length !== scheme.assignmentCount) {
    throw badRequest('Assignment components must match the configured assignment count')
  }
  if (scheme.policyContext.ce !== policyContext.ce || scheme.policyContext.see !== policyContext.see) {
    throw badRequest('Scheme CE/SEE context must match the sysadmin policy')
  }
  if (scheme.policyContext.maxTermTests !== policyContext.maxTermTests || scheme.policyContext.maxQuizzes !== policyContext.maxQuizzes || scheme.policyContext.maxAssignments !== policyContext.maxAssignments) {
    throw badRequest('Scheme component limits must match the sysadmin policy')
  }
  if (scheme.quizWeight !== sumAssessmentComponentWeightage(scheme.quizComponents)) {
    throw badRequest('Quiz weight must equal the total of configured quiz component weightages')
  }
  if (scheme.assignmentWeight !== sumAssessmentComponentWeightage(scheme.assignmentComponents)) {
    throw badRequest('Assignment weight must equal the total of configured assignment component weightages')
  }
  const activeTermTestCount = [scheme.termTestWeights.tt1, scheme.termTestWeights.tt2].filter(weight => weight > 0).length
  if (activeTermTestCount > policyContext.maxTermTests) {
    throw badRequest('Term-test count exceeds the sysadmin policy cap')
  }
  const configuredCeWeight = scheme.termTestWeights.tt1
    + scheme.termTestWeights.tt2
    + scheme.quizWeight
    + scheme.assignmentWeight
  if (configuredCeWeight !== policyContext.ce) {
    throw badRequest('Configured internal CE weightages must exactly match the sysadmin CE total')
  }
}

export function validateQuestionPaperBlueprint(
  kind: 'tt1' | 'tt2',
  blueprint: z.infer<typeof termTestBlueprintSchema>,
  allowedOutcomeIds: Set<string>,
) {
  if (blueprint.kind !== kind) {
    throw badRequest('Question paper kind does not match the selected route')
  }
  const referencedOutcomeIds = collectBlueprintOutcomeIds(blueprint.nodes)
  const invalidOutcomeIds = Array.from(referencedOutcomeIds).filter(outcomeId => !allowedOutcomeIds.has(outcomeId))
  if (invalidOutcomeIds.length > 0) {
    throw badRequest('Question paper references course outcomes outside the resolved offering scope', { invalidOutcomeIds })
  }
}

export function flattenTermTestLeaves(nodes: z.infer<typeof termTestNodeSchema>[]) {
  return nodes.flatMap(node => {
    const children = node.children && node.children.length > 0 ? node.children : [node]
    return children.map(child => ({
      id: child.id,
      label: child.label,
      text: child.text,
      maxMarks: child.maxMarks,
      cos: child.cos,
    }))
  })
}
