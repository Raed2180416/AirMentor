import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import {
  isVisibleAdminRecord,
  listBatchesForBranch,
  listBranchesForDepartment,
  listTermsForBatch,
  resolveAcademicFaculty,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  type LiveAdminDataset,
  type LiveAdminRoute,
} from '../../system-admin-live-data'
import {
  readSubmittedField,
  requirePositiveEvenInteger,
  requirePositiveInteger,
  requireText,
  upsertAcademicFacultyRecord,
  upsertBatchRecord,
  upsertBranchRecord,
  upsertDepartmentRecord,
  type EditingEntity,
  type EntityEditorState,
  type StructureFormState,
} from '../../live-app-model'

export interface HierarchyHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  navigate: (nextRoute: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
  selectedAcademicFaculty: ReturnType<typeof resolveAcademicFaculty>
  selectedDepartment: ReturnType<typeof resolveDepartment>
  selectedBranch: ReturnType<typeof resolveBranch>
  selectedBatch: ReturnType<typeof resolveBatch>
  data: LiveAdminDataset
  entityEditors: EntityEditorState
  structureForms: StructureFormState
  departmentBranches: ReturnType<typeof listBranchesForDepartment>
  branchBatches: ReturnType<typeof listBatchesForBranch>
  batchTerms: ReturnType<typeof listTermsForBatch>
  setData: Dispatch<SetStateAction<LiveAdminDataset>>
  setFlashMessage: Dispatch<SetStateAction<string>>
  setEditingEntity: Dispatch<SetStateAction<EditingEntity | null>>
  setStructureForms: Dispatch<SetStateAction<StructureFormState>>
  setActionError: Dispatch<SetStateAction<string>>
}

export function createHierarchyHandlers(deps: HierarchyHandlerDeps) {
  const {
    apiClient,
    runAction,
    navigate,
    selectedAcademicFaculty,
    selectedDepartment,
    selectedBranch,
    selectedBatch,
    data,
    entityEditors,
    structureForms,
    departmentBranches,
    branchBatches,
    batchTerms,
    setData,
    setFlashMessage,
    setEditingEntity,
    setStructureForms,
    setActionError,
  } = deps

  const handleUpdateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    const form = event.currentTarget
    const nextAcademicFaculty = await runAction(async () => apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: requireText('Faculty code', readSubmittedField(form, 'academicFacultyCode', entityEditors.academicFaculty.code)),
        name: requireText('Faculty name', readSubmittedField(form, 'academicFacultyName', entityEditors.academicFaculty.name)),
        overview: readSubmittedField(form, 'academicFacultyOverview', entityEditors.academicFaculty.overview).trim() || null,
        status: selectedAcademicFaculty.status,
        version: selectedAcademicFaculty.version,
      }))
    if (!nextAcademicFaculty) return
    setData(prev => upsertAcademicFacultyRecord(prev, nextAcademicFaculty))
    setFlashMessage('Academic faculty updated.')
    setEditingEntity(null)
  }

  const handleArchiveAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (!window.confirm(`Archive ${selectedAcademicFaculty.name}? Departments, branches, years, students, and faculty tied to this scope will disappear from the working views until you restore it from History.`)) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'archived',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty archived. Restore it from History when needed.')
    })
  }

  const handleDeleteAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (!window.confirm(`Delete ${selectedAcademicFaculty.name}? This removes the faculty scope from working views, including its departments, branches, years, and linked registries, and sends the faculty to the recycle bin.`)) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'deleted',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty moved to recycle bin.')
    })
  }

  const handleRestoreAcademicFaculty = async (academicFaculty = selectedAcademicFaculty) => {
    if (!academicFaculty) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(academicFaculty.academicFacultyId, {
        code: academicFaculty.code,
        name: academicFaculty.name,
        overview: academicFaculty.overview,
        status: 'active',
        version: academicFaculty.version,
      })
      navigate({ section: 'faculties', academicFacultyId: academicFaculty.academicFacultyId })
      setFlashMessage('Academic faculty restored.')
    })
  }

  const handleUpdateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    const form = event.currentTarget
    const nextDepartment = await runAction(async () => apiClient.updateDepartment(selectedDepartment.departmentId, {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        code: requireText('Department code', readSubmittedField(form, 'departmentCode', entityEditors.department.code)),
        name: requireText('Department name', readSubmittedField(form, 'departmentName', entityEditors.department.name)),
        status: selectedDepartment.status,
        version: selectedDepartment.version,
      }))
    if (!nextDepartment) return
    setData(prev => upsertDepartmentRecord(prev, nextDepartment))
    setFlashMessage('Department updated.')
    setEditingEntity(null)
  }

  const handleArchiveDepartment = async () => {
    if (!selectedDepartment) return
    const activeCourseCount = data.courses.filter(item => item.departmentId === selectedDepartment.departmentId && isVisibleAdminRecord(item.status)).length
    const activeAppointmentCount = data.facultyMembers
      .flatMap(item => item.appointments)
      .filter(item => item.departmentId === selectedDepartment.departmentId && item.status === 'active').length
    if (departmentBranches.length > 0 || activeCourseCount > 0 || activeAppointmentCount > 0) {
      setActionError('Clear branches, course catalog links, and faculty appointments before archiving this department.')
      return
    }
    await runAction(async () => {
      await apiClient.updateDepartment(selectedDepartment.departmentId, {
        academicFacultyId: selectedDepartment.academicFacultyId,
        code: selectedDepartment.code,
        name: selectedDepartment.name,
        status: 'deleted',
        version: selectedDepartment.version,
      })
      navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId })
      setFlashMessage('Department archived.')
    })
  }

  const handleUpdateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    const form = event.currentTarget
    const nextBranch = await runAction(async () => apiClient.updateBranch(selectedBranch.branchId, {
        departmentId: selectedBranch.departmentId,
        code: requireText('Branch code', readSubmittedField(form, 'branchCode', entityEditors.branch.code)),
        name: requireText('Branch name', readSubmittedField(form, 'branchName', entityEditors.branch.name)),
        programLevel: requireText('Program level', readSubmittedField(form, 'branchProgramLevel', entityEditors.branch.programLevel)),
        semesterCount: requirePositiveEvenInteger('Semester count', readSubmittedField(form, 'branchSemesterCount', entityEditors.branch.semesterCount)),
        status: selectedBranch.status,
        version: selectedBranch.version,
      }))
    if (!nextBranch) return
    setData(prev => upsertBranchRecord(prev, nextBranch))
    setFlashMessage('Branch updated.')
    setEditingEntity(null)
  }

  const handleArchiveBranch = async () => {
    if (!selectedBranch) return
    const activeTermCount = data.terms.filter(item => item.branchId === selectedBranch.branchId && isVisibleAdminRecord(item.status)).length
    if (branchBatches.length > 0 || activeTermCount > 0) {
      setActionError('Archive or move branch batches and terms before archiving the branch.')
      return
    }
    await runAction(async () => {
      await apiClient.updateBranch(selectedBranch.branchId, {
        departmentId: selectedBranch.departmentId,
        code: selectedBranch.code,
        name: selectedBranch.name,
        programLevel: selectedBranch.programLevel,
        semesterCount: selectedBranch.semesterCount,
        status: 'deleted',
        version: selectedBranch.version,
      })
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
        departmentId: selectedDepartment?.departmentId,
      })
      setFlashMessage('Branch archived.')
    })
  }

  const handleUpdateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBatch || !selectedBranch) return
    const form = event.currentTarget
    const nextBatch = await runAction(async () => {
      const sectionLabels = readSubmittedField(form, 'batchSectionLabels', entityEditors.batch.sectionLabels).split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      return apiClient.updateBatch(selectedBatch.batchId, {
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', readSubmittedField(form, 'batchAdmissionYear', entityEditors.batch.admissionYear)),
        batchLabel: requireText('Batch label', readSubmittedField(form, 'batchLabel', entityEditors.batch.batchLabel)),
        currentSemester: requirePositiveInteger('Active semester', readSubmittedField(form, 'batchCurrentSemester', entityEditors.batch.currentSemester)),
        sectionLabels,
        status: selectedBatch.status,
        version: selectedBatch.version,
      })
    })
    if (!nextBatch) return
    setData(prev => upsertBatchRecord(prev, nextBatch))
    setFlashMessage('Batch updated.')
    setEditingEntity(null)
  }

  const handleArchiveBatch = async () => {
    if (!selectedBatch || !selectedBranch) return
    const activeStudentCount = data.students.filter(item => item.status === 'active' && item.activeAcademicContext?.batchId === selectedBatch.batchId).length
    const activeTermCount = batchTerms.length
    const activeCurriculumCount = data.curriculumCourses.filter(item => item.batchId === selectedBatch.batchId && isVisibleAdminRecord(item.status)).length
    if (activeStudentCount > 0 || activeTermCount > 0 || activeCurriculumCount > 0) {
      setActionError('Archive the batch’s terms and curriculum, and remap active students before archiving the batch.')
      return
    }
    await runAction(async () => {
      await apiClient.updateBatch(selectedBatch.batchId, {
        branchId: selectedBranch.branchId,
        admissionYear: selectedBatch.admissionYear,
        batchLabel: selectedBatch.batchLabel,
        currentSemester: selectedBatch.currentSemester,
        sectionLabels: selectedBatch.sectionLabels,
        status: 'deleted',
        version: selectedBatch.version,
      })
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
        departmentId: selectedDepartment?.departmentId,
        branchId: selectedBranch.branchId,
      })
      setFlashMessage('Batch archived.')
    })
  }

  const handleCreateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const nextAcademicFaculty = await runAction(async () => apiClient.createAcademicFaculty({
        code: requireText('Faculty code', readSubmittedField(form, 'academicFacultyCode', structureForms.academicFaculty.code)),
        name: requireText('Faculty name', readSubmittedField(form, 'academicFacultyName', structureForms.academicFaculty.name)),
        overview: readSubmittedField(form, 'academicFacultyOverview', structureForms.academicFaculty.overview).trim() || null,
        status: 'active',
      }))
    if (!nextAcademicFaculty) return
    setData(prev => upsertAcademicFacultyRecord(prev, nextAcademicFaculty))
    setStructureForms(prev => ({ ...prev, academicFaculty: { code: '', name: '', overview: '' } }))
    setFlashMessage('Academic faculty created.')
  }

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    const form = event.currentTarget
    const nextDepartment = await runAction(async () => apiClient.createDepartment({
        academicFacultyId: selectedAcademicFaculty.academicFacultyId,
        code: requireText('Department code', readSubmittedField(form, 'departmentCode', structureForms.department.code)),
        name: requireText('Department name', readSubmittedField(form, 'departmentName', structureForms.department.name)),
        status: 'active',
      }))
    if (!nextDepartment) return
    setData(prev => upsertDepartmentRecord(prev, nextDepartment))
    setStructureForms(prev => ({ ...prev, department: { code: '', name: '' } }))
    setFlashMessage('Department created.')
  }

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    const form = event.currentTarget
    const nextBranch = await runAction(async () => apiClient.createBranch({
        departmentId: selectedDepartment.departmentId,
        code: requireText('Branch code', readSubmittedField(form, 'branchCode', structureForms.branch.code)),
        name: requireText('Branch name', readSubmittedField(form, 'branchName', structureForms.branch.name)),
        programLevel: requireText('Program level', readSubmittedField(form, 'branchProgramLevel', structureForms.branch.programLevel)),
        semesterCount: requirePositiveEvenInteger('Semester count', readSubmittedField(form, 'branchSemesterCount', structureForms.branch.semesterCount)),
        status: 'active',
      }))
    if (!nextBranch) return
    setData(prev => upsertBranchRecord(prev, nextBranch))
    setStructureForms(prev => ({ ...prev, branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' } }))
    setFlashMessage('Branch created.')
  }

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    const form = event.currentTarget
    const nextBatch = await runAction(async () => {
      const sectionLabels = readSubmittedField(form, 'batchSectionLabels', structureForms.batch.sectionLabels).split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      return apiClient.createBatch({
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', readSubmittedField(form, 'batchAdmissionYear', structureForms.batch.admissionYear)),
        batchLabel: requireText('Batch label', readSubmittedField(form, 'batchLabel', structureForms.batch.batchLabel)),
        currentSemester: requirePositiveInteger('Active semester', readSubmittedField(form, 'batchCurrentSemester', structureForms.batch.currentSemester)),
        sectionLabels,
        status: 'active',
      })
    })
    if (!nextBatch) return
    setData(prev => upsertBatchRecord(prev, nextBatch))
    setStructureForms(prev => ({ ...prev, batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' } }))
    setFlashMessage('Batch created.')
  }

  return {
    handleUpdateAcademicFaculty,
    handleArchiveAcademicFaculty,
    handleDeleteAcademicFaculty,
    handleRestoreAcademicFaculty,
    handleUpdateDepartment,
    handleArchiveDepartment,
    handleUpdateBranch,
    handleArchiveBranch,
    handleUpdateBatch,
    handleArchiveBatch,
    handleCreateAcademicFaculty,
    handleCreateDepartment,
    handleCreateBranch,
    handleCreateBatch,
  }
}
