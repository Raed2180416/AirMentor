import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type {
  StudentDetailTab,
  StudentFormState,
  EnrollmentFormState,
  MentorAssignmentFormState,
  EditingEntity,
} from '../../live-app-model'
import type { ThemeMode } from '@kernel/shared/domain'
import type {
  ApiAuditEvent,
  ApiBatch,
  ApiStudentEnrollment,
  ApiMentorAssignment,
  ApiProofRunCheckpointStudentSummary,
  ApiSimulationStageCheckpointSummary,
  ApiStudentRecord,
} from '@web/shared/api/types'
import type { LiveAdminDataset, LiveAdminRoute, RegistryFilterState, UniversityScopeState } from '../../system-admin-live-data'

export type StudentsSectionProps = {
  data: LiveAdminDataset
  route: LiveAdminRoute
  themeMode: ThemeMode
  registryPageColumns: string
  registryFilterColumns: string
  registryIsSingleColumn: boolean
  registryScope: UniversityScopeState | null
  navigate: (route: LiveAdminRoute) => void
  // Student registry state
  studentRegistryItems: ApiStudentRecord[]
  studentRegistryViewItems: Array<{
    student: ApiStudentRecord
    proofOverlayActive: boolean
    checkpointSummary: ApiProofRunCheckpointStudentSummary | null
    displayCgpa: number | null
    displaySemester: number | null
    showCheckpointCgpa: boolean
  }>
  studentRegistryCaption: string
  studentRegistryEmptyMessage: string
  studentRegistryScopeLabel: string | null
  studentRegistryProofOverlayActive: boolean
  studentRegistrySearch: string
  setStudentRegistrySearch: (value: string) => void
  effectiveStudentRegistryFilter: RegistryFilterState
  setStudentRegistryFilter: (value: RegistryFilterState | ((prev: RegistryFilterState) => RegistryFilterState)) => void
  studentFilterDepartments: Array<{ departmentId: string; name: string }>
  studentFilterBranches: Array<{ branchId: string; name: string }>
  studentFilterBatches: ApiBatch[]
  studentFilterSections: string[]
  visibleAcademicFaculties: Array<{ academicFacultyId: string; name: string }>
  // Selected student state
  selectedStudent: ApiStudentRecord | null
  selectedStudentRouteIsExplicit: boolean
  selectedStudentScopeMismatch: boolean
  selectedStudentDisplayCgpa: number
  selectedStudentDisplaySemester: number | null
  selectedStudentDisplayBacklogCount: number | null
  selectedStudentCheckpointCgpaVisible: boolean
  selectedStudentCheckpointSummary: ApiProofRunCheckpointStudentSummary | null
  selectedStudentCheckpointBanner: string | null
  selectedStudentProofBanner: string | null
  selectedStudentPolicy: unknown
  selectedStudentPolicyLoading: boolean
  selectedStudentPromotionRecommended: boolean
  selectedStudentPromotionRules: {
    minimumCgpaForPromotion: number
    passMarkPercent: number
    requireNoActiveBacklogs: boolean
  }
  selectedStudentNextTerms: Array<{
    termId: string
    academicYearLabel: string
    semesterNumber: number
    startDate: string
    endDate: string
  }>
  selectedProofCheckpoint: ApiSimulationStageCheckpointSummary | null
  // Student detail tab
  studentDetailTab: StudentDetailTab
  setStudentDetailTab: Dispatch<SetStateAction<StudentDetailTab>>
  // Forms
  studentForm: StudentFormState
  setStudentForm: (value: StudentFormState | ((prev: StudentFormState) => StudentFormState)) => void
  enrollmentForm: EnrollmentFormState
  setEnrollmentForm: (value: EnrollmentFormState | ((prev: EnrollmentFormState) => EnrollmentFormState)) => void
  mentorForm: MentorAssignmentFormState
  setMentorForm: (value: MentorAssignmentFormState | ((prev: MentorAssignmentFormState) => MentorAssignmentFormState)) => void
  // Audit
  studentAuditLoading: boolean
  studentAuditEvents: ApiAuditEvent[]
  // Handlers
  handleSaveStudent: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveStudent: () => void
  handleCloseEnrollment: (enrollment: ApiStudentEnrollment) => void
  handleEndMentorAssignment: (assignment: ApiMentorAssignment) => void
  handlePromoteStudent: (termId: string) => void
  // Editor helpers
  setEditingEntity: (value: EditingEntity | null) => void
  resetStudentEditors: () => void
  startEditingEnrollment: (enrollment: ApiStudentEnrollment) => void
  startEditingMentorAssignment: (assignment: ApiMentorAssignment) => void
}
