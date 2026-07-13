import { Save } from 'lucide-react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarker } from '@web/shared/api/types'
import { Btn, Card, Chip } from '@web/shared/ui/primitives'
import { InfoBanner } from '@web/features/admin/system-admin-ui'
import { formatMarkerWindow, markerTypeLabel } from './calendar-workspace-helpers'

export function CalendarWorkspaceMarkersPanel({
  upcomingMarkers,
  dirty,
  saving,
  onReset,
  onSave,
  onEditMarker,
}: {
  upcomingMarkers: ApiAdminCalendarMarker[]
  dirty: boolean
  saving: boolean
  onReset: () => void
  onSave: () => void
  onEditMarker: (marker: ApiAdminCalendarMarker) => void
}) {
  return (
    <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Institution Markers</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
            Marker edits stay explicit here and also open from the shared calendar detail sheet.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn type="button" size="sm" variant="ghost" onClick={onReset} disabled={!dirty || saving}>Reset</Btn>
          <Btn type="button" size="sm" onClick={onSave} disabled={!dirty || saving}>
            <Save size={12} /> {saving ? 'Saving…' : 'Save Planner'}
          </Btn>
        </div>
      </div>

      {upcomingMarkers.length === 0 ? (
        <InfoBanner message="No semester markers, holiday closures, or university events are mapped yet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {upcomingMarkers.map(marker => (
            <Card key={marker.markerId} style={{ padding: 14, background: T.surface2, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{marker.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{markerTypeLabel(marker.markerType)} · {formatMarkerWindow(marker)}</div>
                </div>
                <Chip color={marker.color} size={9}>{marker.allDay ? 'All day' : 'Timed'}</Chip>
              </div>
              {marker.note ? <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.8 }}>{marker.note}</div> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn type="button" size="sm" variant="ghost" onClick={() => onEditMarker(marker)}>Edit Marker</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  )
}
