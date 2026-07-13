import { AnimatePresence } from 'framer-motion'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import {
  Btn,
  Card,
  Chip,
  ModalWorkspace,
} from '@web/shared/ui/primitives'
import {
  EmptyState,
  EntityButton,
  FieldLabel,
  InfoBanner,
  SearchField,
  SectionHeading,
  SelectInput,
  TextInput,
  formatDate,
  formatDateTime,
} from '../system-admin-ui'
import {
  ADMIN_SECTION_TONES,
  type AppointmentFormState,
  type FacultyDetailTab,
  type FacultyFormState,
  type OwnershipFormState,
  type RoleGrantFormState,
  type EditingEntity,
  defaultAppointmentForm,
  defaultOwnershipForm,
  defaultRoleGrantForm,
  fadeColor,
  formatFacultyAppointmentLabel,
  formatFacultyGrantScopeLabel,
  summarizeAuditEvent,
} from '../live-app-model'
import { isCurrentRoleGrant } from '../system-admin-overview-helpers'
import { isLightTheme } from '@web/shared/ui/theme'
import type { ThemeMode } from '@kernel/shared/domain'
import { SystemAdminFacultyCalendarWorkspace } from '../system-admin-faculty-calendar-workspace'
import {
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminMiniStat,
} from '../live-app-chrome'
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
import { resolveDepartment, deriveCurrentYearLabel, hydrateRegistryFilter, getPrimaryAppointmentDepartmentId } from '../system-admin-live-data'

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
            <Card style={{ padding: 18, display: 'grid', gap: 12, gridTemplateRows: 'auto auto auto minmax(0, 1fr)', alignContent: 'start', maxHeight: registryIsSingleColumn ? 'none' : 'calc(100vh - 200px)', overflow: registryIsSingleColumn ? 'visible' : 'hidden' }}>
              <SectionHeading
                title="Faculty Members"
                eyebrow="Registry"
                caption={registryScope
                  ? `Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here. Live scope-backed feed filtered to ${registryScope.label}.`
                  : 'Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here.'}
                toneColor={ADMIN_SECTION_TONES['faculty-members']}
              />
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}><Plus size={14} /> New Faculty</Btn>
                  <Chip color={T.accent}>{facultyRegistryItems.length} active</Chip>
                  <Chip color={T.warning}>{facultyRegistryItems.filter(item => !item.roleGrants.some((grant: ApiRoleGrant) => isCurrentRoleGrant(grant))).length} no active permissions</Chip>
                  {registryScope ? <Chip color={ADMIN_SECTION_TONES['faculty-members']}>{registryScope.label}</Chip> : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: registryFilterColumns, gap: 10 }}>
                  <div>
                    <FieldLabel>Faculty</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.academicFacultyId} onChange={event => setFacultyRegistryFilter({
                      academicFacultyId: event.target.value,
                      departmentId: '',
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    })}>
                      <option value="">All Faculties</option>
                      {visibleAcademicFaculties.map(item => <option key={item.academicFacultyId} value={item.academicFacultyId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Department</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.departmentId} onChange={event => setFacultyRegistryFilter(prev => ({
                      ...prev,
                      departmentId: event.target.value,
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Departments</option>
                      {facultyFilterDepartments.map(item => <option key={item.departmentId} value={item.departmentId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Branch</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.branchId} onChange={event => setFacultyRegistryFilter(prev => ({
                      ...prev,
                      branchId: event.target.value,
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Branches</option>
                      {facultyFilterBranches.map(item => <option key={item.branchId} value={item.branchId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Year</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.batchId} onChange={event => setFacultyRegistryFilter(prev => ({
                      ...prev,
                      batchId: event.target.value,
                      sectionCode: '',
                    }))}>
                      <option value="">All Years</option>
                      {facultyFilterBatches.map(item => <option key={item.batchId} value={item.batchId}>{deriveCurrentYearLabel(item.currentSemester)} · {item.batchLabel}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Section</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.sectionCode} onChange={event => setFacultyRegistryFilter(prev => ({ ...prev, sectionCode: event.target.value }))}>
                      <option value="">All Sections</option>
                      {facultyFilterSections.map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>)}
                    </SelectInput>
                  </div>
                </div>
                <SearchField
                  value={facultyRegistrySearch}
                  onChange={setFacultyRegistrySearch}
                  placeholder="Search faculty, code, department, role, email..."
                  ariaLabel="Faculty registry search"
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={() => setFacultyRegistryFilter(hydrateRegistryFilter(registryScope))}>Reset Filters</Btn>
                  <Btn type="button" variant="ghost" onClick={() => handleOpenFullRegistry('faculty-members')}>Open Complete Page</Btn>
                  <Chip color={T.dim}>Sorted A-Z</Chip>
                </div>
              </div>
              <div className="scroll-pane" style={{ display: 'grid', gap: 8, minHeight: 0, overflowY: registryIsSingleColumn ? 'visible' : 'auto', paddingRight: 4 }}>
                {facultyRegistryItems.map(item => {
                  const primaryDepartment = resolveDepartment(operatorData, getPrimaryAppointmentDepartmentId(item))
                  return (
                    <EntityButton key={item.facultyId} selected={route.facultyMemberId === item.facultyId} onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.facultyId })}>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 12, background: `${ADMIN_SECTION_TONES['faculty-members']}18`, color: ADMIN_SECTION_TONES['faculty-members'], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...sora, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                              {item.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'FM'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.displayName}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'No primary department'}</div>
                            </div>
                          </div>
                          <Chip color={item.roleGrants.some((grant: ApiRoleGrant) => grant.roleCode === 'MENTOR' && isCurrentRoleGrant(grant)) ? T.success : T.dim} size={9}>{item.roleGrants.some(grant => isCurrentRoleGrant(grant)) ? 'Has Permissions' : 'No Permissions'}</Chip>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.roleGrants.filter(isCurrentRoleGrant).slice(0, 3).map((grant: ApiRoleGrant) => <Chip key={grant.grantId} color={T.accent} size={9}>{grant.roleCode}</Chip>)}
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.designation} · {item.email}</div>
                      </div>
                    </EntityButton>
                  )
                })}
                {facultyRegistryItems.length === 0 ? <InfoBanner message="No active faculty profiles yet. Create the first faculty record from this panel." /> : null}
              </div>
            </Card>

            <div style={{ display: 'grid', gap: 16 }}>
              <Card
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  padding: 18,
                  display: 'grid',
                  gap: 14,
                  minHeight: 238,
                  alignContent: 'start',
                  background: isLightTheme(themeMode) ? fadeColor(T.surface, 'f0') : fadeColor(T.surface, 'ea'),
                  backdropFilter: 'blur(12px)',
                }}
              >
                <SectionHeading
                  title={selectedFacultyMember ? selectedFacultyMember.displayName : 'Create Faculty'}
                  eyebrow="Faculty Workspace"
                  caption={selectedFacultyMember
                    ? 'Identity, appointments, permissions, teaching coverage, timetable planning, and history now stay in a tighter working loop.'
                    : 'Create the faculty profile first, then use the tabs to manage appointments, permissions, teaching coverage, and planning.'}
                />
                {selectedFacultyMember ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                    <AdminMiniStat label="Appointments" value={String(selectedFacultyMember.appointments.length)} tone={T.warning} />
                    <AdminMiniStat label="Permissions" value={String(selectedFacultyMember.roleGrants.length)} tone={T.success} />
                    <AdminMiniStat label="Classes" value={String(selectedFacultyAssignments.length)} tone={T.accent} />
                    <AdminMiniStat label="Mentor Load" value={String(operatorData.students.filter(item => item.activeMentorAssignment?.facultyId === selectedFacultyMember.facultyId).length)} tone={ADMIN_SECTION_TONES.students} />
                    <AdminMiniStat label="Audit Events" value={String(facultyAuditEvents.length)} tone={T.orange} />
                  </div>
                ) : null}
                <AdminDetailTabs
                  activeTab={facultyDetailTab}
                  onChange={tabId => setFacultyDetailTab(tabId as FacultyDetailTab)}
                  ariaLabel="Faculty detail sections"
                  idBase="faculty-detail"
                  tabs={[
                    { id: 'profile', label: 'Profile' },
                    { id: 'appointments', label: 'Appointments', count: selectedFacultyMember?.appointments.length ?? 0, disabled: !selectedFacultyMember },
                    { id: 'permissions', label: 'Permissions', count: selectedFacultyMember?.roleGrants.length ?? 0, disabled: !selectedFacultyMember },
                    { id: 'teaching', label: 'Teaching', count: selectedFacultyAssignments.length, disabled: !selectedFacultyMember },
                    { id: 'timetable', label: 'Timetable', disabled: !selectedFacultyMember },
                    { id: 'history', label: 'History', count: facultyAuditEvents.length, disabled: !selectedFacultyMember },
                  ]}
                />
              </Card>

              {facultyDetailTab === 'profile' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="profile">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title={selectedFacultyMember ? 'Faculty Detail' : 'Create Faculty'} eyebrow={selectedFacultyMember ? selectedFacultyMember.displayName : 'New profile'} caption="Master identity stays admin-owned. Teaching workflow actions continue in the teaching workspace." />
                {selectedFacultyMember ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={T.accent}>{selectedFacultyMember.employeeCode}</Chip>
                      <Chip color={T.warning}>{resolveDepartment(operatorData, getPrimaryAppointmentDepartmentId(selectedFacultyMember))?.name ?? 'No primary department'}</Chip>
                      {selectedFacultyMember.roleGrants.filter(isCurrentRoleGrant).map((grant: ApiRoleGrant) => <Chip key={grant.grantId} color={T.success}>{formatFacultyGrantScopeLabel(grant)}</Chip>)}
                    </div>
                    {selectedFacultyProofBanner ? <InfoBanner tone="neutral" message={selectedFacultyProofBanner} /> : null}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Display Name</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.displayName}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Username</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.username}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Designation</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.designation}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.email}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.phone ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Joined On</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedFacultyMember.joinedOn ? formatDate(selectedFacultyMember.joinedOn) : 'Not set'}</div></Card>
                    </div>
                    <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sign-In Setup</div>
                          <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>
                            {selectedFacultyCredentialStatus.passwordConfigured ? 'Password is active' : 'Waiting for first password setup'}
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                            {selectedFacultyCredentialStatus.activeSetupRequest
                              ? `${selectedFacultyCredentialStatus.latestPurpose === 'reset' ? 'Reset' : 'Invite'} link is still active${selectedFacultyCredentialStatus.latestExpiresAt ? ` until ${formatDateTime(selectedFacultyCredentialStatus.latestExpiresAt)}` : ''}.`
                              : selectedFacultyCredentialStatus.passwordConfigured
                                ? 'Create a reset link when this faculty member needs to change their password.'
                                : 'Issue the first invite link so this faculty member can create a password from their email.'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Chip color={selectedFacultyCredentialStatus.passwordConfigured ? T.success : T.warning}>
                            {selectedFacultyCredentialStatus.passwordConfigured ? 'Password ready' : 'Password missing'}
                          </Chip>
                          {selectedFacultyCredentialStatus.latestPurpose ? (
                            <Chip color={selectedFacultyCredentialStatus.latestPurpose === 'reset' ? T.accent : T.orange}>
                              {selectedFacultyCredentialStatus.latestPurpose === 'reset' ? 'Latest action: reset' : 'Latest action: invite'}
                            </Chip>
                          ) : null}
                        </div>
                      </div>
                      {facultyPasswordSetupResult ? (
                        <InfoBanner
                          tone="success"
                          message={facultyPasswordSetupResult.setupUrl
                            ? `${facultyPasswordSetupResult.purpose === 'invite' ? 'Invite' : 'Reset'} link ready for ${facultyPasswordSetupResult.issuedToEmail}. It expires ${formatDateTime(facultyPasswordSetupResult.expiresAt)}.`
                            : `${facultyPasswordSetupResult.purpose === 'invite' ? 'Invite' : 'Reset'} link created for ${facultyPasswordSetupResult.issuedToEmail}.`}
                        />
                      ) : null}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn type="button" size="sm" onClick={() => void handleIssueFacultyPasswordSetup()}>
                          {selectedFacultyCredentialStatus.passwordConfigured ? 'Create Reset Link' : 'Create Invite Link'}
                        </Btn>
                        {facultyPasswordSetupResult?.setupUrl ? (
                          <Btn type="button" size="sm" variant="ghost" onClick={() => window.open(facultyPasswordSetupResult.setupUrl ?? '', '_blank', 'noopener,noreferrer')}>
                            Open Link
                          </Btn>
                        ) : null}
                        {facultyPasswordSetupResult?.setupUrl ? (
                          <Btn type="button" size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(facultyPasswordSetupResult.setupUrl ?? '')}>
                            Copy Link
                          </Btn>
                        ) : null}
                      </div>
                    </Card>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="button" size="sm" onClick={() => setEditingEntity('faculty-profile')}>Edit Faculty</Btn>
                      <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>New Faculty</Btn>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSaveFaculty} style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>Display Name</FieldLabel><TextInput value={facultyForm.displayName} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} placeholder="Faculty name" /></div>
                      <div><FieldLabel>Employee Code</FieldLabel><TextInput value={facultyForm.employeeCode} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} placeholder="EMP001" /></div>
                      <div><FieldLabel>Username</FieldLabel><TextInput value={facultyForm.username} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} placeholder="faculty.user" /></div>
                      <div><FieldLabel>Email</FieldLabel><TextInput value={facultyForm.email} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} placeholder="faculty@campus.edu" /></div>
                      <div><FieldLabel>Phone</FieldLabel><TextInput value={facultyForm.phone} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" /></div>
                      <div><FieldLabel>Designation</FieldLabel><TextInput value={facultyForm.designation} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} placeholder="Assistant Professor" /></div>
                    </div>
                    <InfoBanner message="New faculty now finish sign-in through an invite link. Create the profile first, then use Sign-In Setup on the detail page to issue or copy the link." />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Create Faculty</Btn>
                      <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>Clear Form</Btn>
                    </div>
                  </form>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'appointments' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="appointments">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Appointments" eyebrow="Canonical Affiliation" caption="Department and branch affiliation stay canonical here, even when HoD visibility rolls up external teaching activity." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Appointments become available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyMember.appointments.length === 0 ? <InfoBanner message="No appointments recorded yet." /> : selectedFacultyMember.appointments.map(appointment => {
                        return (
                          <Card key={appointment.appointmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{formatFacultyAppointmentLabel(appointment)}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{appointment.isPrimary ? 'Primary appointment' : 'Supporting appointment'} · {formatDate(appointment.startDate)} to {appointment.endDate ? formatDate(appointment.endDate) : 'Active'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => { startEditingAppointment(appointment); setEditingEntity('faculty-appointment') }}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveAppointment(appointment)}>Delete</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <Btn type="button" size="sm" onClick={() => {
                        setAppointmentForm(defaultAppointmentForm())
                        setEditingEntity('faculty-appointment')
                      }}>Add New Appointment</Btn>
                    </div>
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'permissions' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="permissions">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Permissions" eyebrow="Role Grants" caption="Mentor, HoD, Course Leader, and System Admin permissions stay separate from actual class ownership." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Permissions become available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyMember.roleGrants.length === 0 ? <InfoBanner message="No permissions granted yet." /> : selectedFacultyMember.roleGrants.map((grant: ApiRoleGrant) => (
                        <Card key={grant.grantId} style={{ padding: 12, background: T.surface2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{grant.roleCode}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatFacultyGrantScopeLabel(grant)} · {grant.startDate ?? 'No start'} to {grant.endDate ?? 'Active'} · {grant.status}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <Btn type="button" size="sm" variant="ghost" onClick={() => { startEditingRoleGrant(grant); setEditingEntity('faculty-permission') }}>Edit</Btn>
                              <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveRoleGrant(grant)}>Delete</Btn>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <Btn type="button" size="sm" onClick={() => {
                        setRoleGrantForm(defaultRoleGrantForm())
                        setEditingEntity('faculty-permission')
                      }}>Add New Permission</Btn>
                    </div>
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'teaching' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="teaching">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Class Ownership" eyebrow="Single Owner Assignment" caption="System admin assigns classes here as a single-owner list. Ownership role stays fixed and no class can belong to more than one professor at the same time." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Teaching ownership becomes available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyOwnerships.length === 0 ? <InfoBanner message="No teaching ownership records yet." /> : selectedFacultyOwnerships.map(ownership => {
                        const offering = operatorData.offerings.find(item => item.offId === ownership.offeringId)
                        return (
                          <Card key={ownership.ownershipId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{offering?.code ?? ownership.offeringId} · {offering?.title ?? 'Unknown offering'}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{offering?.dept ?? 'NA'} · {offering?.year ?? '—'} · Section {offering?.section ?? '—'} · owner · {ownership.status}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveOwnership(ownership)}>Delete</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <form onSubmit={handleSaveOwnership} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Offering / Class</FieldLabel>
                          <SelectInput value={ownershipForm.offeringId} onChange={event => setOwnershipForm(prev => ({ ...prev, offeringId: event.target.value, facultyId: selectedFacultyMember.facultyId }))}>
                            <option value="">{availableOwnershipOfferings.length > 0 ? 'Select unassigned class' : 'No unassigned classes available'}</option>
                            {availableOwnershipOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Section {offering.section}</option>)}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Assigned Role</FieldLabel>
                          <TextInput value="owner" readOnly />
                        </div>
                      </div>
                      {availableOwnershipOfferings.length === 0 ? <InfoBanner message="All visible classes already have an active owner. Remove an ownership first before reassigning a class." /> : null}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit" disabled={!ownershipForm.offeringId}>Add Class</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setOwnershipForm({
                          ...defaultOwnershipForm(),
                          facultyId: selectedFacultyMember.facultyId,
                        })}>Clear Selection</Btn>
                      </div>
                    </form>
                    {selectedFacultyAssignments.length > 0 ? (
                      <Card style={{ padding: 12, background: T.surface }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Current Owned Classes</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {selectedFacultyAssignments.map(item => (
                            <div key={item.ownership.ownershipId} style={{ ...mono, fontSize: 10, color: T.text }}>
                              {item.offering?.code} · {item.offering?.dept} · {item.offering?.year} · Section {item.offering?.section} · owner
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                  </>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'timetable' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="timetable">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Timetable Planner" eyebrow="Calendar-First Review" caption="System admin starts with a calendar summary here, then expands into the full planner only when a wider review surface is needed." />
                {!selectedFacultyMember ? <EmptyState title="Select or create a faculty member first" body="Timetable planning becomes available once the faculty profile exists." /> : facultyCalendarLoading && !facultyCalendar ? (
                  <InfoBanner message="Loading timetable planner…" />
                ) : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <AdminMiniStat label="Mapped Classes" value={String(selectedFacultyCalendarOfferings.length)} tone={T.accent} />
                      <AdminMiniStat label="Weekly Blocks" value={String(facultyCalendarRecurringBlocks.length)} tone={T.success} />
                      <AdminMiniStat label="Exceptions" value={String(facultyCalendarExtraBlocks.length)} tone={T.warning} />
                      <AdminMiniStat label="Markers" value={String(sortedFacultyCalendarMarkers.length)} tone={T.orange} />
                    </div>

                    <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Planner Summary</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                            Review the institutional calendar state first, then open the expanded planner when you need the full weekly board without leaving the faculty workspace.
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Chip color={facultyCalendar?.classEditingLocked ? T.danger : T.success}>{facultyCalendar?.classEditingLocked ? 'Recurring edits locked' : 'Recurring edits open'}</Chip>
                          <Chip color={facultyCalendar?.workspace.publishedAt ? T.accent : T.warning}>{facultyCalendar?.workspace.publishedAt ? `Published ${formatDate(facultyCalendar.workspace.publishedAt.slice(0, 10))}` : 'Not published'}</Chip>
                          <Btn type="button" size="sm" variant="primary" onClick={() => setShowFacultyTimetableExpanded(true)}>
                            Open Full Planner
                          </Btn>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                        <Card style={{ padding: 14, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Upcoming Markers</div>
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {sortedFacultyCalendarMarkers.slice(0, 4).map(marker => (
                              <div key={marker.markerId} style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.8 }}>
                                {marker.title} · {formatDate(marker.dateISO)}
                              </div>
                            ))}
                            {sortedFacultyCalendarMarkers.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No semester or event markers mapped yet.</div> : null}
                          </div>
                        </Card>
                        <Card style={{ padding: 14, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Class Coverage</div>
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {selectedFacultyCalendarOfferings.slice(0, 4).map(offering => (
                              <div key={offering.offId} style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.8 }}>
                                {offering.code} · {offering.year} · Section {offering.section}
                              </div>
                            ))}
                            {selectedFacultyCalendarOfferings.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No classes are currently assigned to this faculty member.</div> : null}
                          </div>
                        </Card>
                      </div>
                    </Card>

                    <AnimatePresence>
                      {showFacultyTimetableExpanded ? (
                        <ModalWorkspace
                          size="full"
                          eyebrow="Faculty Planner"
                          title={`${selectedFacultyMember.displayName} · Weekly Planner`}
                          caption="Use this full-screen planner review surface for weekly edits, then return to the faculty workspace when you are done."
                          onClose={() => setShowFacultyTimetableExpanded(false)}
                        >
                          <div style={{ display: 'grid', gap: 14, padding: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Btn type="button" variant="ghost" onClick={() => setShowFacultyTimetableExpanded(false)}>
                                <ChevronLeft size={14} /> Back to Faculty Workspace
                              </Btn>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Chip color={facultyCalendar?.classEditingLocked ? T.danger : T.success}>{facultyCalendar?.classEditingLocked ? 'Recurring edits locked' : 'Recurring edits open'}</Chip>
                                <Chip color={facultyCalendar?.workspace.publishedAt ? T.accent : T.warning}>{facultyCalendar?.workspace.publishedAt ? `Published ${formatDate(facultyCalendar.workspace.publishedAt.slice(0, 10))}` : 'Not published'}</Chip>
                              </div>
                            </div>
                            <div className="scroll-pane" style={{ minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                              <SystemAdminFacultyCalendarWorkspace
                                facultyId={selectedFacultyMember.facultyId}
                                facultyName={selectedFacultyMember.displayName}
                                offerings={selectedFacultyCalendarOfferings}
                                calendar={facultyCalendar}
                                onSave={handleSaveFacultyCalendar}
                              />
                            </div>
                          </div>
                        </ModalWorkspace>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'history' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="history">
              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <SectionHeading title="History" eyebrow="Audit Trail" caption="Profile, appointment, permission, and class-ownership changes all land here for restore and review." />
                {facultyAuditLoading ? <InfoBanner message="Loading audit history…" /> : null}
                {!facultyAuditLoading && facultyAuditEvents.length === 0 ? <EmptyState title="No audit trail yet" body="Faculty create/update activity will appear here." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {facultyAuditEvents.slice(0, 18).map(item => (
                      <Card key={item.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{item.entityType} · {summarizeAuditEvent(item)}</div>
                          <Chip color={T.accent} size={9}>{formatDateTime(item.createdAt)}</Chip>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.entityId}{item.actorRole ? ` · ${item.actorRole}` : ''}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
              </AdminDetailTabPanel>
              )}
            </div>
          </div>

  )
}
