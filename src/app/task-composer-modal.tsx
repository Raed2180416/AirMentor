import { useCallback, useMemo, useState } from 'react'
import { T, mono, sora, type Offering, type Student } from '../data'
import {
  normalizeDateISO,
  toDueLabel,
  toTodayISO,
  type Role,
  type SchedulePreset,
  type TaskType,
} from '../domain'
import { minutesToDisplayLabel } from '../calendar-utils'
import { useAppSelectors } from '../selectors'
import {
  Btn,
  Card,
  Chip,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  ModalWorkspace,
  UI_FONT_SIZES,
  getFieldChromeStyle,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
} from '../ui-primitives'
import { createRemedialPlan, suggestTaskForStudent } from './workspace-helpers'
import type { TaskComposerState, TaskCreateInput } from './workspace-types'

export function TaskComposerModal({ role, offerings, initialState, onClose, onSubmit }: { role: Role; offerings: Offering[]; initialState: TaskComposerState; onClose: () => void; onSubmit: (input: TaskCreateInput) => void }) {
  const { getStudentsPatched } = useAppSelectors()
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [selectedOffId, setSelectedOffId] = useState<string>(initialState.offeringId ?? '')
  const [query, setQuery] = useState(initialState.search)
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialState.studentId ?? '')
  const [taskType, setTaskType] = useState<TaskType>(initialState.taskType)
  const [dueDateISO, setDueDateISO] = useState(initialState.dueDateISO)
  const [note, setNote] = useState(initialState.note)
  const [step, setStep] = useState<'details' | 'remedial'>(initialState.step)
  const [planTitle, setPlanTitle] = useState(() => initialState.search ? `Remedial support plan for ${initialState.search.split(' ')[0]}` : '')
  const [checkIn1, setCheckIn1] = useState('')
  const [checkIn2, setCheckIn2] = useState('')
  const [planSteps, setPlanSteps] = useState<string[]>(['Target weak CO topics', 'Solve supervised practice set', 'Mentor check-in and reflection'])
  const [schedulingMode, setSchedulingMode] = useState<'one-time' | 'scheduled'>('one-time')
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('daily')
  const [scheduleTime, setScheduleTime] = useState('')
  const [customDates, setCustomDates] = useState<Array<{ dateISO: string; time?: string }>>([{ dateISO: '', time: '' }])

  const yearOptions = useMemo(() => Array.from(new Set(offerings.map(o => o.year))), [offerings])
  const deptOptions = useMemo(() => Array.from(new Set(offerings.map(o => o.dept))), [offerings])
  const classOfferings = useMemo(() => offerings.filter(o => (!selectedYear || o.year === selectedYear) && (!selectedDept || o.dept === selectedDept)), [offerings, selectedYear, selectedDept])
  const activeSelectedOffId = selectedOffId && classOfferings.some(o => o.offId === selectedOffId) ? selectedOffId : ''
  const selectedOffering = offerings.find(o => o.offId === activeSelectedOffId)
  const filteredStudents = (selectedOffering ? getStudentsPatched(selectedOffering) : []).filter(student => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return student.name.toLowerCase().includes(q) || student.usn.toLowerCase().includes(q)
  })
  const selectedStudent = filteredStudents.find(student => student.id === selectedStudentId) ?? (selectedOffering ? getStudentsPatched(selectedOffering).find(student => student.id === selectedStudentId) : undefined)
  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as Array<{ offering: Offering; student: Student }>
    const scope = activeSelectedOffId ? offerings.filter(o => o.offId === activeSelectedOffId) : classOfferings
    return scope.flatMap(o => getStudentsPatched(o).filter(student => student.name.toLowerCase().includes(q) || student.usn.toLowerCase().includes(q)).map(student => ({ offering: o, student }))).slice(0, 10)
  }, [activeSelectedOffId, classOfferings, getStudentsPatched, offerings, query])

  const hydrateSelectedStudent = useCallback((student: Student) => {
    const suggestion = suggestTaskForStudent(student)
    setTaskType(current => initialState.studentId && current === initialState.taskType ? suggestion.taskType : current)
    setDueDateISO(current => current || suggestion.dueDateISO)
    setNote(current => current || suggestion.note)
    setPlanTitle(`Remedial support plan for ${student.name.split(' ')[0]}`)
  }, [initialState.studentId, initialState.taskType])

  const getScheduleMeta = () => {
    if (schedulingMode === 'one-time') return undefined
    if (schedulePreset === 'custom dates') {
      const validCustomDates = customDates
        .map(item => ({ dateISO: item.dateISO.trim(), time: item.time?.trim() || undefined }))
        .filter(item => !!normalizeDateISO(item.dateISO))
      if (validCustomDates.length === 0) return undefined
      const nextDue = validCustomDates.map(item => item.dateISO).sort()[0]
      return {
        mode: 'scheduled' as const,
        preset: 'custom dates' as const,
        customDates: validCustomDates,
        status: 'active' as const,
        nextDueDateISO: nextDue,
      }
    }
    const normalizedDue = normalizeDateISO(dueDateISO) ?? toTodayISO()
    return {
      mode: 'scheduled' as const,
      preset: schedulePreset,
      time: scheduleTime || undefined,
      status: 'active' as const,
      nextDueDateISO: normalizedDue,
    }
  }

  const denseFieldStyle = getFieldChromeStyle({ dense: true })
  const denseTextAreaStyle = { ...denseFieldStyle, minHeight: 0 }

  return (
    <ModalWorkspace
      eyebrow="Action Queue"
      title={step === 'details' ? 'Add Task' : 'Build Remedial Plan'}
      caption={step === 'details' ? 'One unified task flow for follow-up, attendance, academic, and remedial actions.' : 'Step 2 of 2. Leaf tasks stay tied to the same queue item.'}
      onClose={onClose}
      width={760}
      size="lg"
      bodyStyle={{ display: 'grid', gap: 12 }}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={T.accent} size={9}>Owner: {role}</Chip>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {step === 'remedial' && <Btn size="sm" variant="ghost" onClick={() => setStep('details')}>Back</Btn>}
            <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
            {step === 'details' && taskType === 'Remedial' && <Btn size="sm" onClick={() => {
              const fallbackStudentId = selectedStudentId || filteredStudents[0]?.id || searchHits[0]?.student.id
              if (!selectedOffering || !fallbackStudentId) return
              if (!selectedStudentId) setSelectedStudentId(fallbackStudentId)
              setStep('remedial')
            }}>Build Plan</Btn>}
            {step === 'details' && taskType !== 'Remedial' && <Btn size="sm" onClick={() => {
              if (!selectedOffering || !selectedStudentId) return
              const scheduleMeta = getScheduleMeta()
              const effectiveDueDateISO = scheduleMeta?.nextDueDateISO ?? dueDateISO
              onSubmit({
                offeringId: selectedOffering.offId,
                studentId: selectedStudentId,
                taskType,
                dueDateISO: effectiveDueDateISO,
                due: toDueLabel(effectiveDueDateISO),
                note,
                scheduleMeta,
                placement: initialState.placement,
              })
              onClose()
            }}>Create Task</Btn>}
            {step === 'remedial' && <Btn size="sm" onClick={() => {
              if (!selectedOffering || !selectedStudentId) return
              const sanitized = planSteps.map(item => item.trim()).filter(Boolean)
              const scheduleMeta = getScheduleMeta()
              const effectiveDueDateISO = scheduleMeta?.nextDueDateISO ?? dueDateISO
              if (!planTitle.trim() || !effectiveDueDateISO || sanitized.length === 0) return
              const plan = createRemedialPlan({
                selectedStudentId,
                title: planTitle.trim(),
                ownerRole: role,
                dueDateISO: effectiveDueDateISO,
                checkInDatesISO: [checkIn1, checkIn2].filter(Boolean),
                steps: sanitized,
              })
              onSubmit({
                offeringId: selectedOffering.offId,
                studentId: selectedStudentId,
                taskType: 'Remedial',
                dueDateISO: effectiveDueDateISO,
                due: toDueLabel(effectiveDueDateISO),
                note: note.trim() || planTitle.trim(),
                remedialPlan: plan,
                scheduleMeta,
                placement: initialState.placement,
              })
              onClose()
            }}>Create Remedial Task</Btn>}
          </div>
        </div>
      )}
    >
          {step === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldSelect aria-label="Select year" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={denseFieldStyle}>
                  <option value="">All Years</option>
                  {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </FieldSelect>
                <FieldSelect aria-label="Select branch" value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={denseFieldStyle}>
                  <option value="">All Branches</option>
                  {deptOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </FieldSelect>
              </div>
              <FieldSelect aria-label="Select class" value={activeSelectedOffId} onChange={e => { setSelectedOffId(e.target.value); setQuery('') }} style={denseFieldStyle}>
                <option value="">Select class</option>
                {classOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Sec {offering.section} · {getStudentsPatched(offering).length} students</option>)}
              </FieldSelect>
              <FieldInput aria-label="Search student" placeholder="Search student / USN" value={query} onChange={e => setQuery(e.target.value)} style={denseFieldStyle} />
              {query.trim() !== '' && <div className="scroll-pane scroll-pane--dense" style={{ minHeight: 96, maxHeight: 140, overflowY: 'auto', border: `1px solid ${T.border2}`, borderRadius: 14, background: T.surface2 }}>
                {query.trim() !== '' && searchHits.length === 0 && <div style={{ ...mono, fontSize: 10, color: T.dim, padding: '10px 12px' }}>No matching students.</div>}
                {query.trim() !== '' && searchHits.map(hit => (
                  <button key={`${hit.offering.offId}-${hit.student.id}`} onClick={() => {
                    setSelectedYear(hit.offering.year)
                    setSelectedDept(hit.offering.dept)
                    setSelectedOffId(hit.offering.offId)
                    setSelectedStudentId(hit.student.id)
                    setQuery(hit.student.name)
                    hydrateSelectedStudent(hit.student)
                  }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', padding: '8px 10px' }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 11, color: T.text }}>{hit.student.name}</div>
                    <div style={{ ...mono, fontSize: 9, color: T.muted }}>{hit.student.usn} · {hit.offering.code} · Sec {hit.offering.section}</div>
                  </button>
                ))}
              </div>}
              <FieldSelect aria-label="Select student" value={selectedStudentId} onChange={e => {
                const nextId = e.target.value
                setSelectedStudentId(nextId)
                const nextStudent = filteredStudents.find(student => student.id === nextId)
                if (nextStudent) hydrateSelectedStudent(nextStudent)
              }} style={denseFieldStyle}>
                <option value="">Select student</option>
                {filteredStudents.map(student => <option key={student.id} value={student.id}>{student.name} · {student.usn}</option>)}
              </FieldSelect>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldSelect aria-label="Task type" value={taskType} onChange={e => setTaskType(e.target.value as TaskType)} style={denseFieldStyle}>
                  <option>Follow-up</option>
                  <option>Remedial</option>
                  <option>Attendance</option>
                  <option>Academic</option>
                </FieldSelect>
                <FieldInput aria-label={schedulingMode === 'scheduled' ? 'Starts on' : 'Due date'} title={schedulingMode === 'scheduled' ? 'Starts on' : 'Due date'} type="date" value={dueDateISO} onChange={e => setDueDateISO(e.target.value)} style={denseFieldStyle} />
              </div>
              <Card style={{ padding: '10px 12px' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Scheduling</div>
                <div style={{ ...getSegmentedGroupStyle(), marginBottom: 8, width: 'fit-content' }}>
                  <button type="button" data-tab="true" onClick={() => setSchedulingMode('one-time')} style={getSegmentedButtonStyle({ active: schedulingMode === 'one-time', compact: true })}>One-time</button>
                  <button type="button" data-tab="true" onClick={() => setSchedulingMode('scheduled')} style={getSegmentedButtonStyle({ active: schedulingMode === 'scheduled', compact: true })}>Scheduled</button>
                </div>
                {schedulingMode === 'scheduled' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <FieldSelect aria-label="Schedule preset" value={schedulePreset} onChange={e => setSchedulePreset(e.target.value as SchedulePreset)} style={denseFieldStyle}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="custom dates">Custom dates</option>
                      </FieldSelect>
                      {schedulePreset !== 'custom dates' && <FieldInput aria-label="Recurring time (optional)" type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={denseFieldStyle} />}
                    </div>
                    {schedulePreset === 'custom dates' && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {customDates.map((item, index) => (
                          <div key={`custom-date-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                            <FieldInput aria-label={`Custom date ${index + 1}`} type="date" value={item.dateISO} onChange={e => setCustomDates(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, dateISO: e.target.value } : row))} style={denseFieldStyle} />
                            <FieldInput aria-label={`Custom date ${index + 1} time`} type="time" value={item.time ?? ''} onChange={e => setCustomDates(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, time: e.target.value } : row))} style={denseFieldStyle} />
                            <button type="button" aria-label={`Remove custom date ${index + 1}`} onClick={() => setCustomDates(prev => prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index))} style={{ ...getIconButtonStyle({ subtle: false }), width: 38, height: 'auto', minHeight: 42, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>−</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setCustomDates(prev => [...prev, { dateISO: '', time: '' }])} style={{ ...getIconButtonStyle({ subtle: true }), width: 'fit-content', padding: '0 10px', ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>+ Add custom date</button>
                      </div>
                    )}
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>Starts on: {normalizeDateISO(dueDateISO) ?? 'today'} · Queue activation follows the recurring schedule. Calendar placement stays exact when this task is launched from the timetable.</div>
                  </div>
                )}
              </Card>
              {initialState.placement && (
                <Card style={{ padding: '10px 12px' }}>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 6 }}>Calendar placement</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                    {initialState.placement.dateISO} · {initialState.placement.placementMode === 'untimed'
                      ? 'No preferred time'
                      : `${minutesToDisplayLabel(initialState.placement.startMinutes ?? 0)} - ${minutesToDisplayLabel(initialState.placement.endMinutes ?? 0)}`}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>Saving this task will place it directly into the calendar/timetable workspace.</div>
                </Card>
              )}
              <FieldTextarea aria-label="Task note" value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Task note" style={{ ...denseTextAreaStyle, resize: 'none' }} />
              {selectedStudent && (
                <Card style={{ padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>Selected student</div>
                  <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text, marginTop: 4 }}>{selectedStudent.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 2 }}>{selectedStudent.usn} · {selectedOffering?.code} Sec {selectedOffering?.section}</div>
                </Card>
              )}
            </>
          )}

          {step === 'remedial' && (
            <>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{selectedStudent?.name} · {selectedOffering?.code} Sec {selectedOffering?.section}</div>
              <FieldInput aria-label="Remedial plan title" value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="Plan title" style={denseFieldStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <FieldInput aria-label="Plan due date" type="date" value={dueDateISO} onChange={e => setDueDateISO(e.target.value)} style={denseFieldStyle} />
                <FieldInput aria-label="Check-in date 1" type="date" value={checkIn1} onChange={e => setCheckIn1(e.target.value)} style={denseFieldStyle} />
                <FieldInput aria-label="Check-in date 2" type="date" value={checkIn2} onChange={e => setCheckIn2(e.target.value)} style={denseFieldStyle} />
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>Plan steps (checklist)</div>
              {planSteps.map((stepLabel, index) => (
                <FieldInput key={index} aria-label={`Plan step ${index + 1}`} value={stepLabel} onChange={e => setPlanSteps(prev => prev.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} placeholder={`Step ${index + 1}`} style={denseFieldStyle} />
              ))}
            </>
          )}
    </ModalWorkspace>
  )
}
