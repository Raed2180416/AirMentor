import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageQueueProjections,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_NOW } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('academic bootstrap proof calendar bridge', () => {
  it('bridges primary actionable proof queue projections into workflow tasks and uses simulated date authority', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(login.response.statusCode).toBe(200)

    const baselineBootstrapResponse = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie: login.cookie },
    })
    expect(baselineBootstrapResponse.statusCode).toBe(200)
    const baselineBootstrap = baselineBootstrapResponse.json()
    const targetOffering = baselineBootstrap.offerings[0]
    expect(targetOffering).toBeTruthy()
    if (!targetOffering) throw new Error('Expected a visible offering for the proof calendar bridge test')
    const targetStudent = baselineBootstrap.studentsByOffering[targetOffering.offId]?.[0]
    expect(targetStudent).toBeTruthy()
    if (!targetStudent) throw new Error('Expected a visible student for the proof calendar bridge test')

    const canonicalStudentId = String(targetStudent.id).split('::').at(-1) ?? String(targetStudent.id)
    const activeRunRows = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    const activeRun = activeRunRows[0]
    expect(activeRun).toBeTruthy()
    if (!activeRun) throw new Error('Expected an active proof run for the proof calendar bridge test')

    const checkpointRows = await current.db
      .select()
      .from(simulationStageCheckpoints)
      .where(eq(simulationStageCheckpoints.simulationRunId, activeRun.simulationRunId))
    let targetCheckpoint = checkpointRows.find(row => row.semesterNumber === targetOffering.sem) ?? checkpointRows[0]
    if (!targetCheckpoint) {
      const [createdCheckpoint] = await current.db.insert(simulationStageCheckpoints).values({
        simulationStageCheckpointId: `proof_calendar_bridge_checkpoint_${targetOffering.offId}`,
        simulationRunId: activeRun.simulationRunId,
        semesterNumber: targetOffering.sem,
        stageKey: 'post-tt1',
        stageLabel: 'Post TT1',
        stageDescription: 'Synthetic checkpoint seeded for proof calendar bridge isolation.',
        stageOrder: 2,
        previousCheckpointId: null,
        nextCheckpointId: null,
        summaryJson: JSON.stringify({
          source: 'academic-proof-calendar-bridge.test',
          intent: 'minimal checkpoint for workflow-task projection bridge',
        }),
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
      }).returning()
      targetCheckpoint = createdCheckpoint
    }
    expect(targetCheckpoint).toBeTruthy()
    if (!targetCheckpoint) throw new Error('Expected a checkpoint for the proof calendar bridge test')

    const queueCaseId = `proof_queue_case_bridge_${targetOffering.offId}`
    const primaryProjectionId = `proof_queue_projection_primary_${targetOffering.offId}`
    const supportingProjectionId = `proof_queue_projection_support_${targetOffering.offId}`
    const simulatedDateIso = '2026-03-20T00:00:00.000Z'
    const dueAt = '2026-03-20T10:00:00.000Z'

    await current.db
      .update(simulationRuns)
      .set({
        simulatedDateIso,
        updatedAt: TEST_NOW,
      })
      .where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    await current.db.insert(simulationStageQueueCases).values({
      simulationStageQueueCaseId: queueCaseId,
      simulationStageCheckpointId: targetCheckpoint.simulationStageCheckpointId,
      simulationRunId: activeRun.simulationRunId,
      studentId: canonicalStudentId,
      primaryOfferingId: targetOffering.offId,
      semesterNumber: targetOffering.sem,
      sectionCode: targetOffering.section,
      stageKey: targetCheckpoint.stageKey,
      assignedToRole: 'Course Leader',
      assignedFacultyId: login.body.faculty.facultyId,
      status: 'Open',
      recommendedAction: 'Targeted tutoring',
      dueAt,
      countsTowardCapacity: 1,
      priorityRank: 1,
      governanceReason: 'admitted_under_section_and_faculty_caps',
      primaryCourseCode: targetOffering.code,
      primaryCourseTitle: targetOffering.title,
      supportingCourseCount: 1,
      supportingSourceKeysJson: JSON.stringify(['supporting-source']),
      caseJson: JSON.stringify({
        caseKey: queueCaseId,
        stageKey: targetCheckpoint.stageKey,
        priorityRank: 1,
      }),
      detailJson: JSON.stringify({
        queueCaseId,
        primaryCase: true,
        countsTowardCapacity: true,
        dueAt,
        note: 'Proof queue follow-up should bridge into the academic calendar task lane.',
        priorityRank: 1,
        governanceReason: 'admitted_under_section_and_faculty_caps',
        assignedFacultyId: login.body.faculty.facultyId,
      }),
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    await current.db.insert(simulationStageQueueProjections).values([
      {
        simulationStageQueueProjectionId: primaryProjectionId,
        simulationStageCheckpointId: targetCheckpoint.simulationStageCheckpointId,
        simulationRunId: activeRun.simulationRunId,
        simulationStageQueueCaseId: queueCaseId,
        studentId: canonicalStudentId,
        offeringId: targetOffering.offId,
        semesterNumber: targetOffering.sem,
        sectionCode: targetOffering.section,
        courseCode: targetOffering.code,
        courseTitle: targetOffering.title,
        assignedToRole: 'Course Leader',
        assignedFacultyId: login.body.faculty.facultyId,
        taskType: 'Follow-up',
        status: 'Open',
        riskBand: 'High',
        riskProbScaled: 83,
        noActionRiskProbScaled: 91,
        recommendedAction: 'Targeted tutoring',
        simulatedActionTaken: 'Targeted tutoring',
        detailJson: JSON.stringify({
          queueCaseId,
          primaryCase: true,
          countsTowardCapacity: true,
          dueAt,
          note: 'Proof queue follow-up should bridge into the academic calendar task lane.',
          priorityRank: 1,
          governanceReason: 'admitted_under_section_and_faculty_caps',
          assignedFacultyId: login.body.faculty.facultyId,
        }),
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
      },
      {
        simulationStageQueueProjectionId: supportingProjectionId,
        simulationStageCheckpointId: targetCheckpoint.simulationStageCheckpointId,
        simulationRunId: activeRun.simulationRunId,
        simulationStageQueueCaseId: queueCaseId,
        studentId: canonicalStudentId,
        offeringId: targetOffering.offId,
        semesterNumber: targetOffering.sem,
        sectionCode: targetOffering.section,
        courseCode: targetOffering.code,
        courseTitle: targetOffering.title,
        assignedToRole: 'Course Leader',
        assignedFacultyId: login.body.faculty.facultyId,
        taskType: 'Follow-up',
        status: 'Open',
        riskBand: 'High',
        riskProbScaled: 83,
        noActionRiskProbScaled: 91,
        recommendedAction: 'Targeted tutoring',
        simulatedActionTaken: 'Targeted tutoring',
        detailJson: JSON.stringify({
          queueCaseId,
          primaryCase: false,
          countsTowardCapacity: false,
          dueAt,
          note: 'Supporting row should not create a duplicate workflow task.',
          priorityRank: 1,
          governanceReason: 'admitted_under_section_and_faculty_caps',
          assignedFacultyId: login.body.faculty.facultyId,
        }),
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
      },
    ])

    const proofBootstrapResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(targetCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(proofBootstrapResponse.statusCode).toBe(200)
    const proofBootstrap = proofBootstrapResponse.json()

    expect(proofBootstrap.proofPlayback).toMatchObject({
      simulationRunId: activeRun.simulationRunId,
      simulationStageCheckpointId: targetCheckpoint.simulationStageCheckpointId,
      currentDateISO: '2026-03-20',
    })

    const bridgedTasks = proofBootstrap.runtime.tasks.filter((task: { id: string }) => task.id === `proof-workflow-task::${queueCaseId}`)
    expect(bridgedTasks).toHaveLength(1)
    expect(bridgedTasks[0]).toMatchObject({
      assignedTo: 'Course Leader',
      offeringId: targetOffering.offId,
      studentId: canonicalStudentId,
      dueDateISO: '2026-03-20',
      due: 'Today',
      riskBand: 'High',
      taskType: 'Follow-up',
      sourceRole: 'System',
    })

    await current.db
      .update(simulationRuns)
      .set({
        simulatedDateIso: '2026-03-21T00:00:00.000Z',
        updatedAt: TEST_NOW,
      })
      .where(eq(simulationRuns.simulationRunId, activeRun.simulationRunId))

    const advancedDayBootstrapResponse = await current.app.inject({
      method: 'GET',
      url: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(targetCheckpoint.simulationStageCheckpointId)}`,
      headers: { cookie: login.cookie },
    })
    expect(advancedDayBootstrapResponse.statusCode).toBe(200)
    const advancedDayBootstrap = advancedDayBootstrapResponse.json()
    expect(advancedDayBootstrap.proofPlayback).toMatchObject({
      simulationRunId: activeRun.simulationRunId,
      simulationStageCheckpointId: targetCheckpoint.simulationStageCheckpointId,
      currentDateISO: '2026-03-21',
    })
    const advancedDayTasks = advancedDayBootstrap.runtime.tasks.filter((task: { id: string }) => task.id === `proof-workflow-task::${queueCaseId}`)
    expect(advancedDayTasks).toHaveLength(1)
    expect(advancedDayTasks[0]).toMatchObject({
      dueDateISO: '2026-03-20',
      due: 'Overdue',
    })
  })
})
