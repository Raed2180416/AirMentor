import { BellRing, CalendarDays, Clock3, Plus, Sparkles } from 'lucide-react'
import type { Offering } from '@web/simulation/fixtures'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import { formatShortDate } from '@web/shared/state/calendar-utils'
import { Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'

export function CalendarWorkspaceHeader({
  offerings,
  classEditingLocked,
  publishedAt,
  directEditWindowEndsAt,
  saveError,
  onOpenNewMarker,
}: {
  offerings: Offering[]
  classEditingLocked: boolean
  publishedAt: string | null
  directEditWindowEndsAt: string | null | undefined
  saveError: string
  onOpenNewMarker: (markerType: ApiAdminCalendarMarkerType) => void
}) {
  return (
    <Card style={{ padding: 18, display: 'grid', gap: 14, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Teaching Portfolio Timetable</div>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            This is the same calendar and timetable workspace pattern used in the teaching portfolio, with admin-only semester marker editing layered around it.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip color={T.accent}>{offerings.length} mapped classes</Chip>
          <Chip color={classEditingLocked ? T.danger : T.success}>{classEditingLocked ? 'Class editing locked' : 'Class editing open'}</Chip>
          <Chip color={publishedAt ? T.blue : T.warning}>
            {publishedAt ? `Published ${formatShortDate(publishedAt.slice(0, 10))}` : 'Not published yet'}
          </Chip>
        </div>
      </div>

      {classEditingLocked ? (
        <InfoBanner tone="error" message={directEditWindowEndsAt ? `Recurring class edits are locked here until the next direct-edit window. Current lock date: ${formatShortDate(directEditWindowEndsAt.slice(0, 10))}.` : 'Recurring class edits are currently locked here. Markers remain editable.'} />
      ) : null}
      {saveError ? <InfoBanner tone="error" message={saveError} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <button type="button" data-pressable="true" onClick={() => onOpenNewMarker('semester-start')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.success }}><Sparkles size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>Semester Start</span></div>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Add the semester opening marker directly into the same planner context.</div>
        </button>
        <button type="button" data-pressable="true" onClick={() => onOpenNewMarker('term-test-start')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.blue }}><Clock3 size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>Term Test Window</span></div>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Map CE / SEE windows and other assessment periods into the faculty planner.</div>
        </button>
        <button type="button" data-pressable="true" onClick={() => onOpenNewMarker('holiday')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.danger }}><BellRing size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>Holiday / Closure</span></div>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Keep non-teaching interruptions visible in the exact weekly and calendar views faculty use.</div>
        </button>
        <button type="button" data-pressable="true" onClick={() => onOpenNewMarker('event')} style={{ textAlign: 'left', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.accent }}><Plus size={13} /><span style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>University Event</span></div>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Add one-off events without leaving the shared timetable workspace.</div>
        </button>
      </div>
    </Card>
  )
}
