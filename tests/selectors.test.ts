import { describe, expect, it } from 'vitest'
import { getStudents, OFFERINGS } from '../src/data'
import { getNextScheduledDate } from '../src/domain'
import { createAppSelectors, defaultSchemeForOffering, normalizeSchemeState } from '../src/selectors'

const cs401a = OFFERINGS.find(offering => offering.code === 'CS401' && offering.section === 'A') ?? OFFERINGS[0]

describe('selectors', () => {
  it('applies patched attendance and finals data from React-owned state', () => {
    const originalStudents = getStudents(cs401a)
    const targetStudent = originalStudents[0]
    const selectors = createAppSelectors({
      studentPatches: {
        [`${cs401a.offId}::${targetStudent.id}`]: {
          present: 0,
          totalClasses: 20,
          seeScore: 41,
        },
      },
      schemeByOffering: {
        [cs401a.offId]: defaultSchemeForOffering(cs401a),
      },
      ttBlueprintsByOffering: {},
    })

    const students = selectors.getStudentsPatched(cs401a)
    const patchedStudent = students.find(student => student.id === targetStudent.id)

    expect(patchedStudent?.present).toBe(0)
    expect(patchedStudent?.totalClasses).toBe(20)

    const projected = selectors.deriveAcademicProjection({ offering: cs401a, student: patchedStudent ?? students[0] })
    expect(projected.seeRaw).toBe(41)
    expect(selectors.getOfferingAttendancePatched(cs401a)).toBe(
      Math.round(students.reduce((acc, student) => acc + (student.present / Math.max(1, student.totalClasses)) * 100, 0) / students.length),
    )
  })

  it('normalizes scheme counts and clamps component definitions', () => {
    const normalized = normalizeSchemeState({
      finalsMax: 100,
      quizCount: 2,
      assignmentCount: 1,
      quizComponents: [
        { id: 'quiz-a', label: 'Quiz A', rawMax: 0 },
        { id: 'quiz-b', label: '', rawMax: 240 },
      ],
      assignmentComponents: [
        { id: 'assignment-a', label: '', rawMax: -5 },
      ],
      status: 'Configured',
    }, cs401a)

    expect(normalized.quizComponents).toEqual([
      { id: 'quiz-a', label: 'Quiz A', rawMax: 1 },
      { id: 'quiz-b', label: 'Quiz 2', rawMax: 100 },
    ])
    expect(normalized.assignmentComponents).toEqual([
      { id: 'assignment-a', label: 'Assignment 1', rawMax: 1 },
    ])
    expect(normalized.status).toBe('Configured')
  })

  it('advances scheduled recurrence using the v1 scheduling rules', () => {
    expect(getNextScheduledDate({
      mode: 'scheduled',
      preset: 'weekly',
      status: 'active',
      nextDueDateISO: '2026-03-10',
    }, '2026-03-10')).toBe('2026-03-17')

    expect(getNextScheduledDate({
      mode: 'scheduled',
      preset: 'custom dates',
      status: 'active',
      completedDatesISO: ['2026-03-20'],
      customDates: [
        { dateISO: '2026-03-20' },
        { dateISO: '2026-03-24' },
        { dateISO: '2026-03-28' },
      ],
      nextDueDateISO: '2026-03-18',
    }, '2026-03-18')).toBe('2026-03-24')
  })
})
