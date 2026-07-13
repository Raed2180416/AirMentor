import type { Dispatch, SetStateAction } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip, getFieldChromeStyle } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner, SectionHeading, TextInput } from '../system-admin-ui'
import type {
  ApiBatch,
  ApiFacultyRecord,
  ApiMentorAssignmentBulkApplyResponse,
  ApiStudentRecord,
} from '@web/shared/api/types'
import type { LiveAdminDataset } from '../system-admin-live-data'
import type { BatchProvisioningFormState } from '../system-admin-live-app'
import {
  describeBulkMentorPreview,
  describeScopedFacultyRoles,
  getScopedMentorEligibleFaculty,
  type BulkMentorAssignmentFormState,
} from '../system-admin-provisioning-helpers'
import { AdminMiniStat, LabeledField, ToggleField } from './workspace-primitives'

type ProvisioningPanelProps = {
  selectedBatch: ApiBatch | null
  universityTab: string
  selectedSectionCode: string | null
  batchProvisioningForm: BatchProvisioningFormState
  setBatchProvisioningForm: Dispatch<SetStateAction<BatchProvisioningFormState>>
  handleProvisionBatch: () => Promise<void>
  handleProvisionSeededDemoWorkspace: () => Promise<void>
  batchFacultyPool: ApiFacultyRecord[]
  batchMentorEligibleFaculty: ApiFacultyRecord[]
  batchOfferingsWithoutOwner: LiveAdminDataset['offerings']
  batchStudentsWithoutEnrollment: ApiStudentRecord[]
  batchStudentsWithoutMentor: ApiStudentRecord[]
  batchOfferingsWithoutRoster: LiveAdminDataset['offerings']
  currentSemesterTerm: LiveAdminDataset['terms'][number] | null
  batchTerms: LiveAdminDataset['terms']
  bulkMentorAssignmentForm: BulkMentorAssignmentFormState
  setBulkMentorAssignmentForm: Dispatch<SetStateAction<BulkMentorAssignmentFormState>>
  bulkMentorAssignmentPreview: ApiMentorAssignmentBulkApplyResponse | null
  handlePreviewBulkMentorAssignment: () => Promise<void>
  handleApplyBulkMentorAssignment: () => Promise<void>
  clearBulkMentorAssignmentPreview: () => void
  syntheticProvisioningEnabled: boolean
  setSyntheticProvisioningEnabled: Dispatch<SetStateAction<boolean>>
}

export function ProvisioningPanel({
  selectedBatch,
  universityTab,
  selectedSectionCode,
  batchProvisioningForm,
  setBatchProvisioningForm,
  handleProvisionBatch,
  handleProvisionSeededDemoWorkspace,
  batchFacultyPool,
  batchMentorEligibleFaculty,
  batchOfferingsWithoutOwner,
  batchStudentsWithoutEnrollment,
  batchStudentsWithoutMentor,
  batchOfferingsWithoutRoster,
  currentSemesterTerm,
  batchTerms,
  bulkMentorAssignmentForm,
  setBulkMentorAssignmentForm,
  bulkMentorAssignmentPreview,
  handlePreviewBulkMentorAssignment,
  handleApplyBulkMentorAssignment,
  clearBulkMentorAssignmentPreview,
  syntheticProvisioningEnabled,
  setSyntheticProvisioningEnabled,
}: ProvisioningPanelProps) {
  const provisioningSectionLabels = batchProvisioningForm.sectionLabels
    .split(/[\n,]/)
    .map(label => label.trim().toUpperCase())
    .filter(Boolean)
  const provisioningMentorEligibilitySectionCode = provisioningSectionLabels.length === 1 ? provisioningSectionLabels[0] ?? null : null
  const provisioningMentorEligibleFaculty = selectedBatch
    ? getScopedMentorEligibleFaculty(batchFacultyPool, selectedBatch.batchId, provisioningMentorEligibilitySectionCode)
    : []
  const selectedProvisionFacultyPool = batchProvisioningForm.facultyPoolIds.length > 0
    ? batchFacultyPool.filter(member => batchProvisioningForm.facultyPoolIds.includes(member.facultyId))
    : batchFacultyPool
  const selectedProvisionMentorFaculty = batchProvisioningForm.facultyPoolIds.length > 0
    ? provisioningMentorEligibleFaculty.filter(member => batchProvisioningForm.facultyPoolIds.includes(member.facultyId))
    : provisioningMentorEligibleFaculty
  const provisioningModeIsSynthetic = batchProvisioningForm.mode === 'mock'

  return selectedBatch && universityTab === 'provision' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Batch Provisioning" eyebrow="Operations" caption={`Materialize live-empty batches, mentor links, ownership, and scaffolding for Batch ${selectedBatch.batchLabel}${selectedSectionCode ? ` · Section ${selectedSectionCode}` : ''}. Synthetic student creation is advanced/test-only.`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
        <AdminMiniStat label="Faculty In Scope" value={String(batchFacultyPool.length)} tone={T.accent} />
        <AdminMiniStat label="Mentor-Ready Faculty" value={String(provisioningMentorEligibleFaculty.length)} tone={provisioningMentorEligibleFaculty.length ? T.success : T.warning} />
        <AdminMiniStat label="Offerings Without Owner" value={String(batchOfferingsWithoutOwner.length)} tone={batchOfferingsWithoutOwner.length ? T.warning : T.success} />
        <AdminMiniStat label="Students Without Enrollment" value={String(batchStudentsWithoutEnrollment.length)} tone={batchStudentsWithoutEnrollment.length ? T.warning : T.success} />
        <AdminMiniStat label="Students Without Mentor" value={String(batchStudentsWithoutMentor.length)} tone={batchStudentsWithoutMentor.length ? T.warning : T.success} />
        <AdminMiniStat label="Offerings Without Roster" value={String(batchOfferingsWithoutRoster.length)} tone={batchOfferingsWithoutRoster.length ? T.warning : T.success} />
      </div>
      <form style={{ display: 'grid', gap: 12 }} onSubmit={event => { event.preventDefault(); void handleProvisionBatch() }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Setup term">
            <select value={batchProvisioningForm.termId} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, termId: event.target.value }))} style={{ ...getFieldChromeStyle({ dense: true }), cursor: 'pointer', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}>
              <option value="">{currentSemesterTerm ? 'Use current semester term' : 'Select term'}</option>
              {batchTerms.map(term => (
                <option key={term.termId} value={term.termId}>{`${term.academicYearLabel} · Semester ${term.semesterNumber}`}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Provisioning mode" hint="Live-empty and manual modes keep synthetic student creation out of the default operator flow. Enable the advanced test switch below only when you intentionally want synthetic fixture identities.">
            <select value={batchProvisioningForm.mode} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, mode: event.target.value as BatchProvisioningFormState['mode'] }))} style={{ ...getFieldChromeStyle({ dense: true }), cursor: 'pointer', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}>
              <option value="live-empty">Live Empty</option>
              <option value="manual">Manual</option>
              <option value="mock" disabled={!syntheticProvisioningEnabled}>Synthetic Fixture (advanced test only)</option>
            </select>
          </LabeledField>
          <LabeledField label="Sections"><TextInput value={batchProvisioningForm.sectionLabels} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, sectionLabels: event.target.value }))} placeholder="A, B" /></LabeledField>
          <LabeledField label="Students per section"><TextInput value={batchProvisioningForm.studentsPerSection} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, studentsPerSection: event.target.value }))} /></LabeledField>
        </div>
        <LabeledField label="Faculty pool" hint="Leave the multi-select empty to use every faculty member in scope. Provisioning mentors only uses faculty with an active mentor grant in the same scope.">
          <select
            multiple
            value={batchProvisioningForm.facultyPoolIds}
            onChange={event => {
              const nextFacultyPoolIds = Array.from(event.currentTarget.selectedOptions, option => option.value)
              setBatchProvisioningForm(prev => ({ ...prev, facultyPoolIds: nextFacultyPoolIds }))
            }}
            style={{ ...getFieldChromeStyle({ dense: true }), minHeight: 132 }}
          >
            {batchFacultyPool.map(member => (
              <option key={member.facultyId} value={member.facultyId}>
                {`${member.displayName} · ${describeScopedFacultyRoles(member)}`}
              </option>
            ))}
          </select>
        </LabeledField>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn type="button" variant={syntheticProvisioningEnabled ? 'ghost' : 'primary'} onClick={() => {
            setSyntheticProvisioningEnabled(prev => {
              const next = !prev
              if (!next) {
                setBatchProvisioningForm(current => current.mode === 'mock' ? { ...current, mode: 'live-empty', createStudents: false } : current)
              }
              return next
            })
          }}>
            {syntheticProvisioningEnabled ? 'Disable Synthetic Test Mode' : 'Enable Synthetic Test Mode'}
          </Btn>
          <Chip color={syntheticProvisioningEnabled ? T.warning : T.dim}>
            {syntheticProvisioningEnabled ? 'Synthetic fixture identities available' : 'Synthetic fixture identities hidden from the default flow'}
          </Chip>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ToggleField
            label={provisioningModeIsSynthetic ? 'Create synthetic students' : 'Create students'}
            checked={provisioningModeIsSynthetic ? true : false}
            onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createStudents: checked }))}
            disabled={!syntheticProvisioningEnabled || !provisioningModeIsSynthetic}
          />
          <ToggleField label="Create mentors" checked={batchProvisioningForm.createMentors} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createMentors: checked }))} />
          <ToggleField label="Create attendance scaffolding" checked={batchProvisioningForm.createAttendanceScaffolding} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createAttendanceScaffolding: checked }))} />
          <ToggleField label="Create assessment scaffolding" checked={batchProvisioningForm.createAssessmentScaffolding} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createAssessmentScaffolding: checked }))} />
          <ToggleField label="Create transcript scaffolding" checked={batchProvisioningForm.createTranscriptScaffolding} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createTranscriptScaffolding: checked }))} />
        </div>
        {!syntheticProvisioningEnabled ? (
          <InfoBanner message="Synthetic student creation is hidden in the default operator flow. Enable the advanced test mode switch only if you intentionally need fixture identities for sandbox verification." />
        ) : provisioningModeIsSynthetic ? (
          <InfoBanner message="Synthetic fixture mode creates persisted synthetic students. Keep this for explicit test or sandbox runs only." tone="success" />
        ) : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Chip color={selectedProvisionFacultyPool.length === batchFacultyPool.length ? T.dim : T.accent}>
            {selectedProvisionFacultyPool.length === batchFacultyPool.length
              ? 'All eligible department faculty'
              : `${selectedProvisionFacultyPool.length} faculty selected`}
          </Chip>
          <Chip color={selectedProvisionMentorFaculty.length > 0 ? T.success : T.warning}>
            {selectedProvisionMentorFaculty.length > 0
              ? `${selectedProvisionMentorFaculty.length} mentor-ready faculty in the current pool`
              : 'No mentor-ready faculty in the current pool'}
          </Chip>
          <Btn type="submit">Run Batch Provisioning</Btn>
          {currentSemesterTerm ? <Chip color={T.success}>{`Current semester term ${currentSemesterTerm.academicYearLabel}`}</Chip> : <Chip color={T.warning}>Add a term before running batch provisioning</Chip>}
        </div>
      </form>
      <Card style={{ padding: 14, background: T.surface, display: 'grid', gap: 12 }}>
        <SectionHeading title="Seeded Demo Workspace" eyebrow="P5-D" caption="Clone the MSRUAS proof dataset into a disposable demo workspace, including seeded academic rows, proof artifacts, and playback checkpoints." />
        <InfoBanner message="After provisioning, sign in again so the session is bound to the demo workspace pointer rather than the global proof run." />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn type="button" variant="secondary" onClick={() => void handleProvisionSeededDemoWorkspace()}>Provision Seeded Demo Workspace</Btn>
          <Chip color={T.warning}>Disposable demo scope</Chip>
        </div>
      </Card>
      <Card style={{ padding: 14, background: T.surface, display: 'grid', gap: 12 }}>
        <SectionHeading title="Bulk Mentor Assignment" eyebrow="Permissions" caption={`Preview or apply mentor links for ${selectedSectionCode ? `Section ${selectedSectionCode}` : `Batch ${selectedBatch.batchLabel}`} using only mentor-ready faculty.`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Eligible mentor">
            <select value={bulkMentorAssignmentForm.facultyId} onChange={event => {
              clearBulkMentorAssignmentPreview()
              setBulkMentorAssignmentForm(prev => ({ ...prev, facultyId: event.target.value }))
            }} style={{ ...getFieldChromeStyle({ dense: true }), cursor: 'pointer', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}>
              <option value="">{batchMentorEligibleFaculty.length > 0 ? 'Select mentor-eligible faculty' : 'No mentor-eligible faculty available'}</option>
              {batchMentorEligibleFaculty.map(member => (
                <option key={member.facultyId} value={member.facultyId}>{`${member.displayName} · ${describeScopedFacultyRoles(member)}`}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Selection mode">
            <select value={bulkMentorAssignmentForm.selectionMode} onChange={event => {
              clearBulkMentorAssignmentPreview()
              setBulkMentorAssignmentForm(prev => ({ ...prev, selectionMode: event.target.value as BulkMentorAssignmentFormState['selectionMode'] }))
            }} style={{ ...getFieldChromeStyle({ dense: true }), cursor: 'pointer', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}>
              <option value="missing-only">Fill mentor gaps only</option>
              <option value="replace-all">Replace all active mentor links in scope</option>
            </select>
          </LabeledField>
          <LabeledField label="Effective from"><TextInput value={bulkMentorAssignmentForm.effectiveFrom} onChange={event => {
            clearBulkMentorAssignmentPreview()
            setBulkMentorAssignmentForm(prev => ({ ...prev, effectiveFrom: event.target.value }))
          }} placeholder="YYYY-MM-DD" /></LabeledField>
          <LabeledField label="Source"><TextInput value={bulkMentorAssignmentForm.source} onChange={event => {
            clearBulkMentorAssignmentPreview()
            setBulkMentorAssignmentForm(prev => ({ ...prev, source: event.target.value }))
          }} placeholder="sysadmin-bulk-mentor-apply" /></LabeledField>
        </div>
        <InfoBanner message={describeBulkMentorPreview(bulkMentorAssignmentPreview)} tone={bulkMentorAssignmentPreview && bulkMentorAssignmentPreview.summary.targetedStudentCount > 0 ? 'success' : 'neutral'} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn type="button" onClick={() => void handlePreviewBulkMentorAssignment()} disabled={batchMentorEligibleFaculty.length === 0 || !bulkMentorAssignmentForm.facultyId}>Preview Mentor Assignments</Btn>
          <Btn type="button" variant="ghost" onClick={clearBulkMentorAssignmentPreview}>Clear Preview</Btn>
          <Btn
            type="button"
            variant="secondary"
            onClick={() => void handleApplyBulkMentorAssignment()}
            disabled={
              !bulkMentorAssignmentPreview
              || (
                bulkMentorAssignmentPreview.summary.createdAssignmentCount === 0
                && bulkMentorAssignmentPreview.summary.endedAssignmentCount === 0
              )
            }
          >
            Apply Previewed Mentor Changes
          </Btn>
          {bulkMentorAssignmentPreview?.bulkApplyId ? <Chip color={T.success}>{`Applied as ${bulkMentorAssignmentPreview.bulkApplyId}`}</Chip> : null}
        </div>
        {bulkMentorAssignmentPreview ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={bulkMentorAssignmentPreview.summary.targetedStudentCount > 0 ? T.accent : T.dim}>{`${bulkMentorAssignmentPreview.summary.targetedStudentCount} targeted`}</Chip>
              <Chip color={bulkMentorAssignmentPreview.summary.createdAssignmentCount > 0 ? T.success : T.dim}>{`${bulkMentorAssignmentPreview.summary.createdAssignmentCount} creates`}</Chip>
              <Chip color={bulkMentorAssignmentPreview.summary.endedAssignmentCount > 0 ? T.warning : T.dim}>{`${bulkMentorAssignmentPreview.summary.endedAssignmentCount} end-dates`}</Chip>
              <Chip color={bulkMentorAssignmentPreview.summary.unchangedCount > 0 ? T.dim : T.success}>{`${bulkMentorAssignmentPreview.summary.unchangedCount} unchanged`}</Chip>
            </div>
            {bulkMentorAssignmentPreview.students.length === 0 ? <EmptyState title="No students matched the preview" body="Adjust the selection mode, scope, or mentor-ready faculty to target a different cohort." /> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {bulkMentorAssignmentPreview.students.map(student => (
                  <Card key={student.studentId} style={{ padding: 12, background: T.surface2, display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{`${student.studentName} · ${student.usn}`}</div>
                      <Chip color={student.action === 'reassign' ? T.warning : student.action === 'keep' ? T.dim : T.success}>{student.action}</Chip>
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{`${student.sectionCode ? `Section ${student.sectionCode}` : 'Scope-level student'} · ${student.actionReason}`}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </Card>
  ) : null
}
