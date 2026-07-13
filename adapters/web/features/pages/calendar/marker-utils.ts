import { T } from '@web/simulation/fixtures'
import type { ApiAdminCalendarMarker } from '@web/shared/api/types'

export function markerSpansDate(marker: ApiAdminCalendarMarker, dateISO: string) {
  const canSpanRange = marker.markerType === 'holiday' || marker.markerType === 'event'
  if (!canSpanRange || !marker.endDateISO || marker.endDateISO === marker.dateISO) return marker.dateISO === dateISO
  return marker.dateISO <= dateISO && marker.endDateISO >= dateISO
}

export function describeMarkerType(markerType: ApiAdminCalendarMarker['markerType']) {
  if (markerType === 'semester-start') return 'Semester Start'
  if (markerType === 'semester-end') return 'Semester End'
  if (markerType === 'term-test-start') return 'Term Test Start'
  if (markerType === 'term-test-end') return 'Term Test End'
  if (markerType === 'holiday') return 'Holiday'
  return 'Event'
}

export function markerAccent(markerType: ApiAdminCalendarMarker['markerType']) {
  if (markerType === 'semester-start') return T.success
  if (markerType === 'semester-end') return T.orange
  if (markerType === 'term-test-start' || markerType === 'term-test-end') return T.warning
  if (markerType === 'holiday') return T.danger
  return T.blue
}
