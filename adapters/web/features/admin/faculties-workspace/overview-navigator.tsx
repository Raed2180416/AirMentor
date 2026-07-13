import { T, mono, sora } from '@web/simulation/fixtures'
import { Card } from '@web/shared/ui/primitives'
import type { ApiAcademicFaculty, ApiBatch, ApiBranch, ApiDepartment } from '@web/shared/api/types'
import { deriveCurrentYearLabel, type LiveAdminRoute } from '../system-admin-live-data'
import type { TabCard } from './types'

type OverviewNavigatorProps = {
  universityTab: string
  selectedSectionCode: string | null
  universityLevelTitle: string
  universityLevelHelper: string
  selectedBatch: ApiBatch | null
  branchBatches: ApiBatch[]
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
  selectedBranch: ApiBranch | null
  navigate: (route: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
}

export function OverviewNavigator({
  universityTab,
  selectedSectionCode,
  universityLevelTitle,
  universityLevelHelper,
  selectedBatch,
  branchBatches,
  selectedAcademicFaculty,
  selectedDepartment,
  selectedBranch,
  navigate,
}: OverviewNavigatorProps) {
  return universityTab === 'overview' ? (
    <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 10 }}>
      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Hierarchy Navigator · {selectedSectionCode ? 'Section' : universityLevelTitle}</div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
        {universityLevelHelper}
      </div>
      {selectedBatch ? (
        <Card style={{ padding: 14, background: T.surface }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {selectedSectionCode
              ? 'No further hierarchy level exists below section. Use the tabs above or jump into the scoped student or faculty pages below.'
              : 'The next-level cards appear here as soon as the current level on the left is selected.'}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {branchBatches.length === 0 ? (
            <Card style={{ padding: 14, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                The next-level cards appear here as soon as the current level on the left is selected.
              </div>
            </Card>
          ) : branchBatches.map(batch => (
            <button key={batch.batchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch?.branchId, batchId: batch.batchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{`Batch ${batch.batchLabel} · sections ${batch.sectionLabels.join(', ')}`}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  ) : null
}

type YearEditorsProps = {
  universityTab: string
  selectedBatch: ApiBatch | null
  universityWorkspaceTabCards: TabCard[]
  updateUniversityTab: (tabId: string, options?: { recordHistory?: boolean }) => void
}

export function YearEditors({
  universityTab,
  selectedBatch,
  universityWorkspaceTabCards,
  updateUniversityTab,
}: YearEditorsProps) {
  return universityTab === 'overview' && selectedBatch && universityWorkspaceTabCards.length > 0 ? (
    <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 12 }}>
      <div>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Year Editors</div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
          These cards open the exact edit surface for the selected year, so you land on the real controls instead of hunting through the overview.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {universityWorkspaceTabCards.map(tab => (
          <button
            key={`workspace:${tab.id}`}
            type="button"
            data-pressable="true"
            onClick={() => updateUniversityTab(tab.id)}
            style={{
              textAlign: 'left',
              borderRadius: 14,
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '14px 16px',
              display: 'grid',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.accent }}>
              {tab.icon}
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{tab.label}</div>
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{tab.description}</div>
            <div style={{ ...mono, fontSize: 10, color: T.accentLight, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open Editor</div>
          </button>
        ))}
      </div>
    </Card>
  ) : null
}
