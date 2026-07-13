import type { Dispatch, SetStateAction } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Sparkles } from 'lucide-react'
import { T, mono } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock, FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminCalendarMarkerType } from '@web/shared/api/types'
import { addDaysISO, formatWeekRange, minutesToTimeString, normalizeTimedRange, timeStringToMinutes } from '@web/shared/state/calendar-utils'
import { Btn, Chip } from '@web/shared/ui/primitives'
import { iconButtonStyle, timeInputStyle } from './styles'

export function PlannerToolbar({
  selectedDateISO,
  setSelectedDateISO,
  selectedWeekStart,
  classEditingLocked,
  openExtraClassEditor,
  openMarkerEditor,
  dayStartMinutes,
  dayEndMinutes,
  setDraftTemplate,
}: {
  selectedDateISO: string
  setSelectedDateISO: Dispatch<SetStateAction<string>>
  selectedWeekStart: string
  classEditingLocked: boolean
  openExtraClassEditor: (dateISO: string, timed?: { startMinutes: number; endMinutes: number }, existing?: FacultyTimetableClassBlock) => void
  openMarkerEditor: (markerType: ApiAdminCalendarMarkerType, dateISO: string, timed?: { startMinutes: number; endMinutes: number }) => void
  dayStartMinutes: number
  dayEndMinutes: number
  setDraftTemplate: Dispatch<SetStateAction<FacultyTimetableTemplate>>
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" aria-label="Previous week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, -7))} style={iconButtonStyle()}>
            <ChevronLeft size={14} />
          </button>
          <Chip color={T.blue}>{formatWeekRange(selectedWeekStart)}</Chip>
          <button type="button" aria-label="Next week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, 7))} style={iconButtonStyle()}>
            <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!classEditingLocked ? (
            <Btn type="button" size="sm" variant="ghost" onClick={() => openExtraClassEditor(selectedDateISO)}>
              <Plus size={12} /> Extra Class
            </Btn>
          ) : null}
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('semester-start', selectedDateISO)}>
            <Sparkles size={12} /> Semester Start
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('semester-end', selectedDateISO)}>
            <Sparkles size={12} /> Semester End
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('term-test-start', selectedDateISO)}>
            <Clock3 size={12} /> TT Start
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('term-test-end', selectedDateISO)}>
            <Clock3 size={12} /> TT End
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('holiday', selectedDateISO)}>
            <CalendarDays size={12} /> Holiday
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={() => openMarkerEditor('event', selectedDateISO)}>
            <Plus size={12} /> Event
          </Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 10, color: T.muted }}>Day bounds</span>
        <input
          type="time"
          value={minutesToTimeString(dayStartMinutes)}
          disabled={classEditingLocked}
          onChange={event => {
            if (classEditingLocked) return
            const nextStart = timeStringToMinutes(event.target.value)
            setDraftTemplate(current => ({
              ...current,
              dayStartMinutes: normalizeTimedRange(nextStart, current.dayEndMinutes, 0, 24 * 60, 120).startMinutes,
            }))
          }}
          style={timeInputStyle(classEditingLocked)}
        />
        <input
          type="time"
          value={minutesToTimeString(dayEndMinutes)}
          disabled={classEditingLocked}
          onChange={event => {
            if (classEditingLocked) return
            const nextEnd = timeStringToMinutes(event.target.value)
            setDraftTemplate(current => ({
              ...current,
              dayEndMinutes: normalizeTimedRange(current.dayStartMinutes, nextEnd, 0, 24 * 60, 120).endMinutes,
            }))
          }}
          style={timeInputStyle(classEditingLocked)}
        />
      </div>
    </>
  )
}
