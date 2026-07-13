import type { Dispatch, SetStateAction } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { addDaysISO, buildMonthGrid, formatMonthLabel } from '@web/shared/state/calendar-utils'
import { Card, Chip } from '@web/shared/ui/primitives'
import { iconButtonStyle } from './styles'

export function CalendarMonthGrid({
  monthAnchorISO,
  setMonthAnchorISO,
  monthCells,
  monthSummaryByDate,
  selectedDateISO,
  setSelectedDateISO,
  showCalendarDayPanel,
}: {
  monthAnchorISO: string
  setMonthAnchorISO: Dispatch<SetStateAction<string>>
  monthCells: ReturnType<typeof buildMonthGrid>
  monthSummaryByDate: Record<string, { classCount: number; taskCount: number; markerCount: number }>
  selectedDateISO: string
  setSelectedDateISO: Dispatch<SetStateAction<string>>
  showCalendarDayPanel: boolean
}) {
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{formatMonthLabel(monthAnchorISO)}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{showCalendarDayPanel ? 'Select a date to open the detailed day plan.' : 'Select a date to anchor the weekly planner review.'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" aria-label="Previous month" onClick={() => setMonthAnchorISO(addDaysISO(`${monthAnchorISO.slice(0, 7)}-15`, -31).slice(0, 7) + '-01')} style={iconButtonStyle()}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonthAnchorISO(addDaysISO(`${monthAnchorISO.slice(0, 7)}-15`, 31).slice(0, 7) + '-01')} style={iconButtonStyle()}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => (
          <div key={label} style={{ ...mono, fontSize: 10, color: T.dim, padding: '0 6px 6px' }}>{label}</div>
        ))}
        {monthCells.map(cell => {
          const summary = monthSummaryByDate[cell.dateISO] ?? { classCount: 0, taskCount: 0, markerCount: 0 }
          const isSelected = cell.dateISO === selectedDateISO
          const dayNumber = Number(cell.dateISO.slice(8, 10))
          return (
            <button
              key={cell.dateISO}
              type="button"
              aria-label={`Open ${cell.dateISO}`}
              onClick={() => {
                setSelectedDateISO(cell.dateISO)
                setMonthAnchorISO(`${cell.dateISO.slice(0, 7)}-01`)
              }}
              style={{
                minHeight: 106,
                borderRadius: 14,
                border: `1px solid ${isSelected ? T.accent : T.border}`,
                background: isSelected ? `${T.accent}18` : cell.inCurrentMonth ? T.surface : T.surface2,
                color: cell.inCurrentMonth ? T.text : T.muted,
                padding: '10px 10px 12px',
                cursor: 'pointer',
                display: 'grid',
                alignContent: 'space-between',
                textAlign: 'left',
                transition: 'background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14 }}>{dayNumber}</div>
                {isSelected && <Chip color={T.accent} size={8}>Selected</Chip>}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ ...mono, fontSize: 10, color: summary.classCount > 0 ? T.accent : T.dim }}>{summary.classCount} class{summary.classCount === 1 ? '' : 'es'}</div>
                <div style={{ ...mono, fontSize: 10, color: summary.taskCount > 0 ? T.warning : T.dim }}>{summary.taskCount} task{summary.taskCount === 1 ? '' : 's'}</div>
                <div style={{ ...mono, fontSize: 10, color: summary.markerCount > 0 ? T.success : T.dim }}>{summary.markerCount} marker{summary.markerCount === 1 ? '' : 's'}</div>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
