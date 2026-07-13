import { useMemo, useState } from 'react'
import { AlertTriangle, Eye, Phone } from 'lucide-react'
import { T, mono, sora, type Mentee, type StudentHistoryRecord } from '@web/simulation/fixtures'
import { humanLabelForActionCode } from '@web/shared/state/action-code-humaniser'
import { Bar, Btn, Card, Chip, PageBackButton, PageShell } from '@web/shared/ui/primitives'
import { getMenteeCurrentRiskBand, getMenteeCurrentRiskProb, getRiskColorForBand, sortMenteeCourseRisksByCurrentAuthority } from './mentee-risk-helpers'

type MenteeDetailPageProps = {
  mentee: Mentee
  history: StudentHistoryRecord | null
  onBack: () => void
  onOpenHistory: (mentee: Mentee) => void
  onOpenStudentShell?: (studentId: string) => void
  onOpenRiskExplorer?: (studentId: string) => void
}

export function MenteeDetailPage({
  mentee,
  history,
  onBack,
  onOpenHistory,
  onOpenStudentShell,
  onOpenRiskExplorer,
}: MenteeDetailPageProps) {
  const [activeInsight, setActiveInsight] = useState<'risk' | 'cgpa'>('risk')
  const currentRiskProb = getMenteeCurrentRiskProb(mentee)
  const currentRiskBand = getMenteeCurrentRiskBand(mentee)
  const currentRiskColor = getRiskColorForBand(currentRiskBand)
  const currentCgpa = history?.currentCgpa ?? mentee.prevCgpa
  const sgpaSeries = useMemo(
    () => history
      ? [...history.terms]
          .sort((left, right) => left.semesterNumber - right.semesterNumber)
          .map(term => ({ label: `S${term.semesterNumber}`, value: term.sgpa }))
      : [],
    [history],
  )
  const maxSgpa = sgpaSeries.reduce((best, point) => point.value > best.value ? point : best, sgpaSeries[0] ?? { label: 'S1', value: 0 })
  const minSgpa = sgpaSeries.reduce((worst, point) => point.value < worst.value ? point : worst, sgpaSeries[0] ?? { label: 'S1', value: 0 })
  const subjectStats = useMemo(() => {
    const allSubjects = history ? history.terms.flatMap(term => term.subjects.map(subject => ({ ...subject, termLabel: term.label }))) : []
    const best = allSubjects.reduce((winner, subject) => subject.score > (winner?.score ?? Number.NEGATIVE_INFINITY) ? subject : winner, allSubjects[0] ?? null)
    const lowest = allSubjects.reduce((loser, subject) => subject.score < (loser?.score ?? Number.POSITIVE_INFINITY) ? subject : loser, allSubjects[0] ?? null)
    return { best, lowest }
  }, [history])
  const riskDrivers = sortMenteeCourseRisksByCurrentAuthority(mentee).slice(0, 3)
  const prioritizedCourseRisks = useMemo(
    () => sortMenteeCourseRisksByCurrentAuthority(mentee),
    [mentee],
  )

  if (!history) {
    return (
      <PageShell size="standard">
        <PageBackButton onClick={onBack} />
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: T.text }}>Student History Unavailable</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
            The backend did not return a transcript history for {mentee.name}. No local fallback is shown in the live teaching workspace.
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn size="sm" variant="ghost" onClick={onBack}>Back</Btn>
          </div>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 22, color: T.text }}>{mentee.name}</div>
          <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 3 }}>{mentee.usn} · {mentee.year} · Sec {mentee.section} · {mentee.dept}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Mentor workspace with intervention context, summary academics, and transcript entry point.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(mentee.phone)}><Phone size={12} /> Copy Phone</Btn>
          <Btn size="sm" disabled={!history} onClick={() => onOpenHistory(mentee)}><Eye size={12} /> View Student History</Btn>
          {onOpenRiskExplorer ? <Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(mentee.id.replace(/^mentee-/, ''))}><AlertTriangle size={12} /> Risk Explorer</Btn> : null}
          {onOpenStudentShell ? <Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(mentee.id.replace(/^mentee-/, ''))}><Eye size={12} /> Student Shell</Btn> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card
          glow={currentRiskColor}
          onClick={() => setActiveInsight('risk')}
          style={{ padding: '12px 16px', cursor: 'pointer', border: activeInsight === 'risk' ? `1px solid ${T.accent}` : undefined }}
        >
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: currentRiskColor }}>
            {currentRiskProb >= 0 ? `${Math.round(currentRiskProb * 100)}%` : 'Awaiting TT1'}
          </div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Current Risk{mentee.primaryCourseCode ? ` · ${mentee.primaryCourseCode}` : ''}</div>
          {mentee.avs >= 0 && currentRiskProb !== mentee.avs ? (
            <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 3 }}>Avg {Math.round(mentee.avs * 100)}%</div>
          ) : null}
        </Card>
        <Card
          glow={currentCgpa >= 7 ? T.success : currentCgpa >= 6 ? T.warning : T.danger}
          onClick={() => setActiveInsight('cgpa')}
          style={{ padding: '12px 16px', cursor: 'pointer', border: activeInsight === 'cgpa' ? `1px solid ${T.accent}` : undefined }}
        >
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: currentCgpa >= 7 ? T.success : currentCgpa >= 6 ? T.warning : T.danger }}>
            {currentCgpa > 0 ? currentCgpa.toFixed(1) : '—'}
          </div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Current CGPA (click for trend)</div>
        </Card>
        <Card glow={T.accent} style={{ padding: '12px 16px' }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.accent }}>{mentee.courseRisks.length}</div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Tracked Courses</div>
        </Card>
        <Card glow={T.warning} style={{ padding: '12px 16px' }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.warning }}>{mentee.interventions.length}</div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Interventions Logged</div>
        </Card>
      </div>

      {activeInsight === 'risk' ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Why Current Risk Is {currentRiskProb >= 0 ? `${Math.round(currentRiskProb * 100)}%` : 'unavailable'}{mentee.primaryCourseCode ? ` · ${mentee.primaryCourseCode}` : ''}</div>
          {riskDrivers.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {riskDrivers.map(driver => {
                const color = driver.risk >= 0.7 ? T.danger : driver.risk >= 0.35 ? T.warning : T.success
                return (
                  <div key={driver.code} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{driver.code} · {driver.title}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>
                          {driver.primaryCase ? 'Primary proof case' : driver.countsTowardCapacity ? 'Capacity-counted proof case' : 'Supporting course signal'}
                          {driver.recommendedAction ? ` · ${humanLabelForActionCode(driver.recommendedAction) ?? driver.recommendedAction}` : ''}
                        </div>
                      </div>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 16, color }}>{Math.round(driver.risk * 100)}%</div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Bar val={driver.risk * 100} color={color} h={4} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim }}>Risk breakdown will appear after course-level data is available.</div>
          )}
        </Card>
      ) : null}

      {activeInsight === 'cgpa' ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Previous GPA Trend & Subject Highlights</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>SGPA by semester</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                {sgpaSeries.map(point => (
                  <div key={point.label} style={{ flex: 1, minWidth: 30 }}>
                    <div style={{ height: `${Math.max(10, Math.round((point.value / 10) * 100))}%`, background: `${T.accent}aa`, border: `1px solid ${T.accent}66`, borderRadius: '6px 6px 3px 3px' }} />
                    <div style={{ ...mono, fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 5 }}>{point.label}</div>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, textAlign: 'center' }}>{point.value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 7, alignContent: 'start' }}>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Max SGPA: <span style={{ color: T.success }}>{maxSgpa.value.toFixed(2)}</span> ({maxSgpa.label})</div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Min SGPA: <span style={{ color: T.danger }}>{minSgpa.value.toFixed(2)}</span> ({minSgpa.label})</div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Best Subject: <span style={{ color: T.success }}>{subjectStats.best ? `${subjectStats.best.code} (${subjectStats.best.score})` : '—'}</span></div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Lowest Subject: <span style={{ color: T.warning }}>{subjectStats.lowest ? `${subjectStats.lowest.code} (${subjectStats.lowest.score})` : '—'}</span></div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{subjectStats.best?.title ?? 'No subject data'} | {subjectStats.lowest?.title ?? 'No subject data'}</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 10 }}>Mentor Priority Queue</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {prioritizedCourseRisks.map((risk, index) => {
              const color = risk.risk >= 0.7 ? T.danger : risk.risk >= 0.35 ? T.warning : risk.risk >= 0 ? T.success : T.dim
              const guidance = risk.risk >= 0.7
                ? 'Immediate 1:1 check-in and weekly follow-up'
                : risk.risk >= 0.5
                  ? 'Create remedial task and review after next assessment'
                  : risk.risk >= 0.35
                    ? 'Monitor attendance and assign targeted practice'
                    : 'Keep under watch and reinforce consistency'
              return (
                <div key={risk.code} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div>
                      <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>P{index + 1} · {risk.code}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>{risk.title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 18, color }}>{risk.risk >= 0 ? `${Math.round(risk.risk * 100)}%` : '—'}</div>
                      <div style={{ ...mono, fontSize: 9, color: T.dim }}>{risk.risk >= 0 ? `${risk.band} watch band` : 'Awaiting data'}</div>
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>{guidance}</div>
                  <Bar val={risk.risk >= 0 ? risk.risk * 100 : 0} color={color} h={5} />
                </div>
              )
            })}
            {prioritizedCourseRisks.length === 0 ? <div style={{ ...mono, fontSize: 11, color: T.dim }}>Course priorities will appear once risk inputs are available.</div> : null}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 14 }}>
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Mentor Summary</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              {currentRiskProb >= 0 ? `Current proof risk is ${Math.round(currentRiskProb * 100)}%.` : 'No score-based risk yet.'} Current CGPA is {currentCgpa > 0 ? currentCgpa.toFixed(2) : 'not yet available'}.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {mentee.courseRisks.filter(risk => risk.risk >= 0.5).map(risk => <Chip key={risk.code} color={risk.risk >= 0.7 ? T.danger : T.warning} size={9}>{risk.code}</Chip>)}
              {mentee.courseRisks.every(risk => risk.risk < 0.5) ? <Chip color={T.success} size={9}>No current high-risk courses</Chip> : null}
            </div>
          </Card>

          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Intervention Timeline</div>
            {mentee.interventions.length > 0 ? mentee.interventions.map((entry, index) => (
              <div key={`${entry.date}-${index}`} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: index < mentee.interventions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 56 }}>{entry.date}</div>
                <Chip color={T.warning} size={9}>{entry.type}</Chip>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>{entry.note}</div>
              </div>
            )) : (
              <div style={{ ...mono, fontSize: 11, color: T.dim }}>No interventions logged for this mentee yet.</div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
