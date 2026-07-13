import { Plus } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import {
  EntityButton,
  FieldLabel,
  InfoBanner,
  SearchField,
  SectionHeading,
  SelectInput,
} from '../../system-admin-ui'
import { ADMIN_SECTION_TONES } from '../../live-app-model'
import { isCurrentRoleGrant } from '../../system-admin-overview-helpers'
import type { ApiBatch, ApiFacultyRecord, ApiRoleGrant } from '@web/shared/api/types'
import type { LiveAdminDataset, LiveAdminRoute, RegistryFilterState, UniversityScopeState } from '../../system-admin-live-data'
import { resolveDepartment, deriveCurrentYearLabel, hydrateRegistryFilter, getPrimaryAppointmentDepartmentId } from '../../system-admin-live-data'

type FacultyRegistryPanelProps = {
  route: LiveAdminRoute
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
  handleOpenFullRegistry: (section: 'students' | 'faculty-members') => void
  resetFacultyEditors: () => void
  operatorData: LiveAdminDataset
}

export function FacultyRegistryPanel({
  route,
  registryFilterColumns,
  registryIsSingleColumn,
  registryScope,
  navigate,
  facultyRegistryItems,
  facultyRegistrySearch,
  setFacultyRegistrySearch,
  effectiveFacultyRegistryFilter,
  setFacultyRegistryFilter,
  facultyFilterDepartments,
  facultyFilterBranches,
  facultyFilterBatches,
  facultyFilterSections,
  visibleAcademicFaculties,
  handleOpenFullRegistry,
  resetFacultyEditors,
  operatorData,
}: FacultyRegistryPanelProps) {
  return (
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
  )
}
