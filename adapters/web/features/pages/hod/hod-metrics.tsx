import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAcademicHodProofSummary } from '@web/shared/api/types'
import { Card, Chip } from '@web/shared/ui/primitives'
import { MetricCard } from '@web/features/admin/system-admin-ui'
import { formatHours, type HodTabId } from './hod-helpers'

export function HodMetrics({
  summary,
  setActiveTab,
  setShowActionNeededOnly,
  setOverviewRiskFilter,
  setFacultyFilter,
}: {
  summary: ApiAcademicHodProofSummary
  setActiveTab: React.Dispatch<React.SetStateAction<HodTabId>>
  setShowActionNeededOnly: React.Dispatch<React.SetStateAction<boolean>>
  setOverviewRiskFilter: React.Dispatch<React.SetStateAction<'all' | 'high' | 'medium'>>
  setFacultyFilter: React.Dispatch<React.SetStateAction<'all' | 'overloaded'>>
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <MetricCard
          label="Students Covered"
          value={String(summary.totals.studentsCovered)}
          helper="Students visible in the active HoD scope."
          onClick={() => {
            setActiveTab('overview')
            setShowActionNeededOnly(false)
            setOverviewRiskFilter('all')
          }}
        />
        <MetricCard
          label="High Watch"
          value={String(summary.totals.highRiskCount)}
          helper="Current high-priority watchlist count for the active semester."
          onClick={() => {
            setActiveTab('overview')
            setShowActionNeededOnly(false)
            setOverviewRiskFilter('high')
          }}
        />
        <MetricCard
          label="Medium Watch"
          value={String(summary.totals.mediumRiskCount)}
          helper="Students requiring review but not yet in the highest watch band."
          onClick={() => {
            setActiveTab('overview')
            setShowActionNeededOnly(false)
            setOverviewRiskFilter('medium')
          }}
        />
        <MetricCard
          label="Open Reassessments"
          value={String(summary.monitoringSummary.activeReassessmentCount)}
          helper="Read-only count of currently open reassessment events."
          onClick={() => setActiveTab('reassessments')}
        />
        <MetricCard
          label="Capacity Deferred"
          value={String(summary.totals.deferredQueueCount ?? 0)}
          helper="Risk rows kept visible for HoD/admin pressure tracking after watch capacity is full."
          onClick={() => {
            setActiveTab('overview')
            setShowActionNeededOnly(false)
            setOverviewRiskFilter('all')
          }}
        />
        <MetricCard
          label="Unresolved Alerts"
          value={String(summary.totals.unresolvedAlertCount)}
          helper="Alert decisions without acknowledgement in the current active run."
          onClick={() => setActiveTab('reassessments')}
        />
        <MetricCard
          label="Average Queue Age"
          value={formatHours(summary.totals.averageQueueAgeHours)}
          helper="Mean age of open reassessments in the current view."
          onClick={() => setActiveTab('reassessments')}
        />
        <MetricCard
          label="Faculty In Scope"
          value={String(summary.facultyLoadSummary.facultyCount)}
          helper="Faculty rows visible in the supervised proof scope."
          onClick={() => {
            setActiveTab('faculty')
            setFacultyFilter('all')
          }}
        />
        <MetricCard
          label="Overload Flags"
          value={String(summary.facultyLoadSummary.overloadedFacultyCount)}
          helper="Faculty load profiles exceeding the current semester threshold."
          onClick={() => {
            setActiveTab('faculty')
            setFacultyFilter('overloaded')
          }}
        />
      </div>

      <Card
        data-proof-section="hod-capacity-summary"
        style={{
          padding: 16,
          display: 'grid',
          gap: 12,
          background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surface2} 100%)`,
          borderLeft: `4px solid ${T.accent}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Capacity Governance Summary</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
              Risk-flagged students vs. active queue capacity across all sections
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(() => {
              const flaggedHigh = summary.totals.highRiskCount
              const flaggedMedium = summary.totals.mediumRiskCount
              const deferred = summary.totals.deferredQueueCount ?? 0
              const activeReassessments = summary.monitoringSummary.activeReassessmentCount
              const capacityLimit = 60
              const utilizationPct = Math.round((activeReassessments / capacityLimit) * 100)
              return (
                <>
                  <Chip color={T.danger}>{`${flaggedHigh} flagged High`}</Chip>
                  <Chip color={T.warning}>{`${flaggedMedium} flagged Medium`}</Chip>
                  <Chip color={T.accent}>{`${activeReassessments} active (capacity: ${capacityLimit})`}</Chip>
                  <Chip color={T.accent}>{`${deferred} deferred`}</Chip>
                  <Chip color={utilizationPct > 80 ? T.danger : utilizationPct > 50 ? T.warning : T.success}>
                    {`${utilizationPct}% utilized`}
                  </Chip>
                </>
              )
            })()}
          </div>
        </div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
          <strong>Policy:</strong> Queue admissions are risk-score sorted. High-risk students receive priority.
          When capacity is exceeded, lower-risk cases are deferred (remain visible for tracking without creating teacher workload).
        </div>
      </Card>
    </>
  )
}
