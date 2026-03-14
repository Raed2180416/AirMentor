import { createContext, useContext } from 'react'
import {
  PAPER_MAP,
  getStudents,
  type Offering,
  type PaperQ,
  type Student,
  type StudentHistoryRecord,
} from './data'
import {
  type AssessmentComponentDefinition,
  type AssessmentComponentKind,
  type DerivedAcademicProjection,
  type EntryLockMap,
  type EvaluationScheme,
  type SchemeState,
  type StudentRuntimePatch,
  type TTKind,
  type TermTestBlueprint,
  type TermTestNode,
} from './domain'

export type SelectorState = {
  studentPatches: Record<string, StudentRuntimePatch>
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function toStudentPatchKey(offId: string, studentId: string) {
  return `${offId}::${studentId}`
}

export function buildDefaultAssessmentComponents(kind: AssessmentComponentKind, count: 0 | 1 | 2) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${kind}-${index + 1}`,
    label: `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${index + 1}`,
    rawMax: 10,
  }))
}

export function sanitizeAssessmentComponents(kind: AssessmentComponentKind, count: 0 | 1 | 2, components?: AssessmentComponentDefinition[]) {
  const base = components && components.length > 0 ? components.slice(0, count) : buildDefaultAssessmentComponents(kind, count)
  return Array.from({ length: count }, (_, index) => ({
    id: base[index]?.id ?? `${kind}-${index + 1}`,
    label: base[index]?.label?.trim() || `${kind === 'quiz' ? 'Quiz' : 'Assignment'} ${index + 1}`,
    rawMax: clampNumber(Math.round(base[index]?.rawMax ?? 10), 1, 100),
  }))
}

export function defaultSchemeForOffering(offering: Offering): SchemeState {
  const finalsMax = offering.code === 'CS702' ? 100 : 50
  const quizWeight: number = offering.stageInfo.stage >= 2 ? (offering.code === 'CS401' ? 20 : 10) : 10
  const assignmentWeight: number = 30 - quizWeight
  return {
    finalsMax,
    quizWeight,
    assignmentWeight,
    quizCount: quizWeight === 0 ? 0 : offering.code === 'CS401' ? 2 : 1,
    assignmentCount: assignmentWeight === 0 ? 0 : offering.code === 'CS401' ? 2 : 1,
    quizComponents: sanitizeAssessmentComponents('quiz', quizWeight === 0 ? 0 : offering.code === 'CS401' ? 2 : 1),
    assignmentComponents: sanitizeAssessmentComponents('assignment', assignmentWeight === 0 ? 0 : offering.code === 'CS401' ? 2 : 1),
    status: 'Needs Setup',
  }
}

export function normalizeSchemeState(input: Partial<SchemeState> | undefined, offering: Offering): SchemeState {
  const defaults = defaultSchemeForOffering(offering)
  const quizCount = (input?.quizCount ?? defaults.quizCount) as 0 | 1 | 2
  const assignmentCount = (input?.assignmentCount ?? defaults.assignmentCount) as 0 | 1 | 2
  return {
    finalsMax: (input?.finalsMax ?? defaults.finalsMax) as 50 | 100,
    quizWeight: input?.quizWeight ?? defaults.quizWeight,
    assignmentWeight: input?.assignmentWeight ?? defaults.assignmentWeight,
    quizCount,
    assignmentCount,
    quizComponents: sanitizeAssessmentComponents('quiz', quizCount, input?.quizComponents ?? defaults.quizComponents),
    assignmentComponents: sanitizeAssessmentComponents('assignment', assignmentCount, input?.assignmentComponents ?? defaults.assignmentComponents),
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

function sumScores(values?: Record<string, number>) {
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

function getSubjectBand(score: number): DerivedAcademicProjection['bandLabel'] {
  if (score > 90) return 'O'
  if (score > 74) return 'A+'
  if (score > 60) return 'A'
  if (score >= 55) return 'B+'
  if (score >= 50) return 'B'
  if (score > 44) return 'C'
  if (score >= 40) return 'P'
  return 'F'
}

function getGradePointFromBand(band: DerivedAcademicProjection['bandLabel']): DerivedAcademicProjection['gradePoint'] {
  return band === 'O' ? 10
    : band === 'A+' ? 9
    : band === 'A' ? 8
    : band === 'B+' ? 7
    : band === 'B' ? 6
    : band === 'C' ? 5
    : band === 'P' ? 4
    : 0
}

function projectPredictedCgpa(baseCgpa: number, gradePoint: DerivedAcademicProjection['gradePoint']) {
  const base = baseCgpa > 0 ? baseCgpa : 6
  return Math.round((((base * 5) + gradePoint) / 6) * 100) / 100
}

export function computeEvaluation(student: Student, scheme: EvaluationScheme) {
  const tt1Scaled = student.tt1Score !== null && student.tt1Max > 0 ? (student.tt1Score / student.tt1Max) * 15 : 0
  const tt2Scaled = student.tt2Score !== null && student.tt2Max > 0 ? (student.tt2Score / student.tt2Max) * 15 : 0
  const quizVals = scheme.quizComponents.map((component, index) => ({
    score: index === 0 ? student.quiz1 : student.quiz2,
    max: component.rawMax,
  })).filter(item => item.score !== null)
  const assignmentVals = scheme.assignmentComponents.map((component, index) => ({
    score: index === 0 ? student.asgn1 : student.asgn2,
    max: component.rawMax,
  })).filter(item => item.score !== null)
  const quizPct = quizVals.length > 0 ? quizVals.reduce((acc, item) => acc + ((item.score ?? 0) / Math.max(1, item.max)), 0) / quizVals.length : 0
  const assignmentPct = assignmentVals.length > 0 ? assignmentVals.reduce((acc, item) => acc + ((item.score ?? 0) / Math.max(1, item.max)), 0) / assignmentVals.length : 0
  const quizScaled = scheme.quizCount === 0 || scheme.quizWeight === 0 ? 0 : quizPct * scheme.quizWeight
  const assignmentScaled = scheme.assignmentCount === 0 || scheme.assignmentWeight === 0 ? 0 : assignmentPct * scheme.assignmentWeight
  const ce60 = tt1Scaled + tt2Scaled + quizScaled + assignmentScaled
  const overall40 = (ce60 / 60) * 40
  return { tt1Scaled, tt2Scaled, quizScaled, asgnScaled: assignmentScaled, assignmentScaled, ce60, overall40 }
}

export function getEntryLockMap(offering: Offering): EntryLockMap {
  return {
    tt1: !!offering.tt1Locked,
    tt2: !!offering.tt2Locked,
    quiz: !!offering.quizLocked,
    assignment: !!offering.asgnLocked,
    attendance: false,
    finals: false,
  }
}

export function createAppSelectors(state: SelectorState) {
  const getSchemeForOffering = (offering: Offering) => state.schemeByOffering[offering.offId] ?? defaultSchemeForOffering(offering)
  const getBlueprintsForOffering = (offering: Offering) => state.ttBlueprintsByOffering[offering.offId] ?? {
    tt1: seedBlueprintFromPaper('tt1', PAPER_MAP[offering.code] || PAPER_MAP.default),
    tt2: seedBlueprintFromPaper('tt2', PAPER_MAP[offering.code] || PAPER_MAP.default),
  }
  const getStudentPatch = (offeringId: string, studentId: string) => state.studentPatches[toStudentPatchKey(offeringId, studentId)] ?? {}

  const getStudentsPatched = (offering: Offering): Student[] => {
    const scheme = getSchemeForOffering(offering)
    const blueprints = getBlueprintsForOffering(offering)
    const tt1Leaves = flattenBlueprintLeaves(blueprints.tt1.nodes)
    const tt2Leaves = flattenBlueprintLeaves(blueprints.tt2.nodes)
    return getStudents(offering).map(student => {
      const patch = getStudentPatch(offering.offId, student.id)
      if (!state.studentPatches[toStudentPatchKey(offering.offId, student.id)]) {
        return {
          ...student,
          tt1Max: blueprints.tt1.totalMarks,
          tt2Max: blueprints.tt2.totalMarks,
        }
      }
      const totalClasses = patch.totalClasses ?? student.totalClasses
      const present = clampNumber(patch.present ?? student.present, 0, Math.max(1, totalClasses))
      const tt1Score = patch.tt1LeafScores ? clampNumber(sumScores(patch.tt1LeafScores), 0, blueprints.tt1.totalMarks) : student.tt1Score
      const tt2Score = patch.tt2LeafScores ? clampNumber(sumScores(patch.tt2LeafScores), 0, blueprints.tt2.totalMarks) : student.tt2Score
      const quizScores = scheme.quizComponents.map((component, index) => patch.quizScores?.[component.id] ?? (index === 0 ? student.quiz1 : student.quiz2) ?? null)
      const assignmentScores = scheme.assignmentComponents.map((component, index) => patch.assignmentScores?.[component.id] ?? (index === 0 ? student.asgn1 : student.asgn2) ?? null)
      return {
        ...student,
        present,
        totalClasses,
        tt1Score,
        tt2Score,
        tt1Max: blueprints.tt1.totalMarks || (tt1Leaves.length > 0 ? tt1Leaves.reduce((acc, leaf) => acc + leaf.maxMarks, 0) : student.tt1Max),
        tt2Max: blueprints.tt2.totalMarks || (tt2Leaves.length > 0 ? tt2Leaves.reduce((acc, leaf) => acc + leaf.maxMarks, 0) : student.tt2Max),
        quiz1: quizScores[0] ?? null,
        quiz2: quizScores[1] ?? null,
        asgn1: assignmentScores[0] ?? null,
        asgn2: assignmentScores[1] ?? null,
      }
    })
  }

  const getOfferingAttendancePatched = (offering: Offering) => {
    const students = getStudentsPatched(offering)
    if (students.length === 0) return 0
    return Math.round(students.reduce((acc, student) => acc + (student.present / Math.max(1, student.totalClasses)) * 100, 0) / students.length)
  }

  const deriveAcademicProjection = (input: { offering: Offering; student: Student; scheme?: SchemeState; history?: StudentHistoryRecord | null }): DerivedAcademicProjection => {
    const scheme = input.scheme ?? getSchemeForOffering(input.offering)
    const patch = getStudentPatch(input.offering.offId, input.student.id)
    const evaluation = computeEvaluation(input.student, scheme)
    const attendancePct = Math.round((input.student.present / Math.max(1, input.student.totalClasses)) * 100)
    const seeRaw = typeof patch.seeScore === 'number' ? patch.seeScore : null
    const seeScaled40 = seeRaw !== null ? (seeRaw / Math.max(1, scheme.finalsMax)) * 40 : 0
    const finalScore100 = evaluation.ce60 + seeScaled40
    const bandLabel = getSubjectBand(finalScore100)
    const gradePoint = getGradePointFromBand(bandLabel)
    const baseCgpa = input.history?.currentCgpa ?? input.student.prevCgpa
    return {
      attendancePct,
      tt1Raw: input.student.tt1Score,
      tt2Raw: input.student.tt2Score,
      tt1Scaled: evaluation.tt1Scaled,
      tt2Scaled: evaluation.tt2Scaled,
      quizRawTotal: scheme.quizComponents.reduce((acc, _component, index) => acc + ((index === 0 ? input.student.quiz1 : input.student.quiz2) ?? 0), 0),
      assignmentRawTotal: scheme.assignmentComponents.reduce((acc, _component, index) => acc + ((index === 0 ? input.student.asgn1 : input.student.asgn2) ?? 0), 0),
      quizScaled: evaluation.quizScaled,
      asgnScaled: evaluation.asgnScaled,
      ce60: evaluation.ce60,
      seeRaw,
      seeScaled40,
      finalScore100,
      bandLabel,
      gradePoint,
      predictedCgpa: projectPredictedCgpa(baseCgpa, gradePoint),
    }
  }

  return {
    getSchemeForOffering,
    getBlueprintsForOffering,
    getStudentPatch,
    getStudentsPatched,
    getOfferingAttendancePatched,
    deriveAcademicProjection,
  }
}

export type AppSelectors = ReturnType<typeof createAppSelectors>

export const AppSelectorsContext = createContext<AppSelectors | null>(null)

export function useAppSelectors() {
  const value = useContext(AppSelectorsContext)
  if (!value) {
    throw new Error('App selectors context is unavailable.')
  }
  return value
}
