import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CO_MAP, T, mono, sora, yearColor, type CODef, type CoAttainmentRow, type Offering, type Student, type StudentHistoryRecord } from '@web/simulation/fixtures'
import type {
  EntryKind,
  EntryLockMap,
  SchemeState,
  TTKind,
  TermTestBlueprint,
} from '@kernel/shared/domain'
import {
  computeCoAttainmentRows,
  useAppSelectors,
} from '@web/shared/state/selectors'
import { TAB_DEFS } from '@web/shared/state/page-utils'
import { Btn, Chip, HScrollArea, PageBackButton, PageShell, getSegmentedButtonStyle, getSegmentedGroupStyle } from '@web/shared/ui/primitives'
import { getDisplayStageInfo, getStageRailProgress, isProofEvidenceVisible, isRiskEvidenceVisible } from './course/stage-helpers'
import { OverviewTab } from './course/overview-tab'
import { RiskTab } from './course/risk-tab'
import { AttendanceTab } from './course/attendance-tab'
import { TTTab } from './course/tt-tab'
import { QuizzesTab } from './course/quizzes-tab'
import { AssignmentsTab } from './course/assignments-tab'
import { COTab } from './course/co-tab'
import { GradeBookTab } from './course/gradebook-tab'

export function CourseDetail({
  offering: offering,
  onBack,
  onOpenStudent,
  onOpenEntryHub,
  onOpenSchemeSetup,
  initialTab,
  scheme,
  lockMap,
  blueprints,
  onUpdateBlueprint,
  courseOutcomes,
  coAttainmentRows,
  studentHistoryByUsn,
  proofStageKey,
}: {
  offering: Offering
  onBack: () => void
  onOpenStudent: (student: Student) => void
  onOpenEntryHub: (kind: EntryKind) => void
  onOpenSchemeSetup: () => void
  initialTab?: string
  scheme: SchemeState
  lockMap: EntryLockMap
  blueprints: Record<TTKind, TermTestBlueprint>
  onUpdateBlueprint: (kind: TTKind, next: TermTestBlueprint) => void
  courseOutcomes?: CODef[]
  coAttainmentRows?: CoAttainmentRow[]
  studentHistoryByUsn?: Record<string, StudentHistoryRecord>
  proofStageKey?: string | null
}) {
  const { getStudentsPatched } = useAppSelectors()
  const [tab, setTab] = useState(initialTab ?? 'overview')
  const shouldReduceMotion = useReducedMotion()
  const yearTint = yearColor(offering.year)
  const students = useMemo(() => getStudentsPatched(offering), [getStudentsPatched, offering])
  const cos = courseOutcomes && courseOutcomes.length > 0 ? courseOutcomes : (CO_MAP[offering.code] || CO_MAP.default)
  const fallbackCoAttainmentRows = useMemo(() => computeCoAttainmentRows(students, cos, blueprints), [blueprints, cos, students])
  const displayCoAttainmentRows = coAttainmentRows?.some(row => row.studentsCounted > 0)
    ? coAttainmentRows
    : fallbackCoAttainmentRows
  const stageRailProgress = getStageRailProgress(offering, proofStageKey)
  const displayStageInfo = getDisplayStageInfo(offering, proofStageKey)
  const stageRail = [
    'Pre TT1',
    'Post TT1',
    'Post TT2',
    'Post Assignments',
    'Post SEE',
    'Post Project',
  ]
  const tabLocked = (tabId: string) => {
    if (proofStageKey && (tabId === 'quizzes' || tabId === 'assignments')) return !isProofEvidenceVisible(proofStageKey, 'coursework')
    if (proofStageKey && tabId === 'co') return !isProofEvidenceVisible(proofStageKey, 'tt1')
    if (tabId === 'tt2') return proofStageKey ? !isProofEvidenceVisible(proofStageKey, 'tt2') : offering.stageInfo.stage < 2
    return tabId === 'risk' && !isRiskEvidenceVisible(offering, proofStageKey)
  }
  const activeTabContent = tab === 'overview'
    ? <OverviewTab offering={offering} cos={cos} students={students} scheme={scheme} proofStageKey={proofStageKey} setTab={setTab} />
    : tab === 'risk'
      ? <RiskTab offering={offering} students={students} proofStageKey={proofStageKey} onOpenStudent={onOpenStudent} />
      : tab === 'attendance'
        ? <AttendanceTab offering={offering} students={students} proofStageKey={proofStageKey} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('attendance')} />
        : tab === 'tt1'
          ? <TTTab offering={offering} ttNum={1} cos={cos} blueprint={blueprints.tt1} isLocked={lockMap.tt1} students={students} proofStageKey={proofStageKey} onChangeBlueprint={next => onUpdateBlueprint('tt1', next)} onOpenEntryHub={onOpenEntryHub} onOpenStudent={onOpenStudent} />
          : tab === 'tt2'
            ? <TTTab offering={offering} ttNum={2} cos={cos} blueprint={blueprints.tt2} isLocked={lockMap.tt2} students={students} proofStageKey={proofStageKey} onChangeBlueprint={next => onUpdateBlueprint('tt2', next)} onOpenEntryHub={onOpenEntryHub} onOpenStudent={onOpenStudent} />
            : tab === 'quizzes'
              ? <QuizzesTab students={students} scheme={scheme} proofStageKey={proofStageKey} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('quiz')} />
              : tab === 'assignments'
                ? <AssignmentsTab students={students} scheme={scheme} proofStageKey={proofStageKey} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('assignment')} />
                : tab === 'co'
                  ? <COTab cos={cos} rows={displayCoAttainmentRows} proofStageKey={proofStageKey} />
                  : <GradeBookTab offering={offering} students={students} scheme={scheme} studentHistoryByUsn={studentHistoryByUsn} proofStageKey={proofStageKey} onOpenStudent={onOpenStudent} onOpenEntryHub={() => onOpenEntryHub('finals')} onOpenSchemeSetup={onOpenSchemeSetup} />

  return (
    <PageShell size="wide" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: 0 }}>
      <div style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`, borderBottom: `1px solid ${T.border}`, padding: '18px 32px 0' }}>
        <PageBackButton onClick={onBack} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Chip color={yearTint}>{offering.year}</Chip><Chip color={T.muted}>{offering.dept}</Chip>
              <Chip color={T.muted}>Sem {offering.sem}</Chip><Chip color={T.muted}>Sec {offering.section}</Chip>
              <Chip color={displayStageInfo.color}>{displayStageInfo.label} · {displayStageInfo.desc}</Chip>
            </div>
            <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text, lineHeight: 1.2 }}>
              <span style={{ color: yearTint }}>{offering.code}</span> — {offering.title}
            </div>
          </div>
          <Btn variant="ghost" size="sm">📥 Export</Btn>
        </div>
        <div style={{ marginTop: 18, background: `linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)`, border: `1px solid ${T.border}`, borderRadius: 18, padding: '16px 18px', boxShadow: '0 16px 34px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Academic progress</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 14, color: T.text }}>Current stage: <span style={{ color: displayStageInfo.color }}>{displayStageInfo.label}</span></div>
              <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{displayStageInfo.desc}</div>
            </div>
            <Chip color={displayStageInfo.color}>Stage {displayStageInfo.stage}</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 14, maxWidth: 640 }}>
            {stageRail.map((label, index) => {
              const stageReached = index + 1 <= stageRailProgress
              return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', flex: index < stageRail.length - 1 ? 1 : 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 10, fontWeight: 700, background: stageReached ? offering.stageInfo.color : T.border2, border: `2px solid ${stageReached ? offering.stageInfo.color : T.dim}`, color: stageReached ? '#fff' : T.dim }}>
                  {stageReached ? '✓' : index + 1}
                </div>
                <span style={{ ...mono, fontSize: 9, color: T.dim, marginLeft: 6, whiteSpace: 'nowrap' }}>{label}</span>
                {index < stageRail.length - 1 && <div style={{ flex: 1, height: 2, background: index < stageRailProgress - 1 ? offering.stageInfo.color : T.border, margin: '0 8px' }} />}
              </div>
            )})}
          </div>
        </div>
        <div style={{ marginTop: 16, marginLeft: -32, marginRight: -32, borderTop: `1px solid ${T.border}` }}>
          <HScrollArea style={{ paddingLeft: 32, paddingRight: 32 }}>
            <div style={{ ...getSegmentedGroupStyle(), width: 'fit-content', margin: '12px 0' }}>
            {TAB_DEFS.map(def => {
              const locked = tabLocked(def.id)
              return (
                <button
                  key={def.id}
                  onClick={() => !locked && setTab(def.id)}
                  data-tab="true"
                  style={{ ...getSegmentedButtonStyle({ active: tab === def.id, disabled: locked }), whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {def.icon} {def.label}{locked ? ' 🔒' : ''}
                </button>
              )
            })}
            </div>
          </HScrollArea>
        </div>
      </div>

      <div style={{ flex: 1, background: T.bg }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: 'easeOut' }}
          >
            {activeTabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
