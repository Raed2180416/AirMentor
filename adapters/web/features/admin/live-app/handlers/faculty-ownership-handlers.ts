import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiAdminFacultyCalendar,
  ApiFacultyRecord,
  ApiOfferingOwnership,
  ApiRoleGrant,
} from '@web/shared/api/types'
import {
  isTermVisible,
  resolveBatch,
  resolveBranch,
  type LiveAdminDataset,
} from '../../system-admin-live-data'
import { isLeaderLikeOwnership } from '../../system-admin-overview-helpers'
import {
  requireDate,
  requireText,
  toErrorMessage,
  type OwnershipFormState,
  type RoleGrantFormState,
} from '../../live-app-model'

export interface FacultyOwnershipHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  loadAdminData: () => Promise<void>
  operatorData: LiveAdminDataset
  selectedFacultyMember: ApiFacultyRecord | null
  selectedBatch: ReturnType<typeof resolveBatch>
  selectedBranch: ReturnType<typeof resolveBranch>
  selectedSectionCode: string | null
  roleGrantForm: RoleGrantFormState
  ownershipForm: OwnershipFormState
  setOwnershipForm: Dispatch<SetStateAction<OwnershipFormState>>
  setActionError: Dispatch<SetStateAction<string>>
  setFlashMessage: Dispatch<SetStateAction<string>>
  setFacultyCalendar: Dispatch<SetStateAction<ApiAdminFacultyCalendar | null>>
  setFacultyCalendarLoading: Dispatch<SetStateAction<boolean>>
}

export function createFacultyOwnershipHandlers(deps: FacultyOwnershipHandlerDeps) {
  const {
    apiClient,
    runAction,
    loadAdminData,
    operatorData,
    selectedFacultyMember,
    selectedBatch,
    selectedBranch,
    selectedSectionCode,
    roleGrantForm,
    ownershipForm,
    setOwnershipForm,
    setActionError,
    setFlashMessage,
    setFacultyCalendar,
    setFacultyCalendarLoading,
  } = deps

  const handleSaveRoleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing permissions.')
    const payload = {
      roleCode: roleGrantForm.roleCode,
      scopeType: requireText('Scope type', roleGrantForm.scopeType),
      scopeId: requireText('Scope id', roleGrantForm.scopeId),
      startDate: requireDate('Permission start date', roleGrantForm.startDate),
      endDate: roleGrantForm.endDate.trim() ? requireDate('Permission end date', roleGrantForm.endDate) : null,
      status: 'active',
    }
    if (roleGrantForm.grantId) {
      const current = selectedFacultyMember.roleGrants.find(item => item.grantId === roleGrantForm.grantId)
      if (!current) throw new Error('Permission grant could not be found.')
      await runAction(async () => {
        await apiClient.updateRoleGrant(current.grantId, {
          facultyId: selectedFacultyMember.facultyId,
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Permission updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createRoleGrant(selectedFacultyMember.facultyId, payload)
      setFlashMessage('Permission granted.')
    })
  }

  const handleArchiveRoleGrant = async (grant: ApiRoleGrant) => {
    if (!selectedFacultyMember) return
    if (!window.confirm(`Delete ${grant.roleCode} permission?`)) return
    await runAction(async () => {
      await apiClient.updateRoleGrant(grant.grantId, {
        facultyId: selectedFacultyMember.facultyId,
        roleCode: grant.roleCode,
        scopeType: grant.scopeType,
        scopeId: grant.scopeId,
        startDate: grant.startDate ?? new Date().toISOString().slice(0, 10),
        endDate: grant.endDate,
        status: 'deleted',
        version: grant.version,
      })
      setFlashMessage('Permission moved to recycle bin.')
    })
  }

  const handleSaveOwnership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing teaching ownership.')
    const offeringId = requireText('Class / offering', ownershipForm.offeringId)
    await runAction(async () => {
      await apiClient.createOfferingOwnership({
        offeringId,
        facultyId: selectedFacultyMember.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      })
      setOwnershipForm({
        ownershipId: '',
        offeringId: '',
        facultyId: selectedFacultyMember.facultyId,
      })
      setFlashMessage('Class ownership added.')
    })
  }

  const handleArchiveOwnership = async (ownership: ApiOfferingOwnership) => {
    if (!window.confirm('Delete this teaching ownership?')) return
    await runAction(async () => {
      await apiClient.updateOfferingOwnership(ownership.ownershipId, {
        offeringId: ownership.offeringId,
        facultyId: ownership.facultyId,
        ownershipRole: ownership.ownershipRole,
        status: 'deleted',
        version: ownership.version,
      })
      setFlashMessage('Teaching ownership moved to recycle bin.')
    })
  }

  const handleAssignCurriculumCourseLeader = async (curriculumCourseId: string, facultyId: string) => {
    if (!selectedBatch || !selectedBranch) return
    const curriculumCourse = operatorData.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!curriculumCourse) {
      setActionError('The selected curriculum course could not be found.')
      return
    }
    const matchingTermIds = new Set(
      operatorData.terms
        .filter(item => item.batchId === selectedBatch.batchId && item.branchId === selectedBranch.branchId && item.semesterNumber === curriculumCourse.semesterNumber && isTermVisible(operatorData, item))
        .map(item => item.termId),
    )
    const matchingOfferings = operatorData.offerings.filter(item => {
      if (item.branchId !== selectedBranch.branchId) return false
      if (!item.termId) return false
      if (!matchingTermIds.has(item.termId)) return false
      if (item.code.toLowerCase() !== curriculumCourse.courseCode.toLowerCase()) return false
      if (selectedSectionCode && item.section !== selectedSectionCode) return false
      return true
    })
    if (matchingOfferings.length === 0) {
      setActionError('No live offerings match this curriculum row in the selected year or section yet. Create the relevant class offerings first.')
      return
    }

    await runAction(async () => {
      for (const offering of matchingOfferings) {
        const activeLeaderLikeOwnerships = operatorData.ownerships.filter(ownership => ownership.offeringId === offering.offId && ownership.status === 'active' && isLeaderLikeOwnership(ownership.ownershipRole))
        for (const ownership of activeLeaderLikeOwnerships) {
          if (!facultyId || ownership.facultyId !== facultyId) {
            await apiClient.updateOfferingOwnership(ownership.ownershipId, {
              offeringId: ownership.offeringId,
              facultyId: ownership.facultyId,
              ownershipRole: ownership.ownershipRole,
              status: 'deleted',
              version: ownership.version,
            })
          }
        }
        if (!facultyId) continue
        const existingForTarget = activeLeaderLikeOwnerships.find(ownership => ownership.facultyId === facultyId)
        if (!existingForTarget) {
          await apiClient.createOfferingOwnership({
            offeringId: offering.offId,
            facultyId,
            ownershipRole: 'owner',
            status: 'active',
          })
        }
      }
      setFlashMessage(facultyId
        ? `Course leader updated across ${matchingOfferings.length} offering${matchingOfferings.length === 1 ? '' : 's'}.`
        : `Course leader cleared across ${matchingOfferings.length} offering${matchingOfferings.length === 1 ? '' : 's'}.`)
    })
  }

  const handleSaveFacultyCalendar = async (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => {
    if (!selectedFacultyMember) return
    setFacultyCalendarLoading(true)
    setActionError('')
    try {
      const next = await apiClient.saveAdminFacultyCalendar(selectedFacultyMember.facultyId, payload)
      setFacultyCalendar(next)
      await loadAdminData()
      setFlashMessage('Timetable planner saved.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setFacultyCalendarLoading(false)
    }
  }

  // --- Computed ---

  return {
    handleSaveRoleGrant,
    handleArchiveRoleGrant,
    handleSaveOwnership,
    handleArchiveOwnership,
    handleAssignCurriculumCourseLeader,
    handleSaveFacultyCalendar,
  }
}
