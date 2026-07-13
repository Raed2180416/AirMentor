import type { FormEvent } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import {
  FieldLabel,
  InfoBanner,
  SectionHeading,
  TextInput,
  formatDate,
  formatDateTime,
} from '../../system-admin-ui'
import { type EditingEntity, type FacultyFormState, formatFacultyGrantScopeLabel } from '../../live-app-model'
import { isCurrentRoleGrant } from '../../system-admin-overview-helpers'
import { AdminDetailTabPanel } from '../../live-app-chrome'
import type {
  ApiAdminFacultyPasswordSetupResponse,
  ApiFacultyCredentialStatus,
  ApiFacultyRecord,
  ApiRoleGrant,
} from '@web/shared/api/types'
import type { LiveAdminDataset, LiveAdminRoute } from '../../system-admin-live-data'
import { resolveDepartment, getPrimaryAppointmentDepartmentId } from '../../system-admin-live-data'

type FacultyProfileTabProps = {
  selectedFacultyMember: ApiFacultyRecord | null
  selectedFacultyCredentialStatus: ApiFacultyCredentialStatus
  selectedFacultyProofBanner: string | null
  facultyForm: FacultyFormState
  setFacultyForm: (value: FacultyFormState | ((prev: FacultyFormState) => FacultyFormState)) => void
  facultyPasswordSetupResult: ApiAdminFacultyPasswordSetupResponse | null
  handleSaveFaculty: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveFaculty: () => void
  handleIssueFacultyPasswordSetup: () => void
  navigate: (route: LiveAdminRoute) => void
  setEditingEntity: (value: EditingEntity | null) => void
  resetFacultyEditors: () => void
  operatorData: LiveAdminDataset
}

export function FacultyProfileTab({
  selectedFacultyMember,
  selectedFacultyCredentialStatus,
  selectedFacultyProofBanner,
  facultyForm,
  setFacultyForm,
  facultyPasswordSetupResult,
  handleSaveFaculty,
  handleArchiveFaculty,
  handleIssueFacultyPasswordSetup,
  navigate,
  setEditingEntity,
  resetFacultyEditors,
  operatorData,
}: FacultyProfileTabProps) {
  return (
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
  )
}
