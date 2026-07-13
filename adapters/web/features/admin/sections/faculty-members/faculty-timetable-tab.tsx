import { AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { Btn, Card, Chip, ModalWorkspace } from '@web/shared/ui/primitives'
import { EmptyState, InfoBanner, SectionHeading, formatDate } from '../../system-admin-ui'
import { SystemAdminFacultyCalendarWorkspace } from '../../system-admin-faculty-calendar-workspace'
import { AdminDetailTabPanel, AdminMiniStat } from '../../live-app-chrome'
import type { ApiAdminFacultyCalendar, ApiFacultyRecord } from '@web/shared/api/types'

type FacultyTimetableTabProps = {
  selectedFacultyMember: ApiFacultyRecord | null
  facultyCalendar: ApiAdminFacultyCalendar | null
  facultyCalendarLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedFacultyCalendarOfferings: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facultyCalendarRecurringBlocks: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facultyCalendarExtraBlocks: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortedFacultyCalendarMarkers: any[]
  showFacultyTimetableExpanded: boolean
  setShowFacultyTimetableExpanded: (value: boolean) => void
  handleSaveFacultyCalendar: (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => Promise<void>
}

export function FacultyTimetableTab({
  selectedFacultyMember,
  facultyCalendar,
  facultyCalendarLoading,
  selectedFacultyCalendarOfferings,
  facultyCalendarRecurringBlocks,
  facultyCalendarExtraBlocks,
  sortedFacultyCalendarMarkers,
  showFacultyTimetableExpanded,
  setShowFacultyTimetableExpanded,
  handleSaveFacultyCalendar,
}: FacultyTimetableTabProps) {
  return (
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
  )
}
