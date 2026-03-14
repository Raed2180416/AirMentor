import { useMemo, useState } from 'react'
import { Eye, Shield } from 'lucide-react'
import { FACULTY, MENTEES, OFFERINGS, T, mono, sora, type Offering, type Student } from '../data'
import type { RiskBand, SharedTask } from '../domain'
import { useAppSelectors } from '../selectors'
import { Bar, Btn, Card, Chip, PageShell, TH, TD } from '../ui-primitives'

export function HodView({
  onOpenQueueHistory,
  onOpenCourse,
  onOpenStudent,
  tasks,
}: {
  onOpenQueueHistory: () => void
  onOpenCourse: (offering: Offering) => void
  onOpenStudent: (student: Student, offering?: Offering) => void
  tasks: SharedTask[]
}) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  const teacherStats = useMemo(() => {
    return FACULTY.map(faculty => {
      const offerings = faculty.offeringIds
        .map(offId => OFFERINGS.find(offering => offering.offId === offId))
        .filter((offering): offering is Offering => !!offering)
      const students = offerings.reduce((acc, offering) => acc + offering.count, 0)
      const highRisk = offerings.reduce((acc, offering) => acc + getStudentsPatched(offering).filter(student => student.riskBand === 'High').length, 0)
      const averageAttendance = offerings.length > 0 ? Math.round(offerings.reduce((acc, offering) => acc + getOfferingAttendancePatched(offering), 0) / offerings.length) : 0
      const lockChecks = offerings.flatMap(offering => [offering.tt1Locked ? 1 : 0, offering.tt2Locked ? 1 : 0, offering.quizLocked ? 1 : 0, offering.asgnLocked ? 1 : 0])
      const completeness = lockChecks.length > 0 ? Math.round(lockChecks.reduce((acc, value) => acc + value, 0) / lockChecks.length * 100) : 0
      const pendingTasks = offerings.filter(offering => !!offering.pendingAction).length
      return {
        id: faculty.facultyId,
        name: faculty.name,
        initials: faculty.initials,
        dept: faculty.dept,
        role: faculty.roleTitle,
        roles: faculty.allowedRoles,
        offerings,
        students,
        highRisk,
        averageAttendance,
        completeness,
        pendingTasks,
      }
    })
  }, [getOfferingAttendancePatched, getStudentsPatched])

  const selectedTeacher = useMemo(() => teacherStats.find(teacher => teacher.id === selectedTeacherId) ?? null, [teacherStats, selectedTeacherId])
  const mentorTasks = useMemo(() => {
    return MENTEES
      .filter(mentee => mentee.avs >= 0.5)
      .flatMap(mentee => mentee.courseRisks
        .filter(courseRisk => courseRisk.risk >= 0.5)
        .map(courseRisk => ({
          id: `mentor-${mentee.id}-${courseRisk.code}`,
          studentId: mentee.id,
          offeringId: OFFERINGS.find(offering => offering.code === courseRisk.code)?.offId ?? '',
          studentName: mentee.name,
          studentUsn: mentee.usn,
          courseCode: courseRisk.code,
          courseName: courseRisk.title,
          year: mentee.year,
          riskBand: courseRisk.risk >= 0.7 ? 'High' as RiskBand : courseRisk.risk >= 0.35 ? 'Medium' as RiskBand : 'Low' as RiskBand,
          title: `Mentor follow-up: ${Math.round(courseRisk.risk * 100)}% vulnerability in ${courseRisk.code}`,
          due: 'This week',
          status: mentee.interventions.length > 0 ? 'In Progress' : 'New',
          riskProb: courseRisk.risk,
          actionHint: 'Mentor-generated follow-up task',
          priority: Math.round(courseRisk.risk * 100),
        })))
  }, [])

  const selectedTeacherTasks = useMemo(() => {
    if (!selectedTeacher) return []
    const offeringIds = new Set(selectedTeacher.offerings.map(offering => offering.offId))
    const courseCodes = new Set(selectedTeacher.offerings.map(offering => offering.code))
    const courseLeaderTasks = tasks.filter(task => offeringIds.has(task.offeringId))
    const mentorLinkedTasks = mentorTasks.filter(task => courseCodes.has(task.courseCode))
    return [...courseLeaderTasks, ...mentorLinkedTasks]
      .sort((left, right) => right.riskProb - left.riskProb)
      .slice(0, 8)
  }, [tasks, mentorTasks, selectedTeacher])

  const totalStudents = OFFERINGS.reduce((acc, offering) => acc + offering.count, 0)
  const totalHighRisk = OFFERINGS.reduce((acc, offering) => acc + getStudentsPatched(offering).filter(student => student.riskBand === 'High').length, 0)
  const averageAttendance = OFFERINGS.length > 0 ? Math.round(OFFERINGS.reduce((acc, offering) => acc + getOfferingAttendancePatched(offering), 0) / OFFERINGS.length) : 0

  return (
    <PageShell size="wide">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Shield size={22} color={T.accent} />
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>Department Overview — CSE</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Head of Department view · All faculty and students</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Btn size="sm" onClick={onOpenQueueHistory}>Open Queue History</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Faculty', value: teacherStats.length, color: T.accent },
          { label: 'Total Students', value: totalStudents, color: T.success },
          { label: 'High Risk (dept)', value: totalHighRisk, color: T.danger },
          { label: 'Avg Attendance', value: `${averageAttendance}%`, color: T.blue },
        ].map(metric => (
          <Card key={metric.label} glow={metric.color} style={{ padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.color }}>{metric.value}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 12 }}>Faculty Members</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 22 }}>
        {teacherStats.map(teacher => {
          const isSelected = selectedTeacher?.id === teacher.id
          return (
            <Card key={teacher.id} glow={isSelected ? T.accent : undefined} style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setSelectedTeacherId(isSelected ? null : teacher.id)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 13, color: '#fff' }}>{teacher.initials}</div>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{teacher.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{teacher.role}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { label: 'Offerings', value: teacher.offerings.length, color: T.accent },
                  { label: 'Students', value: teacher.students, color: T.text },
                  { label: 'High Risk', value: teacher.highRisk, color: teacher.highRisk > 10 ? T.danger : T.warning },
                ].map(metric => (
                  <div key={metric.label} style={{ background: T.surface2, borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: metric.color }}>{metric.value}</div>
                    <div style={{ ...mono, fontSize: 8, color: T.dim }}>{metric.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>Data:</div>
                <div style={{ flex: 1 }}><Bar val={teacher.completeness} color={teacher.completeness >= 80 ? T.success : teacher.completeness >= 60 ? T.warning : T.danger} h={4} /></div>
                <span style={{ ...mono, fontSize: 10, color: T.muted }}>{teacher.completeness}%</span>
                {teacher.pendingTasks > 0 && <Chip color={T.warning} size={9}>{teacher.pendingTasks} tasks</Chip>}
              </div>
            </Card>
          )
        })}
      </div>

      {selectedTeacher && (
        <Card glow={T.accent} style={{ animation: 'fadeUp 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{selectedTeacher.name} — Detail View</div>
            <Btn size="sm" variant="ghost" onClick={() => setSelectedTeacherId(null)}>Close</Btn>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {selectedTeacher.offerings.map(offering => (
              <div key={`${offering.code}-${offering.section}`} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px', cursor: 'pointer' }} onClick={() => onOpenCourse(offering)}>
                <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 4 }}>{offering.code} - Sec {offering.section}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>{offering.title}</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <Chip color={offering.tt1Locked ? T.success : T.warning} size={9}>TT1: {offering.tt1Locked ? 'Locked' : 'Pending'}</Chip>
                  <Chip color={offering.tt2Locked ? T.success : T.warning} size={9}>TT2: {offering.tt2Locked ? 'Locked' : 'Pending'}</Chip>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...mono, fontSize: 10, color: T.danger }}>{getStudentsPatched(offering).filter(student => student.riskBand === 'High').length} High Risk</span>
                  <span style={{ ...mono, fontSize: 10, color: T.text }}>{getOfferingAttendancePatched(offering)}% Avg Att · Open →</span>
                </div>
              </div>
            ))}
            {selectedTeacher.offerings.length === 0 && <div style={{ ...mono, fontSize: 11, color: T.muted }}>No course offerings mapped for this faculty yet.</div>}
          </div>

          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>Top Assigned Tasks (Overdue)</div>
          <div style={{ background: T.surface2, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Student', 'Course', 'Task', 'Due', 'Status', ''].map(header => <TH key={header}>{header}</TH>)}</tr></thead>
              <tbody>
                {selectedTeacherTasks.map(task => (
                  <tr key={task.id}>
                    <TD><span style={{ ...sora, fontSize: 11, color: T.text }}>{task.studentName}</span> <span style={{ ...mono, fontSize: 10, color: T.accent }}>{task.studentUsn}</span></TD>
                    <TD style={{ ...mono, fontSize: 11 }}>{task.courseCode}</TD>
                    <TD style={{ ...mono, fontSize: 11 }}>{task.title}</TD>
                    <TD style={{ ...mono, fontSize: 11, color: task.due === 'Today' ? T.danger : T.warning }}>{task.due}</TD>
                    <TD><Chip color={task.status === 'New' ? T.danger : task.status === 'In Progress' ? T.warning : T.blue} size={9}>{task.status}</Chip></TD>
                    <TD><button aria-label={`View ${task.studentName} profile`} title="View profile" onClick={() => {
                      const offering = OFFERINGS.find(item => item.offId === task.offeringId)
                      if (!offering) return
                      const student = getStudentsPatched(offering).find(item => item.id === task.studentId)
                      if (student) onOpenStudent(student, offering)
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Eye size={13} /></button></TD>
                  </tr>
                ))}
                {selectedTeacherTasks.length === 0 && (
                  <tr>
                    <TD colSpan={6} style={{ ...mono, fontSize: 11, color: T.muted, textAlign: 'center' }}>No overdue tasks for mapped offerings.</TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageShell>
  )
}
