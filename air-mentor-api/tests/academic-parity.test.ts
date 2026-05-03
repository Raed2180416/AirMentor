import { and, asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  academicRuntimeState,
  academicTerms,
  academicAssets,
  courses,
  facultyOfferingOwnerships,
  mentorAssignments,
  riskAssessments,
  sectionOfferings,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
  studentEnrollments,
  studentObservedSemesterStates,
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
        stage: targetOfferingRow.stage,
        stageLabel: targetOfferingRow.stageLabel,
        stageDescription: targetOfferingRow.stageDescription,
        stageColor: targetOfferingRow.stageColor,
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

  it('ignores stale persisted risk rows from other proof windows when rendering the live bootstrap', async () => {
    current = await createTestApp()
    const facultyLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const baselineBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const targetOffering = baselineBootstrap.offerings.find((offering: { offId: string }) => (
      (baselineBootstrap.studentsByOffering[offering.offId]?.length ?? 0) > 0
    ))
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a proof-scoped offering for stale-risk validation')

    const baselineStudent = baselineBootstrap.studentsByOffering[targetOffering.offId][0]
    expect(baselineStudent).toBeTruthy()
    if (!baselineStudent) throw new Error('Expected a proof-scoped student for stale-risk validation')
    const canonicalStudentId = String(baselineStudent.id).split('::').at(-1) ?? String(baselineStudent.id)
    const staleRiskBand = baselineStudent.riskBand === 'High' ? 'Low' : 'High'

    await current.db.insert(riskAssessments).values({
      riskAssessmentId: 'risk_assessment_stale_runtime_bootstrap',
      simulationRunId: null,
      studentId: canonicalStudentId,
      offeringId: targetOffering.offId,
      termId: targetOffering.termId,
      assessmentScope: 'observable-only',
      riskProbScaled: staleRiskBand === 'High' ? 95 : 10,
      riskBand: staleRiskBand,
      recommendedAction: 'Stale checkpoint row should be ignored by live bootstrap rendering.',
      driversJson: JSON.stringify([{ label: 'Stale risk row', impact: 0.95, feature: 'proof-checkpoint' }]),
      evidenceWindow: 'semester-99-see',
      evidenceSnapshotId: null,
      modelVersion: 'stale-risk-row',
      policyVersion: 'stale-risk-row',
      sourceType: 'simulation',
      assessedAt: '2026-12-31T00:00:00.000Z',
      createdAt: '2026-12-31T00:00:00.000Z',
      updatedAt: '2026-12-31T00:00:00.000Z',
    })

    const refreshedBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const refreshedStudent = refreshedBootstrap.studentsByOffering[targetOffering.offId].find((student: { id: string }) => student.id === baselineStudent.id)

    expect(refreshedStudent).toBeTruthy()
    if (!refreshedStudent) throw new Error('Expected the target student after stale-risk insert')
    expect(refreshedStudent.riskBand).toBe(baselineStudent.riskBand)
    expect(refreshedStudent.riskProb).toBeCloseTo(baselineStudent.riskProb, 6)
  })

  it('reacts immediately to newly entered quiz evidence and follows the authoritative run stage instead of offering stage', async () => {
    current = await createTestApp()
    const facultyLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    if (!activeRun) throw new Error('Expected an active proof run')

    const initialBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const targetOffering = initialBootstrap.offerings.find((offering: { offId: string }) => {
      const scheme = initialBootstrap.assessmentSchemesByOffering[offering.offId]
      return Array.isArray(scheme?.quizComponents)
        && scheme.quizComponents.length > 0
        && (initialBootstrap.studentsByOffering[offering.offId]?.length ?? 0) > 0
    })
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a proof-scoped offering with quiz components')

    const targetStudent = initialBootstrap.studentsByOffering[targetOffering.offId][0]
    expect(targetStudent).toBeTruthy()
    if (!targetStudent) throw new Error('Expected a proof-scoped student with quiz visibility')
    const canonicalStudentId = String(targetStudent.id).split('::').at(-1) ?? String(targetStudent.id)

    await current.db.update(sectionOfferings).set({
      stage: 1,
      quizLocked: 0,
      updatedAt: '2026-03-16T01:00:00.000Z',
    }).where(eq(sectionOfferings.offeringId, targetOffering.offId))
    await current.db.update(simulationRuns).set({
      activeStageKey: 'post-assignments',
      updatedAt: '2026-03-16T01:00:00.000Z',
    }).where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    const stageBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const stageStudent = stageBootstrap.studentsByOffering[targetOffering.offId].find((student: { id: string }) => student.id === targetStudent.id)
    expect(stageStudent).toBeTruthy()
    if (!stageStudent) throw new Error('Expected a stage-scoped bootstrap student before quiz entry')

    const quizComponents = stageBootstrap.assessmentSchemesByOffering[targetOffering.offId].quizComponents.map((component: { id: string; rawMax: number }) => ({
      componentCode: component.id,
      score: 0,
      maxScore: component.rawMax,
    }))
    expect(quizComponents.length).toBeGreaterThan(0)

    const quizCommitResponse = await current.app.inject({
      method: 'PUT',
      url: `/api/academic/offerings/${targetOffering.offId}/assessment-entries/quiz`,
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        entries: [{
          studentId: targetStudent.id,
          components: quizComponents,
        }],
        lock: false,
      },
    })
    expect(quizCommitResponse.statusCode).toBe(200)

    const afterQuizBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const afterQuizStudent = afterQuizBootstrap.studentsByOffering[targetOffering.offId].find((student: { id: string }) => student.id === targetStudent.id)
    expect(afterQuizStudent).toBeTruthy()
    if (!afterQuizStudent) throw new Error('Expected a stage-scoped bootstrap student after quiz entry')
    expect(afterQuizStudent.riskProb).not.toBe(stageStudent.riskProb)
    expect(afterQuizStudent.quiz1 ?? afterQuizStudent.quiz2).toBe(0)

    const studentPatchRow = await current.db
      .select()
      .from(academicRuntimeState)
      .where(eq(academicRuntimeState.stateKey, 'studentPatches'))
      .then(rows => rows[0] ?? null)
    const studentPatchPayload = JSON.parse(studentPatchRow?.payloadJson ?? '{}') as Record<string, Record<string, unknown>>
    expect(studentPatchPayload[`${targetOffering.offId}::${canonicalStudentId}`]).toMatchObject({
      quizScores: Object.fromEntries(quizComponents.map((component: { componentCode: string; score: number }) => [component.componentCode, component.score])),
    })

    await current.db.update(simulationRuns).set({
      activeStageKey: 'pre-tt1',
      updatedAt: '2026-03-16T02:00:00.000Z',
    }).where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    const preTt1Bootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const preTt1Student = preTt1Bootstrap.studentsByOffering[targetOffering.offId].find((student: { id: string }) => student.id === targetStudent.id)
    expect(preTt1Student).toBeTruthy()
    if (!preTt1Student) throw new Error('Expected a bootstrap student after authoritative stage rewind')
    expect(preTt1Student.quiz1).toBeNull()
    expect(preTt1Student.quiz2).toBeNull()
  })

  it('keeps checkpoint playback summaries bound to the selected checkpoint timeline', async () => {
    current = await createTestApp()
    const facultyLogin = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    const liveBootstrap = await loadAcademicBootstrap(facultyLogin.cookie)
    const targetOffering = liveBootstrap.offerings.find((offering: { offId: string }) => (
      (liveBootstrap.studentsByOffering[offering.offId]?.length ?? 0) > 0
    ))
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a proof-scoped offering for checkpoint binding validation')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    if (!activeRun) throw new Error('Expected an active proof run for checkpoint binding validation')
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)

    const [selectedCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, targetOffering.sem),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
    expect(selectedCheckpoint).toBeTruthy()
    if (!selectedCheckpoint) throw new Error('Expected a checkpoint in the target offering semester')

    const checkpointBootstrap = await loadAcademicBootstrap(facultyLogin.cookie, selectedCheckpoint.simulationStageCheckpointId)
    const checkpointStudent = checkpointBootstrap.studentsByOffering[targetOffering.offId]?.[0]
    expect(checkpointStudent).toBeTruthy()
    if (!checkpointStudent) throw new Error('Expected a checkpoint-scoped bootstrap student')
    const canonicalStudentId = String(checkpointStudent.id).split('::').at(-1) ?? String(checkpointStudent.id)
    const injectedCgpa = checkpointStudent.currentCgpa >= 9 ? 0.25 : checkpointStudent.currentCgpa + 1.11
    const injectedBacklogCount = checkpointStudent.flags.backlog ? 0 : 7
    const injectedObservedAt = new Date(Date.parse(selectedCheckpoint.createdAt) + (24 * 60 * 60 * 1000)).toISOString()

    await current.db.insert(studentObservedSemesterStates).values({
      studentObservedSemesterStateId: 'observed_state_future_of_selected_checkpoint',
      simulationRunId: selectedCheckpoint.simulationRunId,
      studentId: canonicalStudentId,
      termId: targetOffering.termId,
      semesterNumber: selectedCheckpoint.semesterNumber,
      sectionCode: targetOffering.section,
      observedStateJson: JSON.stringify({
        offeringId: targetOffering.offId,
        cgpa: injectedCgpa,
        backlogCount: injectedBacklogCount,
      }),
      createdAt: injectedObservedAt,
      updatedAt: injectedObservedAt,
    })

    const refreshedCheckpointBootstrap = await loadAcademicBootstrap(facultyLogin.cookie, selectedCheckpoint.simulationStageCheckpointId)
    const refreshedCheckpointStudent = refreshedCheckpointBootstrap.studentsByOffering[targetOffering.offId]?.find((student: { id: string }) => student.id === checkpointStudent.id)

    expect(refreshedCheckpointStudent).toBeTruthy()
    if (!refreshedCheckpointStudent) throw new Error('Expected the checkpoint-scoped student after injecting a future observed row')
    expect(refreshedCheckpointStudent.currentCgpa).toBe(checkpointStudent.currentCgpa)
    expect(refreshedCheckpointStudent.currentCgpa).not.toBe(injectedCgpa)
    expect(refreshedCheckpointStudent.flags.backlog).toBe(checkpointStudent.flags.backlog)
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

  it('keeps Sem1 checkpoint bootstrap restorable for the scoped course leader after proof recompute', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const login = await loginAs(current.app, 'rohit.menon', 'faculty1234')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)

    const [semOneCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 1),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
    expect(semOneCheckpoint).toBeTruthy()

    const response = await current.app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(semOneCheckpoint!.simulationStageCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(response.statusCode).toBe(200)
    const bootstrap = response.json()
    expect(bootstrap.faculty.map((item: { facultyId: string }) => item.facultyId)).toContain('mnc_t2')
    expect(bootstrap.offerings.length).toBeGreaterThan(0)
  }, 300000)

  it('projects teacher attendance edits into recomputed proof checkpoint evidence', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    const login = await loginAs(current.app, 'rohit.menon', 'faculty1234')
    const activeRole = login.body.activeRoleGrant.roleCode === 'COURSE_LEADER'
      ? login.body
      : (await switchToRole(login.cookie, login.body.availableRoleGrants, 'COURSE_LEADER')).json()
    expect(activeRole.activeRoleGrant.roleCode).toBe('COURSE_LEADER')

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()

    const setupRecomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(setupRecomputeResponse.statusCode).toBe(200)

    const attendanceResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/offerings/mnc_s1_amc_s1_02_a/attendance',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        capturedAt: '2026-03-16T02:00:00.000Z',
        entries: [{
          studentId: 'mnc_student_001',
          presentClasses: 1,
          totalClasses: 2,
        }],
      },
    })
    expect(attendanceResponse.statusCode).toBe(200)

    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${activeRun.simulationRunId}/recompute-risk`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)

    const [postSeeCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 1),
      eq(simulationStageCheckpoints.stageKey, 'post-see'),
    ))
    expect(postSeeCheckpoint).toBeTruthy()

    const [projection] = await current.db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageStudentProjections.simulationStageCheckpointId, postSeeCheckpoint!.simulationStageCheckpointId),
      eq(simulationStageStudentProjections.studentId, 'mnc_student_001'),
      eq(simulationStageStudentProjections.offeringId, 'mnc_s1_amc_s1_02_a'),
    ))
    expect(projection).toBeTruthy()

    const projectionPayload = JSON.parse(projection!.projectionJson) as {
      currentEvidence?: { attendancePct?: number }
    }
    expect(projectionPayload.currentEvidence?.attendancePct).toBe(50)
  }, 300000)

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
