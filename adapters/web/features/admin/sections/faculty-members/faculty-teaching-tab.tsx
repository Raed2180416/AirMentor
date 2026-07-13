import type { FormEvent } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card } from '@web/shared/ui/primitives'
import { EmptyState, FieldLabel, InfoBanner, SectionHeading, SelectInput, TextInput } from '../../system-admin-ui'
import { type OwnershipFormState, defaultOwnershipForm } from '../../live-app-model'
import { AdminDetailTabPanel } from '../../live-app-chrome'
import type { ApiFacultyRecord, ApiOfferingOwnership } from '@web/shared/api/types'
import type { LiveAdminDataset } from '../../system-admin-live-data'

type FacultyTeachingTabProps = {
  selectedFacultyMember: ApiFacultyRecord | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyAssignments: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyOwnerships: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  availableOwnershipOfferings: any[]
  ownershipForm: OwnershipFormState
  setOwnershipForm: (value: OwnershipFormState | ((prev: OwnershipFormState) => OwnershipFormState)) => void
  handleSaveOwnership: (event: FormEvent<HTMLFormElement>) => void
  handleArchiveOwnership: (ownership: ApiOfferingOwnership) => void
  operatorData: LiveAdminDataset
}

export function FacultyTeachingTab({
  selectedFacultyMember,
  selectedFacultyAssignments,
  selectedFacultyOwnerships,
  availableOwnershipOfferings,
  ownershipForm,
  setOwnershipForm,
  handleSaveOwnership,
  handleArchiveOwnership,
  operatorData,
}: FacultyTeachingTabProps) {
  return (
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
  )
}
