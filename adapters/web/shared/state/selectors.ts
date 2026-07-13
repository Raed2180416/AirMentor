import { createContext, useContext } from 'react'
import type {
  DerivedAcademicProjection,
  SchemeState,
  StudentRuntimePatch,
  TTKind,
  TermTestBlueprint,
} from '@kernel/shared/domain'
import type { Offering, Student, StudentHistoryRecord } from '@kernel/shared/simulation-domain'
import {
  buildComponentScoreMap,
  buildUnavailableBlueprint,
  clampNumber,
  computeStageAwareEvaluation,
  computeStudentCoScores,
  defaultSchemeForOffering,
  derivePatchedRiskState,
  flattenBlueprintLeaves,
  getAssessmentComponentScore,
  getGradePointFromBand,
  getSubjectBand,
  isCeComponentVisibleAtStage,
  isPatchEmpty,
  projectPredictedCgpa,
  seedBlueprintFromPaper,
  sumScores,
  toStudentPatchKey,
} from '@kernel/grading/assessment-weights'
import { CO_MAP, PAPER_MAP, getStudents } from '@web/simulation/fixtures'

export type SelectorState = {
  studentPatches: Record<string, StudentRuntimePatch>
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  studentsByOffering?: Record<string, Student[]>
  studentSourceMode: 'live' | 'seeded'
}

export type AppSelectors = ReturnType<typeof createAppSelectors>

export function createAppSelectors(state: SelectorState) {
  const getSchemeForOffering = (offering: Offering) => state.schemeByOffering[offering.offId] ?? defaultSchemeForOffering(offering)
  const getBlueprintsForOffering = (offering: Offering) => {
    const sourcedBlueprints = state.ttBlueprintsByOffering[offering.offId]
    if (sourcedBlueprints) return sourcedBlueprints
    if (state.studentSourceMode === 'live') {
      return {
        tt1: buildUnavailableBlueprint('tt1'),
        tt2: buildUnavailableBlueprint('tt2'),
      }
    }
    return {
      tt1: seedBlueprintFromPaper('tt1', PAPER_MAP[offering.code] || PAPER_MAP.default),
      tt2: seedBlueprintFromPaper('tt2', PAPER_MAP[offering.code] || PAPER_MAP.default),
    }
  }
  const getStudentPatch = (offeringId: string, studentId: string) => {
    const normalizedStudentId = studentId.includes('::') ? (studentId.split('::').at(-1) ?? studentId) : studentId
    return state.studentPatches[toStudentPatchKey(offeringId, studentId)]
      ?? state.studentPatches[toStudentPatchKey(offeringId, normalizedStudentId)]
      ?? {}
  }

  const getStudentsPatched = (offering: Offering): Student[] => {
    const scheme = getSchemeForOffering(offering)
    const blueprints = getBlueprintsForOffering(offering)
    const tt1Leaves = flattenBlueprintLeaves(blueprints.tt1.nodes)
    const tt2Leaves = flattenBlueprintLeaves(blueprints.tt2.nodes)
    const baseStudents = state.studentSourceMode === 'live'
      ? (state.studentsByOffering?.[offering.offId] ?? [])
      : (state.studentsByOffering?.[offering.offId] ?? getStudents(offering))
    return baseStudents.map(student => {
      const patch = getStudentPatch(offering.offId, student.id)
      if (isPatchEmpty(patch)) {
        const hasTt1Blueprint = blueprints.tt1.totalMarks > 0 || blueprints.tt1.nodes.length > 0
        const hasTt2Blueprint = blueprints.tt2.totalMarks > 0 || blueprints.tt2.nodes.length > 0
        return {
          ...student,
          tt1Max: hasTt1Blueprint ? blueprints.tt1.totalMarks : student.tt1Max,
          tt2Max: hasTt2Blueprint ? blueprints.tt2.totalMarks : student.tt2Max,
        }
      }
      const totalClasses = patch.totalClasses ?? student.totalClasses
      const present = clampNumber(patch.present ?? student.present, 0, Math.max(1, totalClasses))
      const tt1Score = patch.tt1LeafScores ? clampNumber(sumScores(patch.tt1LeafScores), 0, blueprints.tt1.totalMarks) : student.tt1Score
      const tt2Score = patch.tt2LeafScores ? clampNumber(sumScores(patch.tt2LeafScores), 0, blueprints.tt2.totalMarks) : student.tt2Score
      const quizScoreMap = buildComponentScoreMap(student, 'quiz', scheme.quizComponents, patch.quizScores)
      const assignmentScoreMap = buildComponentScoreMap(student, 'assignment', scheme.assignmentComponents, patch.assignmentScores)
      const quizScores = scheme.quizComponents.map(component => quizScoreMap[component.id] ?? null)
      const assignmentScores = scheme.assignmentComponents.map(component => assignmentScoreMap[component.id] ?? null)
      const patchedStudent: Student = {
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
        quizScores: Object.keys(quizScoreMap).length > 0 ? quizScoreMap : student.quizScores,
        assignmentScores: Object.keys(assignmentScoreMap).length > 0 ? assignmentScoreMap : student.assignmentScores,
      }
      const cos = CO_MAP[offering.code] || CO_MAP.default
      const hasUsableBlueprints = (['tt1', 'tt2'] as TTKind[]).some(kind => blueprints[kind].totalMarks > 0 || blueprints[kind].nodes.length > 0)
      const coScores = computeStudentCoScores(patchedStudent, cos, hasUsableBlueprints ? blueprints : undefined, patch)
      const riskState = derivePatchedRiskState(offering, patchedStudent, coScores)
      return {
        ...patchedStudent,
        coScores,
        ...riskState,
      }
    })
  }

  const getOfferingAttendancePatched = (offering: Offering) => {
    const students = getStudentsPatched(offering)
    if (students.length === 0) return 0
    return Math.round(students.reduce((acc, student) => acc + (student.present / Math.max(1, student.totalClasses)) * 100, 0) / students.length)
  }

  const deriveAcademicProjection = (input: { offering: Offering; student: Student; scheme?: SchemeState; history?: StudentHistoryRecord | null; stageKey?: string | null }): DerivedAcademicProjection => {
    const scheme = input.scheme ?? getSchemeForOffering(input.offering)
    const patch = getStudentPatch(input.offering.offId, input.student.id)
    const evaluation = computeStageAwareEvaluation(input.student, scheme, input.stageKey)
    const tt1Visible = isCeComponentVisibleAtStage('tt1', input.stageKey)
    const tt2Visible = isCeComponentVisibleAtStage('tt2', input.stageKey)
    const quizVisible = isCeComponentVisibleAtStage('quiz', input.stageKey)
    const assignmentVisible = isCeComponentVisibleAtStage('assignment', input.stageKey)
    const proofPct = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? clampNumber(value, 0, 100) : null)
    const scaleProofPct = (value: number | null | undefined, weight: number) => {
      const pct = proofPct(value)
      return pct === null ? null : (pct / 100) * weight
    }
    const proofTt1Scaled = tt1Visible ? scaleProofPct(input.student.proofObservedTt1Pct, scheme.termTestWeights.tt1) : null
    const proofTt2Scaled = tt2Visible ? scaleProofPct(input.student.proofObservedTt2Pct, scheme.termTestWeights.tt2) : null
    const proofQuizScaled = quizVisible ? scaleProofPct(input.student.proofObservedQuizPct, scheme.quizWeight) : null
    const proofAssignmentScaled = assignmentVisible ? scaleProofPct(input.student.proofObservedAssignmentPct, scheme.assignmentWeight) : null
    const seeVisible = !input.stageKey || input.stageKey === 'post-see'
    const proofSeePct = seeVisible ? proofPct(input.student.proofObservedSeePct) : null
    const attendancePct = proofPct(input.student.proofObservedAttendancePct)
      ?? Math.round((input.student.present / Math.max(1, input.student.totalClasses)) * 100)
    const tt1Scaled = proofTt1Scaled ?? evaluation.tt1Scaled
    const tt2Scaled = proofTt2Scaled ?? evaluation.tt2Scaled
    const quizScaled = proofQuizScaled ?? evaluation.quizScaled
    const asgnScaled = proofAssignmentScaled ?? evaluation.asgnScaled
    const ce60 = tt1Scaled + tt2Scaled + quizScaled + asgnScaled
    const patchedSeeRaw = seeVisible && typeof patch.seeScore === 'number'
      ? patch.seeScore
      : seeVisible && typeof input.student.seeScore === 'number'
        ? input.student.seeScore
        : null
    const seeRaw = patchedSeeRaw ?? (proofSeePct !== null ? (proofSeePct / 100) * scheme.finalsMax : null)
    const seeScaled40 = patchedSeeRaw !== null
      ? (patchedSeeRaw / Math.max(1, scheme.finalsMax)) * scheme.policyContext.see
      : proofSeePct !== null
        ? (proofSeePct / 100) * scheme.policyContext.see
        : null
    const finalScore100 = seeVisible
      ? input.student.finalScore100 ?? (seeScaled40 !== null ? ce60 + seeScaled40 : null)
      : null
    const bandLabel = finalScore100 !== null ? getSubjectBand(finalScore100) : null
    const gradePoint = bandLabel !== null ? getGradePointFromBand(bandLabel) : null
    const baseCgpa = input.history?.currentCgpa ?? input.student.currentCgpa ?? input.student.prevCgpa
    const completedCredits = input.history?.completedCreditsForCgpa ?? 0
    const subjectCredits = input.offering.credits ?? 0
    return {
      attendancePct,
      tt1Raw: tt1Visible ? input.student.tt1Score : null,
      tt2Raw: tt2Visible ? input.student.tt2Score : null,
      tt1Scaled,
      tt2Scaled,
      quizRawTotal: proofQuizScaled !== null
        ? (proofQuizScaled / Math.max(1, scheme.quizWeight)) * scheme.quizComponents.reduce((sum, component) => sum + component.rawMax, 0)
        : quizVisible ? scheme.quizComponents.reduce((acc, component, index) => acc + (getAssessmentComponentScore(input.student, 'quiz', component, index) ?? 0), 0) : 0,
      assignmentRawTotal: proofAssignmentScaled !== null
        ? (proofAssignmentScaled / Math.max(1, scheme.assignmentWeight)) * scheme.assignmentComponents.reduce((sum, component) => sum + component.rawMax, 0)
        : assignmentVisible ? scheme.assignmentComponents.reduce((acc, component, index) => acc + (getAssessmentComponentScore(input.student, 'assignment', component, index) ?? 0), 0) : 0,
      quizScaled,
      asgnScaled,
      ce60,
      seeRaw,
      seeScaled40,
      finalScore100,
      bandLabel,
      gradePoint,
      predictedCgpa: seeVisible ? input.student.predictedCgpa ?? projectPredictedCgpa(baseCgpa, gradePoint, completedCredits, subjectCredits) : null,
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

export {
  addBlueprintPart,
  addBlueprintQuestion,
  buildDefaultAssessmentComponents,
  canonicalizeBlueprintStructure,
  computeCoAttainmentRows,
  computeEvaluation,
  computeStageAwareEvaluation,
  defaultSchemeForOffering,
  flattenBlueprintLeaves,
  getAssessmentComponentScore,
  getEntryLockMap,
  getSchemeConfiguredCeWeight,
  isPatchEmpty,
  normalizeBlueprint,
  normalizeSchemeState,
  pruneScoreMap,
  removeBlueprintPart,
  removeBlueprintQuestion,
  sanitizeAssessmentComponents,
  seedBlueprintFromPaper,
  seedTermTestLeafScores,
  splitMarks,
  sumComponentWeightage,
  toLeafId,
  toStudentPatchKey,
} from '@kernel/grading/assessment-weights'

export const AppSelectorsContext = createContext<AppSelectors | null>(null)

export function useAppSelectors() {
  const value = useContext(AppSelectorsContext)
  if (!value) {
    throw new Error('App selectors context is unavailable.')
  }
  return value
}
