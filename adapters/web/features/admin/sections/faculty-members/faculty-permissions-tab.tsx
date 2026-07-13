import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner, SectionHeading } from '../../system-admin-ui'
import { type EditingEntity, type RoleGrantFormState, defaultRoleGrantForm, formatFacultyGrantScopeLabel } from '../../live-app-model'
import { AdminDetailTabPanel } from '../../live-app-chrome'
import type { ApiFacultyRecord, ApiRoleGrant } from '@web/shared/api/types'

type FacultyPermissionsTabProps = {
  selectedFacultyMember: ApiFacultyRecord | null
  setRoleGrantForm: (value: RoleGrantFormState | ((prev: RoleGrantFormState) => RoleGrantFormState)) => void
  setEditingEntity: (value: EditingEntity | null) => void
  startEditingRoleGrant: (grant: ApiRoleGrant) => void
  handleArchiveRoleGrant: (grant: ApiRoleGrant) => void
}

export function FacultyPermissionsTab({
  selectedFacultyMember,
  setRoleGrantForm,
  setEditingEntity,
  startEditingRoleGrant,
  handleArchiveRoleGrant,
}: FacultyPermissionsTabProps) {
  return (
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
  )
}
