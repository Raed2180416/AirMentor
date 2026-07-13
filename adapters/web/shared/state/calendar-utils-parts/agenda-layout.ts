import { DEFAULT_TASK_DURATION_MINUTES, MIN_EVENT_DURATION_MINUTES } from './constants'
import { clampMinuteValue, clampRangeToDayBounds, normalizeTimedRange, rangeOverlaps } from './time-scalars'
import type { ReflowedClassRange, TimedAgendaLayoutInput, TimedAgendaLayoutResult } from './types'

export function resolveTimedHoverRange(
  minute: number,
  items: Array<{ startMinutes: number; endMinutes: number }>,
  dayStartMinutes: number,
  dayEndMinutes: number,
  preferredDuration = DEFAULT_TASK_DURATION_MINUTES,
  minimumDuration = MIN_EVENT_DURATION_MINUTES,
) {
  const merged = [...items]
    .sort((left, right) => {
      if (left.startMinutes !== right.startMinutes) return left.startMinutes - right.startMinutes
      return left.endMinutes - right.endMinutes
    })
    .reduce<Array<{ startMinutes: number; endMinutes: number }>>((acc, item) => {
      if (acc.length === 0) return [{ startMinutes: item.startMinutes, endMinutes: item.endMinutes }]
      const previous = acc[acc.length - 1]
      if (item.startMinutes <= previous.endMinutes) {
        previous.endMinutes = Math.max(previous.endMinutes, item.endMinutes)
        return acc
      }
      acc.push({ startMinutes: item.startMinutes, endMinutes: item.endMinutes })
      return acc
    }, [])

  const occupied = merged.find(item => item.startMinutes <= minute && minute < item.endMinutes)
  if (occupied) return null

  let gapStartMinutes = dayStartMinutes
  let gapEndMinutes = dayEndMinutes

  for (const item of merged) {
    if (item.endMinutes <= minute) gapStartMinutes = Math.max(gapStartMinutes, item.endMinutes)
    if (item.startMinutes > minute) {
      gapEndMinutes = Math.min(gapEndMinutes, item.startMinutes)
      break
    }
  }

  const gapDuration = gapEndMinutes - gapStartMinutes
  if (gapDuration < minimumDuration) return null

  const duration = Math.max(minimumDuration, Math.min(preferredDuration, gapDuration))
  const startMinutes = clampMinuteValue(minute, gapStartMinutes, gapEndMinutes - duration)
  return {
    gapStartMinutes,
    gapEndMinutes,
    startMinutes,
    endMinutes: startMinutes + duration,
  }
}

export function buildTimeGuides(dayStartMinutes: number, dayEndMinutes: number, intervalMinutes = 60) {
  const start = Math.floor(dayStartMinutes / intervalMinutes) * intervalMinutes
  const guides: number[] = []
  for (let minute = start; minute <= dayEndMinutes; minute += intervalMinutes) {
    if (minute >= dayStartMinutes && minute <= dayEndMinutes) guides.push(minute)
  }
  if (!guides.includes(dayEndMinutes)) guides.push(dayEndMinutes)
  return guides
}

export function assignAgendaLanes<T extends TimedAgendaLayoutInput>(items: T[]): Array<TimedAgendaLayoutResult<T>> {
  const sorted = [...items].sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) return left.startMinutes - right.startMinutes
    if (left.endMinutes !== right.endMinutes) return left.endMinutes - right.endMinutes
    return left.id.localeCompare(right.id)
  })

  const output: Array<TimedAgendaLayoutResult<T>> = []
  let cluster: Array<T & { lane: number }> = []
  let active: Array<{ lane: number; endMinutes: number }> = []

  const flushCluster = () => {
    if (cluster.length === 0) return
    const laneCount = cluster.reduce((max, item) => Math.max(max, item.lane + 1), 1)
    cluster.forEach(item => output.push({ ...item, laneCount }))
    cluster = []
    active = []
  }

  sorted.forEach(item => {
    active = active.filter(entry => entry.endMinutes > item.startMinutes)
    if (cluster.length > 0 && active.length === 0) flushCluster()

    const occupiedLanes = new Set(active.map(entry => entry.lane))
    let lane = 0
    while (occupiedLanes.has(lane)) lane += 1

    cluster.push({ ...item, lane })
    active.push({ lane, endMinutes: item.endMinutes })
  })

  flushCluster()
  return output
}

export function reflowClassDayRanges<T extends { id: string; startMinutes: number; endMinutes: number }>(input: {
  blocks: T[]
  targetId: string
  desiredStartMinutes: number
  desiredEndMinutes: number
  dayStartMinutes: number
  dayEndMinutes: number
  snapThresholdMinutes?: number
}) {
  const target = input.blocks.find(block => block.id === input.targetId)
  if (!target) return null

  const minimumDuration = MIN_EVENT_DURATION_MINUTES
  const snapThresholdMinutes = input.snapThresholdMinutes ?? 14
  const durationById = Object.fromEntries(
    input.blocks.map(block => [block.id, Math.max(minimumDuration, block.endMinutes - block.startMinutes)]),
  ) as Record<string, number>

  const others = input.blocks
    .filter(block => block.id !== input.targetId)
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes || left.id.localeCompare(right.id))

  const desiredRange = normalizeTimedRange(
    input.desiredStartMinutes,
    input.desiredEndMinutes,
    input.dayStartMinutes,
    input.dayEndMinutes,
    minimumDuration,
  )
  const desiredTargetDuration = Math.max(minimumDuration, desiredRange.endMinutes - desiredRange.startMinutes)
  const totalOtherDuration = others.reduce((sum, block) => sum + durationById[block.id], 0)
  const maximumTargetDuration = Math.max(minimumDuration, input.dayEndMinutes - input.dayStartMinutes - totalOtherDuration)
  const targetDuration = Math.min(desiredTargetDuration, maximumTargetDuration)

  let snappedStartMinutes = desiredRange.startMinutes
  let snappedEndMinutes = desiredRange.startMinutes + targetDuration
  const desiredOverlaps = others.some(block => rangeOverlaps(desiredRange.startMinutes, desiredRange.startMinutes + targetDuration, block.startMinutes, block.endMinutes))
  if (!desiredOverlaps) {
    const snapCandidates = others.flatMap(block => [block.startMinutes, block.endMinutes])
    let bestSnapDistance = snapThresholdMinutes + 1
    snapCandidates.forEach(edge => {
      const startDistance = Math.abs(desiredRange.startMinutes - edge)
      if (startDistance < bestSnapDistance) {
        bestSnapDistance = startDistance
        snappedStartMinutes = edge
        snappedEndMinutes = edge + targetDuration
      }
      const endDistance = Math.abs((desiredRange.startMinutes + targetDuration) - edge)
      if (endDistance < bestSnapDistance) {
        bestSnapDistance = endDistance
        snappedStartMinutes = edge - targetDuration
        snappedEndMinutes = edge
      }
    })
  }

  const buildRanges = (candidateStartMinutes: number, candidateEndMinutes: number) => {
    const ordered = [...others, { id: input.targetId, startMinutes: candidateStartMinutes, endMinutes: candidateEndMinutes }]
      .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes || left.id.localeCompare(right.id))
    const targetIndex = ordered.findIndex(block => block.id === input.targetId)
    const previousBlocks = ordered.slice(0, targetIndex)
    const nextBlocks = ordered.slice(targetIndex + 1)

    const rangesById: Record<string, ReflowedClassRange> = {
      [input.targetId]: {
        startMinutes: candidateStartMinutes,
        endMinutes: candidateEndMinutes,
      },
    }

    let previousCursor = candidateStartMinutes
    for (let index = previousBlocks.length - 1; index >= 0; index -= 1) {
      const block = previousBlocks[index]
      const duration = durationById[block.id]
      const overlapsTarget = block.endMinutes > previousCursor
      const endMinutes = overlapsTarget ? previousCursor : block.endMinutes
      const startMinutes = endMinutes - duration
      rangesById[block.id] = { startMinutes, endMinutes }
      previousCursor = startMinutes
    }

    let nextCursor = candidateEndMinutes
    nextBlocks.forEach(block => {
      const duration = durationById[block.id]
      const overlapsTarget = block.startMinutes < nextCursor
      const startMinutes = overlapsTarget ? nextCursor : block.startMinutes
      const endMinutes = startMinutes + duration
      rangesById[block.id] = { startMinutes, endMinutes }
      nextCursor = endMinutes
    })

    const earliestStartMinutes = Math.min(...Object.values(rangesById).map(range => range.startMinutes))
    const latestEndMinutes = Math.max(...Object.values(rangesById).map(range => range.endMinutes))

    return {
      rangesById,
      earliestStartMinutes,
      latestEndMinutes,
    }
  }

  const snappedRange = clampRangeToDayBounds(
    snappedStartMinutes,
    snappedEndMinutes,
    input.dayStartMinutes,
    input.dayEndMinutes,
    targetDuration,
  )

  let candidateStartMinutes = snappedRange.startMinutes
  let candidateEndMinutes = snappedRange.endMinutes
  let resolved = buildRanges(candidateStartMinutes, candidateEndMinutes)

  for (let iteration = 0; iteration < input.blocks.length + 2; iteration += 1) {
    if (resolved.earliestStartMinutes >= input.dayStartMinutes && resolved.latestEndMinutes <= input.dayEndMinutes) break
    const shiftMinutes = resolved.earliestStartMinutes < input.dayStartMinutes
      ? input.dayStartMinutes - resolved.earliestStartMinutes
      : input.dayEndMinutes - resolved.latestEndMinutes
    const shifted = clampRangeToDayBounds(
      candidateStartMinutes + shiftMinutes,
      candidateEndMinutes + shiftMinutes,
      input.dayStartMinutes,
      input.dayEndMinutes,
      targetDuration,
    )
    candidateStartMinutes = shifted.startMinutes
    candidateEndMinutes = shifted.endMinutes
    resolved = buildRanges(candidateStartMinutes, candidateEndMinutes)
  }

  if (resolved.earliestStartMinutes < input.dayStartMinutes || resolved.latestEndMinutes > input.dayEndMinutes) return null

  const changedBlockIds = input.blocks
    .filter(block => {
      const nextRange = resolved.rangesById[block.id]
      return nextRange.startMinutes !== block.startMinutes || nextRange.endMinutes !== block.endMinutes
    })
    .map(block => block.id)

  return {
    rangesById: resolved.rangesById,
    changedBlockIds,
    targetRange: resolved.rangesById[input.targetId],
  }
}
