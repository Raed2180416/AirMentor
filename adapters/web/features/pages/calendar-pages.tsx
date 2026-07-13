import { CalendarDays, ChevronLeft, ChevronRight, Rows4 } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import { addDaysISO, formatMonthLabel, formatShortDate, formatWeekRange, getWeekdayForDateISO } from '@web/shared/state/calendar-utils'
import { Btn, Card, Chip, PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { AgendaBoard } from './calendar/agenda-board'
import { BlockDetailsSheet } from './calendar/block-details-sheet'
import { CalendarMonthGrid } from './calendar/calendar-month-grid'
import { ClassTimingSheet } from './calendar/class-timing-sheet'
import { DragGhostOverlay } from './calendar/drag-ghost-overlay'
import { ExtraClassSheet } from './calendar/extra-class-sheet'
import { TaskPlacementSheet } from './calendar/task-placement-sheet'
import { iconButtonStyle, segmentedButtonStyle, timeInputStyle } from './calendar/styles'
import { useCalendarTimetablePage } from './calendar/use-calendar-timetable-page'
import type { CalendarTimetablePageProps } from './calendar/types'

export function CalendarTimetablePage(props: CalendarTimetablePageProps) {
  const {
    onBack,
    currentTeacher,
    activeRole,
    allowedRoles,
    facultyOfferings,
    onScheduleTask,
    onUpdateMeeting,
    onCreateExtraClass,
    onOpenTaskComposer,
    onOpenCourse,
    onOpenActionQueue,
    onDismissTask,
    onDismissSeries,
    embedded = false,
    hideBackButton = false,
    title = 'Calendar / Timetable',
    subtitle,
    allowTaskCreation = true,
    onEditMarker,
  } = props

  const {
    mode,
    setMode,
    selectedDateISO,
    setSelectedDateISO,
    monthAnchorISO,
    setMonthAnchorISO,
    addTarget,
    setAddTarget,
    extraClassDraft,
    setExtraClassDraft,
    detailsState,
    setDetailsState,
    classEdit,
    setClassEdit,
    hoverAdd,
    setHoverAdd,
    interaction,
    setBoundsDraft,
    setBoundsDirty,
    pageWidth,
    shellRef,
    setColumnRef,
    setUntimedBucketRef,
    isEditable,
    canOpenCourseWorkspace,
    showCalendarDayPanel,
    queueCandidates,
    monthCells,
    selectedWeekStart,
    selectedWeekday,
    dayStartMinutes,
    dayEndMinutes,
    visibleBounds,
    monthSummaryByDate,
    weekColumns,
    dayColumns,
    detailClassBlock,
    detailTask,
    detailMeeting,
    detailMarker,
    detailOffering,
    detailPlacement,
    startTaskDrag,
    startClassDrag,
    startClassResize,
    openClassEdit,
    openEventDetails,
    handleSaveClassEdit,
    handleChangeAddTarget,
    handleChangeExtraClassDraft,
    handleApplyBounds,
  } = useCalendarTimetablePage(props)

  const content = (
    <div ref={shellRef} style={{ display: 'grid', gap: 18 }}>
      {!hideBackButton && <PageBackButton onClick={onBack} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 0, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <CalendarDays size={20} color={T.accent} />
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.text }}>{title}</div>
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>
            {subtitle ?? `Personal planning workspace for ${currentTeacher.name} · merged role scope across ${allowedRoles.join(' / ')}`}
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
            <Chip color={isEditable ? T.success : T.warning} size={9}>{isEditable ? 'Editable' : 'Read-only in this role'}</Chip>
            <Chip color={T.blue} size={9}>{mode === 'calendar' ? formatMonthLabel(monthAnchorISO) : formatWeekRange(selectedWeekStart)}</Chip>
          </div>
        </div>
      </div>

      {mode === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: !showCalendarDayPanel || pageWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(0, 1.7fr) minmax(360px, 1fr)', gap: 16, alignItems: 'start' }}>
          <CalendarMonthGrid
            monthAnchorISO={monthAnchorISO}
            setMonthAnchorISO={setMonthAnchorISO}
            monthCells={monthCells}
            monthSummaryByDate={monthSummaryByDate}
            selectedDateISO={selectedDateISO}
            setSelectedDateISO={setSelectedDateISO}
            showCalendarDayPanel={showCalendarDayPanel}
          />

          {showCalendarDayPanel ? (
          <Card style={{ padding: '16px 18px', position: pageWidth < 1180 ? 'relative' : 'sticky', top: pageWidth < 1180 ? undefined : 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{formatShortDate(selectedDateISO)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Detailed day plan</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label="Previous day" onClick={() => {
                  const next = addDaysISO(selectedDateISO, -1)
                  setSelectedDateISO(next)
                  setMonthAnchorISO(`${next.slice(0, 7)}-01`)
                }} style={iconButtonStyle()}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" aria-label="Next day" onClick={() => {
                  const next = addDaysISO(selectedDateISO, 1)
                  setSelectedDateISO(next)
                  setMonthAnchorISO(`${next.slice(0, 7)}-01`)
                }} style={iconButtonStyle()}>
                  <ChevronRight size={14} />
                </button>
                <Btn size="sm" variant="ghost" onClick={() => setMode('timetable')}>Expand</Btn>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <Chip color={selectedWeekday ? T.success : T.warning} size={9}>{selectedWeekday ? `${selectedWeekday} plan` : 'Sunday view'}</Chip>
              <Chip color={T.accent} size={9}>{facultyOfferings.length} mapped classes</Chip>
            </div>

            {selectedWeekday ? (
              <AgendaBoard
                columns={dayColumns}
                dayStartMinutes={dayStartMinutes}
                dayEndMinutes={dayEndMinutes}
                editable={isEditable}
                variant="day"
                hoverAdd={hoverAdd}
                interaction={interaction}
                onHoverColumn={setHoverAdd}
                onOpenAdd={setAddTarget}
                onTaskDragStart={startTaskDrag}
                onClassDragStart={startClassDrag}
                onClassResizeStart={startClassResize}
                onOpenEventDetails={openEventDetails}
                onOpenMarkerDetails={(marker, dateISO) => setDetailsState({ type: 'marker', markerId: marker.markerId, dateISO })}
                onMoveTaskToUntimed={(taskId, dateISO) => onScheduleTask(taskId, { dateISO, placementMode: 'untimed' })}
                onDismissTask={onDismissTask}
                onDismissSeries={onDismissSeries}
                setColumnRef={setColumnRef}
                setUntimedBucketRef={setUntimedBucketRef}
              />
            ) : (
              <Card style={{ padding: '14px 16px' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4 }}>Sunday stays unscheduled</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Select any Monday to Saturday date for freeform timetable planning.</div>
              </Card>
            )}
          </Card>
          ) : null}
        </div>
      )}

      {mode === 'timetable' && (
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>Weekly Timetable</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Exact-time weekly canvas for recurring classes and scheduled queue work.</div>
            </div>
            <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" aria-label="Previous week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, -7))} style={iconButtonStyle()}>
                  <ChevronLeft size={15} />
                </button>
                <Chip color={T.blue} size={10}>{formatWeekRange(selectedWeekStart)}</Chip>
                <button type="button" aria-label="Next week" onClick={() => setSelectedDateISO(addDaysISO(selectedDateISO, 7))} style={iconButtonStyle()}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ ...mono, fontSize: 10, color: T.muted }}>Day bounds</span>
                <input aria-label="Timetable day start" type="time" value={visibleBounds.start} onChange={event => {
                  setBoundsDirty(true)
                  setBoundsDraft(prev => ({ ...prev, start: event.target.value }))
                }} disabled={!isEditable} style={timeInputStyle(!isEditable)} />
                <input aria-label="Timetable day end" type="time" value={visibleBounds.end} onChange={event => {
                  setBoundsDirty(true)
                  setBoundsDraft(prev => ({ ...prev, end: event.target.value }))
                }} disabled={!isEditable} style={timeInputStyle(!isEditable)} />
                {isEditable && <Btn size="sm" variant="ghost" onClick={handleApplyBounds}>Update bounds</Btn>}
              </div>
            </div>
          </div>

          <AgendaBoard
            columns={weekColumns}
            dayStartMinutes={dayStartMinutes}
            dayEndMinutes={dayEndMinutes}
            editable={isEditable}
            variant="week"
            hoverAdd={hoverAdd}
            interaction={interaction}
            onHoverColumn={setHoverAdd}
            onSelectDate={setSelectedDateISO}
            onOpenAdd={setAddTarget}
            onTaskDragStart={startTaskDrag}
            onClassDragStart={startClassDrag}
            onClassResizeStart={startClassResize}
            onOpenEventDetails={openEventDetails}
            onOpenMarkerDetails={(marker, dateISO) => setDetailsState({ type: 'marker', markerId: marker.markerId, dateISO })}
            onMoveTaskToUntimed={(taskId, dateISO) => onScheduleTask(taskId, { dateISO, placementMode: 'untimed' })}
            onDismissTask={onDismissTask}
            onDismissSeries={onDismissSeries}
            setColumnRef={setColumnRef}
            setUntimedBucketRef={setUntimedBucketRef}
          />
        </Card>
      )}

      {addTarget && (
        <TaskPlacementSheet
          target={addTarget}
          queueCandidates={queueCandidates}
          allowTaskCreation={allowTaskCreation}
          onClose={() => setAddTarget(null)}
          onChangeTarget={handleChangeAddTarget}
          onPlaceTask={taskId => {
            onScheduleTask(taskId, {
              dateISO: addTarget.dateISO,
              placementMode: addTarget.placementMode,
              startMinutes: addTarget.startMinutes,
              endMinutes: addTarget.endMinutes,
            })
            setAddTarget(null)
          }}
          onCreateNewTask={() => {
            onOpenTaskComposer({
              dueDateISO: addTarget.dateISO,
              availableOfferingIds: facultyOfferings.map(offering => offering.offId),
              placement: {
                dateISO: addTarget.dateISO,
                placementMode: addTarget.placementMode,
                startMinutes: addTarget.startMinutes,
                endMinutes: addTarget.endMinutes,
              },
            })
            setAddTarget(null)
          }}
          onScheduleExtraClass={() => {
            if (addTarget.placementMode !== 'timed' || typeof addTarget.startMinutes !== 'number' || typeof addTarget.endMinutes !== 'number') return
            const day = getWeekdayForDateISO(addTarget.dateISO)
            if (!day) return
            setExtraClassDraft({
              offeringId: facultyOfferings[0]?.offId ?? '',
              dateISO: addTarget.dateISO,
              day,
              startMinutes: addTarget.startMinutes,
              endMinutes: addTarget.endMinutes,
            })
          }}
        />
      )}

      {extraClassDraft && (
        <ExtraClassSheet
          draft={extraClassDraft}
          offerings={facultyOfferings}
          onClose={() => {
            setExtraClassDraft(null)
            setAddTarget(null)
          }}
          onChange={handleChangeExtraClassDraft}
          onSave={() => {
            onCreateExtraClass({
              offeringId: extraClassDraft.offeringId,
              dateISO: extraClassDraft.dateISO,
              startMinutes: extraClassDraft.startMinutes,
              endMinutes: extraClassDraft.endMinutes,
            })
            setExtraClassDraft(null)
            setAddTarget(null)
          }}
        />
      )}

      {detailsState && (
        <BlockDetailsSheet
          key={detailsState.type === 'class'
            ? `class-${detailsState.blockId}-${detailsState.dateISO}`
            : detailsState.type === 'task'
              ? `task-${detailsState.taskId}-${detailsState.dateISO}`
              : detailsState.type === 'meeting'
                ? `meeting-${detailsState.meetingId}-${detailsState.dateISO}`
              : `marker-${detailsState.markerId}-${detailsState.dateISO}`}
          detailsState={detailsState}
          classBlock={detailClassBlock}
          task={detailTask}
          meeting={detailMeeting}
          marker={detailMarker}
          offering={detailOffering}
          placement={detailPlacement}
          editable={isEditable}
          canEditMeeting={!!detailMeeting && detailMeeting.facultyId === currentTeacher.facultyId}
          canOpenCourseWorkspace={canOpenCourseWorkspace}
          onEditMarker={onEditMarker}
          onClose={() => setDetailsState(null)}
          onOpenCourse={() => {
            if (!detailOffering) return
            onOpenCourse(detailOffering.offId)
            setDetailsState(null)
          }}
          onOpenActionQueue={() => {
            onOpenActionQueue()
            setDetailsState(null)
          }}
          onRescheduleTask={input => {
            if (!detailTask) return
            onScheduleTask(detailTask.id, {
              dateISO: detailsState.dateISO,
              placementMode: input.placementMode,
              startMinutes: input.startMinutes,
              endMinutes: input.endMinutes,
            })
            setDetailsState(null)
          }}
          onUpdateMeeting={input => {
            if (!detailMeeting) return
            onUpdateMeeting(detailMeeting.meetingId, input)
            setDetailsState(null)
          }}
          onEditClass={() => {
            if (!detailClassBlock) return
            setDetailsState(null)
            openClassEdit(detailClassBlock)
          }}
        />
      )}

      {classEdit && (
        <ClassTimingSheet
          value={classEdit}
          onClose={() => setClassEdit(null)}
          onChange={next => setClassEdit(current => current ? { ...current, ...next } : current)}
          onSave={handleSaveClassEdit}
        />
      )}

      <DragGhostOverlay interaction={interaction} />
    </div>
  )

  if (embedded) return content

  return <PageShell size="wide">{content}</PageShell>
}
