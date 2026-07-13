import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiMentorAssignment,
  ApiStudentEnrollment,
  ApiStudentRecord,
} from '@web/shared/api/types'
import {
  findLatestEnrollment,
  type LiveAdminDataset,
  type LiveAdminRoute,
} from '../../system-admin-live-data'
import {
  defaultEnrollmentForm,
  defaultMentorAssignmentForm,
  defaultStudentForm,
  requireDate,
  requirePositiveInteger,
  requireText,
  type EditingEntity,
  type EnrollmentFormState,
  type MentorAssignmentFormState,
  type StudentFormState,
} from '../../live-app-model'

export interface StudentHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  navigate: (nextRoute: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
  mergeStudentRecord: (nextStudent: ApiStudentRecord) => void
  queueSelectedProofRefresh: (reason: string, curriculumImportVersionId?: string | null) => Promise<string[]>
  selectedStudent: ApiStudentRecord | null
  data: LiveAdminDataset
  studentForm: StudentFormState
  enrollmentForm: EnrollmentFormState
  mentorForm: MentorAssignmentFormState
  setStudentForm: Dispatch<SetStateAction<StudentFormState>>
  setEnrollmentForm: Dispatch<SetStateAction<EnrollmentFormState>>
  setMentorForm: Dispatch<SetStateAction<MentorAssignmentFormState>>
  setEditingEntity: Dispatch<SetStateAction<EditingEntity | null>>
  setActionError: Dispatch<SetStateAction<string>>
  setFlashMessage: Dispatch<SetStateAction<string>>
}

export function createStudentHandlers(deps: StudentHandlerDeps) {
  const {
    apiClient,
    runAction,
    navigate,
    mergeStudentRecord,
    queueSelectedProofRefresh,
    selectedStudent,
    data,
    studentForm,
    enrollmentForm,
    mentorForm,
    setStudentForm,
    setEnrollmentForm,
    setMentorForm,
    setEditingEntity,
    setActionError,
    setFlashMessage,
  } = deps

  const resetStudentEditors = () => {
    setStudentForm(defaultStudentForm())
    setEnrollmentForm(defaultEnrollmentForm())
    setMentorForm(defaultMentorAssignmentForm())
  }

  const startEditingEnrollment = (enrollment: ApiStudentEnrollment) => {
    setEnrollmentForm({
      enrollmentId: enrollment.enrollmentId,
      branchId: enrollment.branchId,
      termId: enrollment.termId,
      sectionCode: enrollment.sectionCode,
      rosterOrder: String(enrollment.rosterOrder ?? 0),
      academicStatus: enrollment.academicStatus,
      startDate: enrollment.startDate,
      endDate: enrollment.endDate ?? '',
    })
  }

  const startEditingMentorAssignment = (assignment: ApiMentorAssignment) => {
    setMentorForm({
      assignmentId: assignment.assignmentId,
      facultyId: assignment.facultyId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo ?? '',
      source: assignment.source,
    })
  }

  const handleSaveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      usn: requireText('University ID / USN', studentForm.usn),
      rollNumber: studentForm.rollNumber.trim() || null,
      name: requireText('Student name', studentForm.name),
      email: studentForm.email.trim() || null,
      phone: studentForm.phone.trim() || null,
      admissionDate: requireDate('Admission date', studentForm.admissionDate),
      status: selectedStudent?.status ?? 'active',
    }
    if (selectedStudent) {
      await runAction(async () => {
        const updated = await apiClient.updateStudent(selectedStudent.studentId, {
          ...payload,
          version: selectedStudent.version,
        })
        mergeStudentRecord(updated)
        setFlashMessage('Student record updated.')
        setEditingEntity(null)
      })
      return
    }
    const created = await runAction(async () => {
      const next = await apiClient.createStudent(payload)
      mergeStudentRecord(next)
      return next
    })
    if (created) {
      navigate({ section: 'students', studentId: created.studentId })
      setFlashMessage('Student created.')
    }
  }

  const handleArchiveStudent = async () => {
    if (!selectedStudent) return
    if (!window.confirm(`Delete ${selectedStudent.name}? This moves the record to the recycle bin for 60 days.`)) return
    await runAction(async () => {
      const deleted = await apiClient.updateStudent(selectedStudent.studentId, {
        usn: selectedStudent.usn,
        rollNumber: selectedStudent.rollNumber,
        name: selectedStudent.name,
        email: selectedStudent.email,
        phone: selectedStudent.phone,
        admissionDate: selectedStudent.admissionDate,
        status: 'deleted',
        version: selectedStudent.version,
      })
      mergeStudentRecord(deleted)
      navigate({ section: 'students' })
      resetStudentEditors()
      setFlashMessage('Student moved to recycle bin.')
    })
  }

  const handleSaveEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStudent) throw new Error('Select a student before editing enrollment.')
    const payload = {
      branchId: requireText('Branch', enrollmentForm.branchId),
      termId: requireText('Term', enrollmentForm.termId),
      sectionCode: requireText('Section', enrollmentForm.sectionCode),
      rosterOrder: requirePositiveInteger('Roster order', enrollmentForm.rosterOrder),
      academicStatus: requireText('Academic status', enrollmentForm.academicStatus),
      startDate: requireDate('Enrollment start date', enrollmentForm.startDate),
      endDate: enrollmentForm.endDate.trim() ? requireDate('Enrollment end date', enrollmentForm.endDate) : null,
    }
    if (enrollmentForm.enrollmentId) {
      const current = selectedStudent.enrollments.find(item => item.enrollmentId === enrollmentForm.enrollmentId)
      if (!current) throw new Error('Enrollment could not be found.')
      await runAction(async () => {
        await apiClient.updateEnrollment(current.enrollmentId, {
          studentId: selectedStudent.studentId,
          ...payload,
          version: current.version,
        })
        const rerun = await queueSelectedProofRefresh(`${selectedStudent.name} enrollment refresh`)
        setFlashMessage(rerun.length > 0 ? 'Enrollment updated and proof batch refreshed.' : 'Enrollment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createEnrollment(selectedStudent.studentId, payload)
      const rerun = await queueSelectedProofRefresh(`${selectedStudent.name} enrollment refresh`)
      setFlashMessage(rerun.length > 0 ? 'Enrollment created and proof batch refreshed.' : 'Enrollment created.')
    })
  }

  const handleCloseEnrollment = async (enrollment: ApiStudentEnrollment) => {
    if (!selectedStudent) return
    if (!window.confirm(`Close enrollment ${enrollment.enrollmentId}?`)) return
    await runAction(async () => {
      await apiClient.updateEnrollment(enrollment.enrollmentId, {
        studentId: selectedStudent.studentId,
        branchId: enrollment.branchId,
        termId: enrollment.termId,
        sectionCode: enrollment.sectionCode,
        rosterOrder: enrollment.rosterOrder ?? 0,
        academicStatus: enrollment.academicStatus === 'regular' ? 'completed' : enrollment.academicStatus,
        startDate: enrollment.startDate,
        endDate: enrollment.endDate ?? new Date().toISOString().slice(0, 10),
        version: enrollment.version,
      })
      setFlashMessage('Enrollment closed.')
    })
  }

  const handleSaveMentorAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStudent) throw new Error('Select a student before editing mentor linkage.')
    const payload = {
      studentId: selectedStudent.studentId,
      facultyId: requireText('Mentor faculty', mentorForm.facultyId),
      effectiveFrom: requireDate('Mentor effective from', mentorForm.effectiveFrom),
      effectiveTo: mentorForm.effectiveTo.trim() ? requireDate('Mentor effective to', mentorForm.effectiveTo) : null,
      source: requireText('Assignment source', mentorForm.source),
    }
    if (mentorForm.assignmentId) {
      const current = selectedStudent.mentorAssignments.find(item => item.assignmentId === mentorForm.assignmentId)
      if (!current) throw new Error('Mentor assignment could not be found.')
      await runAction(async () => {
        await apiClient.updateMentorAssignment(current.assignmentId, {
          ...payload,
          version: current.version,
        })
        setFlashMessage('Mentor assignment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createMentorAssignment(payload)
      setFlashMessage('Mentor assignment created.')
    })
  }

  const handleEndMentorAssignment = async (assignment: ApiMentorAssignment) => {
    if (!selectedStudent) return
    if (!window.confirm('End this mentor assignment?')) return
    await runAction(async () => {
      await apiClient.updateMentorAssignment(assignment.assignmentId, {
        studentId: assignment.studentId,
        facultyId: assignment.facultyId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo ?? new Date().toISOString().slice(0, 10),
        source: assignment.source,
        version: assignment.version,
      })
      setFlashMessage('Mentor assignment ended.')
    })
  }

  const handlePromoteStudent = async (targetTermId: string) => {
    if (!selectedStudent) return
    const currentEnrollment = findLatestEnrollment(selectedStudent)
    const targetTerm = data.terms.find(item => item.termId === targetTermId)
    if (!currentEnrollment || !targetTerm) {
      setActionError('Active enrollment and target term are required for promotion.')
      return
    }
    const existingTarget = selectedStudent.enrollments.find(item => item.termId === targetTermId)
    if (existingTarget) {
      setActionError('This student already has an enrollment for the selected next term.')
      return
    }
    if (!window.confirm(`Promote ${selectedStudent.name} into Semester ${targetTerm.semesterNumber} (${targetTerm.academicYearLabel})?`)) return
    await runAction(async () => {
      if (!currentEnrollment.endDate) {
        await apiClient.updateEnrollment(currentEnrollment.enrollmentId, {
          studentId: selectedStudent.studentId,
          branchId: currentEnrollment.branchId,
          termId: currentEnrollment.termId,
          sectionCode: currentEnrollment.sectionCode,
          rosterOrder: currentEnrollment.rosterOrder ?? 0,
          academicStatus: currentEnrollment.academicStatus === 'regular' ? 'completed' : currentEnrollment.academicStatus,
          startDate: currentEnrollment.startDate,
          endDate: targetTerm.startDate,
          version: currentEnrollment.version,
        })
      }
      await apiClient.createEnrollment(selectedStudent.studentId, {
        branchId: targetTerm.branchId,
        termId: targetTerm.termId,
        sectionCode: currentEnrollment.sectionCode,
        rosterOrder: currentEnrollment.rosterOrder ?? 0,
        academicStatus: 'regular',
        startDate: targetTerm.startDate,
        endDate: null,
      })
      setFlashMessage(`Promotion recorded for Semester ${targetTerm.semesterNumber}.`)
    })
  }

  return {
    resetStudentEditors,
    startEditingEnrollment,
    startEditingMentorAssignment,
    handleSaveStudent,
    handleArchiveStudent,
    handleSaveEnrollment,
    handleCloseEnrollment,
    handleSaveMentorAssignment,
    handleEndMentorAssignment,
    handlePromoteStudent,
  }
}
