import type { TimetableSlotDefinition } from '@kernel/shared/domain'
import { timeStringToMinutes } from './time-scalars'

export function getSlotMap(slots: TimetableSlotDefinition[]) {
  return Object.fromEntries(slots.map(slot => [slot.id, slot])) as Record<string, TimetableSlotDefinition>
}

export function clampSlotSpan(slotId: string, slotSpan: number, slots: TimetableSlotDefinition[]) {
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return 1
  return Math.max(1, Math.min(Math.max(1, Math.round(slotSpan)), slots.length - startIndex))
}

export function getSpannedSlotIds(slotId: string, slotSpan: number, slots: TimetableSlotDefinition[]) {
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return [slotId]
  return slots.slice(startIndex, startIndex + clampSlotSpan(slotId, slotSpan, slots)).map(slot => slot.id)
}

// Internal shared helper — used by ../calendar-utils-parts siblings. Not re-exported by the barrel.
export function resolveLegacySlotRange(slotId: string | undefined, slotSpan: number | undefined, slots: TimetableSlotDefinition[]) {
  if (!slotId) return null
  const startIndex = slots.findIndex(slot => slot.id === slotId)
  if (startIndex < 0) return null
  const span = clampSlotSpan(slotId, Math.max(1, Math.round(slotSpan ?? 1)), slots)
  const startSlot = slots[startIndex]
  const endSlot = slots[Math.min(slots.length - 1, startIndex + span - 1)]
  return {
    startMinutes: timeStringToMinutes(startSlot.startTime),
    endMinutes: timeStringToMinutes(endSlot.endTime),
  }
}
