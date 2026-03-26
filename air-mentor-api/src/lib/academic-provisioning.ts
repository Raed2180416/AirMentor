export type ProvisioningCourseShape = {
  title: string
  assessmentProfile: string
  credits: number
}

export type FacultyLoadTemplateEntry = {
  offeringId: string
  courseCode: string
  courseName: string
  sectionCode: string
  semesterNumber: number
  weeklyHours: number
}

function isLabLikeCourse(course: Pick<ProvisioningCourseShape, 'title' | 'assessmentProfile'>) {
  const haystack = `${course.title} ${course.assessmentProfile}`.toLowerCase()
  return haystack.includes('lab') || haystack.includes('project') || haystack.includes('workshop')
}

function stableUnit(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10_000) / 10_000
}

export function weeklyContactHoursForCourse(course: ProvisioningCourseShape) {
  const totalContactHours = course.credits * (isLabLikeCourse(course) ? 30 : 15)
  return Math.max(2, Math.round(totalContactHours / 16))
}

export function buildFacultyTimetableTemplates(loadsByFacultyId: Map<string, FacultyLoadTemplateEntry[]>) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
  const slots = [
    { id: 'slot_1', label: '08:30-09:30', startTime: '08:30', endTime: '09:30' },
    { id: 'slot_2', label: '09:30-10:30', startTime: '09:30', endTime: '10:30' },
    { id: 'slot_3', label: '10:45-11:45', startTime: '10:45', endTime: '11:45' },
    { id: 'slot_4', label: '11:45-12:45', startTime: '11:45', endTime: '12:45' },
    { id: 'slot_5', label: '13:30-14:30', startTime: '13:30', endTime: '14:30' },
    { id: 'slot_6', label: '14:30-15:30', startTime: '14:30', endTime: '15:30' },
  ] as const
  const result: Record<string, Record<string, unknown>> = {}

  for (const [facultyId, entries] of loadsByFacultyId.entries()) {
    const classBlocks: Array<Record<string, unknown>> = []
    const orderedEntries = [...entries].sort((left, right) => (
      left.semesterNumber - right.semesterNumber
      || left.courseCode.localeCompare(right.courseCode)
      || left.sectionCode.localeCompare(right.sectionCode)
      || left.offeringId.localeCompare(right.offeringId)
    ))
    const occupiedPositions = new Set<string>()
    const dayLoad = new Map(weekdays.map(day => [day, 0]))
    const dayOffset = Math.floor(stableUnit(`timetable-day-${facultyId}`) * weekdays.length) % weekdays.length
    const slotOffset = Math.floor(stableUnit(`timetable-slot-${facultyId}`) * slots.length) % slots.length
    const orderedDays = weekdays.slice(dayOffset).concat(weekdays.slice(0, dayOffset))

    const takeNextFreePosition = (usedDaysForEntry: Set<string>) => {
      const preferredDays = [...orderedDays].sort((left, right) => {
        const leftPenalty = usedDaysForEntry.has(left) ? 1 : 0
        const rightPenalty = usedDaysForEntry.has(right) ? 1 : 0
        if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty
        return (dayLoad.get(left) ?? 0) - (dayLoad.get(right) ?? 0)
      })
      for (const day of preferredDays) {
        for (let offset = 0; offset < slots.length; offset += 1) {
          const slot = slots[(slotOffset + offset) % slots.length]!
          const key = `${day}:${slot.id}`
          if (occupiedPositions.has(key)) continue
          occupiedPositions.add(key)
          dayLoad.set(day, (dayLoad.get(day) ?? 0) + 1)
          return { day, slot }
        }
      }
      throw new Error(`Timetable builder exhausted weekly slot capacity for ${facultyId}`)
    }

    orderedEntries.forEach(entry => {
      const repeatCount = Math.max(1, Math.min(3, entry.weeklyHours))
      const usedDaysForEntry = new Set<string>()
      for (let blockIndex = 0; blockIndex < repeatCount; blockIndex += 1) {
        const position = takeNextFreePosition(usedDaysForEntry)
        const { day, slot } = position
        usedDaysForEntry.add(day)
        classBlocks.push({
          id: `${facultyId}_${entry.offeringId}_${blockIndex + 1}`,
          facultyId,
          offeringId: entry.offeringId,
          courseCode: entry.courseCode,
          courseName: entry.courseName,
          section: entry.sectionCode,
          year: `${Math.ceil(entry.semesterNumber / 2)} Year`,
          day,
          kind: 'regular',
          startMinutes: Number(slot.startTime.slice(0, 2)) * 60 + Number(slot.startTime.slice(3, 5)),
          endMinutes: Number(slot.endTime.slice(0, 2)) * 60 + Number(slot.endTime.slice(3, 5)),
          slotId: slot.id,
          slotSpan: 1,
        })
      }
    })

    result[facultyId] = {
      facultyId,
      slots,
      dayStartMinutes: 8 * 60 + 30,
      dayEndMinutes: 15 * 60 + 30,
      classBlocks,
      updatedAt: Date.now(),
    }
  }

  return result
}
