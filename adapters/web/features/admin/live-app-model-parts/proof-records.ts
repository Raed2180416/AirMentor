import type { ApiSimulationStageCheckpointSummary } from '@web/shared/api/types'
import {
  type LiveAdminProofProvenance,
  type LiveAdminRoute,
  type LiveAdminSearchScope,
} from '../system-admin-live-data'
import { describeProofAvailability, describeProofProvenance } from '@web/simulation/proof-provenance'
import {
  isCanonicalProofBatchId,
  scopeTargetsCanonicalProofHierarchy,
} from '@web/simulation/proof-pilot'

export type ProvenancedRecord = Partial<LiveAdminProofProvenance>

export function hasRecordProofProvenance(record: ProvenancedRecord | null | undefined): record is LiveAdminProofProvenance {
  return !!record?.scopeDescriptor
    && !!record.resolvedFrom
    && !!record.scopeMode
    && !!record.countSource
}

export function formatRecordProofBanner(record: ProvenancedRecord | null | undefined) {
  if (!hasRecordProofProvenance(record)) return null
  return record.countSource === 'unavailable'
    ? describeProofAvailability(record)
    : describeProofProvenance(record)
}

export function shouldShowProofCheckpointCgpa(input: {
  proofScopeActive: boolean
  semesterNumber?: number | null
  stageKey?: string | null
}) {
  if (!input.proofScopeActive) return true
  return (input.semesterNumber ?? 0) > 1 && input.stageKey !== 'pre-tt1'
}

export function shouldOverlayProofCheckpointStudentSummary(input: {
  routeSection: LiveAdminRoute['section']
  studentBatchId?: string | null
  selectedProofCheckpoint?: Pick<ApiSimulationStageCheckpointSummary, 'simulationStageCheckpointId'> | null
  registryScope?: Pick<LiveAdminSearchScope, 'academicFacultyId' | 'departmentId' | 'branchId' | 'batchId'> | null
}) {
  if (input.routeSection !== 'students' || !input.selectedProofCheckpoint?.simulationStageCheckpointId) return false
  return scopeTargetsCanonicalProofHierarchy(input.registryScope) || isCanonicalProofBatchId(input.studentBatchId)
}
