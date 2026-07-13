import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type {
  ApiAdminFacultyPasswordSetupResponse,
  ApiFacultyAppointment,
  ApiFacultyRecord,
  ApiRoleGrant,
} from '@web/shared/api/types'
import type { LiveAdminRoute } from '../../system-admin-live-data'
import {
  defaultAppointmentForm,
  defaultFacultyForm,
  defaultOwnershipForm,
  defaultRoleGrantForm,
  requireDate,
  requireText,
  type AppointmentFormState,
  type EditingEntity,
  type FacultyFormState,
  type OwnershipFormState,
  type RoleGrantFormState,
} from '../../live-app-model'

export interface FacultyProfileHandlerDeps {
  apiClient: AirMentorApiClient
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  navigate: (nextRoute: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
  selectedFacultyMember: ApiFacultyRecord | null
  facultyForm: FacultyFormState
  appointmentForm: AppointmentFormState
  setFacultyForm: Dispatch<SetStateAction<FacultyFormState>>
  setFacultyPasswordSetupResult: Dispatch<SetStateAction<ApiAdminFacultyPasswordSetupResponse | null>>
  setAppointmentForm: Dispatch<SetStateAction<AppointmentFormState>>
  setRoleGrantForm: Dispatch<SetStateAction<RoleGrantFormState>>
  setOwnershipForm: Dispatch<SetStateAction<OwnershipFormState>>
  setEditingEntity: Dispatch<SetStateAction<EditingEntity | null>>
  setFlashMessage: Dispatch<SetStateAction<string>>
}

export function createFacultyProfileHandlers(deps: FacultyProfileHandlerDeps) {
  const {
    apiClient,
    runAction,
    navigate,
    selectedFacultyMember,
    facultyForm,
    appointmentForm,
    setFacultyForm,
    setFacultyPasswordSetupResult,
    setAppointmentForm,
    setRoleGrantForm,
    setOwnershipForm,
    setEditingEntity,
    setFlashMessage,
  } = deps

  const resetFacultyEditors = () => {
    setFacultyForm(defaultFacultyForm())
    setFacultyPasswordSetupResult(null)
    setAppointmentForm(defaultAppointmentForm())
    setRoleGrantForm(defaultRoleGrantForm())
    setOwnershipForm(defaultOwnershipForm())
  }

  const startEditingAppointment = (appointment: ApiFacultyAppointment) => {
    setAppointmentForm({
      appointmentId: appointment.appointmentId,
      departmentId: appointment.departmentId,
      branchId: appointment.branchId ?? '',
      isPrimary: appointment.isPrimary,
      startDate: appointment.startDate,
      endDate: appointment.endDate ?? '',
    })
  }

  const startEditingRoleGrant = (grant: ApiRoleGrant) => {
    setRoleGrantForm({
      grantId: grant.grantId,
      roleCode: grant.roleCode,
      scopeType: grant.scopeType,
      scopeId: grant.scopeId,
      startDate: grant.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: grant.endDate ?? '',
    })
  }

  const handleSaveFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      username: requireText('Username', facultyForm.username),
      email: requireText('Email', facultyForm.email),
      phone: facultyForm.phone.trim() || null,
      employeeCode: requireText('Employee code', facultyForm.employeeCode),
      displayName: requireText('Display name', facultyForm.displayName),
      designation: requireText('Designation', facultyForm.designation),
      joinedOn: selectedFacultyMember?.joinedOn ?? null,
      status: selectedFacultyMember?.status ?? 'active',
    }
    if (selectedFacultyMember) {
      await runAction(async () => {
        await apiClient.updateFaculty(selectedFacultyMember.facultyId, {
          ...payload,
          version: selectedFacultyMember.version,
        })
        setFlashMessage('Faculty profile updated.')
        setEditingEntity(null)
      })
      return
    }
    const created = await runAction(async () => apiClient.createFaculty({
      ...payload,
      password: facultyForm.password.trim() || null,
    }))
    if (created) {
      navigate({ section: 'faculty-members', facultyMemberId: created.facultyId })
      setFlashMessage(created.credentialStatus?.passwordConfigured
        ? 'Faculty profile created with an admin-set password.'
        : 'Faculty profile created. Open Sign-In Setup to issue or copy the invite link.')
    }
  }

  const handleIssueFacultyPasswordSetup = async () => {
    if (!selectedFacultyMember) return
    const issued = await runAction(async () => apiClient.issueFacultyPasswordSetup(selectedFacultyMember.facultyId))
    if (!issued) return
    setFacultyPasswordSetupResult(issued)
    setFlashMessage(
      issued.setupUrl
        ? `${issued.purpose === 'invite' ? 'Invite' : 'Reset'} link is ready for ${selectedFacultyMember.displayName}.`
        : `${issued.purpose === 'invite' ? 'Invite' : 'Reset'} link generated for ${selectedFacultyMember.displayName}.`,
    )
  }

  const handleArchiveFaculty = async () => {
    if (!selectedFacultyMember) return
    if (!window.confirm(`Delete ${selectedFacultyMember.displayName}? This will soft-delete the faculty profile and login.`)) return
    await runAction(async () => {
      await apiClient.updateFaculty(selectedFacultyMember.facultyId, {
        username: selectedFacultyMember.username,
        email: selectedFacultyMember.email,
        phone: selectedFacultyMember.phone,
        employeeCode: selectedFacultyMember.employeeCode,
        displayName: selectedFacultyMember.displayName,
        designation: selectedFacultyMember.designation,
        joinedOn: selectedFacultyMember.joinedOn,
        status: 'deleted',
        version: selectedFacultyMember.version,
      })
      navigate({ section: 'faculty-members' })
      resetFacultyEditors()
      setFlashMessage('Faculty member moved to recycle bin.')
    })
  }

  const handleSaveAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing appointments.')
    const payload = {
      departmentId: requireText('Department', appointmentForm.departmentId),
      branchId: appointmentForm.branchId.trim() || null,
      isPrimary: appointmentForm.isPrimary,
      startDate: requireDate('Appointment start date', appointmentForm.startDate),
      endDate: appointmentForm.endDate.trim() ? requireDate('Appointment end date', appointmentForm.endDate) : null,
      status: 'active',
    }
    if (appointmentForm.appointmentId) {
      const current = selectedFacultyMember.appointments.find(item => item.appointmentId === appointmentForm.appointmentId)
      if (!current) throw new Error('Appointment could not be found.')
      await runAction(async () => {
        await apiClient.updateFacultyAppointment(current.appointmentId, {
          facultyId: selectedFacultyMember.facultyId,
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Appointment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createFacultyAppointment(selectedFacultyMember.facultyId, payload)
      setFlashMessage('Appointment created.')
    })
  }

  const handleArchiveAppointment = async (appointment: ApiFacultyAppointment) => {
    if (!selectedFacultyMember) return
    if (!window.confirm('Delete this appointment?')) return
    await runAction(async () => {
      await apiClient.updateFacultyAppointment(appointment.appointmentId, {
        facultyId: selectedFacultyMember.facultyId,
        departmentId: appointment.departmentId,
        branchId: appointment.branchId,
        isPrimary: appointment.isPrimary,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        status: 'deleted',
        version: appointment.version,
      })
      setFlashMessage('Appointment moved to recycle bin.')
    })
  }

  return {
    resetFacultyEditors,
    startEditingAppointment,
    startEditingRoleGrant,
    handleSaveFaculty,
    handleIssueFacultyPasswordSetup,
    handleArchiveFaculty,
    handleSaveAppointment,
    handleArchiveAppointment,
  }
}
