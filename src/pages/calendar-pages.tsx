import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Grip, Plus, Rows4 } from 'lucide-react'
import { T, mono, sora, type Offering } from '../data'
import type {
  FacultyAccount,
  FacultyTimetableTemplate,
  Role,
  SharedTask,
  TaskCalendarPlacement,
  TaskPlacementMode,
  TimetableSlotDefinition,
  Weekday,
} from '../domain'
import {
  addDaysISO,
  buildMonthGrid,
  formatMonthLabel,
  formatShortDate,
  formatWeekRange,
  getSpannedSlotIds,
  getSlotMap,
  getWeekDates,
  getWeekdayForDateISO,
  startOfWeekISO,
  WEEKDAY_ORDER,
} from '../calendar-utils'
import { Btn, Card, Chip, PageShell } from '../ui-primitives'

type AddTargetState = {
  dateISO: string
  slotId?: string
  initialMode: TaskPlacementMode
}

type ScheduleInput = {
  dateISO: string
  placementMode: TaskPlacementMode
  slotId?: string
}

export function CalendarTimetablePage({
  currentTeacher,
  activeRole,
  allowedRoles,
  facultyOfferings,
  mergedTasks,
  resolvedTaskIds,
  timetable,
  taskPlacements,
  onScheduleTask,
  onMoveClassBlock,
  onResizeClassBlock,
  onOpenTaskComposer,
}: {
  currentTeacher: FacultyAccount
  activeRole: Role
  allowedRoles: Role[]
  facultyOfferings: Offering[]
  mergedTasks: SharedTask[]
  resolvedTaskIds: Record<string, number>
  timetable: FacultyTimetableTemplate
  taskPlacements: Record<string, TaskCalendarPlacement>
  onScheduleTask: (taskId: string, input: ScheduleInput) => void
  onMoveClassBlock: (blockId: string, input: { day: Weekday; slotId: string }) => void
  onResizeClassBlock: (blockId: string, nextSpan: number) => void
  onOpenTaskComposer: (input: {
    dueDateISO: string
    availableOfferingIds: string[]
    placement: ScheduleInput
  }) => void
}) {
  const [mode, setMode] = useState<'calendar' | 'timetable'>('calendar')
  const [selectedDateISO, setSelectedDateISO] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = `${today.getMonth() + 1}`.padStart(2, '0')
    const day = `${today.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [monthAnchorISO, setMonthAnchorISO] = useState(() => `${selectedDateISO.slice(0, 7)}-01`)
  const [addTarget, setAddTarget] = useState<AddTargetState | null>(null)

  const isEditable = allowedRoles.includes('Course Leader')
  const slotMap = useMemo(() => getSlotMap(timetable.slots), [timetable.slots])
  const offeringIds = useMemo(() => new Set(facultyOfferings.map(offering => offering.offId)), [facultyOfferings])
  const queueCandidates = useMemo(() => {
    return mergedTasks
      .filter(task => !resolvedTaskIds[task.id])
      .filter(task => task.status !== 'Resolved')
      .filter(task => !task.unlockRequest)
      .filter(task => offeringIds.has(task.offeringId))
      .sort((left, right) => {
        if ((right.updatedAt ?? right.createdAt) !== (left.updatedAt ?? left.createdAt)) {
          return (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt)
        }
        return right.priority - left.priority
      })
  }, [mergedTasks, offeringIds, resolvedTaskIds])
  const weekDates = useMemo(() => getWeekDates(selectedDateISO), [selectedDateISO])
  const selectedWeekStart = useMemo(() => startOfWeekISO(selectedDateISO), [selectedDateISO])
  const selectedWeekDatesSet = useMemo(() => new Set(weekDates), [weekDates])
  const monthCells = useMemo(() => buildMonthGrid(monthAnchorISO), [monthAnchorISO])
  const selectedWeekday = useMemo(() => getWeekdayForDateISO(selectedDateISO), [selectedDateISO])

  const dayClassBlocks = useMemo(() => {
    if (!selectedWeekday) return []
    return timetable.classBlocks.filter(block => block.day === selectedWeekday)
  }, [selectedWeekday, timetable.classBlocks])

  const timedPlacementsForWeek = useMemo(() => {
    return Object.values(taskPlacements)
      .filter(placement => placement.placementMode === 'timed')
      .filter(placement => selectedWeekDatesSet.has(placement.dateISO))
      .filter(placement => !resolvedTaskIds[placement.taskId])
  }, [resolvedTaskIds, selectedWeekDatesSet, taskPlacements])

  const tasksById = useMemo(() => Object.fromEntries(mergedTasks.map(task => [task.id, task])) as Record<string, SharedTask>, [mergedTasks])

  const dayTimedTaskPlacements = useMemo(() => {
    return Object.values(taskPlacements)
      .filter(placement => placement.dateISO === selectedDateISO)
      .filter(placement => placement.placementMode === 'timed')
      .filter(placement => !resolvedTaskIds[placement.taskId])
  }, [resolvedTaskIds, selectedDateISO, taskPlacements])

  const dayUntimedTasks = useMemo(() => {
    return Object.values(taskPlacements)
      .filter(placement => placement.dateISO === selectedDateISO)
      .filter(placement => placement.placementMode === 'untimed')
      .filter(placement => !resolvedTaskIds[placement.taskId])
      .map(placement => tasksById[placement.taskId])
      .filter((task): task is SharedTask => !!task)
  }, [resolvedTaskIds, selectedDateISO, taskPlacements, tasksById])

  const timedPlacementCellSet = useMemo(() => new Set(
    timedPlacementsForWeek
      .filter(placement => placement.slotId)
      .map(placement => `${placement.dateISO}::${placement.slotId}`),
  ), [timedPlacementsForWeek])
  const classCellSet = useMemo(() => new Set(
    timetable.classBlocks.flatMap(block => getSpannedSlotIds(block.slotId, block.slotSpan, timetable.slots).map(slotId => `${block.day}::${slotId}`)),
  ), [timetable.classBlocks, timetable.slots])

  const monthSummaryByDate = useMemo(() => {
    const summary = {} as Record<string, { classCount: number; taskCount: number }>
    monthCells.forEach(cell => {
      const weekday = getWeekdayForDateISO(cell.dateISO)
      const classCount = weekday ? timetable.classBlocks.filter(block => block.day === weekday).length : 0
      const taskCount = Object.values(taskPlacements).filter(placement => placement.dateISO === cell.dateISO && !resolvedTaskIds[placement.taskId]).length
      summary[cell.dateISO] = { classCount, taskCount }
    })
    return summary
  }, [monthCells, resolvedTaskIds, taskPlacements, timetable.classBlocks])

  const scheduleTaskAtTarget = (taskId: string, target: ScheduleInput) => {
    onScheduleTask(taskId, target)
    setAddTarget(null)
  }

  const renderDayTimeline = () => (
    <div style={{ display: 'grid', gap: 8 }}>
      {selectedWeekday ? timetable.slots.map(slot => {
        const classBlock = dayClassBlocks.find(block => block.slotId === slot.id)
        const classContinuation = !classBlock
          ? dayClassBlocks.find(block => getSpannedSlotIds(block.slotId, block.slotSpan, timetable.slots).includes(slot.id))
          : null
        const taskPlacement = dayTimedTaskPlacements.find(placement => placement.slotId === slot.id)
        const task = taskPlacement ? tasksById[taskPlacement.taskId] : null
        const isOccupied = !!classBlock || !!classContinuation || !!taskPlacement
        return (
          <div key={slot.id} style={{ display: 'grid', gridTemplateColumns: '76px 1fr auto', gap: 8, alignItems: 'stretch' }}>
            <div style={{ ...mono, fontSize: 10, color: T.muted, paddingTop: 10 }}>{slot.label}<div style={{ color: T.dim, marginTop: 2 }}>{slot.startTime}</div></div>
            <div style={{ minHeight: 74, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface2, padding: '10px 12px', display: 'grid', gap: 8 }}>
              {classBlock && (
                <div style={{ borderRadius: 10, background: `${T.accent}18`, border: `1px solid ${T.accent}3a`, padding: '8px 10px' }}>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{classBlock.courseCode} · Sec {classBlock.section}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{classBlock.courseName}</div>
                  {classBlock.slotSpan > 1 && <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 4 }}>Spans {classBlock.slotSpan} periods</div>}
                </div>
              )}
              {!classBlock && classContinuation && (
                <div style={{ borderRadius: 10, background: `${T.accent}10`, border: `1px dashed ${T.accent}30`, padding: '8px 10px' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Continuation · {classContinuation.courseCode} Sec {classContinuation.section}</div>
                </div>
              )}
              {task && (
                <div style={{ borderRadius: 10, background: `${T.warning}18`, border: `1px solid ${T.warning}32`, padding: '8px 10px' }}>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{task.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{task.taskType ?? 'Task'} · {task.studentName}</div>
                </div>
              )}
              {!isOccupied && (
                <div style={{ ...mono, fontSize: 10, color: T.dim, alignSelf: 'center' }}>Open slot</div>
              )}
            </div>
            {isEditable && selectedWeekday && (
              <Btn size="sm" variant="ghost" onClick={() => setAddTarget({ dateISO: selectedDateISO, slotId: slot.id, initialMode: 'timed' })}>
                <Plus size={12} /> Add
              </Btn>
            )}
          </div>
        )
      }) : (
        <Card style={{ padding: '14px 16px' }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4 }}>Sunday is kept unscheduled</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Weekly timetable editing is Monday through Saturday only in this version.</div>
        </Card>
      )}
    </div>
  )

  return (
    <PageShell size="wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <CalendarDays size={20} color={T.accent} />
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.text }}>Calendar / Timetable</div>
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>
            Personal planning workspace for {currentTeacher.name} · merged role view across {allowedRoles.join(' / ')}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
          <div style={{ display: 'inline-flex', gap: 6, padding: 4, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface2 }}>
            <button type="button" aria-label="Calendar mode" onClick={() => setMode('calendar')} style={segmentedButtonStyle(mode === 'calendar')}>
              <CalendarDays size={14} /> Calendar
            </button>
            <button type="button" aria-label="Timetable mode" onClick={() => setMode('timetable')} style={segmentedButtonStyle(mode === 'timetable')}>
              <Rows4 size={14} /> Timetable
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip color={T.accent} size={9}>Active role: {activeRole}</Chip>
            <Chip color={isEditable ? T.success : T.warning} size={9}>{isEditable ? 'Editable via Course Leader access' : 'Read-only in v1'}</Chip>
            <Chip color={T.blue} size={9}>{mode === 'calendar' ? formatMonthLabel(monthAnchorISO) : formatWeekRange(selectedWeekStart)}</Chip>
          </div>
        </div>
      </div>

      {mode === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 0.95fr)', gap: 16, alignItems: 'start' }}>
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{formatMonthLabel(monthAnchorISO)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Select a date to open the detailed day plan.</div>
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
                const summary = monthSummaryByDate[cell.dateISO] ?? { classCount: 0, taskCount: 0 }
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
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 14 }}>{dayNumber}</div>
                      {isSelected && <Chip color={T.accent} size={8}>Selected</Chip>}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ ...mono, fontSize: 10, color: summary.classCount > 0 ? T.accent : T.dim }}>{summary.classCount} class{summary.classCount === 1 ? '' : 'es'}</div>
                      <div style={{ ...mono, fontSize: 10, color: summary.taskCount > 0 ? T.warning : T.dim }}>{summary.taskCount} task{summary.taskCount === 1 ? '' : 's'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card style={{ padding: '16px 18px', position: 'sticky', top: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{formatShortDate(selectedDateISO)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Detailed day plan</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label="Previous day" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, -1))} style={iconButtonStyle()}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" aria-label="Next day" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, 1))} style={iconButtonStyle()}>
                  <ChevronRight size={14} />
                </button>
                <Btn size="sm" variant="ghost" onClick={() => setMode('timetable')}>Expand</Btn>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <Chip color={selectedWeekday ? T.success : T.warning} size={9}>{selectedWeekday ? `${selectedWeekday} plan` : 'Sunday view'}</Chip>
              <Chip color={T.accent} size={9}>{facultyOfferings.length} mapped classes</Chip>
            </div>

            {renderDayTimeline()}

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Untimed Day Tasks</div>
                {isEditable && selectedWeekday && (
                  <Btn size="sm" variant="ghost" onClick={() => setAddTarget({ dateISO: selectedDateISO, initialMode: 'untimed' })}>
                    <Plus size={12} /> Add
                  </Btn>
                )}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {dayUntimedTasks.map(task => (
                  <div key={task.id} style={{ borderRadius: 10, background: `${T.warning}18`, border: `1px solid ${T.warning}32`, padding: '10px 12px' }}>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{task.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{task.studentName} · {task.taskType ?? 'Task'}</div>
                  </div>
                ))}
                {dayUntimedTasks.length === 0 && (
                  <div style={{ ...mono, fontSize: 10, color: T.dim, borderRadius: 10, border: `1px dashed ${T.border2}`, padding: '10px 12px' }}>
                    No untimed tasks scheduled for this day.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {mode === 'timetable' && (
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Weekly Timetable</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Recurring class template plus scheduled queue tasks. Sundays are intentionally excluded.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" aria-label="Previous week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, -7))} style={iconButtonStyle()}>
                <ChevronLeft size={15} />
              </button>
              <Chip color={T.blue} size={10}>{formatWeekRange(selectedWeekStart)}</Chip>
              <button type="button" aria-label="Next week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, 7))} style={iconButtonStyle()}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `92px repeat(${WEEKDAY_ORDER.length}, minmax(0, 1fr))`, gap: 10 }}>
            <div />
            {weekDates.map((dateISO, index) => {
              const isSelected = dateISO === selectedDateISO
              return (
                <button
                  key={dateISO}
                  type="button"
                  aria-label={`Select ${WEEKDAY_ORDER[index]} ${dateISO}`}
                  onClick={() => setSelectedDateISO(dateISO)}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isSelected ? T.accent : T.border}`,
                    background: isSelected ? `${T.accent}16` : T.surface2,
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>{WEEKDAY_ORDER[index]}</div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginTop: 2 }}>{formatShortDate(dateISO).split(', ').slice(1).join(', ')}</div>
                </button>
              )
            })}

            {timetable.slots.map(slot => (
              <TimetableSlotRow
                key={slot.id}
                slot={slot}
                weekDates={weekDates}
                selectedDateISO={selectedDateISO}
                classBlocks={timetable.classBlocks}
                slots={timetable.slots}
                timedPlacements={timedPlacementsForWeek}
                tasksById={tasksById}
                editable={isEditable}
                classCellSet={classCellSet}
                timedPlacementCellSet={timedPlacementCellSet}
                onScheduleTask={onScheduleTask}
                onMoveClassBlock={onMoveClassBlock}
                onResizeClassBlock={onResizeClassBlock}
                onOpenAdd={target => setAddTarget(target)}
              />
            ))}

            <div style={{ ...mono, fontSize: 10, color: T.muted, paddingTop: 10 }}>Untimed</div>
            {weekDates.map(dateISO => {
              const untimedTasks = Object.values(taskPlacements)
                .filter(placement => placement.dateISO === dateISO && placement.placementMode === 'untimed')
                .filter(placement => !resolvedTaskIds[placement.taskId])
                .map(placement => tasksById[placement.taskId])
                .filter((task): task is SharedTask => !!task)
              return (
                <div
                  key={`untimed-${dateISO}`}
                  onDragOver={event => {
                    if (!isEditable) return
                    event.preventDefault()
                  }}
                  onDrop={event => {
                    if (!isEditable) return
                    event.preventDefault()
                    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
                    if (!payload || payload.kind !== 'task') return
                    onScheduleTask(payload.id, { dateISO, placementMode: 'untimed' })
                  }}
                  style={{ minHeight: 104, borderRadius: 12, border: `1px dashed ${T.border2}`, background: T.surface2, padding: '10px 12px', display: 'grid', gap: 8, alignContent: 'start' }}
                >
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>No preferred time</div>
                  {untimedTasks.map(task => (
                    <div key={task.id} draggable={isEditable} onDragStart={event => {
                      if (!isEditable) return
                      event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'task', id: task.id }))
                    }} style={{ borderRadius: 10, border: `1px solid ${T.warning}32`, background: `${T.warning}18`, padding: '8px 10px', cursor: isEditable ? 'grab' : 'default' }}>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{task.title}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName}</div>
                    </div>
                  ))}
                  {untimedTasks.length === 0 && <div style={{ ...mono, fontSize: 10, color: T.dim }}>No untimed tasks.</div>}
                  {isEditable && (
                    <Btn size="sm" variant="ghost" onClick={() => setAddTarget({ dateISO, initialMode: 'untimed' })}>
                      <Plus size={12} /> Add
                    </Btn>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {addTarget && (
        <TaskPlacementSheet
          target={addTarget}
          queueCandidates={queueCandidates}
          taskPlacements={taskPlacements}
          slot={addTarget.slotId ? slotMap[addTarget.slotId] : undefined}
          onClose={() => setAddTarget(null)}
          onPlaceTask={(taskId, placementMode) => scheduleTaskAtTarget(taskId, {
            dateISO: addTarget.dateISO,
            placementMode,
            slotId: placementMode === 'timed' ? addTarget.slotId : undefined,
          })}
          onCreateNewTask={placementMode => {
            onOpenTaskComposer({
              dueDateISO: addTarget.dateISO,
              availableOfferingIds: facultyOfferings.map(offering => offering.offId),
              placement: {
                dateISO: addTarget.dateISO,
                placementMode,
                slotId: placementMode === 'timed' ? addTarget.slotId : undefined,
              },
            })
            setAddTarget(null)
          }}
        />
      )}
    </PageShell>
  )
}

function TimetableSlotRow({
  slot,
  weekDates,
  selectedDateISO,
  classBlocks,
  slots,
  timedPlacements,
  tasksById,
  editable,
  classCellSet,
  timedPlacementCellSet,
  onScheduleTask,
  onMoveClassBlock,
  onResizeClassBlock,
  onOpenAdd,
}: {
  slot: TimetableSlotDefinition
  weekDates: string[]
  selectedDateISO: string
  classBlocks: FacultyTimetableTemplate['classBlocks']
  slots: TimetableSlotDefinition[]
  timedPlacements: TaskCalendarPlacement[]
  tasksById: Record<string, SharedTask>
  editable: boolean
  classCellSet: Set<string>
  timedPlacementCellSet: Set<string>
  onScheduleTask: (taskId: string, input: ScheduleInput) => void
  onMoveClassBlock: (blockId: string, input: { day: Weekday; slotId: string }) => void
  onResizeClassBlock: (blockId: string, nextSpan: number) => void
  onOpenAdd: (target: AddTargetState) => void
}) {
  return (
    <>
      <div style={{ ...mono, fontSize: 10, color: T.muted, paddingTop: 16 }}>
        {slot.label}
        <div style={{ color: T.dim, marginTop: 4 }}>{slot.startTime}</div>
      </div>
      {weekDates.map(dateISO => {
        const day = getWeekdayForDateISO(dateISO)
        const classBlock = day ? classBlocks.find(block => block.day === day && block.slotId === slot.id) : null
        const classContinuation = day && !classBlock
          ? classBlocks.find(block => block.day === day && getSpannedSlotIds(block.slotId, block.slotSpan, slots).includes(slot.id))
          : null
        const taskPlacement = timedPlacements.find(placement => placement.dateISO === dateISO && placement.slotId === slot.id)
        const task = taskPlacement ? tasksById[taskPlacement.taskId] : null
        const hasAnyBlock = !!classBlock || !!classContinuation || !!taskPlacement
        return (
          <div
            key={`${dateISO}-${slot.id}`}
            onDragOver={event => {
              if (!editable || !day) return
              event.preventDefault()
            }}
            onDrop={event => {
              if (!editable || !day) return
              event.preventDefault()
              const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
              if (!payload) return
              if (payload.kind === 'class') {
                if (classCellSet.has(`${day}::${slot.id}`) && classBlock?.id !== payload.id) return
                onMoveClassBlock(payload.id, { day, slotId: slot.id })
                return
              }
              if (timedPlacementCellSet.has(`${dateISO}::${slot.id}`) && taskPlacement?.taskId !== payload.id) return
              onScheduleTask(payload.id, { dateISO, placementMode: 'timed', slotId: slot.id })
            }}
            style={{
              minHeight: 108,
              borderRadius: 12,
              border: `1px solid ${dateISO === selectedDateISO ? T.accent : T.border}`,
              background: dateISO === selectedDateISO ? `${T.accent}10` : T.surface,
              padding: '10px 12px',
              display: 'grid',
              gap: 8,
              alignContent: 'start',
            }}
          >
            {classBlock && (
              <div
                draggable={editable}
                onDragStart={event => {
                  if (!editable) return
                  event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'class', id: classBlock.id }))
                }}
                style={{ borderRadius: 10, border: `1px solid ${T.accent}3a`, background: `${T.accent}18`, padding: '8px 10px', cursor: editable ? 'grab' : 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{classBlock.courseCode} · Sec {classBlock.section}</div>
                  {editable && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" aria-label={`Shrink ${classBlock.courseCode}`} onClick={() => onResizeClassBlock(classBlock.id, classBlock.slotSpan - 1)} style={miniIconButtonStyle()}>
                        −
                      </button>
                      <button type="button" aria-label={`Extend ${classBlock.courseCode}`} onClick={() => onResizeClassBlock(classBlock.id, classBlock.slotSpan + 1)} style={miniIconButtonStyle()}>
                        +
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{classBlock.courseName}</div>
                {classBlock.slotSpan > 1 && <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 4 }}>Spans {classBlock.slotSpan} periods</div>}
                <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Grip size={10} /> Drag to move
                </div>
              </div>
            )}
            {!classBlock && classContinuation && (
              <div style={{ borderRadius: 10, border: `1px dashed ${T.accent}30`, background: `${T.accent}10`, padding: '8px 10px' }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Continuation · {classContinuation.courseCode}</div>
              </div>
            )}
            {task && (
              <div
                draggable={editable}
                onDragStart={event => {
                  if (!editable) return
                  event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'task', id: task.id }))
                }}
                style={{ borderRadius: 10, border: `1px solid ${T.warning}32`, background: `${T.warning}18`, padding: '8px 10px', cursor: editable ? 'grab' : 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text }}>{task.title}</div>
                  {editable && (
                    <button type="button" aria-label={`Move ${task.title} to untimed`} onClick={() => onScheduleTask(task.id, { dateISO, placementMode: 'untimed' })} style={miniIconButtonStyle()}>
                      <Clock3 size={11} />
                    </button>
                  )}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName}</div>
              </div>
            )}
            {!hasAnyBlock && (
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Open slot</div>
            )}
            {editable && !hasAnyBlock && day && (
              <Btn size="sm" variant="ghost" onClick={() => onOpenAdd({ dateISO, slotId: slot.id, initialMode: 'timed' })}>
                <Plus size={12} /> Add
              </Btn>
            )}
          </div>
        )
      })}
    </>
  )
}

function TaskPlacementSheet({
  target,
  queueCandidates,
  taskPlacements,
  slot,
  onClose,
  onPlaceTask,
  onCreateNewTask,
}: {
  target: AddTargetState
  queueCandidates: SharedTask[]
  taskPlacements: Record<string, TaskCalendarPlacement>
  slot?: TimetableSlotDefinition
  onClose: () => void
  onPlaceTask: (taskId: string, placementMode: TaskPlacementMode) => void
  onCreateNewTask: (placementMode: TaskPlacementMode) => void
}) {
  const [preferUntimed, setPreferUntimed] = useState(target.initialMode === 'untimed')
  const effectiveMode: TaskPlacementMode = preferUntimed ? 'untimed' : 'timed'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '82vh', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Add to {formatShortDate(target.dateISO)}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
            {slot ? `${slot.label} · ${slot.startTime}–${slot.endTime}` : 'Untimed day bucket'} · queue tasks stay linked to the same source record.
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', ...mono, fontSize: 10, color: T.text }}>
            <input type="checkbox" checked={preferUntimed} onChange={event => setPreferUntimed(event.target.checked)} />
            No preferred time for this date
          </label>
        </div>

        <div className="scroll-pane scroll-pane--dense" style={{ overflowY: 'auto', padding: 18, display: 'grid', gap: 10 }}>
          {queueCandidates.map(task => {
            const existingPlacement = taskPlacements[task.id]
            return (
              <div key={task.id} style={{ borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '12px 14px', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{task.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{task.studentName} · {task.courseCode} · {task.taskType ?? 'Task'}</div>
                  </div>
                  <Chip color={existingPlacement ? T.warning : T.success} size={9}>{existingPlacement ? 'Scheduled' : 'Unscheduled'}</Chip>
                </div>
                {existingPlacement && (
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>
                    Current placement: {existingPlacement.dateISO}{existingPlacement.slotId ? ` · ${existingPlacement.slotId}` : ' · untimed'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>This updates the existing queue item. No duplicate task is created.</div>
                  <Btn size="sm" onClick={() => onPlaceTask(task.id, effectiveMode)}>
                    {existingPlacement ? 'Reschedule here' : 'Add here'}
                  </Btn>
                </div>
              </div>
            )
          })}
          {queueCandidates.length === 0 && (
            <div style={{ ...mono, fontSize: 11, color: T.dim, textAlign: 'center', padding: '24px 12px' }}>
              No active queue items are available in your current merged scope.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted }}>Need something new instead of reusing queue state?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
            <Btn size="sm" onClick={() => onCreateNewTask(effectiveMode)}>
              <Plus size={12} /> Create New Task
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function segmentedButtonStyle(active: boolean) {
  return {
    border: 'none',
    borderRadius: 999,
    background: active ? T.accent : 'transparent',
    color: active ? '#fff' : T.muted,
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    ...mono,
    fontSize: 11,
  } as const
}

function iconButtonStyle() {
  return {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface2,
    color: T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function miniIconButtonStyle() {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface,
    color: T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function parseDragPayload(raw: string): { kind: 'class' | 'task'; id: string } | null {
  try {
    const parsed = JSON.parse(raw) as { kind?: 'class' | 'task'; id?: string }
    if ((parsed.kind === 'class' || parsed.kind === 'task') && parsed.id) return { kind: parsed.kind, id: parsed.id }
    return null
  } catch {
    return null
  }
}
