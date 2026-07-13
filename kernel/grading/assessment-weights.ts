import type {
  AssessmentComponentDefinition,
  AssessmentComponentKind,
  DerivedAcademicProjection,
  EntryLockMap,
  EvaluationScheme,
  SchemePolicyContext,
  SchemeState,
  StudentRuntimePatch,
  TTKind,
  TermTestBlueprint,
  TermTestNode,
} from '@kernel/shared/domain'
import type {
  COScore,
  CODef,
  CoAttainmentRow,
  Offering,
  PaperQ,
  Student,
} from '@kernel/shared/simulation-domain'

export type {
  AssessmentComponentDefinition,
  AssessmentComponentKind,
  DerivedAcademicProjection,
  EntryLockMap,
  EvaluationScheme,
  SchemePolicyContext,
  SchemeState,
  StudentRuntimePatch,
  TTKind,
  TermTestBlueprint,
  TermTestNode,
} from '@kernel/shared/domain'

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function roundRisk(value: number) {
  return Math.round(value * 100) / 100
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return clampNumber(Math.round(value ?? fallback), min, max)
}

export function toStudentPatchKey(offId: string, studentId: string) {
  return `${offId}::${studentId}`
}

function distributeWeightage(totalWeight: number, count: number) {
  if (count <= 0) return [] as number[]
  const base = Math.floor(totalWeight / count)
  const remainder = totalWeight - (base * count)
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? remainder : 0))
}

export function buildUnavailableBlueprint(kind: TTKind): TermTestBlueprint {
  return {
    kind,
    totalMarks: 0,
    updatedAt: 0,
    nodes: [],
  }
}

function buildDefaultPolicyContext(): SchemePolicyContext {
  return {
    ce: 60,
    see: 40,
    maxTermTests: 2,
    maxQuizzes: 5,
    maxAssignments: 5,
  }
}

function sanitizePolicyContext(input: Partial<SchemePolicyContext> | undefined, defaults: SchemePolicyContext): SchemePolicyContext {
  return {
    ce: clampInteger(input?.ce, 0, 100, defaults.ce),
    see: clampInteger(input?.see, 0, 100, defaults.see),
    maxTermTests: clampInteger(input?.maxTermTests, 0, 2, defaults.maxTermTests),
    maxQuizzes: clampInteger(input?.maxQuizzes, 0, 10, defaults.maxQuizzes),
    maxAssignments: clampInteger(input?.maxAssignments, 0, 10, defaults.maxAssignments),
  }
}

function sanitizeTermTestWeights(
  weights: EvaluationScheme['termTestWeights'] | undefined,
  totalWeight: number,
  maxTermTests: number,
) {
  if (maxTermTests <= 0 || totalWeight <= 0) return { tt1: 0, tt2: 0 }
  if (maxTermTests === 1) {
    const tt1 = clampInteger(weights?.tt1, 0, totalWeight, totalWeight)
    return { tt1, tt2: 0 }
  }
  const fallbackTt1 = Math.round(totalWeight / 2)
  const fallbackTt2 = totalWeight - fallbackTt1
  const tt1 = clampInteger(weights?.tt1, 0, totalWeight, fallbackTt1)
  const tt2 = clampInteger(weights?.tt2, 0, totalWeight, fallbackTt2)
  return { tt1, tt2 }
}

export function buildDefaultAssessmentComponents(kind: AssessmentComponentKind, count: number, totalWeight = 0): AssessmentComponentDefinition[] {
  const distributedWeightage = distributeWeightage(totalWeight, count)
  return Array.from({ length: count }, (_, index) => ({
    id: `${kind}-${index + 1}`,
    label: `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${index + 1}`,
    rawMax: 10,
    weightage: distributedWeightage[index] ?? 0,
  }))
}

export function sumComponentWeightage(components: AssessmentComponentDefinition[]) {
  return components.reduce((acc, component) => acc + clampInteger(component.weightage, 0, 100, 0), 0)
}

export function getSchemeConfiguredCeWeight(scheme: Pick<EvaluationScheme, 'termTestWeights' | 'quizComponents' | 'assignmentComponents'>) {
  return scheme.termTestWeights.tt1
    + scheme.termTestWeights.tt2
    + sumComponentWeightage(scheme.quizComponents)
    + sumComponentWeightage(scheme.assignmentComponents)
}

export function sanitizeAssessmentComponents(
  kind: AssessmentComponentKind,
  count: number,
  components?: AssessmentComponentDefinition[],
  totalWeight = 0,
) {
  const base: AssessmentComponentDefinition[] = components && components.length > 0 ? components.slice(0, count) : buildDefaultAssessmentComponents(kind, count, totalWeight)
  const distributedWeightage = distributeWeightage(totalWeight, count)
  const hasExplicitWeightage = base.some(component => typeof component?.weightage === 'number' && Number.isFinite(component.weightage))
  return Array.from({ length: count }, (_, index) => {
    const cos = base[index]?.cos ?? []
    return {
      id: base[index]?.id ?? `${kind}-${index + 1}`,
      label: base[index]?.label?.trim() || `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${index + 1}`,
      rawMax: clampNumber(Math.round(base[index]?.rawMax ?? 10), 1, 100),
      weightage: clampInteger(base[index]?.weightage, 0, 100, hasExplicitWeightage ? 0 : (distributedWeightage[index] ?? 0)),
      ...(cos.length > 0 ? { cos } : {}),
    }
  })
}

export function defaultSchemeForOffering(offering: Offering): SchemeState {
  const policyContext = buildDefaultPolicyContext()
  const finalsMax = offering.code === 'CS702' ? 100 : 50
  const quizWeight: number = offering.stageInfo.stage >= 2 ? (offering.code === 'CS401' ? 20 : 10) : 10
  const assignmentWeight: number = Math.max(0, policyContext.ce - 30 - quizWeight)
  const quizCount = quizWeight === 0 ? 0 : offering.code === 'CS401' ? 2 : 1
  const assignmentCount = assignmentWeight === 0 ? 0 : offering.code === 'CS401' ? 2 : 1
  return {
    finalsMax,
    termTestWeights: { tt1: 15, tt2: 15 },
    quizWeight,
    assignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents: sanitizeAssessmentComponents('quiz', quizCount, undefined, quizWeight),
    assignmentComponents: sanitizeAssessmentComponents('assignment', assignmentCount, undefined, assignmentWeight),
    policyContext,
    status: 'Needs Setup',
  }
}

export function normalizeSchemeState(input: Partial<SchemeState> | undefined, offering: Offering): SchemeState {
  const defaults = defaultSchemeForOffering(offering)
  const policyContext = sanitizePolicyContext(input?.policyContext, defaults.policyContext)
  const quizCount = clampInteger(input?.quizCount ?? input?.quizComponents?.length, 0, policyContext.maxQuizzes, defaults.quizCount)
  const assignmentCount = clampInteger(input?.assignmentCount ?? input?.assignmentComponents?.length, 0, policyContext.maxAssignments, defaults.assignmentCount)
  const legacyQuizWeight = clampInteger(input?.quizWeight, 0, 100, defaults.quizWeight)
  const legacyAssignmentWeight = clampInteger(input?.assignmentWeight, 0, 100, defaults.assignmentWeight)
  const hasExplicitQuizWeightage = (input?.quizComponents ?? []).some(component => Number.isFinite(component.weightage))
  const hasExplicitAssignmentWeightage = (input?.assignmentComponents ?? []).some(component => Number.isFinite(component.weightage))
  const quizComponents = sanitizeAssessmentComponents(
    'quiz',
    quizCount,
    input?.quizComponents ?? defaults.quizComponents,
    hasExplicitQuizWeightage ? 0 : legacyQuizWeight,
  )
  const assignmentComponents = sanitizeAssessmentComponents(
    'assignment',
    assignmentCount,
    input?.assignmentComponents ?? defaults.assignmentComponents,
    hasExplicitAssignmentWeightage ? 0 : legacyAssignmentWeight,
  )
  const quizWeight = hasExplicitQuizWeightage || quizCount === 0 ? sumComponentWeightage(quizComponents) : legacyQuizWeight
  const assignmentWeight = hasExplicitAssignmentWeightage || assignmentCount === 0 ? sumComponentWeightage(assignmentComponents) : legacyAssignmentWeight
  const defaultTermTestTotal = Math.max(0, policyContext.ce - quizWeight - assignmentWeight)
  const fallbackTermTestTotal = Math.max(0, policyContext.ce - legacyQuizWeight - legacyAssignmentWeight)
  return {
    finalsMax: (input?.finalsMax ?? (policyContext.see > 50 ? 100 : defaults.finalsMax)) as 50 | 100,
    termTestWeights: sanitizeTermTestWeights(input?.termTestWeights, defaultTermTestTotal || fallbackTermTestTotal, policyContext.maxTermTests),
    quizWeight,
    assignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents,
    assignmentComponents,
    policyContext,
    status: input?.status ?? defaults.status,
    configuredAt: input?.configuredAt,
    lockedAt: input?.lockedAt,
    lastEditedBy: input?.lastEditedBy,
  }
}

export function toLeafId(kind: TTKind, questionIndex: number, partIndex: number) {
  return `${kind}-q${questionIndex + 1}-p${partIndex + 1}`
}

export function splitMarks(total: number) {
  if (total <= 4) return [total]
  const first = Math.ceil(total / 2)
  const second = total - first
  return second > 0 ? [first, second] : [first]
}

export function seedBlueprintFromPaper(kind: TTKind, paper: PaperQ[]): TermTestBlueprint {
  return {
    kind,
    totalMarks: paper.reduce((acc, item) => acc + item.maxMarks, 0),
    updatedAt: Date.now(),
    nodes: paper.map((question, questionIndex) => {
      const parts = splitMarks(question.maxMarks)
      return {
        id: `${kind}-q${questionIndex + 1}`,
        label: `Q${questionIndex + 1}`,
        text: question.text,
        maxMarks: question.maxMarks,
        cos: [],
        children: parts.map((marks, partIndex) => ({
          id: toLeafId(kind, questionIndex, partIndex),
          label: `Q${questionIndex + 1}${String.fromCharCode(97 + partIndex)}`,
          text: partIndex === 0 ? question.text : `Part ${String.fromCharCode(65 + partIndex)}`,
          maxMarks: marks,
          cos: question.cos.length > 0 ? [question.cos[Math.min(partIndex, question.cos.length - 1)]] : [],
        })),
      }
    }),
  }
}

function sumQuestionMarks(node: TermTestNode): number {
  if (!node.children || node.children.length === 0) return node.maxMarks
  return node.children.reduce((acc, child) => acc + sumQuestionMarks(child), 0)
}

export function normalizeBlueprint(kind: TTKind, blueprint: TermTestBlueprint): TermTestBlueprint {
  const nodes = blueprint.nodes.map((node, index) => {
    const canonicalQuestionLabel = `Q${index + 1}`
    const questionLabel = node.label?.trim() || canonicalQuestionLabel
    const children = (node.children && node.children.length > 0 ? node.children : [{
      id: `${node.id}-p1`,
      label: `${questionLabel}a`,
      text: node.text,
      maxMarks: node.maxMarks,
      cos: node.cos,
    }]).map((child, childIndex) => ({
      ...child,
      id: toLeafId(kind, index, childIndex),
      label: child.label?.trim() || `${questionLabel}${String.fromCharCode(97 + childIndex)}`,
      text: child.text?.trim() || (childIndex === 0 ? (node.text?.trim() || `Question ${index + 1}`) : `Part ${String.fromCharCode(65 + childIndex)}`),
      maxMarks: clampNumber(Math.round(child.maxMarks), 1, 25),
      cos: child.cos.length > 0 ? child.cos : node.cos,
    }))
    return {
      ...node,
      id: `${kind}-q${index + 1}`,
      label: questionLabel,
      text: node.text?.trim() || `Question ${index + 1}`,
      cos: [],
      children,
      maxMarks: children.reduce((acc, child) => acc + sumQuestionMarks(child), 0),
    }
  })
  return {
    kind,
    totalMarks: nodes.reduce((acc, node) => acc + sumQuestionMarks(node), 0),
    updatedAt: blueprint.updatedAt ?? Date.now(),
    nodes,
  }
}

export function canonicalizeBlueprintStructure(kind: TTKind, blueprint: TermTestBlueprint): TermTestBlueprint {
  const normalized = normalizeBlueprint(kind, blueprint)
  const nodes = normalized.nodes.map((node, questionIndex) => {
    const questionLabel = `Q${questionIndex + 1}`
    const children = (node.children && node.children.length > 0 ? node.children : [{
      id: toLeafId(kind, questionIndex, 0),
      label: `${questionLabel}a`,
      text: node.text,
      maxMarks: node.maxMarks,
      cos: node.cos,
    }]).map((child, childIndex) => ({
      ...child,
      id: toLeafId(kind, questionIndex, childIndex),
      label: `${questionLabel}${String.fromCharCode(97 + childIndex)}`,
      text: child.text?.trim() || (childIndex === 0 ? node.text : `Part ${String.fromCharCode(65 + childIndex)}`),
      maxMarks: clampNumber(Math.round(child.maxMarks), 1, 25),
      cos: child.cos.length > 0 ? child.cos : node.cos,
    }))
    return {
      ...node,
      id: `${kind}-q${questionIndex + 1}`,
      label: questionLabel,
      text: node.text?.trim() || `Question ${questionIndex + 1}`,
      cos: [],
      children,
      maxMarks: children.reduce((acc, child) => acc + child.maxMarks, 0),
    }
  })
  return {
    ...normalized,
    kind,
    updatedAt: Date.now(),
    totalMarks: nodes.reduce((acc, node) => acc + node.maxMarks, 0),
    nodes,
  }
}

export function addBlueprintQuestion(kind: TTKind, blueprint: TermTestBlueprint, fallbackCoId?: string): TermTestBlueprint {
  const normalized = normalizeBlueprint(kind, blueprint)
  const nextIndex = normalized.nodes.length
  return canonicalizeBlueprintStructure(kind, {
    ...normalized,
    updatedAt: Date.now(),
    nodes: [...normalized.nodes, {
      id: `${kind}-q${nextIndex + 1}`,
      label: `Q${nextIndex + 1}`,
      text: `Question ${nextIndex + 1}`,
      maxMarks: 5,
      cos: [],
      children: [{
        id: toLeafId(kind, nextIndex, 0),
        label: `Q${nextIndex + 1}a`,
        text: 'Part A',
        maxMarks: 5,
        cos: fallbackCoId ? [fallbackCoId] : [],
      }],
    }],
  })
}

export function removeBlueprintQuestion(kind: TTKind, blueprint: TermTestBlueprint, questionId: string): TermTestBlueprint {
  const normalized = normalizeBlueprint(kind, blueprint)
  if (normalized.nodes.length <= 1) return normalized
  return canonicalizeBlueprintStructure(kind, {
    ...normalized,
    updatedAt: Date.now(),
    nodes: normalized.nodes.filter(node => node.id !== questionId),
  })
}

export function addBlueprintPart(kind: TTKind, blueprint: TermTestBlueprint, questionId: string, fallbackCoId?: string): TermTestBlueprint {
  const normalized = normalizeBlueprint(kind, blueprint)
  return canonicalizeBlueprintStructure(kind, {
    ...normalized,
    updatedAt: Date.now(),
    nodes: normalized.nodes.map(node => {
      if (node.id !== questionId) return node
      const partCount = node.children?.length ?? 0
      return {
        ...node,
        children: [...(node.children ?? []), {
          id: toLeafId(kind, normalized.nodes.findIndex(candidate => candidate.id === questionId), partCount),
          label: `${node.label}${String.fromCharCode(97 + partCount)}`,
          text: `Part ${String.fromCharCode(65 + partCount)}`,
          maxMarks: 1,
          cos: node.children?.[0]?.cos?.length ? node.children[0].cos : (fallbackCoId ? [fallbackCoId] : node.cos),
        }],
      }
    }),
  })
}

export function removeBlueprintPart(kind: TTKind, blueprint: TermTestBlueprint, questionId: string, partId: string): TermTestBlueprint {
  const normalized = normalizeBlueprint(kind, blueprint)
  return canonicalizeBlueprintStructure(kind, {
    ...normalized,
    updatedAt: Date.now(),
    nodes: normalized.nodes.map(node => {
      if (node.id !== questionId) return node
      const remainingChildren = (node.children ?? []).filter(child => child.id !== partId)
      return {
        ...node,
        children: remainingChildren.length > 0 ? remainingChildren : node.children,
      }
    }),
  })
}

export function flattenBlueprintLeaves(nodes: TermTestNode[]) {
  return nodes.flatMap(node => (node.children && node.children.length > 0 ? node.children : [node]).map(child => ({
    ...child,
    parentLabel: node.label,
  })))
}

export function seedTermTestLeafScores(score: number | null | undefined, maxScore: number | null | undefined, leaves: ReturnType<typeof flattenBlueprintLeaves>) {
  if (typeof score !== 'number' || !Number.isFinite(score) || leaves.length === 0) return undefined
  const totalMax = Math.max(1, typeof maxScore === 'number' && Number.isFinite(maxScore) && maxScore > 0
    ? maxScore
    : leaves.reduce((acc, leaf) => acc + Math.max(0, leaf.maxMarks), 0))
  const targetScore = Math.round(clampNumber(score, 0, totalMax))
  const allocations = leaves.map((leaf, index) => {
    const exact = (targetScore * Math.max(0, leaf.maxMarks)) / totalMax
    return { id: leaf.id, index, maxMarks: Math.max(0, leaf.maxMarks), score: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = targetScore - allocations.reduce((acc, item) => acc + item.score, 0)
  for (const item of [...allocations].sort((left, right) => right.remainder - left.remainder || left.index - right.index)) {
    if (remaining <= 0) break
    if (item.score >= item.maxMarks) continue
    item.score += 1
    remaining -= 1
  }
  return Object.fromEntries(allocations.map(item => [item.id, item.score])) as Record<string, number>
}

export function sumScores(values?: Record<string, number>) {
  if (!values) return 0
  return Object.values(values).reduce((acc, value) => acc + value, 0)
}

export function pruneScoreMap(values?: Record<string, number>) {
  if (!values) return undefined
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(value))
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function isPatchEmpty(patch: StudentRuntimePatch) {
  return patch.present === undefined
    && patch.totalClasses === undefined
    && patch.seeScore === undefined
    && !pruneScoreMap(patch.tt1LeafScores)
    && !pruneScoreMap(patch.tt2LeafScores)
    && !pruneScoreMap(patch.quizScores)
    && !pruneScoreMap(patch.assignmentScores)
}

export function getSubjectBand(score: number): DerivedAcademicProjection['bandLabel'] {
  if (score >= 90) return 'O'
  if (score >= 80) return 'A+'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B+'
  if (score >= 55) return 'B'
  if (score >= 50) return 'C'
  if (score >= 40) return 'P'
  return 'F'
}

export function getGradePointFromBand(band: DerivedAcademicProjection['bandLabel']): DerivedAcademicProjection['gradePoint'] {
  return band === 'O' ? 10
    : band === 'A+' ? 9
    : band === 'A' ? 8
    : band === 'B+' ? 7
    : band === 'B' ? 6
    : band === 'C' ? 5
    : band === 'P' ? 4
    : 0
}

export function projectPredictedCgpa(
  baseCgpa: number,
  gradePoint: DerivedAcademicProjection['gradePoint'],
  completedCredits: number,
  subjectCredits: number,
): number | null {
  if (gradePoint == null) return null
  if (baseCgpa > 0 && completedCredits > 0) {
    const weighted = (baseCgpa * completedCredits) + (gradePoint * subjectCredits)
    const totalCredits = completedCredits + subjectCredits
    return Math.round((weighted / totalCredits) * 100) / 100
  }
  return gradePoint
}

function getLegacyComponentScore(student: Student, kind: AssessmentComponentKind, index: number) {
  if (kind === 'quiz') {
    if (index === 0) return student.quiz1
    if (index === 1) return student.quiz2
    return null
  }
  if (index === 0) return student.asgn1
  if (index === 1) return student.asgn2
  return null
}

export function getAssessmentComponentScore(
  student: Student,
  kind: AssessmentComponentKind,
  component: AssessmentComponentDefinition,
  index: number,
) {
  const dynamicScores = kind === 'quiz' ? student.quizScores : student.assignmentScores
  const dynamicScore = dynamicScores?.[component.id]
  if (typeof dynamicScore === 'number' && Number.isFinite(dynamicScore)) return dynamicScore
  return getLegacyComponentScore(student, kind, index)
}

export function buildComponentScoreMap(
  student: Student,
  kind: AssessmentComponentKind,
  components: AssessmentComponentDefinition[],
  patchScores: Record<string, number> | undefined,
) {
  return Object.fromEntries(components.flatMap((component, index) => {
    const patchScore = patchScores?.[component.id]
    const score = typeof patchScore === 'number' && Number.isFinite(patchScore)
      ? patchScore
      : getAssessmentComponentScore(student, kind, component, index)
    return typeof score === 'number' && Number.isFinite(score) ? [[component.id, score]] : []
  }))
}

export function computeEvaluation(student: Student, scheme: EvaluationScheme) {
  return computeStageAwareEvaluation(student, scheme, null)
}

export function isCeComponentVisibleAtStage(
  kind: 'tt1' | 'tt2' | 'quiz' | 'assignment',
  stageKey?: string | null,
) {
  if (!stageKey) return true
  switch (stageKey) {
    case 'pre-tt1':
      return false
    case 'post-tt1':
      return kind === 'tt1'
    case 'post-tt2':
      return kind === 'tt1' || kind === 'tt2'
    case 'post-assignments':
      return kind === 'tt1' || kind === 'tt2' || kind === 'quiz' || kind === 'assignment'
    case 'post-see':
      return true
    default:
      return true
  }
}

export function computeStageAwareEvaluation(student: Student, scheme: EvaluationScheme, stageKey?: string | null) {
  const ceTarget = Math.max(1, scheme.policyContext.ce)
  const seeTarget = Math.max(0, scheme.policyContext.see)
  const tt1Visible = isCeComponentVisibleAtStage('tt1', stageKey)
  const tt2Visible = isCeComponentVisibleAtStage('tt2', stageKey)
  const quizVisible = isCeComponentVisibleAtStage('quiz', stageKey)
  const assignmentVisible = isCeComponentVisibleAtStage('assignment', stageKey)
  const tt1Scaled = tt1Visible && student.tt1Score !== null && student.tt1Max > 0
    ? (student.tt1Score / student.tt1Max) * scheme.termTestWeights.tt1
    : 0
  const tt2Scaled = tt2Visible && student.tt2Score !== null && student.tt2Max > 0
    ? (student.tt2Score / student.tt2Max) * scheme.termTestWeights.tt2
    : 0
  const quizScaled = quizVisible ? scheme.quizComponents.reduce((acc, component, index) => {
    const score = getAssessmentComponentScore(student, 'quiz', component, index)
    if (score === null) return acc
    return acc + ((score / Math.max(1, component.rawMax)) * component.weightage)
  }, 0) : 0
  const assignmentScaled = assignmentVisible ? scheme.assignmentComponents.reduce((acc, component, index) => {
    const score = getAssessmentComponentScore(student, 'assignment', component, index)
    if (score === null) return acc
    return acc + ((score / Math.max(1, component.rawMax)) * component.weightage)
  }, 0) : 0
  const ce60 = tt1Scaled + tt2Scaled + quizScaled + assignmentScaled
  const overall40 = (ce60 / ceTarget) * seeTarget
  return { tt1Scaled, tt2Scaled, quizScaled, asgnScaled: assignmentScaled, assignmentScaled, ce60, overall40 }
}

function getLeaves(node: TermTestNode): TermTestNode[] {
  return node.children && node.children.length > 0 ? node.children : [node]
}

function getLeafScoresForKind(
  kind: TTKind,
  patch?: { tt1LeafScores?: Record<string, number>; tt2LeafScores?: Record<string, number> },
): Record<string, number> | null {
  const scores = kind === 'tt1' ? patch?.tt1LeafScores : patch?.tt2LeafScores
  return scores && Object.keys(scores).length > 0 ? scores : null
}

function getObservedTermTestPct(student: Student, kind: TTKind) {
  const proofPct = kind === 'tt1' ? student.proofObservedTt1Pct : student.proofObservedTt2Pct
  if (typeof proofPct === 'number' && Number.isFinite(proofPct)) return clampNumber(proofPct, 0, 100)
  const totalScore = kind === 'tt1' ? student.tt1Score : student.tt2Score
  const totalMax = kind === 'tt1' ? student.tt1Max : student.tt2Max
  return totalScore !== null && totalMax > 0 ? (totalScore / totalMax) * 100 : null
}

export function computeStudentCoScores(
  student: Student,
  cos: CODef[],
  blueprints?: Record<TTKind, TermTestBlueprint>,
  patch?: { tt1LeafScores?: Record<string, number>; tt2LeafScores?: Record<string, number> },
): COScore[] {
  if (!blueprints) {
    const tt1Pct = getObservedTermTestPct(student, 'tt1')
    const tt2Pct = getObservedTermTestPct(student, 'tt2')
    const avgPct = tt1Pct != null && tt2Pct != null
      ? (tt1Pct + tt2Pct) / 2
      : tt1Pct ?? tt2Pct ?? null
    return cos.map(co => ({
      coId: co.id,
      attainment: avgPct != null ? Math.round(Math.max(0, Math.min(100, avgPct))) : 0,
    }))
  }

  return cos.map(co => {
    let coMax = 0
    let coScore = 0

    for (const kind of ['tt1', 'tt2'] as TTKind[]) {
      const blueprint = blueprints[kind]
      if (!blueprint || !blueprint.nodes) continue

      const leafScores = getLeafScoresForKind(kind, patch)
      const observedPct = getObservedTermTestPct(student, kind)
      if (!leafScores && observedPct === null) continue

      for (const node of blueprint.nodes) {
        for (const leaf of getLeaves(node)) {
          if (!leaf.cos.includes(co.id)) continue
          coMax += leaf.maxMarks
          if (leafScores) {
            coScore += leafScores[leaf.id] ?? 0
          } else if (observedPct !== null) {
            coScore += (observedPct / 100) * leaf.maxMarks
          }
        }
      }
    }

    const attainment = coMax > 0 ? Math.round((coScore / coMax) * 100) : 0
    return { coId: co.id, attainment: Math.min(100, Math.max(0, attainment)) }
  })
}

function hasStudentCoEvidence(
  student: Student,
  co: CODef,
  blueprints?: Record<TTKind, TermTestBlueprint>,
  patch?: { tt1LeafScores?: Record<string, number>; tt2LeafScores?: Record<string, number> },
) {
  if (!blueprints) {
    return getObservedTermTestPct(student, 'tt1') !== null || getObservedTermTestPct(student, 'tt2') !== null
  }

  for (const kind of ['tt1', 'tt2'] as TTKind[]) {
    const blueprint = blueprints[kind]
    if (!blueprint || !blueprint.nodes) continue
    const hasMappedLeaf = blueprint.nodes.some(node => getLeaves(node).some(leaf => leaf.cos.includes(co.id)))
    if (!hasMappedLeaf) continue
    if (getLeafScoresForKind(kind, patch)) return true
    if (getObservedTermTestPct(student, kind) !== null) return true
  }
  return false
}

export function computeCoAttainmentRows(
  students: Student[],
  cos: CODef[],
  blueprints?: Record<TTKind, TermTestBlueprint>,
  patches?: Record<string, { tt1LeafScores?: Record<string, number>; tt2LeafScores?: Record<string, number> }>,
): CoAttainmentRow[] {
  return cos.map(co => {
    let tt1Sum = 0, tt1Count = 0
    let tt2Sum = 0, tt2Count = 0
    let overallSum = 0
    let overallCount = 0

    for (const student of students) {
      const patch = patches?.[student.id]
      const scores = computeStudentCoScores(student, [co], blueprints, patch)
      const score = scores.find(c => c.coId === co.id)?.attainment ?? 0
      if (hasStudentCoEvidence(student, co, blueprints, patch)) {
        overallSum += score
        overallCount++
      }

      // Per-kind CO attainment from blueprint leaf scores when available
      if (blueprints) {
        for (const kind of ['tt1', 'tt2'] as TTKind[]) {
          const blueprint = blueprints[kind]
          if (!blueprint || !blueprint.nodes) continue
          const leafScores = kind === 'tt1' ? patches?.[student.id]?.tt1LeafScores : patches?.[student.id]?.tt2LeafScores
          const observedPct = getObservedTermTestPct(student, kind)
          if (!leafScores && observedPct === null) continue
          let coMax = 0, coScore = 0
          for (const node of blueprint.nodes) {
            for (const leaf of getLeaves(node)) {
              if (!leaf.cos.includes(co.id)) continue
              coMax += leaf.maxMarks
              if (leafScores) {
                coScore += leafScores[leaf.id] ?? 0
              } else if (observedPct !== null) {
                coScore += (observedPct / 100) * leaf.maxMarks
              }
            }
          }
          const pct = coMax > 0 ? Math.round((coScore / coMax) * 100) : null
          if (pct != null) {
            if (kind === 'tt1') { tt1Sum += pct; tt1Count++ }
            else { tt2Sum += pct; tt2Count++ }
          }
        }
      }
    }

    return {
      coId: co.id,
      desc: co.desc,
      bloom: co.bloom,
      target: 60,
      tt1Attainment: tt1Count > 0 ? Math.round(tt1Sum / tt1Count) : null,
      tt2Attainment: tt2Count > 0 ? Math.round(tt2Sum / tt2Count) : null,
      overallAttainment: overallCount > 0 ? Math.round(overallSum / overallCount) : null,
      studentsCounted: overallCount,
    }
  })
}

export function getEntryLockMap(offering: Offering): EntryLockMap {
  return {
    tt1: !!offering.tt1Locked,
    tt2: !!offering.tt2Locked,
    quiz: !!offering.quizLocked,
    assignment: !!offering.asgnLocked,
    attendance: false,
    finals: !!offering.finalsLocked,
  }
}

function deriveBandFromRisk(riskProb: number): Student['riskBand'] {
  if (riskProb >= 0.70) return 'High'
  if (riskProb >= 0.35) return 'Medium'
  return 'Low'
}

function buildDeterministicReasons(student: Student, attendancePct: number, coScores: COScore[]): Student['reasons'] {
  const reasons: Student['reasons'] = []
  if (attendancePct < 65) reasons.push({ label: `Attendance critically low (${attendancePct}%)`, impact: 0.34, feature: 'attendance' })
  else if (attendancePct < 75) reasons.push({ label: `Attendance below threshold (${attendancePct}%)`, impact: 0.22, feature: 'attendance' })

  if (student.tt1Score !== null && student.tt1Max > 0) {
    const pct = Math.round((student.tt1Score / student.tt1Max) * 100)
    if (pct < 40) reasons.push({ label: `Very low TT1 score (${student.tt1Score}/${student.tt1Max})`, impact: 0.31, feature: 'tt1' })
    else if (pct < 60) reasons.push({ label: `Below-average TT1 (${student.tt1Score}/${student.tt1Max})`, impact: 0.18, feature: 'tt1' })
  }

  if (student.prevCgpa < 6) reasons.push({ label: `Weak previous CGPA (${student.prevCgpa.toFixed(1)})`, impact: 0.22, feature: 'cgpa' })
  else if (student.prevCgpa < 7) reasons.push({ label: `Below-average prev CGPA (${student.prevCgpa.toFixed(1)})`, impact: 0.12, feature: 'cgpa' })

  const weakCO = coScores.filter(co => co.attainment < 40).sort((left, right) => left.attainment - right.attainment)[0]
  if (weakCO) reasons.push({ label: `Weak ${weakCO.coId} attainment (${weakCO.attainment}%)`, impact: 0.19, feature: 'co' })

  if (student.quiz1 !== null && student.quiz1 < 4) reasons.push({ label: `Low quiz performance (${student.quiz1}/10)`, impact: 0.09, feature: 'quiz' })

  return reasons.sort((left, right) => right.impact - left.impact).slice(0, 4)
}

function buildDeterministicWhatIf(riskProb: number, attendancePct: number, coScores: COScore[]): Student['whatIf'] {
  const scenarios: Student['whatIf'] = []
  if (attendancePct < 75) {
    const newRisk = roundRisk(Math.max(0.08, riskProb - 0.22))
    scenarios.push({ label: 'Improve attendance to 75%', current: `${attendancePct}%`, target: '75%', currentRisk: riskProb, newRisk })
  }
  const weak = coScores.filter(co => co.attainment < 50).sort((left, right) => left.attainment - right.attainment)[0]
  if (weak) {
    const newRisk = roundRisk(Math.max(0.12, riskProb - 0.18))
    scenarios.push({ label: `${weak.coId} attainment >= 50% in TT2`, current: `${weak.attainment}%`, target: '50%', currentRisk: riskProb, newRisk })
  }
  return scenarios
}

export function derivePatchedRiskState(offering: Offering, student: Student, coScores: COScore[]) {
  const attendancePct = Math.round((student.present / Math.max(1, student.totalClasses)) * 100)
  const flags = {
    ...student.flags,
    backlog: student.flags.backlog || student.prevCgpa < 5.5,
    lowAttendance: attendancePct < 75,
  }

  if (offering.stage < 2 || student.tt1Score === null) {
    return {
      riskProb: null,
      riskBand: null,
      reasons: [],
      whatIf: [],
      flags,
    } satisfies Pick<Student, 'riskProb' | 'riskBand' | 'reasons' | 'whatIf' | 'flags'>
  }

  let base = 0
  if (attendancePct < 65) base += 0.35
  else if (attendancePct < 75) base += 0.18

  const tt1Pct = student.tt1Max > 0 ? student.tt1Score / student.tt1Max : 0
  if (tt1Pct < 0.4) base += 0.30
  else if (tt1Pct < 0.6) base += 0.14

  if (student.prevCgpa < 6) base += 0.22
  else if (student.prevCgpa < 7) base += 0.10

  base += coScores.filter(co => co.attainment < 40).length * 0.05

  const riskProb = roundRisk(clampNumber(base, 0.05, 0.95))
  const riskBand = deriveBandFromRisk(riskProb)
  const reasons = riskProb >= 0.35 ? buildDeterministicReasons(student, attendancePct, coScores) : []
  const whatIf = riskProb >= 0.35 ? buildDeterministicWhatIf(riskProb, attendancePct, coScores) : []

  return {
    riskProb,
    riskBand,
    reasons,
    whatIf,
    flags,
  } satisfies Pick<Student, 'riskProb' | 'riskBand' | 'reasons' | 'whatIf' | 'flags'>
}

