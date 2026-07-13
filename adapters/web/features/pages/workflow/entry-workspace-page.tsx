import { useState } from 'react'
import { Eye } from 'lucide-react'
import {
  PAPER_MAP,
  T,
  mono,
  sora,
  type Offering,
  type Student,
  type StudentHistoryRecord,
} from '@web/simulation/fixtures'
import type {
  EntryKind,
  EntryLockMap,
  FacultyCapabilitySet,
  QueueTransition,
  SchemeState,
  StudentRuntimePatch,
  TaskType,
  TTKind,
  TermTestBlueprint,
} from '@kernel/shared/domain'
import {
  defaultSchemeForOffering,
  flattenBlueprintLeaves,
  getAssessmentComponentScore,
  getEntryLockMap,
  seedBlueprintFromPaper,
  seedTermTestLeafScores,
  useAppSelectors,
} from '@web/shared/state/selectors'
import {
  ENTRY_CATALOG,
  getEntryAccessState,
  parseInputValue,
  shouldBlockNumericKey,
  toCellKey,
} from '@web/shared/state/page-utils'
import { Btn, Card, Chip, HScrollArea, PageBackButton, PageShell, TD, TH } from '@web/shared/ui/primitives'
import { EmptyState } from '@web/features/admin/system-admin-ui'

export function EntryWorkspacePage({
  capabilities,
  offeringId,
  kind,
  onBack,
  lockByOffering,
  draftBySection,
  onSaveDraft,
  onSubmitLock,
  onRequestUnlock,
  cellValues,
  onCellValueChange,
  onOpenStudent,
  onOpenTaskComposer,
  onUpdateStudentAttendance,
  schemeByOffering,
  ttBlueprintsByOffering,
  studentHistoryByUsn,
  lockAuditByTarget,
  availableOfferings,
  proofStageKey,
}: {
  capabilities: FacultyCapabilitySet
  offeringId: string
  kind: EntryKind
  onBack: () => void
  lockByOffering: Record<string, EntryLockMap>
  draftBySection: Record<string, number>
  onSaveDraft: (offeringId: string, kind: EntryKind) => void
  onSubmitLock: (offeringId: string, kind: EntryKind) => void
  onRequestUnlock: (offeringId: string, kind: EntryKind) => void
  cellValues: Record<string, number>
  onCellValueChange: (key: string, value: number | undefined) => void
  onOpenStudent: (student: Student, offering: Offering) => void
  onOpenTaskComposer: (input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => void
  onUpdateStudentAttendance: (offeringId: string, studentId: string, patch: StudentRuntimePatch) => void
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  studentHistoryByUsn?: Record<string, StudentHistoryRecord>
  lockAuditByTarget: Record<string, QueueTransition[]>
  availableOfferings: Offering[]
  proofStageKey?: string | null
}) {
  const { deriveAcademicProjection, getStudentPatch, getStudentsPatched } = useAppSelectors()
  const selectedOffering = availableOfferings.find(item => item.offId === offeringId) ?? null
  const groupedSections = selectedOffering
    ? availableOfferings.filter(item => item.code === selectedOffering.code && item.year === selectedOffering.year)
    : []
  const [selectedClassOffIdState, setSelectedClassOffIdState] = useState<string>('all')
  const selected = ENTRY_CATALOG.find(item => item.kind === kind) ?? ENTRY_CATALOG[0]
  const selectedClassOffId = selectedClassOffIdState === 'all' || groupedSections.some(section => section.offId === selectedClassOffIdState)
    ? selectedClassOffIdState
    : offeringId
  if (!selectedOffering) {
    return (
      <PageShell size="wide">
        <PageBackButton onClick={onBack} />
        <Card surface="panel" style={{ padding: '16px 18px' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: T.text, marginBottom: 6 }}>{selected.title}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>This workspace has no live offering in scope. Re-open it from a provisioned class in the data-entry hub.</div>
        </Card>
      </PageShell>
    )
  }
  const lockMap = lockByOffering[selectedOffering.offId] ?? getEntryLockMap(selectedOffering)
  const access = getEntryAccessState({
    stage: selectedOffering.stageInfo.stage,
    kind,
    isLocked: lockMap[kind],
    canEditMarks: capabilities.canEditMarks,
  })
  const visibleSections = selectedClassOffId === 'all' ? groupedSections : groupedSections.filter(section => section.offId === selectedClassOffId)
  const latestAudit = lockAuditByTarget[`${selectedOffering.offId}::${kind}`]?.at(-1)

  return (
    <PageShell size="wide">
      <PageBackButton onClick={onBack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>{selected.title} — Direct Entry Workspace</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>{selectedOffering.code} · {selectedOffering.title} · {selectedOffering.year} · Stage {selectedOffering.stageInfo.stage}</div>
        </div>
        <div style={{ minWidth: 280 }}>
          <label htmlFor="entry-workspace-class" style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 4 }}>Class</label>
          <select id="entry-workspace-class" value={selectedClassOffId} onChange={event => setSelectedClassOffIdState(event.target.value)} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
            <option value="all">All mapped classes for {selectedOffering.code}</option>
            {groupedSections.map(section => <option key={section.offId} value={section.offId}>{section.year} · Sec {section.section} · {getStudentsPatched(section).length} students</option>)}
          </select>
        </div>
      </div>
      {!capabilities.canEditMarks && <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 10 }}>Read-only for this role. Only Course Leaders can edit marks.</div>}
      {access.isLocked && (
        <Card style={{ marginBottom: 10, padding: '10px 12px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>This dataset is locked. Corrections require a governed unlock flow.</div>
          {latestAudit && <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>Latest audit note: {latestAudit.note}</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => onRequestUnlock(selectedOffering.offId, kind)}>Request unlock from HoD</Btn>
          </div>
        </Card>
      )}
      {!access.isApplicableForStage && <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 10 }}>Not applicable at current stage ({selectedOffering.stageInfo.stage}).</div>}

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {visibleSections.map(section => {
          const students = getStudentsPatched(section)
          const sectionLocks = lockByOffering[section.offId] ?? getEntryLockMap(section)
          const sectionAccess = getEntryAccessState({
            stage: section.stageInfo.stage,
            kind,
            isLocked: sectionLocks[kind],
            canEditMarks: capabilities.canEditMarks,
          })
          const currentScheme = schemeByOffering[section.offId] ?? defaultSchemeForOffering(section)
          const blueprint = kind === 'tt1' || kind === 'tt2'
            ? (ttBlueprintsByOffering[section.offId]?.[kind] ?? seedBlueprintFromPaper(kind, PAPER_MAP[section.code] || PAPER_MAP.default))
            : null
          const leaves = blueprint ? flattenBlueprintLeaves(blueprint.nodes) : []
          const hasInvalidTtBlueprint = blueprint != null && blueprint.totalMarks !== 25
          const dynamicComponents = kind === 'quiz' ? currentScheme.quizComponents : kind === 'assignment' ? currentScheme.assignmentComponents : []
          const draftKey = `${section.offId}::${kind}`
          const hasIncompleteTtLeaves = (kind === 'tt1' || kind === 'tt2') && students.some(student => {
            const exactPatch = getStudentPatch(section.offId, student.id)
            const exactLeafScores = kind === 'tt1' ? exactPatch.tt1LeafScores : exactPatch.tt2LeafScores
            const seededScores = seedTermTestLeafScores(kind === 'tt1' ? student.tt1Score : student.tt2Score, kind === 'tt1' ? student.tt1Max : student.tt2Max, leaves)
            return leaves.some(leaf => cellValues[toCellKey(section.offId, kind, student.id, leaf.id)] === undefined && exactLeafScores?.[leaf.id] === undefined && seededScores?.[leaf.id] === undefined)
          })

          return (
            <Card key={section.offId} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{section.code} · Sec {section.section}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{students.length} students</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip color={sectionAccess.isApplicableForStage ? T.blue : T.dim} size={9}>{sectionAccess.isApplicableForStage ? 'Stage Applicable' : 'Locked by Stage'}</Chip>
                  {students.length === 0 ? <Chip color={T.dim} size={9}>Roster unconfigured</Chip> : null}
                  {hasInvalidTtBlueprint ? <Chip color={T.danger} size={9}>Blueprint total {blueprint.totalMarks}/25</Chip> : null}
                  {hasIncompleteTtLeaves ? <Chip color={T.warning} size={9}>Explicit TT leaf values required</Chip> : null}
                  {draftBySection[draftKey] && <Chip color={T.success} size={9}>Draft saved</Chip>}
                  <Btn size="sm" onClick={() => onSaveDraft(section.offId, kind)} variant="ghost" disabled={students.length === 0 || hasInvalidTtBlueprint}>Save Draft</Btn>
                  <Btn size="sm" onClick={() => onSubmitLock(section.offId, kind)} disabled={students.length === 0 || hasIncompleteTtLeaves || hasInvalidTtBlueprint}>{sectionAccess.canEdit ? 'Submit & Lock' : sectionAccess.isLocked ? 'Locked' : 'View Only'}</Btn>
                </div>
              </div>

              {hasInvalidTtBlueprint ? (
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: `${T.danger}10`, ...mono, fontSize: 11, color: T.danger }}>
                  TT entry is blocked until the question-paper raw total is exactly 25. Return to the TT blueprint builder and adjust the parts before saving marks.
                </div>
              ) : null}

              {students.length === 0 ? (
                <div style={{ padding: 14 }}>
                  <EmptyState
                    title="No live roster configured"
                    body="This section has no students in studentsByOffering yet, so assessment entry remains unconfigured until the backend supplies a roster."
                  />
                </div>
              ) : (
                <HScrollArea>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <TH>USN</TH><TH>Name</TH>
                        {(kind === 'tt1' || kind === 'tt2') && leaves.map(leaf => <TH key={leaf.id}>{leaf.label}/{leaf.maxMarks}</TH>)}
                        {(kind === 'quiz' || kind === 'assignment') && dynamicComponents.map(component => <TH key={component.id}>{component.label} /{component.rawMax}</TH>)}
                        {kind === 'attendance' && <TH>Present</TH>}
                        {kind === 'attendance' && <TH>Total Classes</TH>}
                        {kind === 'finals' && <TH>SEE /{currentScheme.finalsMax}</TH>}
                        <TH>Current</TH><TH>Profile</TH><TH>Task</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => {
                        const projection = deriveAcademicProjection({ offering: section, student, scheme: currentScheme, history: studentHistoryByUsn?.[student.usn] ?? null, stageKey: proofStageKey })
                        const exactPatch = getStudentPatch(section.offId, student.id)
                        return (
                          <tr key={student.id} data-dense-row="true">
                            <TD style={{ ...mono, fontSize: 10, color: T.accent }}>{student.usn}</TD>
                            <TD style={{ ...sora, fontSize: 11, color: T.text }}>{student.name}</TD>
                            {(kind === 'tt1' || kind === 'tt2') && leaves.map(leaf => {
                              const exactLeafScores = kind === 'tt1' ? exactPatch.tt1LeafScores : exactPatch.tt2LeafScores
                              const seededScores = seedTermTestLeafScores(kind === 'tt1' ? student.tt1Score : student.tt2Score, kind === 'tt1' ? student.tt1Max : student.tt2Max, leaves)
                              return (
                                <TD key={leaf.id}>
                                  <input
                                    aria-label={`${kind.toUpperCase()} marks for ${student.name}, ${leaf.label}`}
                                    title={`Enter ${kind.toUpperCase()} marks for ${student.name}, ${leaf.label}`}
                                    placeholder="0"
                                    type="number"
                                    inputMode="numeric"
                                    data-student-id={student.id}
                                    data-leaf-id={leaf.id}
                                    min={0}
                                    max={leaf.maxMarks}
                                    disabled={!sectionAccess.canEdit}
                                    value={cellValues[toCellKey(section.offId, kind, student.id, leaf.id)] ?? exactLeafScores?.[leaf.id] ?? seededScores?.[leaf.id] ?? ''}
                                    onKeyDown={shouldBlockNumericKey}
                                    onChange={event => onCellValueChange(toCellKey(section.offId, kind, student.id, leaf.id), parseInputValue(event.target.value, 0, leaf.maxMarks))}
                                    style={{ width: 58, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                  />
                                </TD>
                              )
                            })}
                            {(kind === 'quiz' || kind === 'assignment') && dynamicComponents.map((component, index) => {
                              const max = component.rawMax
                              const componentKind = kind === 'quiz' ? 'quiz' : 'assignment'
                              const currentScore = getAssessmentComponentScore(student, componentKind, component, index)
                              const exactScores = kind === 'quiz' ? exactPatch.quizScores : exactPatch.assignmentScores
                              return (
                                <TD key={component.id}>
                                  <input
                                    aria-label={`${component.label} marks for ${student.name}`}
                                    title={`Enter ${component.label} marks for ${student.name}`}
                                    placeholder="0"
                                    type="number"
                                    inputMode="numeric"
                                    data-student-id={student.id}
                                    data-leaf-id={component.id}
                                    min={0}
                                    max={max}
                                    disabled={!sectionAccess.canEdit}
                                    value={cellValues[toCellKey(section.offId, kind, student.id, component.id)] ?? exactScores?.[component.id] ?? (currentScore ?? '')}
                                    onKeyDown={shouldBlockNumericKey}
                                    onChange={event => onCellValueChange(toCellKey(section.offId, kind, student.id, component.id), parseInputValue(event.target.value, 0, max))}
                                    style={{ width: 72, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                  />
                                </TD>
                              )
                            })}
                            {kind === 'attendance' && (
                              <TD>
                                <input
                                  aria-label={`Attendance present classes for ${student.name}`}
                                  title={`Enter attendance present count for ${student.name}`}
                                  placeholder="0"
                                  type="number"
                                  inputMode="numeric"
                                  data-student-id={student.id}
                                  data-leaf-id="present"
                                  min={0}
                                  max={999}
                                  disabled={!sectionAccess.canEdit}
                                  value={cellValues[toCellKey(section.offId, kind, student.id, 'present')] ?? exactPatch.present ?? student.present}
                                  onKeyDown={shouldBlockNumericKey}
                                  onChange={event => {
                                    const next = parseInputValue(event.target.value, 0, 999)
                                    onCellValueChange(toCellKey(section.offId, kind, student.id, 'present'), next)
                                    onUpdateStudentAttendance(section.offId, student.id, { present: next })
                                  }}
                                  style={{ width: 64, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                />
                              </TD>
                            )}
                            {kind === 'attendance' && (
                              <TD>
                                <input
                                  aria-label={`Total classes for ${student.name}`}
                                  title={`Enter total classes conducted for ${student.name}`}
                                  placeholder="0"
                                  type="number"
                                  inputMode="numeric"
                                  data-student-id={student.id}
                                  data-leaf-id="total"
                                  min={1}
                                  max={999}
                                  disabled={!sectionAccess.canEdit}
                                  value={cellValues[toCellKey(section.offId, kind, student.id, 'total')] ?? exactPatch.totalClasses ?? student.totalClasses}
                                  onKeyDown={shouldBlockNumericKey}
                                  onChange={event => {
                                    const nextTotal = parseInputValue(event.target.value, 1, 999)
                                    onCellValueChange(toCellKey(section.offId, kind, student.id, 'total'), nextTotal)
                                    onUpdateStudentAttendance(section.offId, student.id, { totalClasses: nextTotal })
                                  }}
                                  style={{ width: 84, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                />
                              </TD>
                            )}
                            {kind === 'finals' && (
                              <TD>
                                <input
                                  aria-label={`SEE marks for ${student.name}`}
                                  title={`Enter SEE marks for ${student.name}`}
                                  type="number"
                                  inputMode="numeric"
                                  data-student-id={student.id}
                                  data-leaf-id="finals"
                                  min={0}
                                  max={currentScheme.finalsMax}
                                  disabled={!sectionAccess.canEdit}
                                  value={cellValues[toCellKey(section.offId, kind, student.id, 'see')] ?? exactPatch.seeScore ?? ''}
                                  onKeyDown={shouldBlockNumericKey}
                                  onChange={event => onCellValueChange(toCellKey(section.offId, kind, student.id, 'see'), parseInputValue(event.target.value, 0, currentScheme.finalsMax))}
                                  placeholder="Enter"
                                  style={{ width: 72, background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text, ...mono, fontSize: 11, padding: '4px 5px' }}
                                />
                              </TD>
                            )}
                            <TD><div style={{ ...mono, fontSize: 10, color: T.muted }}>CE {projection.ce60.toFixed(1)}/{currentScheme.policyContext.ce}<br />CGPA {projection.predictedCgpa?.toFixed(2) ?? '—'}</div></TD>
                            <TD><button aria-label={`Open ${student.name} profile`} title="Open profile" onClick={() => onOpenStudent(student, section)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
                            <TD><button aria-label={`Add task for ${student.name}`} title="Add task" onClick={() => onOpenTaskComposer({ offeringId: section.offId, studentId: student.id, taskType: 'Follow-up' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.success, ...mono, fontSize: 11 }}>+Task</button></TD>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </HScrollArea>
              )}
            </Card>
          )
        })}
      </div>
    </PageShell>
  )
}
