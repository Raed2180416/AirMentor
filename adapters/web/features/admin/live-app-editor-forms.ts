import type { ApiRoleCode } from '@web/shared/api/types'

export type StructureFormState = {
  academicFaculty: { code: string; name: string; overview: string }
  department: { code: string; name: string }
  branch: { code: string; name: string; programLevel: string; semesterCount: string }
  batch: { admissionYear: string; batchLabel: string; currentSemester: string; sectionLabels: string }
  term: { academicYearLabel: string; semesterNumber: string; startDate: string; endDate: string }
  curriculum: { semesterNumber: string; courseCode: string; title: string; credits: string }
}

export type EntityEditorState = {
  academicFaculty: StructureFormState['academicFaculty']
  department: StructureFormState['department']
  branch: StructureFormState['branch']
  batch: StructureFormState['batch']
  term: StructureFormState['term'] & { termId: string }
  curriculum: StructureFormState['curriculum'] & { curriculumCourseId: string }
}

export type StudentFormState = {
  usn: string
  rollNumber: string
  name: string
  email: string
  phone: string
  admissionDate: string
}

export type EnrollmentFormState = {
  enrollmentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: string
  academicStatus: string
  startDate: string
  endDate: string
}

export type MentorAssignmentFormState = {
  assignmentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string
  source: string
}

export type FacultyFormState = {
  username: string
  password: string
  email: string
  phone: string
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string
}

export type AppointmentFormState = {
  appointmentId: string
  departmentId: string
  branchId: string
  isPrimary: boolean
  startDate: string
  endDate: string
}

export type RoleGrantFormState = {
  grantId: string
  roleCode: ApiRoleCode
  scopeType: string
  scopeId: string
  startDate: string
  endDate: string
}

export type OwnershipFormState = {
  ownershipId: string
  offeringId: string
  facultyId: string
}

export function defaultEntityEditorState(currentSemester = '1'): EntityEditorState {
  return {
    academicFaculty: { code: '', name: '', overview: '' },
    department: { code: '', name: '' },
    branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' },
    batch: { admissionYear: '2022', batchLabel: '2022', currentSemester, sectionLabels: 'A, B' },
    term: { termId: '', academicYearLabel: '2026-27', semesterNumber: currentSemester, startDate: '2026-08-01', endDate: '2026-12-15' },
    curriculum: { curriculumCourseId: '', semesterNumber: currentSemester, courseCode: '', title: '', credits: '4' },
  }
}

export function defaultStudentForm(): StudentFormState {
  return {
    usn: '',
    rollNumber: '',
    name: '',
    email: '',
    phone: '',
    admissionDate: new Date().toISOString().slice(0, 10),
  }
}

export function defaultEnrollmentForm(): EnrollmentFormState {
  return {
    enrollmentId: '',
    branchId: '',
    termId: '',
    sectionCode: 'A',
    rosterOrder: '0',
    academicStatus: 'regular',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

export function defaultMentorAssignmentForm(): MentorAssignmentFormState {
  return {
    assignmentId: '',
    facultyId: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    source: 'sysadmin-manual',
  }
}

export function defaultFacultyForm(): FacultyFormState {
  return {
    username: '',
    password: '',
    email: '',
    phone: '',
    employeeCode: '',
    displayName: '',
    designation: '',
    joinedOn: '',
  }
}

export function defaultAppointmentForm(): AppointmentFormState {
  return {
    appointmentId: '',
    departmentId: '',
    branchId: '',
    isPrimary: false,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

export function defaultRoleGrantForm(): RoleGrantFormState {
  return {
    grantId: '',
    roleCode: 'MENTOR',
    scopeType: 'department',
    scopeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

export function defaultOwnershipForm(): OwnershipFormState {
  return {
    ownershipId: '',
    offeringId: '',
    facultyId: '',
  }
}
