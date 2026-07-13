import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { T, mono, sora, type Offering } from '@web/simulation/fixtures'
import type {
  AcademicMeeting,
  FacultyTimetableClassBlock,
  SharedTask,
  TaskCalendarPlacement,
  TaskPlacementMode,
} from '@kernel/shared/domain'
import type { ApiAdminCalendarMarker } from '@web/shared/api/types'
import { DEFAULT_TASK_DURATION_MINUTES, formatShortDate, minutesToDisplayLabel, minutesToTimeString } from '@web/shared/state/calendar-utils'
import { Btn, UI_TRANSITION_FAST, UI_TRANSITION_MEDIUM } from '@web/shared/ui/primitives'
import { normalizeTimeValue } from './calendar-helpers'
import { describeMarkerType } from './marker-utils'
import { iconButtonStyle, segmentedButtonStyle, sheetFieldStyle } from './styles'
import type { BlockDetailsState } from './types'

export function BlockDetailsSheet({
  detailsState,
  classBlock,
  task,
  meeting,
  marker,
  offering,
  placement,
  editable,
  canEditMeeting,
  canOpenCourseWorkspace,
  onEditMarker,
  onClose,
  onOpenCourse,
  onOpenActionQueue,
  onRescheduleTask,
  onUpdateMeeting,
  onEditClass,
}: {
  detailsState: BlockDetailsState
  classBlock: FacultyTimetableClassBlock | null
  task: SharedTask | null
  meeting: AcademicMeeting | null
  marker: ApiAdminCalendarMarker | null
  offering: Offering | null
  placement: TaskCalendarPlacement | null
  editable: boolean
  canEditMeeting: boolean
  canOpenCourseWorkspace: boolean
  onEditMarker?: (marker: ApiAdminCalendarMarker) => void
  onClose: () => void
  onOpenCourse: () => void
  onOpenActionQueue: () => void
  onRescheduleTask: (input: { placementMode: TaskPlacementMode; startMinutes?: number; endMinutes?: number }) => void
  onUpdateMeeting: (input: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status: AcademicMeeting['status']; version: number }) => void
  onEditClass: () => void
}) {
  const isClass = detailsState.type === 'class'
  const isMeeting = detailsState.type === 'meeting'
  const isMarker = detailsState.type === 'marker'
  const title = isClass
    ? (classBlock ? `${classBlock.courseCode} · Sec ${classBlock.section}` : 'Class details')
    : isMeeting
      ? (meeting?.title ?? 'Meeting details')
    : isMarker
      ? (marker?.title ?? 'Marker details')
      : (task?.title ?? 'Task details')
  const subtitle = isClass
    ? (classBlock?.kind === 'extra'
        ? `Extra class · ${offering?.title ?? classBlock?.courseName ?? ''}`
        : (offering?.title ?? classBlock?.courseName ?? ''))
    : isMeeting
      ? (meeting ? `${meeting.studentName}${meeting.courseCode ? ` · ${meeting.courseCode}` : ''}` : '')
    : isMarker
      ? (marker ? `${describeMarkerType(marker.markerType)}${marker.note ? ` · ${marker.note}` : ''}` : '')
      : (task ? `${task.studentName} · ${task.courseCode} · ${task.taskType ?? 'Task'}` : '')
  const [rescheduleMode, setRescheduleMode] = useState<TaskPlacementMode>(() => placement?.placementMode ?? 'timed')
  const [rescheduleStart, setRescheduleStart] = useState(() => minutesToTimeString(placement?.startMinutes ?? 0))
  const [rescheduleEnd, setRescheduleEnd] = useState(() => minutesToTimeString(placement?.endMinutes ?? ((placement?.startMinutes ?? 0) + DEFAULT_TASK_DURATION_MINUTES)))
  const [meetingDateISO, setMeetingDateISO] = useState(() => meeting?.dateISO ?? '')
  const [meetingStart, setMeetingStart] = useState(() => minutesToTimeString(meeting?.startMinutes ?? (15 * 60)))
  const [meetingEnd, setMeetingEnd] = useState(() => minutesToTimeString(meeting?.endMinutes ?? ((15 * 60) + 30)))
  const [meetingStatus, setMeetingStatus] = useState<AcademicMeeting['status']>(() => meeting?.status ?? 'scheduled')
  const [meetingNotes, setMeetingNotes] = useState(() => meeting?.notes ?? '')

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 143, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={UI_TRANSITION_MEDIUM}
        style={{ width: '100%', maxWidth: 520, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, display: 'grid', gap: 14, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.32)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{title}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{subtitle}</div>
          </div>
          <button type="button" aria-label="Close block details" onClick={onClose} style={iconButtonStyle()}>
            <X size={14} />
          </button>
        </div>

        {isClass && classBlock && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <DetailRow label="When" value={`${classBlock.dateISO ? formatShortDate(classBlock.dateISO) : classBlock.day} · ${minutesToDisplayLabel(classBlock.startMinutes)} - ${minutesToDisplayLabel(classBlock.endMinutes)}`} />
              <DetailRow label="Year" value={classBlock.year} />
              <DetailRow label="Section" value={`Sec ${classBlock.section}`} />
              <DetailRow label="Type" value={classBlock.kind === 'extra' ? 'Extra class' : 'Weekly class'} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
              {editable && <Btn size="sm" variant="ghost" onClick={onEditClass}>Edit timing</Btn>}
              {canOpenCourseWorkspace && <Btn size="sm" onClick={onOpenCourse}>Open Course Workspace</Btn>}
            </div>
          </>
        )}

        {isMarker && marker && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <DetailRow label="Type" value={describeMarkerType(marker.markerType)} />
              <DetailRow label="When" value={`${formatShortDate(detailsState.dateISO)}${marker.allDay ? ' · All day' : ` · ${minutesToDisplayLabel(marker.startMinutes ?? 0)} - ${minutesToDisplayLabel(marker.endMinutes ?? 0)}`}`} />
              <DetailRow label="Range" value={marker.endDateISO ? `${formatShortDate(marker.dateISO)} to ${formatShortDate(marker.endDateISO)}` : formatShortDate(marker.dateISO)} />
              <DetailRow label="Audience" value="Institutional calendar context" />
            </div>
            {marker.note ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>{marker.note}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
              {onEditMarker ? <Btn size="sm" onClick={() => onEditMarker(marker)}>Edit Marker</Btn> : null}
            </div>
          </>
        )}

        {isMeeting && meeting && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <DetailRow label="Student" value={`${meeting.studentName} · ${meeting.studentUsn}`} />
              <DetailRow label="Status" value={meetingStatus} />
              <DetailRow label="When" value={`${formatShortDate(meeting.dateISO)} · ${minutesToDisplayLabel(meeting.startMinutes)} - ${minutesToDisplayLabel(meeting.endMinutes)}`} />
              <DetailRow label="Course" value={meeting.courseCode ? `${meeting.courseCode} · ${meeting.courseName ?? ''}` : 'General student meeting'} />
            </div>
            <div style={{ borderRadius: 12, border: `1px solid ${T.blue}28`, background: `${T.blue}10`, padding: '12px 14px', display: 'grid', gap: 10 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Update meeting schedule</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Adjust the time or mark the meeting as completed or cancelled.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 10, color: T.muted }}>Date</span>
                  <input type="date" value={meetingDateISO} onChange={event => setMeetingDateISO(event.target.value)} style={sheetFieldStyle()} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 10, color: T.muted }}>Start</span>
                  <input type="time" value={meetingStart} onChange={event => setMeetingStart(event.target.value)} style={sheetFieldStyle()} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 10, color: T.muted }}>End</span>
                  <input type="time" value={meetingEnd} onChange={event => setMeetingEnd(event.target.value)} style={sheetFieldStyle()} />
                </label>
              </div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ ...mono, fontSize: 10, color: T.muted }}>Status</span>
                <select value={meetingStatus} onChange={event => setMeetingStatus(event.target.value as AcademicMeeting['status'])} style={sheetFieldStyle()}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ ...mono, fontSize: 10, color: T.muted }}>Notes</span>
                <textarea value={meetingNotes} onChange={event => setMeetingNotes(event.target.value)} rows={3} style={{ ...sheetFieldStyle(), resize: 'vertical', minHeight: 88 }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
              <Btn
                size="sm"
                disabled={!canEditMeeting}
                onClick={() => {
                  onUpdateMeeting({
                    studentId: meeting.studentId,
                    offeringId: meeting.offeringId ?? null,
                    title: meeting.title,
                    notes: meetingNotes.trim() || null,
                    dateISO: meetingDateISO || meeting.dateISO,
                    startMinutes: normalizeTimeValue(meetingStart, meeting.startMinutes),
                    endMinutes: normalizeTimeValue(meetingEnd, meeting.endMinutes),
                    status: meetingStatus,
                    version: meeting.version,
                  })
                }}
                variant={canEditMeeting ? 'primary' : 'ghost'}
              >
                {canEditMeeting ? 'Save Meeting' : 'Owned by another faculty'}
              </Btn>
              {canOpenCourseWorkspace && offering && <Btn size="sm" variant="ghost" onClick={onOpenCourse}>Open Course Workspace</Btn>}
            </div>
          </>
        )}

        {!isClass && !isMarker && task && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <DetailRow label="When" value={placement?.placementMode === 'untimed'
                ? `${formatShortDate(detailsState.dateISO)} · No preferred time`
                : `${formatShortDate(detailsState.dateISO)} · ${minutesToDisplayLabel(placement?.startMinutes ?? 0)} - ${minutesToDisplayLabel(placement?.endMinutes ?? 0)}`} />
              <DetailRow label="Status" value={task.status} />
              <DetailRow label="Student" value={task.studentName} />
              <DetailRow label="Course" value={`${task.courseCode} · ${offering?.title ?? task.courseName}`} />
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.dim }}>{task.actionHint}</div>
            <div style={{ borderRadius: 12, border: `1px solid ${T.accent}28`, background: `${T.accent}10`, padding: '12px 14px', display: 'grid', gap: 10 }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>Reschedule on {formatShortDate(detailsState.dateISO)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Adjust this task directly for the selected day without leaving the calendar.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" data-tab="true" onClick={() => setRescheduleMode('timed')} style={segmentedButtonStyle(rescheduleMode === 'timed')}>
                  Timed
                </button>
                <button type="button" data-tab="true" onClick={() => setRescheduleMode('untimed')} style={segmentedButtonStyle(rescheduleMode === 'untimed')}>
                  Untimed
                </button>
              </div>
              {rescheduleMode === 'timed' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>Start</span>
                    <input
                      type="time"
                      value={rescheduleStart}
                      onChange={event => setRescheduleStart(event.target.value)}
                      style={sheetFieldStyle()}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>End</span>
                    <input
                      type="time"
                      value={rescheduleEnd}
                      onChange={event => setRescheduleEnd(event.target.value)}
                      style={sheetFieldStyle()}
                    />
                  </label>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => onRescheduleTask(rescheduleMode === 'untimed'
                  ? { placementMode: 'untimed' }
                  : {
                      placementMode: 'timed',
                      startMinutes: normalizeTimeValue(rescheduleStart, placement?.startMinutes ?? 0),
                      endMinutes: normalizeTimeValue(rescheduleEnd, placement?.endMinutes ?? ((placement?.startMinutes ?? 0) + DEFAULT_TASK_DURATION_MINUTES)),
                    })}
              >
                Save Schedule
              </Btn>
              <Btn size="sm" onClick={onOpenActionQueue}>Open Action Queue</Btn>
              {canOpenCourseWorkspace && offering && <Btn size="sm" variant="ghost" onClick={onOpenCourse}>Open Course Workspace</Btn>}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '10px 12px' }}>
      <div style={{ ...mono, fontSize: 9, color: T.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text }}>{value}</div>
    </div>
  )
}
