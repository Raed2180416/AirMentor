import type { Dispatch, FormEvent, SetStateAction } from 'react'

import type {
  ApiAcademicFaculty,
  ApiAcademicTerm,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiFacultyRecord,
  ApiStudentRecord,
} from '../../api/types'
import type {
  AppointmentFormState,
  EditingEntity,
  EnrollmentFormState,
  EntityEditorState,
  FacultyFormState,
  MentorAssignmentFormState,
  RoleGrantFormState,
  StudentFormState,
} from '../live-app-model'

type FormSubmitHandler = (event: FormEvent<HTMLFormElement>) => void | Promise<void>
type ActionHandler = () => void | Promise<void>

export type EntityEditorModalsProps = {
  editingEntity: EditingEntity | null
  setEditingEntity: Dispatch<SetStateAction<EditingEntity | null>>
  selectedStudent: ApiStudentRecord | null
  selectedFacultyMember: ApiFacultyRecord | null
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
  selectedBranch: ApiBranch | null
  selectedBatch: ApiBatch | null
  studentForm: StudentFormState
  setStudentForm: Dispatch<SetStateAction<StudentFormState>>
  enrollmentForm: EnrollmentFormState
  setEnrollmentForm: Dispatch<SetStateAction<EnrollmentFormState>>
  mentorForm: MentorAssignmentFormState
  setMentorForm: Dispatch<SetStateAction<MentorAssignmentFormState>>
  facultyForm: FacultyFormState
  setFacultyForm: Dispatch<SetStateAction<FacultyFormState>>
  roleGrantForm: RoleGrantFormState
  setRoleGrantForm: Dispatch<SetStateAction<RoleGrantFormState>>
  appointmentForm: AppointmentFormState
  setAppointmentForm: Dispatch<SetStateAction<AppointmentFormState>>
  entityEditors: EntityEditorState
  setEntityEditors: Dispatch<SetStateAction<EntityEditorState>>
  visibleBranches: ApiBranch[]
  visibleTerms: ApiAcademicTerm[]
  visibleDepartments: ApiDepartment[]
  termsForEnrollment: ApiAcademicTerm[]
  mentorEligibleFaculty: ApiFacultyRecord[]
  branchesForAppointment: ApiBranch[]
  scopeOptions: { value: string; label: string }[]
  handleSaveStudent: FormSubmitHandler
  handleArchiveStudent: ActionHandler
  handleSaveEnrollment: FormSubmitHandler
  handleSaveMentorAssignment: FormSubmitHandler
  handleSaveFaculty: FormSubmitHandler
  handleArchiveFaculty: ActionHandler
  handleSaveRoleGrant: FormSubmitHandler
  handleSaveAppointment: FormSubmitHandler
  handleUpdateAcademicFaculty: FormSubmitHandler
  handleArchiveAcademicFaculty: ActionHandler
  handleRestoreAcademicFaculty: ActionHandler
  handleDeleteAcademicFaculty: ActionHandler
  handleUpdateDepartment: FormSubmitHandler
  handleArchiveDepartment: ActionHandler
  handleUpdateBranch: FormSubmitHandler
  handleArchiveBranch: ActionHandler
  handleUpdateBatch: FormSubmitHandler
  handleArchiveBatch: ActionHandler
}

export type StudentEditorModalsProps = Pick<EntityEditorModalsProps,
  | 'editingEntity'
  | 'setEditingEntity'
  | 'selectedStudent'
  | 'studentForm'
  | 'setStudentForm'
  | 'enrollmentForm'
  | 'setEnrollmentForm'
  | 'mentorForm'
  | 'setMentorForm'
  | 'visibleBranches'
  | 'visibleTerms'
  | 'termsForEnrollment'
  | 'mentorEligibleFaculty'
  | 'handleSaveStudent'
  | 'handleArchiveStudent'
  | 'handleSaveEnrollment'
  | 'handleSaveMentorAssignment'
>

export type FacultyEditorModalsProps = Pick<EntityEditorModalsProps,
  | 'editingEntity'
  | 'setEditingEntity'
  | 'selectedFacultyMember'
  | 'facultyForm'
  | 'setFacultyForm'
  | 'roleGrantForm'
  | 'setRoleGrantForm'
  | 'appointmentForm'
  | 'setAppointmentForm'
  | 'visibleDepartments'
  | 'branchesForAppointment'
  | 'scopeOptions'
  | 'handleSaveFaculty'
  | 'handleArchiveFaculty'
  | 'handleSaveRoleGrant'
  | 'handleSaveAppointment'
>

export type HierarchyEditorModalsProps = Pick<EntityEditorModalsProps,
  | 'editingEntity'
  | 'setEditingEntity'
  | 'selectedAcademicFaculty'
  | 'selectedDepartment'
  | 'selectedBranch'
  | 'selectedBatch'
  | 'entityEditors'
  | 'setEntityEditors'
  | 'handleUpdateAcademicFaculty'
  | 'handleArchiveAcademicFaculty'
  | 'handleRestoreAcademicFaculty'
  | 'handleDeleteAcademicFaculty'
  | 'handleUpdateDepartment'
  | 'handleArchiveDepartment'
  | 'handleUpdateBranch'
  | 'handleArchiveBranch'
  | 'handleUpdateBatch'
  | 'handleArchiveBatch'
>
