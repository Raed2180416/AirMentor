import { Bell, CheckCircle2, Clock3, GraduationCap, LayoutDashboard, Layers3, RefreshCw, UserCog } from 'lucide-react'
import { T, mono, sora } from '../../data'
import { Card } from '../../ui-primitives'
import { HeroBadge } from '../../system-admin-ui'
import { ADMIN_SECTION_TONES } from '../live-app-model'
import { OverviewSupportCard, SectionLaunchCard } from '../live-app-chrome'

type OverviewSectionProps = {
  viewportWidth: number
  actionQueueCount: number
  openRequests: Array<{ summary: string }>
  hiddenItemCount: number
  remindersSupported: boolean
  pendingReminders: Array<unknown>
  activeRunDetail: {
    monitoringSummary: {
      activeReassessmentCount: number
      acknowledgementCount: number
      resolutionCount: number
    }
  } | null
  proofLauncherStageLabel: string
  visibleAcademicFaculties: Array<unknown>
  visibleDepartments: Array<unknown>
  visibleBranches: Array<unknown>
  overviewHierarchyScope: unknown
  overviewVisibleStudentCount: number
  overviewVisibleMentoredCount: number
  overviewGlobalStudentCount: number
  overviewGlobalMentoredCount: number
  overviewScopeLabel: string | null
  overviewFacultyCaption: string
  overviewVisibleMentorGapCount: number
  overviewCounts: { ownershipCount: number }
  navigate: (route: { section: string }) => void
}

export function OverviewSection({
  viewportWidth,
  actionQueueCount,
  openRequests,
  hiddenItemCount,
  remindersSupported,
  pendingReminders,
  activeRunDetail,
  proofLauncherStageLabel,
  visibleAcademicFaculties,
  visibleDepartments,
  visibleBranches,
  overviewHierarchyScope,
  overviewVisibleStudentCount,
  overviewVisibleMentoredCount,
  overviewGlobalStudentCount,
  overviewGlobalMentoredCount,
  overviewScopeLabel,
  overviewFacultyCaption,
  overviewVisibleMentorGapCount,
  overviewCounts,
  navigate,
}: OverviewSectionProps) {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: viewportWidth > 1180 ? 'minmax(0, 1.6fr) minmax(280px, 0.95fr)' : 'minmax(0, 1fr)' }}>
        <Card style={{ padding: 24, display: 'grid', gap: 16, textAlign: 'left', background: `radial-gradient(circle at top left, ${T.accent}14, transparent 34%), linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ ...mono, fontSize: 10, color: ADMIN_SECTION_TONES.overview, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Sysadmin Control Plane</div>
            <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text }}>System Admin Control Plane</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.9, maxWidth: 760 }}>
              Use this workspace for full university setup, registry cleanup, faculty ownership, proof verification, and governed requests. The canonical MNC proof batch stays available as a dedicated preview path, but the rest of admin is no longer forced into that batch.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start', maxWidth: 620 }}>
            <HeroBadge color={T.accent} compact><Bell size={11} /> Action Queue {actionQueueCount}</HeroBadge>
            <HeroBadge color={T.warning} compact><Clock3 size={11} /> Open Requests {openRequests.length}</HeroBadge>
            <HeroBadge color={T.danger} compact><RefreshCw size={11} /> Hidden Records {hiddenItemCount}</HeroBadge>
            <HeroBadge color={remindersSupported ? T.success : T.orange} compact><CheckCircle2 size={11} /> {remindersSupported ? `Private Reminders ${pendingReminders.length}` : 'Reminder API offline on this backend'}</HeroBadge>
          </div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <SectionLaunchCard
              title="Proof"
              caption={activeRunDetail
                ? `${activeRunDetail.monitoringSummary.activeReassessmentCount} queue · ${activeRunDetail.monitoringSummary.acknowledgementCount} acknowledgements`
                : 'No active proof run'}
              helper={activeRunDetail
                ? `${proofLauncherStageLabel} · ${activeRunDetail.monitoringSummary.resolutionCount} resolutions · dedicated dashboard route.`
                : 'Open the dedicated proof dashboard to validate imports, stage runs, and monitor proof acknowledgements before advancing the branch.'}
              icon={<Layers3 size={18} />}
              tone={ADMIN_SECTION_TONES.overview}
              active={false}
              onClick={() => navigate({ section: 'proof-dashboard' })}
            />
            <SectionLaunchCard
              title="University"
              caption={`${visibleAcademicFaculties.length} faculties · ${visibleDepartments.length} departments · ${visibleBranches.length} branches`}
              helper="Selector-driven hierarchy control for the proof branch faculty, department, branch, year, section, policy bands, and course tables."
              icon={<LayoutDashboard size={18} />}
              tone={ADMIN_SECTION_TONES.faculties}
              active={false}
              onClick={() => navigate({ section: 'faculties' })}
            />
            <SectionLaunchCard
              title="Students"
              caption={overviewHierarchyScope
                ? `${overviewVisibleStudentCount} records · ${overviewVisibleMentoredCount} mentored`
                : `${overviewGlobalStudentCount} records · ${overviewGlobalMentoredCount} mentored`}
              helper={overviewHierarchyScope
                ? `Canonical student identity, mentor linkage, and semester progression filtered to ${overviewScopeLabel ?? 'the active academic scope'}.`
                : 'Open the proof-branch student registry directly, or set a faculty, department, branch, year, or section in the university workspace to preserve scope.'}
              icon={<GraduationCap size={18} />}
              tone={ADMIN_SECTION_TONES.students}
              active={false}
              onClick={() => navigate({ section: 'students' })}
            />
            <SectionLaunchCard
              title="Faculty"
              caption={overviewFacultyCaption}
              helper={overviewHierarchyScope
                ? `Appointments, permissions, class ownership, and timetable review filtered to ${overviewScopeLabel ?? 'the active academic scope'}.`
                : 'Global appointments, permissions, class ownership, and timetable review. Select an academic scope to narrow these totals.'}
              icon={<UserCog size={18} />}
              tone={ADMIN_SECTION_TONES['faculty-members']}
              active={false}
              onClick={() => navigate({ section: 'faculty-members' })}
            />
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <OverviewSupportCard title="Requests" value={String(openRequests.length)} helper="Governed items waiting in the action rail." tone={T.warning} onClick={() => navigate({ section: 'requests' })} />
          <OverviewSupportCard title="Hidden Records" value={String(hiddenItemCount)} helper="Archived or deleted records with restore visibility." tone={T.danger} onClick={() => navigate({ section: 'history' })} />
          <OverviewSupportCard
            title="Mentor Gaps"
            value={String(overviewVisibleMentorGapCount)}
            helper={overviewHierarchyScope
              ? `Students still missing an active mentor linkage inside ${overviewScopeLabel ?? 'the active academic scope'}.`
              : 'No hierarchy scope selected yet. Mentor-gap totals stay empty until you select a faculty, department, branch, year, or section.'}
            tone={ADMIN_SECTION_TONES.students}
            onClick={() => navigate({ section: 'students' })}
          />
          <OverviewSupportCard
            title="Teaching Load"
            value={String(overviewCounts.ownershipCount)}
            helper={overviewHierarchyScope
              ? `Active teaching ownership records mapped to faculty inside ${overviewScopeLabel ?? 'the active academic scope'}.`
              : 'No hierarchy scope selected yet. Teaching-load totals stay empty until you choose the academic slice you want to inspect.'}
            tone={ADMIN_SECTION_TONES['faculty-members']}
            onClick={() => navigate({ section: 'faculty-members' })}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Immediate Watchlist</div>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>What needs eyes first</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {openRequests.length > 0
              ? `${openRequests[0].summary} is currently the highest-visibility governed request.`
              : 'No governed requests are waiting right now.'}
          </div>
        </Card>
        <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scoped Navigation</div>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Rail state carries forward</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Deep faculty, student, and faculty-member searches now respect the active hierarchy scope so you can move across panels without rebuilding context.
          </div>
        </Card>
      </div>
    </div>
  )
}
