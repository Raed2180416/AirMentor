import { BellRing, CalendarDays } from 'lucide-react'
import type { Offering } from '@web/simulation/fixtures'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAdminFacultyCalendar, ApiAdminFacultyCalendarWorkspace } from '@web/shared/api/types'
import { formatShortDate } from '@web/shared/state/calendar-utils'
import { Card, Chip } from '@web/shared/ui/primitives'

export function PlannerHeader({
  offerings,
  classEditingLocked,
  draftWorkspace,
  calendar,
  saveError,
}: {
  offerings: Offering[]
  classEditingLocked: boolean
  draftWorkspace: ApiAdminFacultyCalendarWorkspace
  calendar: ApiAdminFacultyCalendar | null
  saveError: string
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CalendarDays size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Timetable Planner</div>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            Uses the teaching-style drag board for real class blocks, while semester windows, holidays, and events live in a dedicated planner layer so they read like schedule context instead of fake classes.
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip color={T.accent}>{offerings.length} owned classes</Chip>
            <Chip color={classEditingLocked ? T.danger : T.success}>{classEditingLocked ? 'Class editing locked' : 'Class editing open'}</Chip>
            <Chip color={draftWorkspace.publishedAt ? T.blue : T.warning}>
              {draftWorkspace.publishedAt ? `Published ${formatShortDate(draftWorkspace.publishedAt.slice(0, 10))}` : 'Not published yet'}
            </Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>
            {calendar?.directEditWindowEndsAt
              ? `Direct class edits close on ${formatShortDate(calendar.directEditWindowEndsAt.slice(0, 10))}`
              : 'First save starts the 14-day direct-edit window for class timetable changes.'}
          </div>
        </div>
      </div>

      {classEditingLocked ? (
        <Card style={{ padding: 12, background: `${T.warning}14`, border: `1px solid ${T.warning}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={14} color={T.warning} />
            <div style={{ ...mono, fontSize: 10, color: T.text }}>
              Recurring class moves are now read-only here. Institutional markers remain editable, but permanent timetable changes should continue through approved HoD requests.
            </div>
          </div>
        </Card>
      ) : null}

      {saveError ? (
        <Card style={{ padding: 12, background: `${T.danger}14`, border: `1px solid ${T.danger}44` }}>
          <div style={{ ...mono, fontSize: 10, color: T.text }}>{saveError}</div>
        </Card>
      ) : null}
    </>
  )
}
