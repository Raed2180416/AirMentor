import { useMemo, useState } from 'react'
import { AlertTriangle, Eye, Mail, Phone, Search, Users, X } from 'lucide-react'
import { T, mono, sora, type Mentee } from '@web/simulation/fixtures'
import { type SharedTask } from '@kernel/shared/domain'
import type { ApiAcademicFacultyProfile } from '@web/shared/api/types'
import { Bar, Card, Chip, PageShell } from '@web/shared/ui/primitives'
import { getMenteeCurrentRiskBand, getMenteeCurrentRiskProb, getRiskColorForBand } from './mentee-risk-helpers'

type MentorViewProps = {
  mentees: Mentee[]
  tasks: SharedTask[]
  proofProfile?: ApiAcademicFacultyProfile | null
  onOpenMentee: (mentee: Mentee) => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}

export function MentorView({
  mentees,
  tasks,
  proofProfile,
  onOpenMentee,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: MentorViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const proofCheckpoint = proofProfile?.proofOperations?.scopeMode === 'proof'
    ? proofProfile.proofOperations.selectedCheckpoint
    : null
  const proofStageKey = proofCheckpoint?.stageKey ?? null
  const proofSemesterNumber = proofCheckpoint?.semesterNumber ?? null
  const proofModeActive = proofProfile?.proofOperations?.scopeMode === 'proof'
  const preTt1Checkpoint = proofStageKey === 'pre-tt1'
  const showCheckpointCgpa = !proofModeActive || (proofSemesterNumber != null && proofSemesterNumber > 1 && !preTt1Checkpoint)
  const sorted = [...mentees].sort((left, right) => getMenteeCurrentRiskProb(right) - getMenteeCurrentRiskProb(left))
  const highRisk = mentees.filter(mentee => getMenteeCurrentRiskBand(mentee) === 'High').length
  const medRisk = mentees.filter(mentee => getMenteeCurrentRiskBand(mentee) === 'Medium').length
  const lowRisk = mentees.filter(mentee => getMenteeCurrentRiskBand(mentee) === 'Low').length
  const filteredMentees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sorted.filter(mentee => {
      const byRisk =
        activeFilter === 'all'
          ? true
          : activeFilter === 'high'
            ? getMenteeCurrentRiskBand(mentee) === 'High'
            : activeFilter === 'medium'
              ? getMenteeCurrentRiskBand(mentee) === 'Medium'
              : getMenteeCurrentRiskBand(mentee) === 'Low'
      if (!byRisk) return false
      if (!query) return true
      const matchesText = [
        mentee.name,
        mentee.usn,
        mentee.dept,
        mentee.year,
        mentee.section,
        ...mentee.courseRisks.map(risk => `${risk.code} ${risk.title}`),
      ].join(' ').toLowerCase()
      return matchesText.includes(query)
    })
  }, [activeFilter, searchQuery, sorted])
  const pendingMentorActions = useMemo(() => {
    const menteeByUsn = new Map(mentees.map(mentee => [mentee.usn, mentee]))
    return tasks
      .filter(task =>
        task.assignedTo === 'Mentor'
        && !task.dismissal
        && task.status !== 'Resolved'
        && menteeByUsn.has(task.studentUsn),
      )
      .sort((left, right) => {
        if (left.priority !== right.priority) return right.priority - left.priority
        const leftDue = left.dueDateISO ?? '9999-12-31'
        const rightDue = right.dueDateISO ?? '9999-12-31'
        return leftDue.localeCompare(rightDue)
      })
      .slice(0, 6)
  }, [mentees, tasks])

  return (
    <PageShell size="standard">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={22} color={T.accent} />
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>My Mentees</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>
              {proofCheckpoint
                ? `Student-centric checkpoint view · Semester ${proofCheckpoint.semesterNumber} / ${proofCheckpoint.stageLabel}`
                : 'Student-centric view · Cross-course watchlist summary from current observable evidence'}
            </div>
          </div>
        </div>
        <div style={{ minWidth: 220, flex: '1 1 280px', maxWidth: 360, position: 'relative' }}>
          <Search size={14} color={T.dim} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search mentee, USN, or course"
            style={{
              width: '100%',
              padding: '9px 34px 9px 30px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface2,
              color: T.text,
              ...mono,
              fontSize: 10,
              outline: 'none',
            }}
          />
          {searchQuery ? (
            <button
              aria-label="Clear mentee search"
              title="Clear search"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: T.dim, cursor: 'pointer', display: 'flex' }}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {proofCheckpoint ? (
        <Card data-proof-section="mentor-checkpoint-banner" style={{ padding: '12px 14px', marginBottom: 18, display: 'grid', gap: 6 }}>
          <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Shared Proof Checkpoint
          </div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>
            Semester {proofCheckpoint.semesterNumber} · {proofCheckpoint.stageLabel}
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.7 }}>
            Mentor cards below are pinned to the currently selected proof checkpoint. Student-shell and risk-explorer drilldowns follow this same semester and stage.
          </div>
          {preTt1Checkpoint ? (
            <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.7 }}>
              Pre-TT1 is an early-semester evidence window, so later-semester cues like carry-forward CGPA framing and assessment percentage bars stay suppressed here.
            </div>
          ) : null}
        </Card>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { lbl: 'Total Mentees', val: mentees.length, col: T.accent, key: 'all' as const, clickable: true },
          { lbl: proofCheckpoint ? 'High Watch' : 'High Vulnerability', val: highRisk, col: T.danger, key: 'high' as const, clickable: true },
          { lbl: 'Medium Risk', val: medRisk, col: T.warning, key: 'medium' as const, clickable: true },
          { lbl: 'Low Risk', val: lowRisk, col: T.success, key: 'low' as const, clickable: true },
        ].map((stat, index) => (
          <Card
            key={index}
            glow={stat.col}
            onClick={stat.clickable ? () => setActiveFilter(stat.key) : undefined}
            style={{
              padding: '12px 16px',
              cursor: stat.clickable ? 'pointer' : 'default',
              border: stat.clickable && activeFilter === stat.key ? `1px solid ${stat.col}` : undefined,
              boxShadow: stat.clickable && activeFilter === stat.key ? `0 0 0 1px ${stat.col}25 inset` : undefined,
            }}
          >
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: stat.col }}>{stat.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{stat.lbl}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue (Pending Actions)</div>
          <Chip color={pendingMentorActions.length > 0 ? T.warning : T.success} size={9}>
            {pendingMentorActions.length} active
          </Chip>
        </div>
        {pendingMentorActions.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingMentorActions.map(task => {
              const target = mentees.find(mentee => mentee.usn === task.studentUsn || mentee.id === task.studentId)
              return (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: `1px solid ${T.border}`, background: T.surface2, borderRadius: 8, padding: '9px 10px' }}>
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{task.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.courseCode} · {task.due}</div>
                  </div>
                  {target ? (
                    <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                      <button
                        onClick={() => onOpenMentee(target)}
                        style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer' }}
                      >
                        Open Student
                      </button>
                      {onOpenRiskExplorer ? (
                        <button
                          onClick={() => onOpenRiskExplorer(target.id.replace(/^mentee-/, ''))}
                          style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer' }}
                        >
                          Risk Explorer
                        </button>
                      ) : null}
                      {onOpenStudentShell ? (
                        <button
                          onClick={() => onOpenStudentShell(target.id.replace(/^mentee-/, ''))}
                          style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer' }}
                        >
                          Student Shell
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ ...mono, fontSize: 11, color: T.dim }}>No pending mentor actions right now.</div>
        )}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredMentees.map(mentee => {
          const currentRiskProb = getMenteeCurrentRiskProb(mentee)
          const currentRiskBand = getMenteeCurrentRiskBand(mentee)
          const currentRiskColor = getRiskColorForBand(currentRiskBand)
          return (
            <Card key={mentee.id} glow={currentRiskColor} style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => onOpenMentee(mentee)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>{mentee.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 1 }}>{mentee.usn} · {mentee.year} · Sec {mentee.section} · {mentee.dept}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {currentRiskProb >= 0 ? (
                    <>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: currentRiskColor }}>{Math.round(currentRiskProb * 100)}%</div>
                      <div style={{ ...mono, fontSize: 9, color: T.muted }}>Current Risk{mentee.primaryCourseCode ? ` · ${mentee.primaryCourseCode}` : ''}</div>
                    </>
                  ) : (
                    <Chip color={T.dim} size={10}>Awaiting TT1</Chip>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {mentee.avs >= 0 && currentRiskProb !== mentee.avs ? (
                  <Chip color={T.dim} size={9}>Avg {Math.round(mentee.avs * 100)}%</Chip>
                ) : null}
                {currentRiskBand ? <Chip color={currentRiskColor} size={9}>{currentRiskBand}</Chip> : null}
                {mentee.primaryQueueState ? <Chip color={T.orange} size={9}>{mentee.primaryQueueState}</Chip> : null}
                {mentee.courseRisks.map(courseRisk => {
                  const riskColor = courseRisk.risk >= 0.7 ? T.danger : courseRisk.risk >= 0.35 ? T.warning : courseRisk.risk >= 0 ? T.success : T.dim
                  return (
                    <div key={courseRisk.code} style={{ flex: '1 1 140px', background: T.surface2, borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{courseRisk.code}</span>
                        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: riskColor }}>
                          {preTt1Checkpoint
                            ? 'Awaiting TT1'
                            : courseRisk.risk >= 0
                              ? `${Math.round(courseRisk.risk * 100)}%`
                              : '—'}
                        </span>
                      </div>
                      {!preTt1Checkpoint ? <Bar val={courseRisk.risk >= 0 ? courseRisk.risk * 100 : 0} color={riskColor} h={4} /> : null}
                      <div style={{ ...mono, fontSize: 8, color: T.dim, marginTop: 2 }}>
                        {preTt1Checkpoint
                          ? `${courseRisk.title.slice(0, 25)} · checkpoint baseline`
                          : courseRisk.title.slice(0, 25)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {mentee.interventions.length > 0 ? (
                  <>
                    <Chip color={T.warning} size={9}>Last: {mentee.interventions[mentee.interventions.length - 1].date}</Chip>
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>{mentee.interventions[mentee.interventions.length - 1].note.slice(0, 40)}…</span>
                  </>
                ) : (
                  <span style={{ ...mono, fontSize: 10, color: T.dim }}>No interventions logged</span>
                )}
                {showCheckpointCgpa && mentee.prevCgpa > 0 ? <Chip color={T.dim} size={9}>CGPA: {mentee.prevCgpa.toFixed(1)}</Chip> : null}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {onOpenRiskExplorer ? (
                    <button
                      aria-label={`Open ${mentee.name} in risk explorer`}
                      title="Risk Explorer"
                      onClick={event => {
                        event.stopPropagation()
                        onOpenRiskExplorer(mentee.id.replace(/^mentee-/, ''))
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}
                    >
                      <AlertTriangle size={13} />
                    </button>
                  ) : null}
                  {onOpenStudentShell ? (
                    <button
                      aria-label={`Open ${mentee.name} in student shell`}
                      title="Student Shell"
                      onClick={event => {
                        event.stopPropagation()
                        onOpenStudentShell(mentee.id.replace(/^mentee-/, ''))
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}
                    >
                      <Eye size={13} />
                    </button>
                  ) : null}
                  <button aria-label={`Copy ${mentee.name} phone number`} title="Copy phone" onClick={event => { event.stopPropagation(); void navigator.clipboard.writeText(mentee.phone) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Phone size={13} /></button>
                  <button aria-label={`Email ${mentee.name}`} title="Email" onClick={event => event.stopPropagation()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Mail size={13} /></button>
                </div>
              </div>
            </Card>
          )
        })}
        {filteredMentees.length === 0 ? (
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>No mentees found for this filter.</div>
          </Card>
        ) : null}
      </div>
    </PageShell>
  )
}
