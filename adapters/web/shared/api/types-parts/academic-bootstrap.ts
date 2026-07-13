// Academic meeting/CO-attainment aliases, the academic bootstrap payload,
// runtime-key alias, admin offering, offering stage eligibility, and batch
// provisioning request/response contracts. Extracted verbatim from '../types'.

import type {
  CoAttainmentRow,
  Mentee,
  Offering,
  Professor,
  Student,
  StudentHistoryRecord,
  SubjectRun,
  TeacherInfo,
  YearGroup,
} from '@web/simulation/fixtures'
import type {
  AcademicMeeting,
  FacultyAccount,
  SchemeState,
  TTKind,
  TermTestBlueprint,
} from '@kernel/shared/domain'
import type { ApiAcademicRuntimeState } from './academic-runtime'
import type { ApiCourseOutcome, ApiProofRefresh } from './curriculum'
import type {
  ApiStageEvidenceKind,
  ApiStagePolicyPayload,
  ApiStagePolicyStage,
} from './policy'

export type ApiAcademicMeeting = AcademicMeeting
export type ApiCoAttainmentRow = CoAttainmentRow

export type ApiAcademicBootstrap = {
  professor: Professor
  faculty: FacultyAccount[]
  offerings: Offering[]
  yearGroups: YearGroup[]
  mentees: Mentee[]
  teachers: TeacherInfo[]
  subjectRuns: SubjectRun[]
  studentsByOffering: Record<string, Student[]>
  studentHistoryByUsn: Record<string, StudentHistoryRecord>
  runtime: ApiAcademicRuntimeState
  courseOutcomesByOffering: Record<string, ApiCourseOutcome[]>
  assessmentSchemesByOffering: Record<string, SchemeState>
  questionPapersByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  coAttainmentByOffering: Record<string, ApiCoAttainmentRow[]>
  meetings: ApiAcademicMeeting[]
  proofPlayback?: {
    simulationStageCheckpointId: string
    simulationRunId: string
    semesterNumber: number
    stageKey: string
    stageLabel: string
    stageDescription: string
    stageOrder: number
    previousCheckpointId: string | null
    nextCheckpointId: string | null
  } | null
}

export type ApiAcademicRuntimeKey = keyof ApiAcademicRuntimeState

export type ApiAdminOffering = Offering & {
  termId?: string
  branchId?: string
  version?: number
  finalsLocked?: boolean
}

export type ApiOfferingStageEligibility = {
  offeringId: string
  batchId: string | null
  policy: ApiStagePolicyPayload
  currentStage: ApiStagePolicyStage
  nextStage: ApiStagePolicyStage | null
  eligible: boolean
  blockingReasons: string[]
  queueBurden: number
  evidenceStatus: Array<{
    kind: ApiStageEvidenceKind
    required: boolean
    present: boolean
    presentCount: number
    expectedCount: number
    locked: boolean
  }>
}

export type ApiBatchProvisioningRequest = {
  termId: string
  sectionLabels?: string[]
  mode?: 'live-empty' | 'mock' | 'manual'
  studentsPerSection?: number
  facultyPoolIds?: string[]
  createStudents?: boolean
  createMentors?: boolean
  createAttendanceScaffolding?: boolean
  createAssessmentScaffolding?: boolean
  createTranscriptScaffolding?: boolean
}

export type ApiBatchProvisioningResponse = {
  ok: true
  batchId: string
  termId: string
  sections: string[]
  affectedBatchIds: string[]
  proofRefresh?: ApiProofRefresh
  summary: {
    createdOfferingCount: number
    createdStudentCount: number
    createdEnrollmentCount: number
    createdMentorCount: number
    createdAttendanceCount: number
    createdAssessmentCount: number
    createdTranscriptCount: number
    facultyPoolCount: number
    mentorFacultyPoolCount: number
    curriculumCourseCount: number
  }
  policyFingerprint: ApiStagePolicyPayload
  curriculumFeatureProfileFingerprint: string
}
