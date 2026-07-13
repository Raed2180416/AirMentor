import { describe, expect, it } from 'vitest'
import { getStudents, OFFERINGS } from '@web/simulation/fixtures'
import { getNextScheduledDate } from '@kernel/shared/domain'
import {
  addBlueprintPart,
  addBlueprintQuestion,
  canonicalizeBlueprintStructure,
  computeCoAttainmentRows,
  createAppSelectors,
  defaultSchemeForOffering,
  flattenBlueprintLeaves,
  normalizeSchemeState,
  removeBlueprintPart,
  removeBlueprintQuestion,
  seedTermTestLeafScores,
} from '@web/shared/state/selectors'

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
  it('does not fall back to seeded students when live projections omit an offering', () => {
    const selectors = createAppSelectors({
      studentPatches: {},
      schemeByOffering: {
        [cs401a.offId]: defaultSchemeForOffering(cs401a),
      },
      ttBlueprintsByOffering: {},
      studentSourceMode: 'live',
      studentsByOffering: {},
    })

    expect(selectors.getStudentsPatched(cs401a)).toEqual([])
  })

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
      studentSourceMode: 'seeded',
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

  it('recomputes patched risk band and driver cards from patched attendance and TT scores', () => {
    const baseStudent = getStudents(cs401a)[0]
    const blueprint = buildBlueprintFixture()
    const zeroTt1Scores = Object.fromEntries(flattenBlueprintLeaves(blueprint.nodes).map(leaf => [leaf.id, 0]))
    const controlledStudent = {
      ...baseStudent,
      id: 'risk-recompute-student',
      present: 45,
      totalClasses: 45,
      tt1Score: 23,
      tt1Max: 25,
      prevCgpa: 8.4,
      riskProb: 0.05,
      riskBand: 'Low' as const,
      reasons: [],
      coScores: [
        { coId: 'CO1', attainment: 92 },
        { coId: 'CO2', attainment: 88 },
      ],
      whatIf: [],
      flags: { backlog: false, lowAttendance: false, declining: false },
    }
    const selectors = createAppSelectors({
      studentPatches: {
        [`${cs401a.offId}::risk-recompute-student`]: {
          present: 9,
          totalClasses: 45,
          tt1LeafScores: zeroTt1Scores,
        },
      },
      schemeByOffering: {
        [cs401a.offId]: defaultSchemeForOffering(cs401a),
      },
      ttBlueprintsByOffering: {
        [cs401a.offId]: {
          tt1: blueprint,
          tt2: { ...blueprint, kind: 'tt2' },
        },
      },
      studentsByOffering: {
        [cs401a.offId]: [controlledStudent],
      },
      studentSourceMode: 'seeded',
    })

    const patchedStudent = selectors.getStudentsPatched(cs401a)[0]

    expect(patchedStudent.present).toBe(9)
    expect(patchedStudent.tt1Score).toBe(0)
    expect(patchedStudent.riskBand).toBe('High')
    expect(patchedStudent.riskProb).toBeGreaterThanOrEqual(0.7)
    expect(patchedStudent.flags.lowAttendance).toBe(true)
    expect(patchedStudent.coScores.find(co => co.coId === 'CO1')?.attainment).toBe(0)
    expect(patchedStudent.reasons.map(reason => reason.feature)).toEqual(
      expect.arrayContaining(['attendance', 'tt1', 'co']),
    )
    expect(patchedStudent.whatIf.map(item => item.label)).toEqual(
      expect.arrayContaining(['Improve attendance to 75%', 'CO1 attainment >= 50% in TT2']),
    )
  })

  it('normalizes scheme counts and clamps component definitions', () => {
    const normalized = normalizeSchemeState({
      finalsMax: 100,
      quizCount: 2,
      assignmentCount: 1,
      quizComponents: [
        { id: 'quiz-a', label: 'Quiz A', rawMax: 0, weightage: 0 },
        { id: 'quiz-b', label: '', rawMax: 240, weightage: 0 },
      ],
      assignmentComponents: [
        { id: 'assignment-a', label: '', rawMax: -5, weightage: 0 },
      ],
      status: 'Configured',
    }, cs401a)

    expect(normalized.quizComponents).toEqual([
      { id: 'quiz-a', label: 'Quiz A', rawMax: 1, weightage: 0 },
      { id: 'quiz-b', label: 'Quiz 2', rawMax: 100, weightage: 0 },
    ])
    expect(normalized.assignmentComponents).toEqual([
      { id: 'assignment-a', label: 'Assignment 1', rawMax: 1, weightage: 0 },
    ])
    expect(normalized.status).toBe('Configured')
  })

  it('keeps dynamic assignment scores beyond the two legacy fields', () => {
    const baseStudent = getStudents(cs401a)[0]
    const scheme = normalizeSchemeState({
      finalsMax: 100,
      termTestWeights: { tt1: 20, tt2: 15 },
      quizCount: 0,
      assignmentCount: 3,
      quizComponents: [],
      assignmentComponents: [
        { id: 'assignment-1', label: 'Assignment 1', rawMax: 10, weightage: 8 },
        { id: 'assignment-2', label: 'Assignment 2', rawMax: 10, weightage: 8 },
        { id: 'assignment-3', label: 'Assignment 3', rawMax: 10, weightage: 9 },
      ],
      policyContext: {
        ce: 60,
        see: 40,
        maxTermTests: 2,
        maxQuizzes: 5,
        maxAssignments: 5,
      },
      status: 'Configured',
    }, cs401a)
    const selectors = createAppSelectors({
      studentPatches: {
        [`${cs401a.offId}::${baseStudent.id}`]: {
          assignmentScores: {
            'assignment-1': 8,
            'assignment-2': 7,
            'assignment-3': 6,
          },
        },
      },
      schemeByOffering: {
        [cs401a.offId]: scheme,
      },
      ttBlueprintsByOffering: {},
      studentSourceMode: 'seeded',
    })

    const patchedStudent = selectors.getStudentsPatched(cs401a).find(student => student.id === baseStudent.id)
    expect(patchedStudent).toBeTruthy()
    expect(patchedStudent?.asgn1).toBe(8)
    expect(patchedStudent?.asgn2).toBe(7)
    expect(patchedStudent?.assignmentScores).toEqual({
      'assignment-1': 8,
      'assignment-2': 7,
      'assignment-3': 6,
    })
    const projection = selectors.deriveAcademicProjection({ offering: cs401a, student: patchedStudent ?? baseStudent, scheme })
    expect(projection.assignmentRawTotal).toBe(21)
    expect(projection.asgnScaled).toBeCloseTo(17.4, 5)
  })

  it('keeps CE projections stage-visible so future marks do not leak into early proof cards', () => {
    const baseStudent = getStudents(cs401a)[0]
    const scheme = normalizeSchemeState({
      finalsMax: 100,
      termTestWeights: { tt1: 15, tt2: 15 },
      quizCount: 2,
      assignmentCount: 2,
      quizComponents: [
        { id: 'quiz-1', label: 'Quiz 1', rawMax: 10, weightage: 8 },
        { id: 'quiz-2', label: 'Quiz 2', rawMax: 10, weightage: 7 },
      ],
      assignmentComponents: [
        { id: 'assignment-1', label: 'Assignment 1', rawMax: 10, weightage: 8 },
        { id: 'assignment-2', label: 'Assignment 2', rawMax: 10, weightage: 7 },
      ],
      policyContext: {
        ce: 60,
        see: 40,
        maxTermTests: 2,
        maxQuizzes: 5,
        maxAssignments: 5,
      },
      status: 'Configured',
    }, cs401a)
    const student = {
      ...baseStudent,
      tt1Score: 20,
      tt1Max: 25,
      tt2Score: 19,
      tt2Max: 25,
      quizScores: { 'quiz-1': 8, 'quiz-2': 7 },
      assignmentScores: { 'assignment-1': 9, 'assignment-2': 8 },
    }
    const selectors = createAppSelectors({
      studentPatches: {},
      schemeByOffering: { [cs401a.offId]: scheme },
      ttBlueprintsByOffering: {},
      studentSourceMode: 'seeded',
    })

    const preTt1 = selectors.deriveAcademicProjection({ offering: cs401a, student, scheme, stageKey: 'pre-tt1' })
    const postTt1 = selectors.deriveAcademicProjection({ offering: cs401a, student, scheme, stageKey: 'post-tt1' })
    const postAssignments = selectors.deriveAcademicProjection({ offering: cs401a, student, scheme, stageKey: 'post-assignments' })

    expect(preTt1.ce60).toBe(0)
    expect(preTt1.tt1Raw).toBeNull()
    expect(postTt1.ce60).toBeCloseTo(12, 5)
    expect(postTt1.tt2Raw).toBeNull()
    expect(postTt1.quizRawTotal).toBe(0)
    expect(postAssignments.ce60).toBeGreaterThan(postTt1.ce60)
    expect(postAssignments.quizRawTotal).toBe(15)
    expect(postAssignments.assignmentRawTotal).toBe(17)
  })

  it('uses proof-observed SEE and transcript history for final score and predicted CGPA', () => {
    const baseStudent = getStudents(cs401a)[0]
    const scheme = normalizeSchemeState({
      finalsMax: 100,
      termTestWeights: { tt1: 15, tt2: 15 },
      quizCount: 1,
      assignmentCount: 1,
      quizComponents: [{ id: 'quiz-1', label: 'Quiz 1', rawMax: 10, weightage: 15 }],
      assignmentComponents: [{ id: 'assignment-1', label: 'Assignment 1', rawMax: 10, weightage: 15 }],
      policyContext: {
        ce: 60,
        see: 40,
        maxTermTests: 2,
        maxQuizzes: 5,
        maxAssignments: 5,
      },
      status: 'Configured',
    }, cs401a)
    const student = {
      ...baseStudent,
      prevCgpa: 5.1,
      currentCgpa: 6.4,
      proofObservedTt1Pct: 80,
      proofObservedTt2Pct: 70,
      proofObservedQuizPct: 50,
      proofObservedAssignmentPct: 100,
      proofObservedSeePct: 80,
    }
    const selectors = createAppSelectors({
      studentPatches: {},
      schemeByOffering: { [cs401a.offId]: scheme },
      ttBlueprintsByOffering: {},
      studentSourceMode: 'seeded',
    })

    const projection = selectors.deriveAcademicProjection({
      offering: { ...cs401a, credits: 4 },
      student,
      scheme,
      history: {
        usn: student.usn,
        studentName: student.name,
        program: 'CSE',
        dept: 'CSE',
        trend: 'Stable',
        currentCgpa: 7,
        completedCreditsForCgpa: 100,
        progressionStatus: 'Eligible',
        advisoryNotes: [],
        repeatSubjects: [],
        terms: [],
      },
      stageKey: 'post-see',
    })

    expect(projection.ce60).toBeCloseTo(45, 5)
    expect(projection.seeRaw).toBe(80)
    expect(projection.seeScaled40).toBeCloseTo(32, 5)
    expect(projection.finalScore100).toBeCloseTo(77, 5)
    expect(projection.predictedCgpa).toBe(7.04)
  })

  it('falls back to proof-observed TT percentages for CO attainment rows', () => {
    const baseStudent = getStudents(cs401a)[0]
    const rows = computeCoAttainmentRows([
      {
        ...baseStudent,
        tt1Score: null,
        tt2Score: null,
        proofObservedTt1Pct: 80,
        proofObservedTt2Pct: 60,
      },
    ], [{ id: 'CO1', desc: 'Apply proof-aware evidence', bloom: 'Apply' }])

    expect(rows[0]).toMatchObject({
      coId: 'CO1',
      overallAttainment: 70,
      studentsCounted: 1,
    })
  })

  it('uses proof-observed TT percentages for CO attainment rows even when blueprints exist', () => {
    const baseStudent = getStudents(cs401a)[0]
    const blueprint = buildBlueprintFixture()
    const rows = computeCoAttainmentRows([
      {
        ...baseStudent,
        tt1Score: null,
        tt2Score: null,
        proofObservedTt1Pct: 80,
        proofObservedTt2Pct: 60,
      },
    ], [{ id: 'CO1', desc: 'Apply proof-aware evidence', bloom: 'Apply' }], {
      tt1: blueprint,
      tt2: {
        ...blueprint,
        kind: 'tt2',
      },
    })

    expect(rows[0]).toMatchObject({
      coId: 'CO1',
      tt1Attainment: 80,
      tt2Attainment: 60,
      overallAttainment: 70,
      studentsCounted: 1,
    })
  })

  it('excludes future TT blueprints from CO denominators when no score is visible yet', () => {
    const baseStudent = getStudents(cs401a)[0]
    const blueprint = buildBlueprintFixture()
    const rows = computeCoAttainmentRows([
      {
        ...baseStudent,
        tt1Score: null,
        tt2Score: null,
        proofObservedTt1Pct: 100,
        proofObservedTt2Pct: null,
      },
    ], [{ id: 'CO1', desc: 'Apply proof-aware evidence', bloom: 'Apply' }], {
      tt1: blueprint,
      tt2: {
        ...blueprint,
        kind: 'tt2',
      },
    })

    expect(rows[0]).toMatchObject({
      coId: 'CO1',
      tt1Attainment: 100,
      tt2Attainment: null,
      overallAttainment: 100,
      studentsCounted: 1,
    })
  })

  it('counts genuine zero CO evidence in class averages without treating missing future evidence as zero', () => {
    const baseStudent = getStudents(cs401a)[0]
    const blueprint = buildBlueprintFixture()
    const rows = computeCoAttainmentRows([
      {
        ...baseStudent,
        id: 'zero-evidence-student',
        tt1Score: null,
        tt2Score: null,
        proofObservedTt1Pct: 0,
        proofObservedTt2Pct: null,
      },
      {
        ...baseStudent,
        id: 'perfect-evidence-student',
        tt1Score: null,
        tt2Score: null,
        proofObservedTt1Pct: 100,
        proofObservedTt2Pct: null,
      },
    ], [{ id: 'CO1', desc: 'Apply proof-aware evidence', bloom: 'Apply' }], {
      tt1: blueprint,
      tt2: {
        ...blueprint,
        kind: 'tt2',
      },
    })

    expect(rows[0]).toMatchObject({
      coId: 'CO1',
      tt1Attainment: 50,
      tt2Attainment: null,
      overallAttainment: 50,
      studentsCounted: 2,
    })
  })

  it('hides stale final score and predicted CGPA before the post-SEE checkpoint', () => {
    const baseStudent = getStudents(cs401a)[0]
    const selectors = createAppSelectors({
      studentPatches: {},
      schemeByOffering: { [cs401a.offId]: defaultSchemeForOffering(cs401a) },
      ttBlueprintsByOffering: {},
      studentSourceMode: 'seeded',
    })
    const projection = selectors.deriveAcademicProjection({
      offering: cs401a,
      student: {
        ...baseStudent,
        finalScore100: 91,
        predictedCgpa: 9.1,
        proofObservedSeePct: 90,
      },
      stageKey: 'post-assignments',
    })

    expect(projection.seeRaw).toBeNull()
    expect(projection.finalScore100).toBeNull()
    expect(projection.bandLabel).toBeNull()
    expect(projection.predictedCgpa).toBeNull()
  })

  it('seeds TT leaf scores from aggregate backend marks without showing zero-only cells', () => {
    const blueprint = buildBlueprintFixture()
    const leaves = flattenBlueprintLeaves(blueprint.nodes)
    const seededScores = seedTermTestLeafScores(12, 25, leaves)

    expect(seededScores).toBeTruthy()
    expect(Object.values(seededScores ?? {}).reduce((sum, value) => sum + value, 0)).toBe(12)
    expect(leaves.every(leaf => (seededScores?.[leaf.id] ?? 0) <= leaf.maxMarks)).toBe(true)
    expect(seededScores?.['tt1-q1-p1']).toBeGreaterThan(0)
  })

  it('keeps sysadmin CE policy context and weighted components in sync', () => {
    const normalized = normalizeSchemeState({
      finalsMax: 100,
      quizCount: 1,
      assignmentCount: 1,
      termTestWeights: { tt1: 25, tt2: 15 },
      quizComponents: [
        { id: 'quiz-a', label: 'Quiz A', rawMax: 10, weightage: 8 },
      ],
      assignmentComponents: [
        { id: 'assignment-a', label: 'Assignment A', rawMax: 20, weightage: 12 },
      ],
      policyContext: {
        ce: 60,
        see: 40,
        maxTermTests: 2,
        maxQuizzes: 1,
        maxAssignments: 1,
      },
      status: 'Configured',
    }, cs401a)

    expect(normalized.policyContext).toEqual({
      ce: 60,
      see: 40,
      maxTermTests: 2,
      maxQuizzes: 1,
      maxAssignments: 1,
    })
    expect(normalized.termTestWeights).toEqual({ tt1: 25, tt2: 15 })
    expect(normalized.quizWeight).toBe(8)
    expect(normalized.assignmentWeight).toBe(12)
    expect(normalized.quizComponents[0].weightage).toBe(8)
    expect(normalized.assignmentComponents[0].weightage).toBe(12)
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
