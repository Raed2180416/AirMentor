import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner, SectionHeading, TextInput } from '../system-admin-ui'
import type { ApiBatch, ApiBranch, ApiFacultyRecord } from '@web/shared/api/types'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type { LiveAdminDataset } from '../system-admin-live-data'
import type { EntityEditorState } from '../system-admin-live-app'
import { SystemAdminCurriculumGraphWorkspace } from '../system-admin-curriculum-graph'
import type { CurriculumSemesterEntry } from './types'
import { LabeledField } from './workspace-primitives'

type CoursesPanelProps = {
  selectedBranch: ApiBranch | null
  universityTab: string
  selectedBatch: ApiBatch | null
  selectedSectionCode: string | null
  currentSemesterTerm: LiveAdminDataset['terms'][number] | null
  batchTerms: LiveAdminDataset['terms']
  entityEditors: Pick<EntityEditorState, 'term' | 'curriculum'>
  setEntityEditors: Dispatch<SetStateAction<EntityEditorState>>
  startEditingTerm: (termId: string) => void
  resetTermEditor: () => void
  handleSaveTerm: FormEventHandler<HTMLFormElement>
  handleArchiveTerm: (termId: string) => Promise<void>
  selectedCurriculumSemester: string
  setSelectedCurriculumSemester: Dispatch<SetStateAction<string>>
  curriculumSemesterEntries: CurriculumSemesterEntry[]
  handleBootstrapCurriculumManifest: () => Promise<void>
  getScopedCourseLeaderState: (curriculumCourseId: string) => {
    matchingOfferings: LiveAdminDataset['offerings']
    leaderIds: string[]
    selectedFacultyId: string
    hasMultipleLeaders: boolean
  }
  startEditingCurriculumCourse: (curriculumCourseId: string) => void
  handleArchiveCurriculumCourse: (curriculumCourseId: string) => Promise<void>
  scopedCourseLeaderFaculty: ApiFacultyRecord[]
  handleAssignCurriculumCourseLeader: (curriculumCourseId: string, facultyId: string) => Promise<void>
  handleSaveCurriculumCourse: FormEventHandler<HTMLFormElement>
  resetCurriculumEditor: () => void
  selectedCurriculumCourseId: string
}

export function CoursesPanel({
  selectedBranch,
  universityTab,
  selectedBatch,
  selectedSectionCode,
  currentSemesterTerm,
  batchTerms,
  entityEditors,
  setEntityEditors,
  startEditingTerm,
  resetTermEditor,
  handleSaveTerm,
  handleArchiveTerm,
  selectedCurriculumSemester,
  setSelectedCurriculumSemester,
  curriculumSemesterEntries,
  handleBootstrapCurriculumManifest,
  getScopedCourseLeaderState,
  startEditingCurriculumCourse,
  handleArchiveCurriculumCourse,
  scopedCourseLeaderFaculty,
  handleAssignCurriculumCourseLeader,
  handleSaveCurriculumCourse,
  resetCurriculumEditor,
  selectedCurriculumCourseId,
}: CoursesPanelProps) {
  const selectedCurriculumSemesterEntry = curriculumSemesterEntries.find(entry => String(entry.semesterNumber) === selectedCurriculumSemester) ?? null
  const selectedCurriculumSemesterCourses = selectedCurriculumSemesterEntry?.courses ?? []

  return selectedBranch && universityTab === 'courses' ? (
    selectedBatch ? (
      <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
        <SectionHeading title="Terms, Curriculum, And Course Leaders" eyebrow="Courses" caption={`Operate semester navigation, curriculum rows, and course-leader ownership directly for Batch ${selectedBatch.batchLabel}${selectedSectionCode ? ` · Section ${selectedSectionCode}` : ''}.`} />
        <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Academic Terms</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>Semester navigation is now owned here instead of relying on the legacy shell.</div>
            </div>
            {currentSemesterTerm ? <Chip color={T.success}>{`Current sem term · ${currentSemesterTerm.academicYearLabel}`}</Chip> : <Chip color={T.warning}>No term mapped to current semester</Chip>}
          </div>
          {batchTerms.length === 0 ? <EmptyState title="No academic terms yet" body="Create the first semester term here before provisioning or assigning course leaders." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {batchTerms.map(term => (
                <Card key={term.termId} style={{ padding: 12, background: T.surface, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{`${term.academicYearLabel} · Semester ${term.semesterNumber}`}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{`${term.startDate} to ${term.endDate}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingTerm(term.termId)}>Edit Term</Btn>
                    <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveTerm(term.termId)}>Archive</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <form onSubmit={handleSaveTerm} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{entityEditors.term.termId ? 'Edit Term' : 'Add Term'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <LabeledField label="Academic year"><TextInput value={entityEditors.term.academicYearLabel} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, academicYearLabel: event.target.value } }))} /></LabeledField>
              <LabeledField label="Semester number"><TextInput value={entityEditors.term.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, semesterNumber: event.target.value } }))} /></LabeledField>
              <LabeledField label="Start date"><TextInput value={entityEditors.term.startDate} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, startDate: event.target.value } }))} placeholder="YYYY-MM-DD" /></LabeledField>
              <LabeledField label="End date"><TextInput value={entityEditors.term.endDate} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, endDate: event.target.value } }))} placeholder="YYYY-MM-DD" /></LabeledField>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn type="submit">{entityEditors.term.termId ? 'Save Term' : 'Create Term'}</Btn>
              <Btn type="button" variant="ghost" onClick={resetTermEditor}>Clear Editor</Btn>
            </div>
          </form>
        </Card>
        <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Curriculum Import And Rows</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>Import the proof curriculum seed, then edit semester rows and course-leader ownership in one place.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <LabeledField label="Semester">
                <select value={selectedCurriculumSemester} onChange={event => setSelectedCurriculumSemester(event.target.value)} style={{ width: 160 }}>
                  {curriculumSemesterEntries.map(entry => (
                    <option key={entry.semesterNumber} value={String(entry.semesterNumber)}>
                      {`Semester ${entry.semesterNumber}`}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <Btn type="button" variant="ghost" onClick={() => void handleBootstrapCurriculumManifest()}>Import Curriculum From Manifest</Btn>
            </div>
          </div>
          <InfoBanner message="This imports the bundled proof curriculum seed (manifest key msruas-mnc-seed), regenerates prerequisite suggestions, and queues any proof refresh required for the affected batches." />
          {selectedCurriculumSemesterCourses.length === 0 ? <EmptyState title="No curriculum rows for this semester" body="Create the first course row below or import the governed proof curriculum seed into this batch." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {selectedCurriculumSemesterCourses.map(course => {
                const leaderState = getScopedCourseLeaderState(course.curriculumCourseId)
                return (
                  <Card key={course.curriculumCourseId} style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{`${course.courseCode} · ${course.title}`}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted }}>{`${course.credits} credits · ${leaderState.matchingOfferings.length} live offering${leaderState.matchingOfferings.length === 1 ? '' : 's'}`}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingCurriculumCourse(course.curriculumCourseId)}>Edit</Btn>
                        <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveCurriculumCourse(course.curriculumCourseId)}>Archive</Btn>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px)', gap: 10 }}>
                      <LabeledField label="Course leader assignment" hint={leaderState.matchingOfferings.length === 0 ? 'Assignment is locked until a live offering exists for this curriculum row in the current scope.' : leaderState.hasMultipleLeaders ? 'Multiple leader-like ownerships exist across the matching live offerings.' : undefined}>
                        <select
                          value={leaderState.selectedFacultyId}
                          onChange={event => void handleAssignCurriculumCourseLeader(course.curriculumCourseId, event.target.value)}
                          style={{ width: '100%' }}
                          disabled={leaderState.matchingOfferings.length === 0}
                        >
                          <option value="">{leaderState.matchingOfferings.length === 0 ? 'No matching live offering yet' : 'Clear leader assignment'}</option>
                          {scopedCourseLeaderFaculty.map(faculty => (
                            <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.displayName}</option>
                          ))}
                        </select>
                      </LabeledField>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {leaderState.leaderIds.length === 0 ? <Chip color={T.warning}>No leader assigned</Chip> : leaderState.leaderIds.map(facultyId => {
                        const faculty = scopedCourseLeaderFaculty.find(item => item.facultyId === facultyId)
                        return <Chip key={`${course.curriculumCourseId}:${facultyId}`} color={leaderState.hasMultipleLeaders ? T.warning : T.success}>{faculty?.displayName ?? facultyId}</Chip>
                      })}
                      {leaderState.matchingOfferings.length === 0 ? <Chip color={T.dim}>Locked until a live offering exists</Chip> : null}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
          <form onSubmit={handleSaveCurriculumCourse} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{entityEditors.curriculum.curriculumCourseId ? 'Edit Curriculum Row' : 'Add Curriculum Row'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <LabeledField label="Semester number"><TextInput value={entityEditors.curriculum.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, semesterNumber: event.target.value } }))} /></LabeledField>
              <LabeledField label="Course code"><TextInput value={entityEditors.curriculum.courseCode} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, courseCode: event.target.value } }))} /></LabeledField>
              <LabeledField label="Course title"><TextInput value={entityEditors.curriculum.title} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, title: event.target.value } }))} /></LabeledField>
              <LabeledField label="Credits"><TextInput value={entityEditors.curriculum.credits} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, credits: event.target.value } }))} /></LabeledField>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn type="submit">{entityEditors.curriculum.curriculumCourseId ? 'Save Curriculum Row' : 'Create Curriculum Row'}</Btn>
              <Btn type="button" variant="ghost" onClick={resetCurriculumEditor}>Clear Editor</Btn>
              <Chip color={selectedCurriculumCourseId ? T.accent : T.dim}>{selectedCurriculumCourseId ? `Selected row ${selectedCurriculumCourseId}` : 'No row selected'}</Chip>
            </div>
          </form>
        </Card>
      </Card>
    ) : (
      <EmptyState title="Select a year first" body="Terms and curriculum editing unlock once a batch is selected within the chosen branch." />
    )
  ) : null
}

type CurriculumPanelProps = {
  selectedBatch: ApiBatch | null
  universityTab: string
  apiClient: AirMentorApiClient
}

export function CurriculumPanel({ selectedBatch, universityTab, apiClient }: CurriculumPanelProps) {
  return selectedBatch && universityTab === 'curriculum' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Curriculum Graph Builder" eyebrow="Curriculum" caption={`Visual prerequisite graph, course nodes, ML suggestions, and publish workflow for Batch ${selectedBatch.batchLabel}.`} />
      <SystemAdminCurriculumGraphWorkspace batchId={selectedBatch.batchId} apiClient={apiClient} />
    </Card>
  ) : null
}
