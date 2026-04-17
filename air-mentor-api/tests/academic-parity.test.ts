import { and, asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  academicTerms,
  academicAssets,
  courses,
  facultyOfferingOwnerships,
  mentorAssignments,
  sectionOfferings,
  simulationRuns,
  simulationStageCheckpoints,
  studentEnrollments,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

function weekdayFromDateIso(value: string) {
  const parsed = new Date(value)
  const weekday = parsed.getUTCDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday] ?? null) as string | null
}

function timetableBlocksCanOverlap(
  left: { kind?: string; dateISO?: string; day: string },
  right: { kind?: string; dateISO?: string; day: string },
) {
  if (left.kind === 'extra' && left.dateISO && right.kind === 'extra' && right.dateISO) {
    return left.dateISO === right.dateISO
  }
  if (left.kind === 'extra' && left.dateISO && right.kind !== 'extra') {
    return weekdayFromDateIso(left.dateISO) === right.day
  }
  if (right.kind === 'extra' && right.dateISO && left.kind !== 'extra') {
    return weekdayFromDateIso(right.dateISO) === left.day
  }
  return left.day === right.day
}

function timetableRangesOverlap(
  left: { startMinutes: number; endMinutes: number },
  right: { startMinutes: number; endMinutes: number },
) {
  return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes
}

async function _grantCourseOwnership(cookie: string, offeringId: string, facultyId = 't1') {
  if (!current) throw new Error('Test app is not initialized')
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/admin/offering-ownership',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: {
      offeringId,
      facultyId,
      ownershipRole: 'owner',
      status: 'active',
    },
  })
  expect(response.statusCode).toBe(200)
}

async function switchToRole(cookie: string, availableRoleGrants: Array<{ grantId: string; roleCode: string }>, roleCode: string) {
  if (!current) throw new Error('Test app is not initialized')
  const roleGrantId = availableRoleGrants.find(grant => grant.roleCode === roleCode)?.grantId
  expect(roleGrantId).toBeTruthy()
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId },
  })
  expect(response.statusCode).toBe(200)
  return response
}

async function loginAsProofCourseLeader() {
  if (!current) throw new Error('Test app is not initialized')
  const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
  if (login.body.activeRoleGrant.roleCode !== 'COURSE_LEADER') {
    await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')
  }
  return login
}

async function loadAcademicBootstrap(cookie: string, simulationStageCheckpointId?: string) {
  if (!current) throw new Error('Test app is not initialized')
  const response = await current.app.inject({
    method: 'GET',
    url: simulationStageCheckpointId
      ? `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(simulationStageCheckpointId)}`
      : '/api/academic/bootstrap',
    headers: { cookie },
  })
  expect(response.statusCode).toBe(200)
  return response.json()
}

function collectLeafComponentDefs(nodes: Array<{ id: string; maxMarks?: number; children?: Array<{ id: string; maxMarks?: number; children?: unknown[] }> }>) {
  const leafDefs: Array<{ id: string; maxMarks: number }> = []
  const visit = (items: Array<{ id: string; maxMarks?: number; children?: Array<{ id: string; maxMarks?: number; children?: unknown[] }> }>) => {
    for (const item of items) {
      if (Array.isArray(item.children) && item.children.length > 0) {
        visit(item.children as Array<{ id: string; maxMarks?: number; children?: Array<{ id: string; maxMarks?: number; children?: unknown[] }> }>)
        continue
      }
      leafDefs.push({ id: item.id, maxMarks: Number(item.maxMarks ?? 0) })
    }
  }
  visit(nodes)
  return leafDefs
}

describe('academic bootstrap', () => {
  it('keeps faculty-profile proof context and linked proof drilldowns aligned for the active teaching role', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/faculty-profile/mnc_t1',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const profile = response.json()
    expect(profile.currentOwnedClasses.length).toBeGreaterThan(0)
    expect(profile.currentBatchContexts.length).toBeGreaterThan(0)
    expect(profile.subjectRunCourseLeaderScope.length).toBeGreaterThan(0)
    expect(profile.mentorScope.activeStudentCount).toBe(profile.mentorScope.studentIds.length)
    expect(profile.requestSummary.openCount).toBeGreaterThanOrEqual(0)
    expect(profile.reassessmentSummary.openCount).toBeGreaterThanOrEqual(0)
    expect(profile.proofOperations).toMatchObject({
      scopeMode: 'proof',
      countSource: expect.stringMatching(/^proof-/),
      activeOperationalSemester: expect.any(Number),
      scopeDescriptor: expect.objectContaining({
        batchId: expect.any(String),
        label: expect.any(String),
      }),
      resolvedFrom: expect.objectContaining({
        kind: expect.any(String),
        label: expect.any(String),
      }),
    })
    expect(profile.proofOperations.monitoringQueue.length).toBeGreaterThan(0)

    const firstQueueStudentId = profile.proofOperations.monitoringQueue[0]?.studentId
    expect(firstQueueStudentId).toBeTruthy()
    if (!firstQueueStudentId) throw new Error('Expected a checkpoint-bound faculty queue student')

    const [riskExplorerResponse, studentShellResponse] = await Promise.all([
      current.app.inject({
        method: 'GET',
        url: `/api/academic/students/${firstQueueStudentId}/risk-explorer`,
        headers: { cookie: login.cookie },
      }),
      current.app.inject({
        method: 'GET',
        url: `/api/academic/student-shell/students/${firstQueueStudentId}/card`,
        headers: { cookie: login.cookie },
      }),
    ])

    expect(riskExplorerResponse.statusCode).toBe(200)
    expect(studentShellResponse.statusCode).toBe(200)
  })

  it('exposes non-overlapping faculty timetable blocks in the proof bootstrap for course-leader playback', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const snapshot = response.json()
    const timetable = snapshot.runtime.timetableByFacultyId?.mnc_t1
    expect(timetable).toBeTruthy()
    if (!timetable) throw new Error('Expected a proof timetable for mnc_t1')

    const classBlocks = timetable.classBlocks as Array<{
      kind?: string
      dateISO?: string
      day: string
      startMinutes: number
      endMinutes: number
    }>

    for (let index = 0; index < classBlocks.length; index += 1) {
      const left = classBlocks[index]
      for (let compareIndex = index + 1; compareIndex < classBlocks.length; compareIndex += 1) {
        const right = classBlocks[compareIndex]
        if (!timetableBlocksCanOverlap(left, right)) continue
        expect(timetableRangesOverlap(left, right)).toBe(false)
      }
    }
  })

  it('ignores legacy academic asset snapshots and derives the live view from admin-owned records', async () => {
    current = await createTestApp()
    const login = await loginAsProofCourseLeader()

    await current.db.update(academicAssets).set({
      payloadJson: JSON.stringify({
        name: 'Legacy Mock Professor',
        id: 'legacy-professor',
        dept: 'Legacy Department',
        role: 'Legacy Role',
        initials: 'LM',
        email: 'legacy@example.com',
      }),
      version: 99,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicAssets.assetKey, 'professor'))

    await current.db.update(academicAssets).set({
      payloadJson: JSON.stringify([{ facultyId: 'legacy-faculty', name: 'Legacy Faculty', dept: 'LEG', roleTitle: 'Demo', allowedRoles: ['Course Leader'] }]),
      version: 99,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicAssets.assetKey, 'faculty'))

    await current.db.update(academicAssets).set({
      payloadJson: JSON.stringify([{ offId: 'legacy-offering', code: 'LEG101', title: 'Legacy Demo Course' }]),
      version: 99,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }).where(eq(academicAssets.assetKey, 'offerings'))

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(200)
    const snapshot = response.json()
    const proofFacultyId = String(login.body.faculty.facultyId)
    const proofFaculty = snapshot.faculty.find((faculty: { facultyId: string }) => faculty.facultyId === proofFacultyId)
    const firstOffering = snapshot.offerings[0]
    const firstStudent = firstOffering ? (snapshot.studentsByOffering[firstOffering.offId] ?? [])[0] : null

    expect(snapshot.professor).toMatchObject({
      id: proofFacultyId,
      role: 'Course Leader',
    })
    expect(snapshot.faculty.some((faculty: { facultyId: string }) => faculty.facultyId === 'legacy-faculty')).toBe(false)
    expect(snapshot.offerings.some((offering: { offId: string }) => offering.offId === 'legacy-offering')).toBe(false)
    expect(proofFaculty?.allowedRoles).toContain('Course Leader')
    expect(snapshot.offerings.length).toBeGreaterThan(0)
    expect(firstOffering).toBeTruthy()
    expect(firstStudent).toBeTruthy()
    if (!firstStudent) throw new Error('Expected a proof-scoped bootstrap student')
    expect(snapshot.studentHistoryByUsn[firstStudent.usn]).toMatchObject({
      usn: firstStudent.usn,
      studentName: firstStudent.name,
    })
    expect(Array.isArray(snapshot.runtime.tasks)).toBe(true)
  })

  it('reflects admin master-data changes into the academic bootstrap on the next fetch', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const academicLogin = await loginAsProofCourseLeader()
    const initialSnapshot = await loadAcademicBootstrap(academicLogin.cookie)
    const facultyId = String(academicLogin.body.faculty.facultyId)
    const targetOffering = initialSnapshot.offerings[0]
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a proof-scoped offering for the master-data refresh test')

    const [targetOfferingRow, targetCourseRows] = await Promise.all([
      current.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, targetOffering.offId)).then(rows => rows[0] ?? null),
      current.db.select().from(courses),
    ])
    expect(targetOfferingRow).toBeTruthy()
    if (!targetOfferingRow) throw new Error('Expected a persisted offering row')
    const currentCourse = targetCourseRows.find(row => row.courseId === targetOfferingRow.courseId) ?? null
    expect(currentCourse).toBeTruthy()
    if (!currentCourse) throw new Error('Expected a persisted course row')
    const updatedTitle = `${targetOffering.title} · Admin Refresh`

    const coursePatch = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/courses/${targetOfferingRow.courseId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseCode: currentCourse.courseCode,
        title: updatedTitle,
        defaultCredits: currentCourse.defaultCredits,
        departmentId: currentCourse.departmentId,
        status: 'active',
        version: currentCourse.version,
      },
    })
    expect(coursePatch.statusCode).toBe(200)

    const snapshot = await loadAcademicBootstrap(academicLogin.cookie)

    expect(snapshot.offerings.find((offering: { offId: string }) => offering.offId === targetOffering.offId)?.title).toBe(updatedTitle)
    expect(snapshot.faculty.find((faculty: { facultyId: string }) => faculty.facultyId === facultyId)?.offeringIds).toContain(targetOffering.offId)
  })

  it('persists resolved course outcomes, offering schemes, and question papers through backend-owned routes', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const facultyLogin = await loginAsProofCourseLeader()
    const initialBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const targetOffering = initialBootstrap.offerings[0]
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a proof-scoped offering for the curriculum persistence test')
    const offeringRow = await current.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, targetOffering.offId)).then(rows => rows[0] ?? null)
    expect(offeringRow).toBeTruthy()
    if (!offeringRow) throw new Error('Expected a persisted proof offering row')

    const overrideResponse = await current.app.inject({
      method: 'POST',
      url: '/api/admin/course-outcomes',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseId: offeringRow.courseId,
        scopeType: 'branch',
        scopeId: offeringRow.branchId,
        outcomes: [
          { id: 'CO1', desc: 'Prove complexity bounds for algorithmic strategies.', bloom: 'Analyze' },
          { id: 'CO2', desc: 'Design dynamic programming solutions for constrained problems.', bloom: 'Create' },
        ],
        status: 'active',
      },
    })
    expect(overrideResponse.statusCode).toBe(200)

    const resolvedOutcomesResponse = await current.app.inject({
      method: 'GET',
      url: `/api/admin/offerings/${targetOffering.offId}/resolved-course-outcomes`,
      headers: { cookie: facultyLogin.cookie },
    })
    expect(resolvedOutcomesResponse.statusCode).toBe(200)
    expect(resolvedOutcomesResponse.json()).toMatchObject({
      offeringId: targetOffering.offId,
      courseId: offeringRow.courseId,
      outcomes: [
        expect.objectContaining({ id: 'CO1', bloom: 'Analyze' }),
        expect.objectContaining({ id: 'CO2', bloom: 'Create' }),
      ],
    })

    const invalidSchemeResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/scheme`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        scheme: {
          finalsMax: 100,
          termTestWeights: { tt1: 20, tt2: 15 },
          quizWeight: 10,
          assignmentWeight: 14,
          quizCount: 2,
          assignmentCount: 2,
          policyContext: {
            ce: 60,
            see: 40,
            maxTermTests: 2,
            maxQuizzes: 2,
            maxAssignments: 2,
          },
          quizComponents: [
            { id: 'quiz-1', label: 'Quiz 1', rawMax: 10, weightage: 5 },
            { id: 'quiz-2', label: 'Quiz 2', rawMax: 10, weightage: 5 },
          ],
          assignmentComponents: [
            { id: 'assignment-1', label: 'Assignment 1', rawMax: 10, weightage: 7 },
            { id: 'assignment-2', label: 'Assignment 2', rawMax: 10, weightage: 7 },
          ],
          status: 'Needs Setup',
        },
      },
    })
    expect(invalidSchemeResponse.statusCode).toBe(400)

    const schemeResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/scheme`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        scheme: {
          finalsMax: 100,
          termTestWeights: { tt1: 20, tt2: 15 },
          quizWeight: 10,
          assignmentWeight: 15,
          quizCount: 2,
          assignmentCount: 2,
          policyContext: {
            ce: 60,
            see: 40,
            maxTermTests: 2,
            maxQuizzes: 2,
            maxAssignments: 2,
          },
          quizComponents: [
            { id: 'quiz-1', label: 'Quiz 1', rawMax: 10, weightage: 5 },
            { id: 'quiz-2', label: 'Quiz 2', rawMax: 10, weightage: 5 },
          ],
          assignmentComponents: [
            { id: 'assignment-1', label: 'Assignment 1', rawMax: 10, weightage: 7 },
            { id: 'assignment-2', label: 'Assignment 2', rawMax: 10, weightage: 8 },
          ],
          status: 'Configured',
          configuredAt: Date.now(),
          lastEditedBy: String(facultyLogin.body.faculty.facultyId),
        },
      },
    })
    expect(schemeResponse.statusCode).toBe(200)
    expect(schemeResponse.json().scheme.status).toBe('Configured')

    const invalidBlueprintResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/question-papers/tt1`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        blueprint: {
          kind: 'tt1',
          totalMarks: 20,
          updatedAt: Date.now(),
          nodes: [
            {
              id: 'tt1-q1',
              label: 'Q1',
              text: 'Explain the recurrence.',
              maxMarks: 10,
              cos: ['CO9'],
            },
          ],
        },
      },
    })
    expect(invalidBlueprintResponse.statusCode).toBe(400)

    const blueprintResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/question-papers/tt1`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        blueprint: {
          kind: 'tt1',
          totalMarks: 20,
          updatedAt: Date.now(),
          nodes: [
            {
              id: 'tt1-q1',
              label: 'Q1',
              text: 'Design a dynamic programming solution.',
              maxMarks: 10,
              cos: ['CO2'],
            },
            {
              id: 'tt1-q2',
              label: 'Q2',
              text: 'Analyse the complexity of the strategy.',
              maxMarks: 10,
              cos: ['CO1'],
            },
          ],
        },
      },
    })
    expect(blueprintResponse.statusCode).toBe(200)
    expect(blueprintResponse.json().blueprint.nodes).toHaveLength(2)

    const bootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    expect(bootstrap.courseOutcomesByOffering[targetOffering.offId]).toEqual([
      expect.objectContaining({ id: 'CO1', bloom: 'Analyze' }),
      expect.objectContaining({ id: 'CO2', bloom: 'Create' }),
    ])
    expect(bootstrap.assessmentSchemesByOffering[targetOffering.offId]).toMatchObject({
      status: 'Configured',
      quizCount: 2,
      assignmentCount: 2,
    })
    expect(bootstrap.questionPapersByOffering[targetOffering.offId].tt1.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tt1-q1', cos: ['CO2'] }),
      expect.objectContaining({ id: 'tt1-q2', cos: ['CO1'] }),
    ]))
  })

  it('persists authoritative queue, calendar workspace, attendance, and TT1 entry state through the teaching routes', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const facultyLogin = await loginAsProofCourseLeader()
    const facultyId = String(facultyLogin.body.faculty.facultyId)
    const initialBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const targetOffering = initialBootstrap.offerings[0]
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a proof-scoped offering for the teaching state test')
    const targetOfferingRow = await current.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, targetOffering.offId)).then(rows => rows[0] ?? null)
    expect(targetOfferingRow).toBeTruthy()
    if (!targetOfferingRow) throw new Error('Expected a persisted proof offering row')
    const offeringUnlockResponse = await current.app.inject({
      method: 'PATCH',
      url: `/api/admin/offerings/${targetOffering.offId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseId: targetOfferingRow.courseId,
        termId: targetOfferingRow.termId,
        branchId: targetOfferingRow.branchId,
        sectionCode: targetOfferingRow.sectionCode,
        yearLabel: targetOfferingRow.yearLabel,
        attendance: 76,
        studentCount: targetOfferingRow.studentCount,
        stage: 2,
        stageLabel: 'Stage 2',
        stageDescription: 'TT1 → TT2',
        stageColor: '#3b82f6',
        tt1Done: true,
        tt2Done: false,
        tt1Locked: false,
        tt2Locked: false,
        quizLocked: false,
        assignmentLocked: false,
        pendingAction: 'Submit & Lock TT2',
        status: 'active',
        version: targetOfferingRow.version,
      },
    })
    expect(offeringUnlockResponse.statusCode).toBe(200)

    const targetStudent = initialBootstrap.studentsByOffering[targetOffering.offId][0]
    expect(targetStudent).toBeTruthy()
    if (!targetStudent) throw new Error('Expected a proof-scoped student for the teaching state test')
    const canonicalStudentId = String(targetStudent.id).split('::').at(-1)
    const tt1Leaves = collectLeafComponentDefs(initialBootstrap.questionPapersByOffering[targetOffering.offId].tt1.nodes).slice(0, 5)
    expect(tt1Leaves.length).toBeGreaterThan(0)
    const tt1Components = tt1Leaves.map((leaf, index) => ({
      componentCode: leaf.id,
      score: Math.max(1, Math.min(leaf.maxMarks || 5, (leaf.maxMarks || 5) - (index % 2))),
      maxScore: Math.max(1, leaf.maxMarks || 5),
    }))
    const tt1TotalScore = tt1Components.reduce((sum, component) => sum + component.score, 0)
    const tt1TotalMax = tt1Components.reduce((sum, component) => sum + component.maxScore, 0)

    const syncedTask = {
      id: 'manual-followup-c3a-student-test',
      studentId: targetStudent.id,
      studentName: targetStudent.name,
      studentUsn: targetStudent.usn,
      offeringId: targetOffering.offId,
      courseCode: targetOffering.code,
      courseName: targetOffering.title,
      year: targetOffering.year,
      riskProb: 0.62,
      riskBand: 'Medium',
      title: 'Follow-up: confirm TT1 recovery plan',
      due: 'Today',
      dueDateISO: '2026-03-20',
      status: 'In Progress',
      actionHint: 'Meet the student and confirm the next remedial checkpoint.',
      priority: 62,
      createdAt: Date.now() - 10_000,
      updatedAt: Date.now(),
      assignedTo: 'Course Leader',
      taskType: 'Follow-up',
      manual: true,
      sourceRole: 'Course Leader',
      transitionHistory: [
        {
          id: 'transition-manual-followup-c3a',
          at: Date.now(),
          actorRole: 'Course Leader',
          actorTeacherId: facultyId,
          action: 'Created',
          fromOwner: 'Course Leader',
          toOwner: 'Course Leader',
          note: 'Teacher created a direct follow-up from the queue.',
        },
      ],
    }

    const taskSyncResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/tasks/sync',
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: { tasks: [syncedTask] },
    })
    expect(taskSyncResponse.statusCode).toBe(200)

    const taskPlacementResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/task-placements/sync',
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        placements: {
          [syncedTask.id]: {
            taskId: syncedTask.id,
            dateISO: '2026-03-20',
            placementMode: 'timed',
            startMinutes: 570,
            endMinutes: 600,
            startTime: '09:30',
            endTime: '10:00',
            updatedAt: Date.now(),
          },
        },
      },
    })
    expect(taskPlacementResponse.statusCode).toBe(200)

    const calendarAuditResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/calendar-audit/sync',
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        events: [{
          id: 'calendar-audit-manual-followup-c3a',
          facultyId,
          actorRole: 'Course Leader',
          actorFacultyId: facultyId,
          timestamp: Date.now(),
          actionKind: 'task-created-and-scheduled',
          targetType: 'task',
          targetId: syncedTask.id,
          note: 'Created and scheduled a direct follow-up from the timetable.',
          after: {
            dateISO: '2026-03-20',
            startMinutes: 570,
            endMinutes: 600,
            placementMode: 'timed',
            offeringId: targetOffering.offId,
          },
        }],
      },
    })
    expect(calendarAuditResponse.statusCode).toBe(200)

    const timetableSaveResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/faculty-calendar-workspace/${facultyId}`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        template: {
          ...initialBootstrap.runtime.timetableByFacultyId[facultyId],
          updatedAt: Date.now(),
        },
      },
    })
    expect(timetableSaveResponse.statusCode).toBe(200)

    const attendanceCommitResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/attendance`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        entries: [{
          studentId: targetStudent.id,
          presentClasses: 34,
          totalClasses: 40,
        }],
        lock: true,
      },
    })
    expect(attendanceCommitResponse.statusCode).toBe(200)

    const tt1CommitResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/assessment-entries/tt1`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        entries: [{
          studentId: targetStudent.id,
          components: tt1Components,
        }],
        lock: true,
      },
    })
    expect(tt1CommitResponse.statusCode).toBe(200)

    const meetingCreateResponse = await current.app.inject({
      method: 'POST',
      url: '/api/academic/meetings',
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        studentId: targetStudent.id,
        offeringId: targetOffering.offId,
        title: 'Recovery planning meeting',
        notes: 'Review TT1 recovery steps and confirm the next checkpoint.',
        dateISO: '2026-03-21',
        startMinutes: 900,
        endMinutes: 930,
        status: 'scheduled',
      },
    })
    expect(meetingCreateResponse.statusCode).toBe(200)
    const createdMeeting = meetingCreateResponse.json()
    expect(createdMeeting).toMatchObject({
      studentId: canonicalStudentId,
      offeringId: targetOffering.offId,
      title: 'Recovery planning meeting',
      status: 'scheduled',
      version: 1,
    })

    const meetingUpdateResponse = await current.app.inject({
      method: 'PATCH',
      url: `/api/academic/meetings/${createdMeeting.meetingId}`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        studentId: canonicalStudentId,
        offeringId: targetOffering.offId,
        title: 'Recovery planning meeting',
        notes: 'Meeting completed. Student agreed to the revised remedial timeline.',
        dateISO: '2026-03-21',
        startMinutes: 905,
        endMinutes: 940,
        status: 'completed',
        version: createdMeeting.version,
      },
    })
    expect(meetingUpdateResponse.statusCode).toBe(200)

    const finalBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const refreshedStudent = finalBootstrap.studentsByOffering[targetOffering.offId].find((student: { id: string }) => student.id === targetStudent.id)

    expect(finalBootstrap.runtime.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: syncedTask.id, title: syncedTask.title }),
    ]))
    expect(finalBootstrap.runtime.taskPlacements[syncedTask.id]).toMatchObject({
      taskId: syncedTask.id,
      placementMode: 'timed',
      startMinutes: 570,
      endMinutes: 600,
    })
    expect(finalBootstrap.runtime.calendarAudit).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'calendar-audit-manual-followup-c3a', targetId: syncedTask.id }),
    ]))
    expect(finalBootstrap.runtime.timetableByFacultyId[facultyId]).toBeTruthy()
    expect(finalBootstrap.runtime.lockByOffering[targetOffering.offId]).toMatchObject({
      attendance: true,
      tt1: true,
    })
    expect(finalBootstrap.runtime.studentPatches[`${targetOffering.offId}::${canonicalStudentId}`]).toMatchObject({
      present: 34,
      totalClasses: 40,
      tt1LeafScores: Object.fromEntries(tt1Components.slice(0, 2).map(component => [component.componentCode, component.score])),
    })
    expect(refreshedStudent).toMatchObject({
      present: 34,
      totalClasses: 40,
      tt1Score: tt1TotalScore,
      tt1Max: tt1TotalMax,
    })
    expect(finalBootstrap.meetings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        meetingId: createdMeeting.meetingId,
        studentId: canonicalStudentId,
        status: 'completed',
        startMinutes: 905,
        endMinutes: 940,
      }),
    ]))
    expect(finalBootstrap.coAttainmentByOffering[targetOffering.offId][0]).toMatchObject({
      coId: expect.any(String),
      tt1Attainment: expect.any(Number),
      overallAttainment: expect.any(Number),
    })
    expect(refreshedStudent.interventions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'Meeting',
      }),
    ]))
    expect(finalBootstrap.studentHistoryByUsn[targetStudent.usn]).toMatchObject({
      currentCgpa: expect.any(Number),
      completedCreditsForCgpa: expect.any(Number),
      progressionStatus: expect.stringMatching(/Eligible|Review|Hold/),
    })
  })

  it('keeps faculty-profile proof payloads and student drilldowns scoped for course leaders and mentors', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })

    const [selectedCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
    ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder))
    expect(selectedCheckpoint).toBeTruthy()

    const facultyId = login.body.faculty.facultyId as string
    const ownedOfferingRows = await current.db.select().from(facultyOfferingOwnerships).where(and(
      eq(facultyOfferingOwnerships.facultyId, facultyId),
      eq(facultyOfferingOwnerships.status, 'active'),
    ))
    const ownedOfferingIds = new Set(ownedOfferingRows.map(row => row.offeringId))
    expect(ownedOfferingIds.size).toBeGreaterThan(0)

    const mentorRows = await current.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyId))
    const mentorStudentIds = new Set(mentorRows.filter(row => row.effectiveTo === null).map(row => row.studentId))
    expect(mentorStudentIds.size).toBeGreaterThan(0)

    let activeSessionBody = login.body
    const loadProfileForRole = async (roleCode: 'COURSE_LEADER' | 'MENTOR', simulationStageCheckpointId?: string) => {
      activeSessionBody = activeSessionBody.activeRoleGrant.roleCode === roleCode
        ? activeSessionBody
        : (await switchToRole(login.cookie, login.body.availableRoleGrants, roleCode)).json()
      const response = await current!.app.inject({
        method: 'GET',
        url: `/api/academic/faculty-profile/${facultyId}${simulationStageCheckpointId ? `?simulationStageCheckpointId=${encodeURIComponent(simulationStageCheckpointId)}` : ''}`,
        headers: { cookie: login.cookie },
      })
      expect(response.statusCode).toBe(200)
      return response.json()
    }

    const courseLeaderCheckpointProfile = await loadProfileForRole('COURSE_LEADER', selectedCheckpoint.simulationStageCheckpointId)
    expect(courseLeaderCheckpointProfile.proofOperations.scopeDescriptor).toMatchObject({
      scopeType: 'proof',
      simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId,
    })
    expect(courseLeaderCheckpointProfile.proofOperations.resolvedFrom).toMatchObject({
      kind: 'proof-checkpoint',
      scopeType: 'proof',
      scopeId: selectedCheckpoint.simulationStageCheckpointId,
    })
    expect(courseLeaderCheckpointProfile.proofOperations.scopeMode).toBe('proof')
    expect(courseLeaderCheckpointProfile.proofOperations.countSource).toBe('proof-checkpoint')
    expect(courseLeaderCheckpointProfile.proofOperations.activeOperationalSemester).toBe(selectedCheckpoint.semesterNumber)
    expect(courseLeaderCheckpointProfile.proofOperations.selectedCheckpoint).toMatchObject({
      simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId,
      semesterNumber: selectedCheckpoint.semesterNumber,
    })
    expect(Array.isArray(courseLeaderCheckpointProfile.proofOperations.monitoringQueue)).toBe(true)
    expect(courseLeaderCheckpointProfile.currentBatchContexts.every((item: { currentSemester: number }) => {
      return item.currentSemester === courseLeaderCheckpointProfile.proofOperations.activeOperationalSemester
    })).toBe(true)
    const courseLeaderCheckpointBootstrapResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(courseLeaderCheckpointBootstrapResponse.statusCode).toBe(200)
    const courseLeaderCheckpointBootstrap = courseLeaderCheckpointBootstrapResponse.json()
    const [allOfferingRows, allTermRows, allEnrollmentRows] = await Promise.all([
      current.db.select().from(sectionOfferings),
      current.db.select().from(academicTerms),
      current.db.select().from(studentEnrollments),
    ])
    const termById = new Map(allTermRows.map(row => [row.termId, row] as const))
    const proofBatchId = String(courseLeaderCheckpointProfile.proofOperations.scopeDescriptor.batchId)
    const proofSemesterNumber = Number(courseLeaderCheckpointProfile.proofOperations.activeOperationalSemester)
    const checkpointOwnedOfferingIds = Array.from(new Set(ownedOfferingRows
      .map(row => row.offeringId)
      .filter(offeringId => {
        const offering = allOfferingRows.find(row => row.offeringId === offeringId)
        const term = offering ? termById.get(offering.termId) : null
        return !!term && term.batchId === proofBatchId && term.semesterNumber === proofSemesterNumber
      }))).sort((left, right) => left.localeCompare(right))
    expect(courseLeaderCheckpointProfile.currentOwnedClasses.map((item: { offeringId: string }) => item.offeringId).sort()).toEqual(checkpointOwnedOfferingIds)

    const courseLeaderProfile = await loadProfileForRole('COURSE_LEADER')
    const activeProofBatchId = String(courseLeaderProfile.proofOperations.scopeDescriptor.batchId)
    const activeProofSemesterNumber = Number(courseLeaderProfile.proofOperations.activeOperationalSemester)
    const activeSemesterOwnedOfferingIds = Array.from(new Set(ownedOfferingRows
      .map(row => row.offeringId)
      .filter(offeringId => {
        const offering = allOfferingRows.find(row => row.offeringId === offeringId)
        const term = offering ? termById.get(offering.termId) : null
        return !!term && term.batchId === activeProofBatchId && term.semesterNumber === activeProofSemesterNumber
      }))).sort((left, right) => left.localeCompare(right))
    expect(courseLeaderProfile.currentOwnedClasses.map((item: { offeringId: string }) => item.offeringId).sort()).toEqual(activeSemesterOwnedOfferingIds)
    expect(courseLeaderProfile.proofOperations.monitoringQueue.every((item: { offeringId: string }) => activeSemesterOwnedOfferingIds.includes(item.offeringId))).toBe(true)
    if (courseLeaderCheckpointProfile.proofOperations.monitoringQueue[0]) {
      const queueItem = courseLeaderCheckpointProfile.proofOperations.monitoringQueue[0] as {
        studentId: string
        offeringId: string
      }
      const studentId = queueItem.studentId
      const bootstrapStudent = (courseLeaderCheckpointBootstrap.studentsByOffering[queueItem.offeringId] ?? []).find((student: { id: string }) => {
        return String(student.id).split('::').at(-1) === studentId
      })
      expect(bootstrapStudent).toBeTruthy()
      const [riskExplorerResponse, studentShellResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${studentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${studentId}/card?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
      ])
      expect(riskExplorerResponse.statusCode).toBe(200)
      expect(studentShellResponse.statusCode).toBe(200)
      const riskExplorer = riskExplorerResponse.json()
      const studentShell = studentShellResponse.json()
      expect(bootstrapStudent).toMatchObject({
        riskBand: studentShell.overview.currentStatus.riskBand,
        riskProb: (studentShell.overview.currentStatus.riskProbScaled ?? 0) / 100,
        currentCgpa: studentShell.summaryRail.currentCgpa,
      })
      expect(bootstrapStudent.flags.backlog).toBe(studentShell.summaryRail.backlogCount > 0)
      expect(bootstrapStudent.riskBand).toBe(riskExplorer.currentStatus.riskBand)
      expect(Math.round((bootstrapStudent.riskProb ?? 0) * 100)).toBe(riskExplorer.currentStatus.riskProbScaled)
    }

    const mentorCheckpointProfile = await loadProfileForRole('MENTOR', selectedCheckpoint.simulationStageCheckpointId)
    expect(mentorCheckpointProfile.proofOperations.scopeMode).toBe('proof')
    expect(mentorCheckpointProfile.proofOperations.countSource).toBe('proof-checkpoint')
    expect(mentorCheckpointProfile.proofOperations.activeOperationalSemester).toBe(selectedCheckpoint.semesterNumber)
    expect(mentorCheckpointProfile.proofOperations.selectedCheckpoint).toMatchObject({
      simulationStageCheckpointId: selectedCheckpoint.simulationStageCheckpointId,
      semesterNumber: selectedCheckpoint.semesterNumber,
    })
    expect(Array.isArray(mentorCheckpointProfile.proofOperations.monitoringQueue)).toBe(true)
    const proofMentorStudentIds = Array.from(new Set(Array.from(mentorStudentIds)
      .filter(studentId => {
        const enrollment = allEnrollmentRows.find(row => row.studentId === studentId && row.academicStatus === 'active')
        const term = enrollment ? termById.get(enrollment.termId) : null
        return !!term && term.batchId === proofBatchId && term.semesterNumber === proofSemesterNumber
      }))).sort((left, right) => left.localeCompare(right))
    expect([...mentorCheckpointProfile.mentorScope.studentIds].sort()).toEqual(proofMentorStudentIds)
    expect(mentorCheckpointProfile.mentorScope.activeStudentCount).toBe(proofMentorStudentIds.length)
    expect(mentorCheckpointProfile.currentBatchContexts.every((item: { currentSemester: number }) => {
      return item.currentSemester === mentorCheckpointProfile.proofOperations.activeOperationalSemester
    })).toBe(true)

    const mentorProfile = await loadProfileForRole('MENTOR')
    const activeMentorProofBatchId = String(mentorProfile.proofOperations.scopeDescriptor.batchId)
    const activeMentorProofSemesterNumber = Number(mentorProfile.proofOperations.activeOperationalSemester)
    const activeMentorStudentIds = Array.from(new Set(Array.from(mentorStudentIds)
      .filter(studentId => {
        const enrollment = allEnrollmentRows.find(row => row.studentId === studentId && row.academicStatus === 'active')
        const term = enrollment ? termById.get(enrollment.termId) : null
        return !!term && term.batchId === activeMentorProofBatchId && term.semesterNumber === activeMentorProofSemesterNumber
      }))).sort((left, right) => left.localeCompare(right))
    expect([...mentorProfile.mentorScope.studentIds].sort()).toEqual(activeMentorStudentIds)
    expect(mentorProfile.mentorScope.activeStudentCount).toBe(activeMentorStudentIds.length)
    expect(mentorProfile.proofOperations.monitoringQueue.every((item: { studentId: string }) => mentorStudentIds.has(item.studentId))).toBe(true)
    expect(mentorProfile.proofOperations.electiveFits.every((item: { studentId: string }) => mentorStudentIds.has(item.studentId))).toBe(true)
    if (mentorProfile.proofOperations.monitoringQueue[0]) {
      const studentId = mentorProfile.proofOperations.monitoringQueue[0].studentId as string
      const [riskExplorerResponse, studentShellResponse] = await Promise.all([
        current.app.inject({
          method: 'GET',
          url: `/api/academic/students/${studentId}/risk-explorer?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
        current.app.inject({
          method: 'GET',
          url: `/api/academic/student-shell/students/${studentId}/card?simulationStageCheckpointId=${encodeURIComponent(selectedCheckpoint.simulationStageCheckpointId)}`,
          headers: { cookie: login.cookie },
        }),
      ])
      expect(riskExplorerResponse.statusCode).toBe(200)
      expect(studentShellResponse.statusCode).toBe(200)
    }
  })

  it('keeps academic playback checkpoints available when another proof run is also active', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [baselineActiveRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(baselineActiveRun).toBeTruthy()
    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${baselineActiveRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)

    const [selectedCheckpoint] = await current.db.select().from(simulationStageCheckpoints).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    )
    expect(selectedCheckpoint).toBeTruthy()

    const [checkpointRun] = await current.db.select().from(simulationRuns).where(
      eq(simulationRuns.simulationRunId, selectedCheckpoint.simulationRunId),
    )
    expect(checkpointRun).toBeTruthy()

    const syntheticRunId = 'sim_parallel_active_checkpoint_scope'
    const syntheticCheckpointId = 'stage_checkpoint_parallel_active_checkpoint_scope'
    const syntheticCheckpointSummary = {
      ...(JSON.parse(selectedCheckpoint.summaryJson) as Record<string, unknown>),
      simulationStageCheckpointId: syntheticCheckpointId,
      simulationRunId: syntheticRunId,
      previousCheckpointId: null,
      nextCheckpointId: null,
    }
    await current.db.insert(simulationRuns).values({
      ...checkpointRun,
      simulationRunId: syntheticRunId,
      runLabel: 'Parallel active proof run',
      seed: checkpointRun.seed + 1,
      createdAt: '2026-03-31T01:15:00.000Z',
      updatedAt: '2026-03-31T01:15:00.000Z',
    })
    await current.db.insert(simulationStageCheckpoints).values({
      ...selectedCheckpoint,
      simulationStageCheckpointId: syntheticCheckpointId,
      simulationRunId: syntheticRunId,
      previousCheckpointId: null,
      nextCheckpointId: null,
      summaryJson: JSON.stringify(syntheticCheckpointSummary),
      createdAt: '2026-03-31T01:15:00.000Z',
      updatedAt: '2026-03-31T01:15:00.000Z',
    })

    const activeRuns = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRuns[0]?.simulationRunId).toBe(baselineActiveRun.simulationRunId)

    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(syntheticCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(bootstrapResponse.statusCode).toBe(200)
    expect(bootstrapResponse.json().proofPlayback).toMatchObject({
      simulationRunId: syntheticRunId,
      simulationStageCheckpointId: syntheticCheckpointId,
    })

    const facultyProfileResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/faculty-profile/${login.body.faculty.facultyId}?simulationStageCheckpointId=${encodeURIComponent(syntheticCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(facultyProfileResponse.statusCode).toBe(200)
    expect(facultyProfileResponse.json().proofOperations.selectedCheckpoint).toMatchObject({
      simulationStageCheckpointId: syntheticCheckpointId,
    })
    expect(facultyProfileResponse.json().proofOperations.activeRunContexts[0]).toMatchObject({
      simulationRunId: syntheticRunId,
    })
  })
})
