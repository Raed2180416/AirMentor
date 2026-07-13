import type { RiskBand, Stage } from '@kernel/shared/domain'

export type StageInfo = {
  stage: Stage
  label: string
  desc: string
  color: string
}

export type SHAPReason = {
  label: string
  impact: number
  feature: string
}

export type COScore = {
  coId: string
  attainment: number
}

export type WhatIf = {
  label: string
  current: string
  target: string
  currentRisk: number
  newRisk: number
}

export type Intervention = {
  date: string
  type: string
  note: string
}

export type CoAttainmentRow = {
  coId: string
  desc: string
  bloom: string
  target: number
  tt1Attainment: number | null
  tt2Attainment: number | null
  overallAttainment: number | null
  studentsCounted: number
}

export type CODef = {
  id: string
  desc: string
  bloom: string
}

export type PaperQ = {
  id: string
  text: string
  maxMarks: number
  cos: string[]
}

export type Offering = {
  id: string
  offId: string
  code: string
  title: string
  year: string
  dept: string
  sem: number
  section: string
  count: number
  attendance: number
  credits?: number
  stage: Stage
  stageInfo: StageInfo
  tt1Done: boolean
  tt2Done: boolean
  tt1Locked?: boolean
  tt2Locked?: boolean
  quizLocked?: boolean
  asgnLocked?: boolean
  finalsLocked?: boolean
  pendingAction: string | null
  sections: string[]
  enrolled: number[]
  att: number[]
}

export type TranscriptSubjectRecord = {
  code: string
  title: string
  credits: number
  score: number
  gradeLabel: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F'
  gradePoint: 0 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  result: 'Passed' | 'Failed' | 'Repeated'
}

export type TranscriptTerm = {
  termId: string
  label: string
  semesterNumber: number
  academicYear: string
  sgpa: number
  registeredCredits: number
  earnedCredits: number
  backlogCount: number
  subjects: TranscriptSubjectRecord[]
}

export type StudentHistoryRecord = {
  usn: string
  studentName: string
  program: string
  dept: string
  trend: 'Improving' | 'Stable' | 'Declining'
  currentCgpa: number
  completedCreditsForCgpa: number
  progressionStatus: 'Eligible' | 'Review' | 'Hold'
  advisoryNotes: string[]
  repeatSubjects: string[]
  electiveRecommendation?: {
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string
    alternatives: Array<{ code: string; title: string; stream: string }>
  } | null
  terms: TranscriptTerm[]
}

export type Student = {
  id: string
  usn: string
  name: string
  phone: string
  present: number
  totalClasses: number
  tt1Score: number | null
  tt1Max: number
  tt2Score: number | null
  tt2Max: number
  quiz1: number | null
  quiz2: number | null
  asgn1: number | null
  asgn2: number | null
  quizScores?: Record<string, number>
  assignmentScores?: Record<string, number>
  prevCgpa: number
  currentCgpa?: number
  seeScore?: number | null
  finalScore100?: number | null
  predictedCgpa?: number | null
  proofObservedAttendancePct?: number | null
  proofObservedTt1Pct?: number | null
  proofObservedTt2Pct?: number | null
  proofObservedQuizPct?: number | null
  proofObservedAssignmentPct?: number | null
  proofObservedSeePct?: number | null
  proofRiskProbScaled?: number | null
  proofRiskChangeFromPreviousCheckpointScaled?: number | null
  proofCounterfactualLiftScaled?: number | null
  riskProb: number | null
  riskBand: RiskBand | null
  reasons: SHAPReason[]
  coScores: COScore[]
  whatIf: WhatIf[]
  interventions: Intervention[]
  flags: { backlog: boolean; lowAttendance: boolean; declining: boolean }
}
