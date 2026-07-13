import type { Offering } from '@web/simulation/fixtures'
import type { FacultyTimetableClassBlock, FacultyTimetableTemplate, Weekday } from '@kernel/shared/domain'
import { classBlockOccursOnDate, reflowClassDayRanges } from '@web/shared/state/calendar-utils'
import type { ExtraClassDraft, InteractionPreview } from './types'

export function applyClassChangeToTemplate(current: FacultyTimetableTemplate, blockId: string, preview: InteractionPreview): FacultyTimetableTemplate {
  const block = current.classBlocks.find(item => item.id === blockId)
  if (!block) return current
  const nextBlock: FacultyTimetableClassBlock = {
    ...block,
    day: preview.day,
    dateISO: block.kind === 'extra' ? preview.dateISO : undefined,
    startMinutes: preview.startMinutes,
    endMinutes: preview.endMinutes,
  }
  const collisionPool = current.classBlocks.filter(item => item.id === blockId || classBlockOccursOnDate(item, preview.dateISO, preview.day))
  const reflowed = reflowClassDayRanges({
    blocks: collisionPool.map(item => item.id === blockId ? nextBlock : item),
    targetId: blockId,
    desiredStartMinutes: preview.startMinutes,
    desiredEndMinutes: preview.endMinutes,
    dayStartMinutes: current.dayStartMinutes,
    dayEndMinutes: current.dayEndMinutes,
    snapThresholdMinutes: 14,
  })
  if (!reflowed) return current
  return {
    ...current,
    updatedAt: Date.now(),
    classBlocks: current.classBlocks.map(item => {
      if (!reflowed.rangesById[item.id] && item.id !== blockId) return item
      const range = reflowed.rangesById[item.id]
      if (item.id === blockId) {
        return {
          ...nextBlock,
          startMinutes: range?.startMinutes ?? preview.startMinutes,
          endMinutes: range?.endMinutes ?? preview.endMinutes,
        }
      }
      if (!range) return item
      return {
        ...item,
        startMinutes: range.startMinutes,
        endMinutes: range.endMinutes,
      }
    }),
  }
}

export function applyClassResizeToTemplate(current: FacultyTimetableTemplate, blockId: string, preview: InteractionPreview): FacultyTimetableTemplate {
  const block = current.classBlocks.find(item => item.id === blockId)
  if (!block) return current
  const nextBlock: FacultyTimetableClassBlock = {
    ...block,
    startMinutes: preview.startMinutes,
    endMinutes: preview.endMinutes,
  }
  const focusDateISO = block.dateISO ?? preview.dateISO
  const collisionPool = current.classBlocks.filter(item => item.id === blockId || classBlockOccursOnDate(item, focusDateISO, block.day))
  const reflowed = reflowClassDayRanges({
    blocks: collisionPool.map(item => item.id === blockId ? nextBlock : item),
    targetId: blockId,
    desiredStartMinutes: preview.startMinutes,
    desiredEndMinutes: preview.endMinutes,
    dayStartMinutes: current.dayStartMinutes,
    dayEndMinutes: current.dayEndMinutes,
    snapThresholdMinutes: 14,
  })
  if (!reflowed) return current
  return {
    ...current,
    updatedAt: Date.now(),
    classBlocks: current.classBlocks.map(item => {
      const range = reflowed.rangesById[item.id]
      if (item.id === blockId) {
        return {
          ...item,
          startMinutes: range?.startMinutes ?? preview.startMinutes,
          endMinutes: range?.endMinutes ?? preview.endMinutes,
        }
      }
      if (!range) return item
      return {
        ...item,
        startMinutes: range.startMinutes,
        endMinutes: range.endMinutes,
      }
    }),
  }
}

export function buildTemplateAfterExtraClassSave(
  current: FacultyTimetableTemplate,
  params: {
    mode: 'create' | 'edit'
    draft: ExtraClassDraft
    offering: Offering
    day: Weekday
    normalized: { startMinutes: number; endMinutes: number }
    facultyId: string
  },
): FacultyTimetableTemplate {
  const { mode, draft, offering, day, normalized, facultyId } = params
  if (mode === 'edit' && draft.blockId) {
    return {
      ...current,
      updatedAt: Date.now(),
      classBlocks: current.classBlocks.map(block => block.id === draft.blockId ? ({
        ...block,
        offeringId: offering.offId,
        courseCode: offering.code,
        courseName: offering.title,
        section: offering.section,
        year: offering.year,
        day,
        dateISO: draft.dateISO,
        kind: 'extra' as const,
        startMinutes: normalized.startMinutes,
        endMinutes: normalized.endMinutes,
      }) : block),
    }
  }
  const nextBlock: FacultyTimetableClassBlock = {
    id: `extra-${offering.offId}-${Date.now()}`,
    facultyId,
    offeringId: offering.offId,
    courseCode: offering.code,
    courseName: offering.title,
    section: offering.section,
    year: offering.year,
    day,
    dateISO: draft.dateISO,
    kind: 'extra',
    startMinutes: normalized.startMinutes,
    endMinutes: normalized.endMinutes,
  }
  return {
    ...current,
    updatedAt: Date.now(),
    classBlocks: [
      ...current.classBlocks,
      nextBlock,
    ],
  }
}
