import { useState } from 'react'
import { T, mono, sora, type Offering } from '@web/simulation/fixtures'
import type { EntryKind, EntryLockMap, Role } from '@kernel/shared/domain'
import { getEntryLockMap, useAppSelectors } from '@web/shared/state/selectors'
import { ENTRY_CATALOG, getEntryAccessState } from '@web/shared/state/page-utils'
import { Btn, Card, Chip, PageBackButton, PageShell } from '@web/shared/ui/primitives'

export function UploadPage({
  role,
  offering,
  defaultKind,
  onBack,
  onOpenWorkspace,
  lockByOffering,
  onRequestUnlock,
  availableOfferings,
  onOpenSchemeSetup,
}: {
  role: Role
  offering: Offering | null
  defaultKind: EntryKind
  onBack: () => void
  onOpenWorkspace: (offeringId: string, kind: EntryKind) => void
  lockByOffering: Record<string, EntryLockMap>
  onRequestUnlock: (offeringId: string, kind: EntryKind) => void
  availableOfferings?: Offering[]
  onOpenSchemeSetup: (offering?: Offering) => void
  }) {
  const { getSchemeForOffering, getStudentsPatched } = useAppSelectors()
  const visibleOfferings = availableOfferings ?? (offering ? [offering] : [])
  const [selectedKind, setSelectedKind] = useState<EntryKind>(defaultKind)
  const [selectedOffIdState, setSelectedOffIdState] = useState<string>(offering?.offId ?? visibleOfferings[0]?.offId ?? '')
  const [unlockRequested, setUnlockRequested] = useState<EntryKind | null>(null)

  const selectedOffId = visibleOfferings.length === 0
    ? ''
    : (visibleOfferings.some(item => item.offId === selectedOffIdState)
        ? selectedOffIdState
        : (offering?.offId ?? visibleOfferings[0]?.offId ?? ''))

  const selected = ENTRY_CATALOG.find(item => item.kind === selectedKind) ?? ENTRY_CATALOG[0]
  const selectedOffering = visibleOfferings.find(item => item.offId === selectedOffId) ?? offering ?? visibleOfferings[0] ?? null
  if (!selectedOffering) {
    return (
      <PageShell size="narrow">
        <PageBackButton onClick={onBack} />
        <Card surface="panel" style={{ padding: '16px 18px' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: T.text, marginBottom: 6 }}>Data Entry Hub</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>No live class is mapped to this faculty scope yet. Provision the class through sysadmin or assign offering ownership before marks entry.</div>
        </Card>
      </PageShell>
    )
  }
  const scheme = getSchemeForOffering(selectedOffering)
  const selectedStudents = getStudentsPatched(selectedOffering)
  const selectedCourseCode = selectedOffering.code
  const classOfferings = visibleOfferings.filter(item => item.code === selectedCourseCode)
  const lockMap = lockByOffering[selectedOffering.offId] ?? getEntryLockMap(selectedOffering)
  const hasInFlightEvaluation = !!selectedOffering.tt1Done || !!selectedOffering.tt2Done || !!lockMap.tt1 || !!lockMap.tt2 || !!lockMap.quiz || !!lockMap.assignment || !!lockMap.finals
  const schemeReady = scheme.status !== 'Needs Setup' || hasInFlightEvaluation
  const shouldShowSchemePrompt = !schemeReady && !hasInFlightEvaluation

  const completion = {
    tt1: !!selectedOffering.tt1Locked || selectedStudents.some(student => student.tt1Score !== null),
    tt2: !!selectedOffering.tt2Locked || selectedStudents.some(student => student.tt2Score !== null),
    quiz: !!selectedOffering.quizLocked || selectedStudents.some(student => student.quiz1 !== null || student.quiz2 !== null),
    assignment: !!selectedOffering.asgnLocked || selectedStudents.some(student => student.asgn1 !== null || student.asgn2 !== null),
    attendance: !!lockMap.attendance || selectedStudents.some(student => student.totalClasses > 0),
    finals: !!selectedOffering.finalsLocked,
  }

  return (
    <PageShell size="narrow">
      <PageBackButton onClick={onBack} />
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>Data Entry Hub</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 6 }}>Single consistent entry route from dashboard. CSV import is disabled in v1.</div>
      <div style={{ ...mono, fontSize: 11, color: T.accent, marginBottom: 12 }}>{selectedOffering.code} · {selectedOffering.title} · {selectedOffering.year} · Stage {selectedOffering.stageInfo.stage}</div>
      {role !== 'Mentor' && lockMap[selectedKind] && (
        <Card style={{ marginBottom: 12, padding: '12px 14px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>This entry is locked. You cannot modify {selected.title}.</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" onClick={() => { setUnlockRequested(selectedKind); onRequestUnlock(selectedOffering.offId, selectedKind) }}>Request unlock from HoD</Btn>
            {unlockRequested === selectedKind && <Chip color={T.success} size={9}>Governance action recorded</Chip>}
          </div>
        </Card>
      )}
      {shouldShowSchemePrompt && (
        <Card style={{ marginBottom: 12, padding: '12px 14px' }} glow={T.warning}>
          <div style={{ ...mono, fontSize: 11, color: T.warning }}>Set up the evaluation scheme before first marks entry for this class.</div>
          <div style={{ marginTop: 8 }}><Btn size="sm" variant="ghost" onClick={() => onOpenSchemeSetup(selectedOffering)}>Open Scheme Setup</Btn></div>
        </Card>
      )}
      {selectedStudents.length === 0 && (
        <Card style={{ marginBottom: 12, padding: '12px 14px' }} glow={T.dim}>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>No live roster is configured for this offering yet. Entry stays unconfigured until studentsByOffering is supplied by the backend.</div>
        </Card>
      )}
      <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label htmlFor="entry-course-select" style={{ ...mono, fontSize: 10, color: T.muted, marginRight: 8 }}>Course:</label>
          <select id="entry-course-select" aria-label="Select course" title="Select course" value={selectedCourseCode} onChange={event => {
            const code = event.target.value
            const firstClass = visibleOfferings.find(item => item.code === code)
            if (firstClass) setSelectedOffIdState(firstClass.offId)
          }} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px' }}>
            {Array.from(new Set(visibleOfferings.map(item => item.code))).map(code => {
              const first = visibleOfferings.find(item => item.code === code)
              return <option key={code} value={code}>{code} · {first?.title ?? 'Course'}</option>
            })}
          </select>
        </div>
        <div>
          <label htmlFor="entry-class-select" style={{ ...mono, fontSize: 10, color: T.muted, marginRight: 8 }}>Class:</label>
          <select id="entry-class-select" aria-label="Select class" title="Select class" value={selectedOffId} onChange={event => setSelectedOffIdState(event.target.value)} style={{ width: '100%', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '7px 10px' }}>
            {classOfferings.map(item => <option key={item.offId} value={item.offId}>{item.year} · Sec {item.section} · {getStudentsPatched(item).length} students</option>)}
          </select>
        </div>
        <Btn size="sm" onClick={() => setSelectedOffIdState(selectedOffId)}>Select Class</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {ENTRY_CATALOG.map(item => {
          const access = getEntryAccessState({
            stage: selectedOffering.stageInfo.stage,
            kind: item.kind,
            isLocked: lockMap[item.kind],
            canEditMarks: role === 'Course Leader',
          })
          return (
            <Card
              key={item.kind}
              glow={selectedKind === item.kind ? T.accent : undefined}
              style={{ padding: '18px 20px', cursor: schemeReady && (!access.isApplicableForStage || access.isLocked) ? 'not-allowed' : 'pointer', opacity: access.isLocked ? 0.8 : 1 }}
              onClick={() => {
                setSelectedKind(item.kind)
                if (!schemeReady && access.canOpenSetup) {
                  onOpenSchemeSetup(selectedOffering)
                  return
                }
                if (!access.isApplicableForStage) return
                if (!schemeReady && !access.isLocked) {
                  onOpenSchemeSetup(selectedOffering)
                  return
                }
                if (!access.canOpenWorkspace) return
                onOpenWorkspace(selectedOffering.offId, item.kind)
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4 }}>{item.title}</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>{item.desc}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={selectedStudents.length === 0 ? T.dim : completion[item.kind] ? T.success : T.warning} size={10}>{selectedStudents.length === 0 ? 'No roster configured' : completion[item.kind] ? 'Completed' : 'Pending Entry'}</Chip>
                {access.isLocked && <Chip color={T.danger} size={10}>Locked</Chip>}
                {!access.isApplicableForStage && <Chip color={T.warning} size={10}>Stage N/A</Chip>}
              </div>
            </Card>
          )
        })}
      </div>
      {role === 'Mentor' && <div style={{ ...mono, fontSize: 11, color: T.warning, marginTop: 12 }}>Read-only role. Only Course Leaders can edit marks.</div>}
      {!getEntryAccessState({ stage: selectedOffering.stageInfo.stage, kind: selectedKind, isLocked: lockMap[selectedKind], canEditMarks: role === 'Course Leader' }).isApplicableForStage && (
        <div style={{ ...mono, fontSize: 11, color: T.warning, marginTop: 8 }}>Current selected type is not applicable at stage {selectedOffering.stageInfo.stage}.</div>
      )}
    </PageShell>
  )
}
