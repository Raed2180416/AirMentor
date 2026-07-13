// Demo workspace and demo provisioning preview/result contracts.
// Extracted verbatim from '../types'.

export type ApiDemoWorkspace = {
  demoWorkspaceId: string
  name: string
  ownerFacultyId: string | null
  batchId: string | null
  scopeKind: string
  scopeName: string | null
  sourceBatchId: string | null
  activeSimulationRunId: string | null
  createdByFacultyId: string | null
  stoppedAt: string | null
  resetAt: string | null
  metadataJson: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export type ApiDemoProvisioningPreview = {
  batchLabel: string
  termLabel: string
  sections: string[]
  estimatedStudentCount: number
  estimatedOfferingCount: number
  curriculumCourseCount: number
}

export type ApiDemoProvisioningResult = {
  demoWorkspaceId: string
  activeSimulationRunId: string
  provisionedCounts: {
    students: number
    enrollments: number
    offerings: number
    ownerships: number
    runs: number
    checkpoints: number
    observedStates: number
    riskAssessments: number
  }
}
