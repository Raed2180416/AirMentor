import { Eye, TrendingDown } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentRiskExplorer } from '@web/shared/api/types'
import { Card } from '@web/shared/ui/primitives'
import { InfoBanner, MetricCard } from '@web/features/admin/system-admin-ui'
import { DriverList } from './shared'
import { formatEvidencePct } from './helpers'

export function RiskExplorerRightColumn({
  explorer,
  activeTab,
}: {
  explorer: ApiStudentRiskExplorer
  activeTab: 'overview' | 'details' | 'advanced'
}) {
  return (
    <div style={{ flex: '999 1 400px', display: 'grid', gap: 14 }}>
      {activeTab === 'overview' && (
        <Card data-proof-section="top-observable-drivers" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Top Observable Drivers</div>
          </div>
          <InfoBanner tone="neutral" message="Driver points show each observable feature's contribution to risk at this checkpoint. Positive points increase risk pressure; negative points reduce it. They are directional contributions, not standalone marks." />
          <DriverList items={explorer.topDrivers} emptyMessage="No observable driver list is available for this evidence window." />
        </Card>
      )}

      {activeTab === 'advanced' && (
        <Card data-proof-section="cross-course-pressure" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={16} color={T.warning} />
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Cross-Course And Prerequisite Pressure</div>
          </div>
          {explorer.crossCourseDrivers.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {explorer.crossCourseDrivers.map((driver, index) => (
                <Card key={`${driver}-${index}`} style={{ padding: 10, background: T.surface2 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7 }}>{driver}</div>
                </Card>
              ))}
            </div>
          ) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No stable cross-course watch factors are attached to the current evidence row.</div>}
          <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.7 }}>
            Prerequisites: {explorer.prerequisiteMap.prerequisiteCourseCodes.length > 0 ? explorer.prerequisiteMap.prerequisiteCourseCodes.join(' · ') : 'None tracked on this row.'}
          </div>
          {explorer.prerequisiteMap.weakPrerequisiteCourseCodes.length > 0 ? (
            <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.7 }}>
              Weak prerequisite carryover: {explorer.prerequisiteMap.weakPrerequisiteCourseCodes.join(' · ')}
            </div>
          ) : null}
        </Card>
      )}

      {(activeTab === 'details' || activeTab === 'overview') && (
        <Card data-proof-section="weak-course-outcomes" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Focus Outcomes</div>
          {explorer.weakCourseOutcomes.length > 0 ? explorer.weakCourseOutcomes.map(item => (
            <Card key={item.coCode} style={{ padding: 10, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.coCode} · {item.coTitle}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>
                TT1 {formatEvidencePct(item.tt1Pct)} · TT2 {formatEvidencePct(item.tt2Pct)} · SEE {formatEvidencePct(item.seePct)} · trend {item.trend} · gap {item.transferGap}
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{item.topics.join(' · ')}</div>
            </Card>
          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No focus areas are currently surfaced on the proof row.</div>}
        </Card>
      )}

      {activeTab === 'details' && (
        <>
          <Card data-proof-section="question-patterns" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Question Patterns</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <MetricCard label="Weak Questions" value={String(explorer.questionPatterns.weakQuestionCount)} helper="Count of currently weak question traces." />
              <MetricCard label="Careless Errors" value={String(explorer.questionPatterns.carelessErrorCount)} helper="Observed careless-error pattern count." />
              <MetricCard label="Transfer Gaps" value={String(explorer.questionPatterns.transferGapCount)} helper="Observed transfer-demand weakness count." />
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              Common weak topics: {explorer.questionPatterns.commonWeakTopics.join(' · ') || 'None'}
            </div>
          </Card>

          <Card data-proof-section="semester-trajectory" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Semester Trajectory</div>
            {explorer.semesterSummaries.map(item => (
              <Card key={item.semesterNumber} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>Semester {item.semesterNumber}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>SGPA {item.sgpa} · CGPA {item.cgpaAfterSemester}</div>
                </div>
              </Card>
            ))}
          </Card>
          <Card data-proof-section="cgpa-formula-trace" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>CGPA Formula Trace</div>
            {explorer.cgpaTrace.terms.map(item => (
              <Card key={`cgpa-${item.semesterNumber}`} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.text }}>Semester {item.semesterNumber}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                    SGPA {item.recomputedSgpa} · CGPA {item.recomputedCgpaAfterSemester} · credits {item.earnedCredits}/{item.registeredCredits}
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 6, lineHeight: 1.7 }}>
                  {item.subjects.slice(0, 4).map(subject => `${subject.courseCode}: CE ${subject.ceMark ?? 'NA'} + SEE ${subject.seeMark ?? 'NA'} = ${subject.totalMark ?? 'NA'} (${subject.gradeLabel}/${subject.gradePoint})`).join(' · ')}
                </div>
              </Card>
            ))}
          </Card>
        </>
      )}

      {activeTab === 'advanced' && explorer.electiveFit && (
        <Card data-proof-section="elective-fit" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Elective Fit</div>
          <div style={{ ...mono, fontSize: 10, color: T.text }}>
            {explorer.electiveFit.recommendedCode} · {explorer.electiveFit.recommendedTitle} · {explorer.electiveFit.stream}
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {explorer.electiveFit.rationale.join(' · ')}
          </div>
        </Card>
      )}
    </div>
  )
}
