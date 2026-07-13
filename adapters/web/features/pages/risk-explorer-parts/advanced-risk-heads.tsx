import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiStudentRiskExplorer } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { HeadCard } from './shared'
import { renderHeadHelper, renderHeadValue } from './helpers'

export function AdvancedRiskHeads({ explorer }: { explorer: ApiStudentRiskExplorer }) {
  const headDisplays = explorer.trainedRiskHeadDisplays ?? {}
  const trainedHeads = [
    {
      key: 'attendanceRisk',
      label: 'Attendance / Eligibility',
      value: explorer.trainedRiskHeads.attendanceRiskProbScaled,
      helper: renderHeadHelper(headDisplays.attendanceRisk, 'Observable attendance risk only.'),
      display: headDisplays.attendanceRisk,
    },
    {
      key: 'ceRisk',
      label: 'CE Shortfall',
      value: explorer.trainedRiskHeads.ceRiskProbScaled,
      helper: renderHeadHelper(headDisplays.ceRisk, 'Checkpoint risk of falling below the CE floor.'),
      display: headDisplays.ceRisk,
    },
    {
      key: 'seeRisk',
      label: 'SEE Projection',
      value: explorer.trainedRiskHeads.seeRiskProbScaled,
      helper: renderHeadHelper(headDisplays.seeRisk, 'Checkpoint risk of SEE shortfall from observed signals.'),
      display: headDisplays.seeRisk,
    },
    {
      key: 'overallCourseRisk',
      label: 'Overall Course Fail',
      value: explorer.trainedRiskHeads.overallCourseRiskProbScaled,
      helper: renderHeadHelper(headDisplays.overallCourseRisk, 'Primary trained head for course-level failure pressure.'),
      display: headDisplays.overallCourseRisk,
    },
    {
      key: 'downstreamCarryoverRisk',
      label: 'Carryover',
      value: explorer.trainedRiskHeads.downstreamCarryoverRiskProbScaled,
      helper: renderHeadHelper(headDisplays.downstreamCarryoverRisk, 'Downstream adverse-pressure head over prerequisite chains.'),
      display: headDisplays.downstreamCarryoverRisk,
    },
  ]
  const derivedHeads = [
    { label: 'Semester SGPA Drop', value: explorer.derivedScenarioHeads.semesterSgpaDropRiskProbScaled, helper: 'Derived advisory index from trained course heads plus semester trend.' },
    { label: 'Cumulative CGPA Drop', value: explorer.derivedScenarioHeads.cumulativeCgpaDropRiskProbScaled, helper: 'Derived advisory index for running CGPA pressure.' },
    { label: 'Elective Mismatch', value: explorer.derivedScenarioHeads.electiveMismatchRiskProbScaled, helper: 'Derived advisory index for elective-fit mismatch pressure.' },
  ]

  return (
    <>
      <Card data-proof-section="trained-risk-heads" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Trained Risk Heads</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {trainedHeads.map(head => (
            <HeadCard
              key={head.key}
              label={head.label}
              value={renderHeadValue(head.display, head.value)}
              helper={head.helper}
              tone={head.display?.riskBand === 'High' || (head.value != null && head.value >= 70) ? 'danger' : head.display?.riskBand === 'Medium' || (head.value != null && head.value >= 35) ? 'warning' : 'success'}
            />
          ))}
        </div>
      </Card>

      <Card data-proof-section="derived-risk-heads" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Derived Scenario Heads</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={T.orange}>Advisory Index</Chip>
          <Chip color={T.dim}>{explorer.derivedScenarioHeads.scale}</Chip>
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{explorer.derivedScenarioHeads.supportWarning}</div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{explorer.derivedScenarioHeads.note}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {derivedHeads.map(head => (
            <HeadCard
              key={head.label}
              label={head.label}
              value={head.value == null ? 'NA' : `${head.value} pts`}
              helper={head.helper}
              tone={head.value != null && head.value >= 70 ? 'danger' : head.value != null && head.value >= 35 ? 'warning' : 'success'}
            />
          ))}
        </div>
      </Card>
    </>
  )
}
