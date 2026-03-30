import { and, asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  academicAssets,
  facultyOfferingOwnerships,
  mentorAssignments,
  simulationRuns,
  simulationStageCheckpoints,
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

async function grantCourseOwnership(cookie: string, offeringId: string, facultyId = 't1') {
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
    expect(profile.mentorScope.activeStudentCount).toBeGreaterThan(0)
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
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    await grantCourseOwnership(adminLogin.cookie, 'c3-A')
    const login = await loginAs(current.app, 'kavitha.rao', '1234')

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
    expect(snapshot.professor).toMatchObject({
      id: 't1',
      name: 'Dr. Kavitha Rao',
      dept: 'CSE',
      role: 'Course Leader',
    })
    expect(snapshot.faculty.some((faculty: { facultyId: string }) => faculty.facultyId === 'legacy-faculty')).toBe(false)
    expect(snapshot.offerings.some((offering: { offId: string }) => offering.offId === 'legacy-offering')).toBe(false)
    expect(snapshot.faculty.find((faculty: { facultyId: string }) => faculty.facultyId === 't1')?.allowedRoles).toContain('Course Leader')
    expect(snapshot.offerings.find((offering: { offId: string }) => offering.offId === 'c3-A')?.title).toBe('Design & Analysis of Algorithms')
    expect(snapshot.studentsByOffering['c3-A']?.length ?? 0).toBeGreaterThan(0)
    expect(snapshot.studentHistoryByUsn['1MS23CS001']).toMatchObject({
      usn: '1MS23CS001',
      studentName: 'Aarav Sharma',
    })
    expect(Array.isArray(snapshot.runtime.tasks)).toBe(true)
  })

  it('reflects admin master-data changes into the academic bootstrap on the next fetch', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    await grantCourseOwnership(adminLogin.cookie, 'c3-A')
    const academicLogin = await loginAs(current.app, 'kavitha.rao', '1234')

    const coursePatch = await current.app.inject({
      method: 'PATCH',
      url: '/api/admin/courses/c3',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseCode: 'CS401',
        title: 'Algorithms and Performance Engineering',
        defaultCredits: 4,
        departmentId: 'dept_cse',
        status: 'active',
        version: 1,
      },
    })
    expect(coursePatch.statusCode).toBe(200)

    const ownershipPatch = await current.app.inject({
      method: 'PATCH',
      url: '/api/admin/offering-ownership/ownership_t2_c6-A',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        offeringId: 'c6-A',
        facultyId: 't1',
        ownershipRole: 'owner',
        status: 'active',
        version: 1,
      },
    })
    expect(ownershipPatch.statusCode).toBe(200)

    const bootstrap = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: academicLogin.cookie },
    })
    expect(bootstrap.statusCode).toBe(200)
    const snapshot = bootstrap.json()

    expect(snapshot.offerings.find((offering: { offId: string }) => offering.offId === 'c3-A')?.title).toBe('Algorithms and Performance Engineering')
    const t1 = snapshot.faculty.find((faculty: { facultyId: string }) => faculty.facultyId === 't1')
    expect(t1?.offeringIds).toContain('c6-A')
    expect(t1?.courseCodes).toContain('CS601')
  })

  it('persists resolved course outcomes, offering schemes, and question papers through backend-owned routes', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    await grantCourseOwnership(adminLogin.cookie, 'c3-A')
    const facultyLogin = await loginAs(current.app, 'kavitha.rao', '1234')

    const overrideResponse = await current.app.inject({
      method: 'POST',
      url: '/api/admin/course-outcomes',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseId: 'c3',
        scopeType: 'branch',
        scopeId: 'branch_cse_btech',
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
      url: '/api/admin/offerings/c3-A/resolved-course-outcomes',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(resolvedOutcomesResponse.statusCode).toBe(200)
    expect(resolvedOutcomesResponse.json()).toMatchObject({
      offeringId: 'c3-A',
      courseId: 'c3',
      outcomes: [
        expect.objectContaining({ id: 'CO1', bloom: 'Analyze' }),
        expect.objectContaining({ id: 'CO2', bloom: 'Create' }),
      ],
    })

    const invalidSchemeResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/offerings/c3-A/scheme',
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
      url: '/api/academic/offerings/c3-A/scheme',
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
          lastEditedBy: 't1',
        },
      },
    })
    expect(schemeResponse.statusCode).toBe(200)
    expect(schemeResponse.json().scheme.status).toBe('Configured')

    const invalidBlueprintResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/offerings/c3-A/question-papers/tt1',
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
      url: '/api/academic/offerings/c3-A/question-papers/tt1',
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

    const bootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(bootstrapResponse.statusCode).toBe(200)
    const bootstrap = bootstrapResponse.json()
    expect(bootstrap.courseOutcomesByOffering['c3-A']).toEqual([
      expect.objectContaining({ id: 'CO1', bloom: 'Analyze' }),
      expect.objectContaining({ id: 'CO2', bloom: 'Create' }),
    ])
    expect(bootstrap.assessmentSchemesByOffering['c3-A']).toMatchObject({
      status: 'Configured',
      quizCount: 2,
      assignmentCount: 2,
    })
    expect(bootstrap.questionPapersByOffering['c3-A'].tt1.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tt1-q1', cos: ['CO2'] }),
      expect.objectContaining({ id: 'tt1-q2', cos: ['CO1'] }),
    ]))
  })

  it('persists authoritative queue, calendar workspace, attendance, and TT1 entry state through the teaching routes', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')
    await grantCourseOwnership(adminLogin.cookie, 'c3-A')
    await grantCourseOwnership(adminLogin.cookie, 'c3-B')
    await grantCourseOwnership(adminLogin.cookie, 'c4-C')
    const offeringUnlockResponse = await current.app.inject({
      method: 'PATCH',
      url: '/api/admin/offerings/c3-A',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        courseId: 'c3',
        termId: 'term_cse_sem4',
        branchId: 'branch_cse_btech',
        sectionCode: 'A',
        yearLabel: '2nd Year',
        attendance: 76,
        studentCount: 58,
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
        version: 1,
      },
    })
    expect(offeringUnlockResponse.statusCode).toBe(200)
    const facultyLogin = await loginAs(current.app, 'kavitha.rao', '1234')

    const initialBootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(initialBootstrapResponse.statusCode).toBe(200)
    const initialBootstrap = initialBootstrapResponse.json()
    const targetOffering = initialBootstrap.offerings.find((offering: { offId: string }) => offering.offId === 'c3-A')
    expect(targetOffering).toBeTruthy()
    const targetStudent = initialBootstrap.studentsByOffering[targetOffering.offId][0]
    const canonicalStudentId = String(targetStudent.id).split('::').at(-1)
    expect(targetStudent).toBeTruthy()

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
          actorTeacherId: 't1',
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
          facultyId: 't1',
          actorRole: 'Course Leader',
          actorFacultyId: 't1',
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
      url: '/api/academic/faculty-calendar-workspace/t1',
      headers: { cookie: facultyLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        template: {
          ...initialBootstrap.runtime.timetableByFacultyId.t1,
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
          components: [
            { componentCode: 'tt1-q1-p1', score: 4, maxScore: 5 },
            { componentCode: 'tt1-q2-p1', score: 5, maxScore: 5 },
            { componentCode: 'tt1-q3-p1', score: 4, maxScore: 5 },
            { componentCode: 'tt1-q4-p1', score: 3, maxScore: 5 },
            { componentCode: 'tt1-q5-p1', score: 4, maxScore: 5 },
          ],
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

    const finalBootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: facultyLogin.cookie },
    })
    expect(finalBootstrapResponse.statusCode).toBe(200)
    const finalBootstrap = finalBootstrapResponse.json()
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
    expect(finalBootstrap.runtime.timetableByFacultyId.t1).toBeTruthy()
    expect(finalBootstrap.runtime.lockByOffering[targetOffering.offId]).toMatchObject({
      attendance: true,
      tt1: true,
    })
    expect(finalBootstrap.runtime.studentPatches[`${targetOffering.offId}::${canonicalStudentId}`]).toMatchObject({
      present: 34,
      totalClasses: 40,
      tt1LeafScores: {
        'tt1-q1-p1': 4,
        'tt1-q2-p1': 5,
      },
    })
    expect(refreshedStudent).toMatchObject({
      present: 34,
      totalClasses: 40,
      tt1Score: 20,
      tt1Max: 25,
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
    expect(finalBootstrap.coAttainmentByOffering[targetOffering.offId]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        coId: 'CO1',
        tt1Attainment: expect.any(Number),
        overallAttainment: expect.any(Number),
      }),
    ]))
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

    const [selectedCheckpoint] = await current.db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, 6),
    )).orderBy(asc(simulationStageCheckpoints.stageOrder))
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
    expect(courseLeaderCheckpointProfile.proofOperations.activeOperationalSemester).toBe(6)
    expect(Array.isArray(courseLeaderCheckpointProfile.proofOperations.monitoringQueue)).toBe(true)

    const courseLeaderProfile = await loadProfileForRole('COURSE_LEADER')
    expect(courseLeaderProfile.currentOwnedClasses.every((item: { offeringId: string }) => ownedOfferingIds.has(item.offeringId))).toBe(true)
    expect(courseLeaderProfile.proofOperations.monitoringQueue.every((item: { offeringId: string }) => ownedOfferingIds.has(item.offeringId))).toBe(true)
    if (courseLeaderProfile.proofOperations.monitoringQueue[0]) {
      const studentId = courseLeaderProfile.proofOperations.monitoringQueue[0].studentId as string
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

    const mentorCheckpointProfile = await loadProfileForRole('MENTOR', selectedCheckpoint.simulationStageCheckpointId)
    expect(mentorCheckpointProfile.proofOperations.scopeMode).toBe('proof')
    expect(mentorCheckpointProfile.proofOperations.countSource).toBe('proof-checkpoint')
    expect(Array.isArray(mentorCheckpointProfile.proofOperations.monitoringQueue)).toBe(true)

    const mentorProfile = await loadProfileForRole('MENTOR')
    expect(mentorProfile.mentorScope.activeStudentCount).toBe(mentorStudentIds.size)
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
})
