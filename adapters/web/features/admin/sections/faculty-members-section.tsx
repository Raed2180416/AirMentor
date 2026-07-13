import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type {
  AppointmentFormState,
  FacultyDetailTab,
  FacultyFormState,
  OwnershipFormState,
  RoleGrantFormState,
  EditingEntity,
} from '../live-app-model'
import type { ThemeMode } from '@kernel/shared/domain'
import type {
  ApiAdminFacultyCalendar,
  ApiAdminFacultyPasswordSetupResponse,
  ApiAuditEvent,
  ApiBatch,
  ApiFacultyAppointment,
  ApiFacultyCredentialStatus,
  ApiFacultyRecord,
  ApiOfferingOwnership,
  ApiRoleGrant,
} from '@web/shared/api/types'
import type { LiveAdminDataset, LiveAdminRoute, RegistryFilterState, UniversityScopeState } from '../system-admin-live-data'
import { FacultyRegistryPanel } from './faculty-members/faculty-registry-panel'
import { FacultyWorkspaceHeader } from './faculty-members/faculty-workspace-header'
import { FacultyProfileTab } from './faculty-members/faculty-profile-tab'
import { FacultyAppointmentsTab } from './faculty-members/faculty-appointments-tab'
import { FacultyPermissionsTab } from './faculty-members/faculty-permissions-tab'
import { FacultyTeachingTab } from './faculty-members/faculty-teaching-tab'
import { FacultyTimetableTab } from './faculty-members/faculty-timetable-tab'
import { FacultyHistoryTab } from './faculty-members/faculty-history-tab'

type FacultyMembersSectionProps = {
  route: LiveAdminRoute
  themeMode: ThemeMode
  now: Date
  password: string
  registryPageColumns: string
  registryFilterColumns: string
  registryIsSingleColumn: boolean
  registryScope: UniversityScopeState | null
  navigate: (route: LiveAdminRoute) => void
  facultyRegistryItems: ApiFacultyRecord[]
  facultyRegistrySearch: string
  setFacultyRegistrySearch: (value: string) => void
  effectiveFacultyRegistryFilter: RegistryFilterState
  setFacultyRegistryFilter: (value: RegistryFilterState | ((prev: RegistryFilterState) => RegistryFilterState)) => void
  facultyFilterDepartments: Array<{ departmentId: string; name: string }>
  facultyFilterBranches: Array<{ branchId: string; name: string }>
  facultyFilterBatches: ApiBatch[]
  facultyFilterSections: string[]
  visibleAcademicFaculties: Array<{ academicFacultyId: string; name: string }>
  selectedFacultyMember: ApiFacultyRecord | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyAssignments: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyOwnerships: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyCalendarOfferings: any[]
  selectedFacultyCredentialStatus: ApiFacultyCredentialStatus
  selectedFacultyProofBanner: string | null
  facultyCalendar: ApiAdminFacultyCalendar | null
  facultyCalendarLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facultyCalendarRecurringBlocks: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facultyCalendarExtraBlocks: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortedFacultyCalendarMarkers: any[]
  showFacultyTimetableExpanded: boolean
  setShowFacultyTimetableExpanded: (value: boolean) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  availableOwnershipOfferings: any[]
  facultyDetailTab: FacultyDetailTab
  setFacultyDetailTab: Dispatch<SetStateAction<FacultyDetailTab>>
  facultyForm: FacultyFormState
  setFacultyForm: (value: FacultyFormState | ((prev: FacultyFormState) => FacultyFormState)) => void
  appointmentForm: AppointmentFormState
  setAppointmentForm: (value: AppointmentFormState | ((prev: AppointmentFormState) => AppointmentFormState)) => void
  roleGrantForm: RoleGrantFormState
  setRoleGrantForm: (value: RoleGrantFormState | ((prev: RoleGrantFormState) => RoleGrantFormState)) => void
  ownershipForm: OwnershipFormState
  setOwnershipForm: (value: OwnershipFormState | ((prev: OwnershipFormState) => OwnershipFormState)) => void
  facultyPasswordSetupResult: ApiAdminFacultyPasswordSetupResponse | null
  facultyAuditLoading: boolean
  facultyAuditEvents: ApiAuditEvent[]
  handleSaveFaculty: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveFaculty: () => void
  handleIssueFacultyPasswordSetup: () => void
  handleSaveAppointment: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveAppointment: (appointment: ApiFacultyAppointment) => void
  handleSaveRoleGrant: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveRoleGrant: (grant: ApiRoleGrant) => void
  handleSaveOwnership: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveOwnership: (ownership: ApiOfferingOwnership) => void
  handleSaveFacultyCalendar: (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => Promise<void>
  handleOpenFullRegistry: (section: 'students' | 'faculty-members') => void
  setEditingEntity: (value: EditingEntity | null) => void
  resetFacultyEditors: () => void
  startEditingAppointment: (appointment: ApiFacultyAppointment) => void
  startEditingRoleGrant: (grant: ApiRoleGrant) => void
  operatorData: LiveAdminDataset
}

export function FacultyMembersSection(props: FacultyMembersSectionProps) {
  const {
    route, themeMode,
    registryPageColumns, registryFilterColumns, registryIsSingleColumn, registryScope, navigate,
    facultyRegistryItems, facultyRegistrySearch, setFacultyRegistrySearch,
    effectiveFacultyRegistryFilter, setFacultyRegistryFilter,
    facultyFilterDepartments, facultyFilterBranches, facultyFilterBatches, facultyFilterSections,
    visibleAcademicFaculties,
    selectedFacultyMember, selectedFacultyAssignments, selectedFacultyOwnerships,
    selectedFacultyCalendarOfferings, selectedFacultyCredentialStatus, selectedFacultyProofBanner,
    facultyCalendar, facultyCalendarLoading, facultyCalendarRecurringBlocks, facultyCalendarExtraBlocks,
    sortedFacultyCalendarMarkers, showFacultyTimetableExpanded, setShowFacultyTimetableExpanded,
    availableOwnershipOfferings,
    facultyDetailTab, setFacultyDetailTab,
    facultyForm, setFacultyForm, setAppointmentForm,
    setRoleGrantForm, ownershipForm, setOwnershipForm,
    facultyPasswordSetupResult, facultyAuditLoading, facultyAuditEvents,
    handleSaveFaculty, handleArchiveFaculty, handleIssueFacultyPasswordSetup,
    handleArchiveAppointment, handleArchiveRoleGrant,
    handleSaveOwnership, handleArchiveOwnership, handleSaveFacultyCalendar, handleOpenFullRegistry,
    setEditingEntity, resetFacultyEditors, startEditingAppointment, startEditingRoleGrant,
    operatorData,
  } = props

  return (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <FacultyRegistryPanel
              route={route}
              registryFilterColumns={registryFilterColumns}
              registryIsSingleColumn={registryIsSingleColumn}
              registryScope={registryScope}
              navigate={navigate}
              facultyRegistryItems={facultyRegistryItems}
              facultyRegistrySearch={facultyRegistrySearch}
              setFacultyRegistrySearch={setFacultyRegistrySearch}
              effectiveFacultyRegistryFilter={effectiveFacultyRegistryFilter}
              setFacultyRegistryFilter={setFacultyRegistryFilter}
              facultyFilterDepartments={facultyFilterDepartments}
              facultyFilterBranches={facultyFilterBranches}
              facultyFilterBatches={facultyFilterBatches}
              facultyFilterSections={facultyFilterSections}
              visibleAcademicFaculties={visibleAcademicFaculties}
              handleOpenFullRegistry={handleOpenFullRegistry}
              resetFacultyEditors={resetFacultyEditors}
              operatorData={operatorData}
            />

            <div style={{ display: 'grid', gap: 16 }}>
              <FacultyWorkspaceHeader
                themeMode={themeMode}
                selectedFacultyMember={selectedFacultyMember}
                selectedFacultyAssignments={selectedFacultyAssignments}
                facultyAuditEvents={facultyAuditEvents}
                facultyDetailTab={facultyDetailTab}
                setFacultyDetailTab={setFacultyDetailTab}
                operatorData={operatorData}
              />

              {facultyDetailTab === 'profile' && (
              <FacultyProfileTab
                selectedFacultyMember={selectedFacultyMember}
                selectedFacultyCredentialStatus={selectedFacultyCredentialStatus}
                selectedFacultyProofBanner={selectedFacultyProofBanner}
                facultyForm={facultyForm}
                setFacultyForm={setFacultyForm}
                facultyPasswordSetupResult={facultyPasswordSetupResult}
                handleSaveFaculty={handleSaveFaculty}
                handleArchiveFaculty={handleArchiveFaculty}
                handleIssueFacultyPasswordSetup={handleIssueFacultyPasswordSetup}
                navigate={navigate}
                setEditingEntity={setEditingEntity}
                resetFacultyEditors={resetFacultyEditors}
                operatorData={operatorData}
              />
              )}

              {facultyDetailTab === 'appointments' && (
              <FacultyAppointmentsTab
                selectedFacultyMember={selectedFacultyMember}
                setAppointmentForm={setAppointmentForm}
                setEditingEntity={setEditingEntity}
                startEditingAppointment={startEditingAppointment}
                handleArchiveAppointment={handleArchiveAppointment}
              />
              )}

              {facultyDetailTab === 'permissions' && (
              <FacultyPermissionsTab
                selectedFacultyMember={selectedFacultyMember}
                setRoleGrantForm={setRoleGrantForm}
                setEditingEntity={setEditingEntity}
                startEditingRoleGrant={startEditingRoleGrant}
                handleArchiveRoleGrant={handleArchiveRoleGrant}
              />
              )}

              {facultyDetailTab === 'teaching' && (
              <FacultyTeachingTab
                selectedFacultyMember={selectedFacultyMember}
                selectedFacultyAssignments={selectedFacultyAssignments}
                selectedFacultyOwnerships={selectedFacultyOwnerships}
                availableOwnershipOfferings={availableOwnershipOfferings}
                ownershipForm={ownershipForm}
                setOwnershipForm={setOwnershipForm}
                handleSaveOwnership={handleSaveOwnership}
                handleArchiveOwnership={handleArchiveOwnership}
                operatorData={operatorData}
              />
              )}

              {facultyDetailTab === 'timetable' && (
              <FacultyTimetableTab
                selectedFacultyMember={selectedFacultyMember}
                facultyCalendar={facultyCalendar}
                facultyCalendarLoading={facultyCalendarLoading}
                selectedFacultyCalendarOfferings={selectedFacultyCalendarOfferings}
                facultyCalendarRecurringBlocks={facultyCalendarRecurringBlocks}
                facultyCalendarExtraBlocks={facultyCalendarExtraBlocks}
                sortedFacultyCalendarMarkers={sortedFacultyCalendarMarkers}
                showFacultyTimetableExpanded={showFacultyTimetableExpanded}
                setShowFacultyTimetableExpanded={setShowFacultyTimetableExpanded}
                handleSaveFacultyCalendar={handleSaveFacultyCalendar}
              />
              )}

              {facultyDetailTab === 'history' && (
              <FacultyHistoryTab
                facultyAuditLoading={facultyAuditLoading}
                facultyAuditEvents={facultyAuditEvents}
              />
              )}
            </div>
          </div>

  )
}
