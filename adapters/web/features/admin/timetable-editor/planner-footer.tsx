import type { Dispatch, SetStateAction } from 'react'
import { Save } from 'lucide-react'
import { T, mono } from '@web/simulation/fixtures'
import type { FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiAdminFacultyCalendarWorkspace } from '@web/shared/api/types'
import { Btn } from '@web/shared/ui/primitives'

export function PlannerFooter({
  dirty,
  saving,
  baseTemplate,
  baseWorkspace,
  setDraftTemplate,
  setDraftWorkspace,
  handleSave,
}: {
  dirty: boolean
  saving: boolean
  baseTemplate: FacultyTimetableTemplate
  baseWorkspace: ApiAdminFacultyCalendarWorkspace
  setDraftTemplate: Dispatch<SetStateAction<FacultyTimetableTemplate>>
  setDraftWorkspace: Dispatch<SetStateAction<ApiAdminFacultyCalendarWorkspace>>
  handleSave: () => Promise<void>
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
        Regular class blocks inherit the teacher-style drag board. Institutional markers stay separate so admin can place semester boundaries, test windows, holidays, and events without confusing them for actual teaching load.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn type="button" size="sm" variant="ghost" onClick={() => {
          setDraftTemplate(baseTemplate)
          setDraftWorkspace(baseWorkspace)
        }} disabled={!dirty || saving}>
          Reset
        </Btn>
        <Btn type="button" size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
          <Save size={12} /> {saving ? 'Saving…' : 'Save Planner'}
        </Btn>
      </div>
    </div>
  )
}
