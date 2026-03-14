import { describe, expect, it } from 'vitest'
import { getStudents, OFFERINGS } from '../src/data'
import { getNextScheduledDate } from '../src/domain'
import {
  addBlueprintPart,
  addBlueprintQuestion,
  canonicalizeBlueprintStructure,
  createAppSelectors,
  defaultSchemeForOffering,
  normalizeSchemeState,
  removeBlueprintPart,
  removeBlueprintQuestion,
} from '../src/selectors'

const cs401a = OFFERINGS.find(offering => offering.code === 'CS401' && offering.section === 'A') ?? OFFERINGS[0]

function buildBlueprintFixture() {
  return canonicalizeBlueprintStructure('tt1', {
    kind: 'tt1',
    totalMarks: 25,
    updatedAt: 1,
    nodes: [
      {
        id: 'legacy-q-1',
        label: 'Section A',
        text: 'Alpha question',
        maxMarks: 10,
        cos: [],
        children: [
          { id: 'legacy-q-1-p-1', label: 'A(i)', text: 'Alpha part 1', maxMarks: 4, cos: ['CO1'] },
          { id: 'legacy-q-1-p-2', label: 'A(ii)', text: 'Alpha part 2', maxMarks: 6, cos: ['CO2'] },
        ],
      },
      {
        id: 'legacy-q-2',
        label: 'Section B',
        text: 'Beta question',
        maxMarks: 8,
        cos: [],
        children: [
          { id: 'legacy-q-2-p-1', label: 'B(i)', text: 'Beta part 1', maxMarks: 8, cos: ['CO3'] },
        ],
      },
      {
        id: 'legacy-q-3',
        label: 'Section C',
        text: 'Gamma question',
        maxMarks: 7,
        cos: [],
        children: [
          { id: 'legacy-q-3-p-1', label: 'C(i)', text: 'Gamma part 1', maxMarks: 3, cos: ['CO4'] },
          { id: 'legacy-q-3-p-2', label: 'C(ii)', text: 'Gamma part 2', maxMarks: 4, cos: ['CO5'] },
        ],
      },
    ],
  })
}

function collectBlueprintIds(blueprint: ReturnType<typeof buildBlueprintFixture>) {
  const questionIds = blueprint.nodes.map(node => node.id)
  const partIds = blueprint.nodes.flatMap(node => (node.children ?? []).map(child => child.id))
  return [...questionIds, ...partIds]
}

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

  it('renumbers questions canonically after removing a middle question and adding a new one', () => {
    const base = buildBlueprintFixture()
    const afterRemoval = removeBlueprintQuestion('tt1', base, base.nodes[1].id)
    const afterAdd = addBlueprintQuestion('tt1', afterRemoval, 'CO6')

    expect(afterAdd.nodes.map(node => node.id)).toEqual(['tt1-q1', 'tt1-q2', 'tt1-q3'])
    expect(afterAdd.nodes.map(node => node.label)).toEqual(['Q1', 'Q2', 'Q3'])
    expect(afterAdd.nodes[0].text).toBe('Alpha question')
    expect(afterAdd.nodes[1].text).toBe('Gamma question')
    expect(afterAdd.nodes[1].children?.map(child => child.label)).toEqual(['Q2a', 'Q2b'])
    expect(afterAdd.nodes[2].children?.[0].cos).toEqual(['CO6'])

    const ids = collectBlueprintIds(afterAdd)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('renumbers parts canonically after removing a middle part and adding a new one', () => {
    const base = canonicalizeBlueprintStructure('tt1', {
      kind: 'tt1',
      totalMarks: 15,
      updatedAt: 1,
      nodes: [
        {
          id: 'legacy-q-1',
          label: 'Question A',
          text: 'Composite question',
          maxMarks: 15,
          cos: [],
          children: [
            { id: 'legacy-p-1', label: 'A', text: 'Part 1', maxMarks: 5, cos: ['CO1'] },
            { id: 'legacy-p-2', label: 'B', text: 'Part 2', maxMarks: 5, cos: ['CO2'] },
            { id: 'legacy-p-3', label: 'C', text: 'Part 3', maxMarks: 5, cos: ['CO3'] },
          ],
        },
      ],
    })

    const questionId = base.nodes[0].id
    const partId = base.nodes[0].children?.[1].id ?? ''
    const afterRemoval = removeBlueprintPart('tt1', base, questionId, partId)
    const afterAdd = addBlueprintPart('tt1', afterRemoval, questionId, 'CO9')
    const parts = afterAdd.nodes[0].children ?? []

    expect(parts.map(part => part.id)).toEqual(['tt1-q1-p1', 'tt1-q1-p2', 'tt1-q1-p3'])
    expect(parts.map(part => part.label)).toEqual(['Q1a', 'Q1b', 'Q1c'])
    expect(parts[0].text).toBe('Part 1')
    expect(parts[1].text).toBe('Part 3')
    expect(parts[0].cos).toEqual(['CO1'])
    expect(parts[1].cos).toEqual(['CO3'])
    expect(parts[2].cos).toEqual(['CO1'])

    const ids = collectBlueprintIds(afterAdd)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps blueprint ids unique across repeated add and remove cycles', () => {
    let current = buildBlueprintFixture()

    current = addBlueprintQuestion('tt1', current, 'CO7')
    current = removeBlueprintQuestion('tt1', current, current.nodes[1].id)
    current = addBlueprintPart('tt1', current, current.nodes[0].id, 'CO8')
    current = removeBlueprintPart('tt1', current, current.nodes[0].id, current.nodes[0].children?.[1].id ?? '')
    current = addBlueprintQuestion('tt1', current, 'CO9')

    expect(current.nodes.map(node => node.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
    expect(current.nodes[0].children?.map(part => part.label)).toEqual(['Q1a', 'Q1b'])
    expect(current.nodes[1].text).toBe('Gamma question')

    const ids = collectBlueprintIds(current)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
