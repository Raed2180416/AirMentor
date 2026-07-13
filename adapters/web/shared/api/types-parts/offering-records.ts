// Offering ownership, attendance snapshots, assessment scores, student
// interventions, and transcript term/subject results.
// Extracted verbatim from '../types'.

export type ApiOfferingOwnership = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAttendanceSnapshot = {
  attendanceSnapshotId: string
  studentId: string
  offeringId: string
  presentClasses: number
  totalClasses: number
  attendancePercent: number
  source: string
  capturedAt: string
}

export type ApiAssessmentScore = {
  assessmentScoreId: string
  studentId: string
  offeringId: string
  termId: string | null
  componentType: 'tt1' | 'tt2' | 'quiz1' | 'quiz2' | 'asgn1' | 'asgn2' | 'sem_end' | 'lab' | 'viva' | 'other'
  componentCode: string | null
  score: number
  maxScore: number
  evaluatedAt: string
}

export type ApiStudentIntervention = {
  interventionId: string
  studentId: string
  facultyId: string | null
  offeringId: string | null
  interventionType: string
  note: string
  occurredAt: string
}

export type ApiTranscriptTermResult = {
  transcriptTermResultId: string
  studentId: string
  termId: string
  sgpaScaled: number
  registeredCredits: number
  earnedCredits: number
  backlogCount: number
}

export type ApiTranscriptSubjectResult = {
  transcriptSubjectResultId: string
  transcriptTermResultId: string
  courseCode: string
  title: string
  credits: number
  score: number
  gradeLabel: string
  gradePoint: number
  result: string
}
