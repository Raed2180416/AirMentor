import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { academicRuntimeState } from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

type RuntimeChangeSet = {
  task: Record<string, unknown> & { id: string }
  placement: Record<string, unknown> & { taskId: string }
  auditEvent: Record<string, unknown> & { id: string }
}

type AcademicBootstrapRuntimeView = {
  runtime: {
    tasks: Array<{ id: string }>
    taskPlacements: Record<string, Record<string, unknown> | undefined>
    calendarAudit: Array<{ id: string }>
  }
}

async function loginCourseLeader(app: FastifyInstance) {
  const login = await loginAs(app, 'devika.shetty', 'faculty1234')
  expect(login.response.statusCode).toBe(200)
  return login.cookie
}

async function pickRuntimeScope(app: FastifyInstance, cookie: string) {
  const bootstrapResponse = await app.inject({
    method: 'GET',
    url: '/api/academic/bootstrap',
    headers: { cookie },
  })
  expect(bootstrapResponse.statusCode).toBe(200)
  const bootstrap = bootstrapResponse.json()
  const targetOffering = bootstrap.offerings[0]
  expect(targetOffering).toBeTruthy()
  const targetStudent = bootstrap.studentsByOffering[targetOffering.offId]?.[0]
  expect(targetStudent).toBeTruthy()
  return {
    bootstrap,
    targetOffering,
    targetStudent,
  }
}

function buildRuntimeChangeSet(scope: Awaited<ReturnType<typeof pickRuntimeScope>>): RuntimeChangeSet {
  const taskId = `narrow-runtime-task-${scope.targetStudent.id}`
  return {
    task: {
      id: taskId,
      studentId: scope.targetStudent.id,
      studentName: scope.targetStudent.name,
      studentUsn: scope.targetStudent.usn,
      offeringId: scope.targetOffering.offId,
      courseCode: scope.targetOffering.code,
      courseName: scope.targetOffering.title,
      year: scope.targetOffering.year,
      riskProb: 0.64,
      riskBand: 'Medium',
      title: 'Follow-up: confirm checkpoint recovery plan',
      due: 'Today',
      dueDateISO: '2026-03-20',
      status: 'In Progress',
      actionHint: 'Meet the student and confirm the next remedial checkpoint.',
      priority: 64,
      createdAt: Date.parse('2026-03-16T09:00:00.000Z'),
      updatedAt: Date.parse('2026-03-16T09:15:00.000Z'),
      assignedTo: 'Course Leader',
      taskType: 'Follow-up',
      manual: true,
      sourceRole: 'Course Leader',
      transitionHistory: [
        {
          id: `transition-${taskId}`,
          at: Date.parse('2026-03-16T09:15:00.000Z'),
          actorRole: 'Course Leader',
          actorTeacherId: scope.bootstrap.professor.id,
          action: 'Created',
          fromOwner: 'Course Leader',
          toOwner: 'Course Leader',
          note: 'Direct follow-up created from the proof playback review.',
        },
      ],
    },
    placement: {
      taskId,
      dateISO: '2026-03-20',
      placementMode: 'timed',
      startMinutes: 570,
      endMinutes: 600,
      startTime: '09:30',
      endTime: '10:00',
      updatedAt: Date.parse('2026-03-16T09:20:00.000Z'),
    },
    auditEvent: {
      id: `calendar-audit-${taskId}`,
      eventId: `calendar-audit-${taskId}`,
      facultyId: scope.bootstrap.professor.id,
      actorRole: 'Course Leader',
      actorFacultyId: scope.bootstrap.professor.id,
      timestamp: Date.parse('2026-03-16T09:25:00.000Z'),
      at: Date.parse('2026-03-16T09:25:00.000Z'),
      actionKind: 'task-created-and-scheduled',
      action: 'task-created-and-scheduled',
      targetType: 'task',
      targetId: taskId,
      note: 'Created and scheduled the checkpoint follow-up from the academic timeline.',
      after: {
        dateISO: '2026-03-20',
        startMinutes: 570,
        endMinutes: 600,
        placementMode: 'timed',
        offeringId: scope.targetOffering.offId,
      },
    },
  }
}

async function applyRuntimeChanges(
  app: FastifyInstance,
  cookie: string,
  mode: 'narrow' | 'sync',
  changeSet: RuntimeChangeSet,
) {
  const finalTask = {
    ...changeSet.task,
    title: 'Follow-up: confirm checkpoint recovery plan and mentor handoff',
  }

  if (mode === 'narrow') {
    const taskCreateResponse = await app.inject({
      method: 'PUT',
      url: `/api/academic/tasks/${changeSet.task.id}`,
      headers: { cookie, origin: TEST_ORIGIN },
      payload: { task: changeSet.task },
    })
    expect(taskCreateResponse.statusCode).toBe(200)

    const createdTask = taskCreateResponse.json()
    expect(createdTask.created).toBe(true)
    expect(createdTask.task.version).toBe(1)

    const taskUpdateResponse = await app.inject({
      method: 'PUT',
      url: `/api/academic/tasks/${changeSet.task.id}`,
      headers: { cookie, origin: TEST_ORIGIN },
      payload: {
        task: {
          ...finalTask,
        },
        expectedVersion: createdTask.task.version,
      },
    })
    expect(taskUpdateResponse.statusCode).toBe(200)
    const updatedTask = taskUpdateResponse.json()
    expect(updatedTask.created).toBe(false)
    expect(updatedTask.task.version).toBe(2)

    const taskConflictResponse = await app.inject({
      method: 'PUT',
      url: `/api/academic/tasks/${changeSet.task.id}`,
      headers: { cookie, origin: TEST_ORIGIN },
      payload: {
        task: {
          ...changeSet.task,
          title: 'Stale write should be rejected',
        },
        expectedVersion: 1,
      },
    })
    expect(taskConflictResponse.statusCode).toBe(409)

    const taskListResponse = await app.inject({
      method: 'GET',
      url: '/api/academic/tasks',
      headers: { cookie },
    })
    expect(taskListResponse.statusCode).toBe(200)
    expect(taskListResponse.json().items.some((item: { id: string; version: number }) => item.id === changeSet.task.id && item.version === 2)).toBe(true)

    const placementCreateResponse = await app.inject({
      method: 'PUT',
      url: `/api/academic/task-placements/${changeSet.placement.taskId}`,
      headers: { cookie, origin: TEST_ORIGIN },
      payload: {
        placement: changeSet.placement,
      },
    })
    expect(placementCreateResponse.statusCode).toBe(200)
    const createdPlacement = placementCreateResponse.json()
    expect(createdPlacement.created).toBe(true)

    const placementConflictResponse = await app.inject({
      method: 'PUT',
      url: `/api/academic/task-placements/${changeSet.placement.taskId}`,
      headers: { cookie, origin: TEST_ORIGIN },
      payload: {
        placement: {
          ...changeSet.placement,
          endMinutes: 615,
          endTime: '10:15',
        },
        expectedUpdatedAt: 0,
      },
    })
    expect(placementConflictResponse.statusCode).toBe(409)

    const placementListResponse = await app.inject({
      method: 'GET',
      url: '/api/academic/task-placements',
      headers: { cookie },
    })
    expect(placementListResponse.statusCode).toBe(200)
    expect(placementListResponse.json().items.some((item: { taskId: string }) => item.taskId === changeSet.placement.taskId)).toBe(true)

    const calendarAppendResponse = await app.inject({
      method: 'POST',
      url: '/api/academic/calendar-audit',
      headers: { cookie, origin: TEST_ORIGIN },
      payload: { event: changeSet.auditEvent },
    })
    expect(calendarAppendResponse.statusCode).toBe(200)
    expect(calendarAppendResponse.json().created).toBe(true)

    const calendarAppendRepeatResponse = await app.inject({
      method: 'POST',
      url: '/api/academic/calendar-audit',
      headers: { cookie, origin: TEST_ORIGIN },
      payload: { event: changeSet.auditEvent },
    })
    expect(calendarAppendRepeatResponse.statusCode).toBe(200)
    expect(calendarAppendRepeatResponse.json().created).toBe(false)

    const calendarListResponse = await app.inject({
      method: 'GET',
      url: '/api/academic/calendar-audit',
      headers: { cookie },
    })
    expect(calendarListResponse.statusCode).toBe(200)
    expect(calendarListResponse.json().items.some((item: { id: string }) => item.id === changeSet.auditEvent.id)).toBe(true)
    return
  }

  const taskSyncResponse = await app.inject({
    method: 'PUT',
    url: '/api/academic/tasks/sync',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { tasks: [finalTask] },
  })
  expect(taskSyncResponse.statusCode).toBe(200)
  expect(taskSyncResponse.headers.deprecation).toBe('true')
  expect(taskSyncResponse.headers['x-airmentor-compatibility-route']).toBe('true')
  expect(String(taskSyncResponse.headers.link ?? '')).toContain('/api/academic/tasks')

  const taskSyncUpdateResponse = await app.inject({
    method: 'PUT',
    url: '/api/academic/tasks/sync',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: {
      tasks: [{
        ...changeSet.task,
        title: 'Follow-up: confirm checkpoint recovery plan and mentor handoff',
      }],
    },
  })
  expect(taskSyncUpdateResponse.statusCode).toBe(200)

  const taskPlacementSyncResponse = await app.inject({
    method: 'PUT',
    url: '/api/academic/task-placements/sync',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: {
      placements: {
        [changeSet.placement.taskId]: changeSet.placement,
      },
    },
  })
  expect(taskPlacementSyncResponse.statusCode).toBe(200)
  expect(taskPlacementSyncResponse.headers.deprecation).toBe('true')
  expect(taskPlacementSyncResponse.headers['x-airmentor-compatibility-route']).toBe('true')
  expect(String(taskPlacementSyncResponse.headers.link ?? '')).toContain('/api/academic/task-placements')

  const calendarAuditSyncResponse = await app.inject({
    method: 'PUT',
    url: '/api/academic/calendar-audit/sync',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: {
      events: [changeSet.auditEvent],
    },
  })
  expect(calendarAuditSyncResponse.statusCode).toBe(200)
  expect(calendarAuditSyncResponse.headers.deprecation).toBe('true')
  expect(calendarAuditSyncResponse.headers['x-airmentor-compatibility-route']).toBe('true')
  expect(String(calendarAuditSyncResponse.headers.link ?? '')).toContain('/api/academic/calendar-audit')
}

async function readRuntimeProjection(app: FastifyInstance, cookie: string, changeSet: RuntimeChangeSet) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/academic/bootstrap',
    headers: { cookie },
  })
  expect(response.statusCode).toBe(200)
  const bootstrap = response.json() as AcademicBootstrapRuntimeView
  return {
    task: bootstrap.runtime.tasks.find((item: { id: string }) => item.id === changeSet.task.id) ?? null,
    placement: bootstrap.runtime.taskPlacements[changeSet.placement.taskId] ?? null,
    auditEvent: bootstrap.runtime.calendarAudit.find((item: { id: string }) => item.id === changeSet.auditEvent.id) ?? null,
  }
}

describe('academic runtime narrow routes', () => {
  it('exposes additive per-entity task, placement, and calendar-audit routes with conflict handling', async () => {
    current = await createTestApp()
    const cookie = await loginCourseLeader(current.app)
    const scope = await pickRuntimeScope(current.app, cookie)
    const changeSet = buildRuntimeChangeSet(scope)

    await applyRuntimeChanges(current.app, cookie, 'narrow', changeSet)
    const runtime = await readRuntimeProjection(current.app, cookie, changeSet)

    expect(runtime.task).toMatchObject({
      id: changeSet.task.id,
      title: 'Follow-up: confirm checkpoint recovery plan and mentor handoff',
    })
    expect(runtime.placement).toMatchObject({
      taskId: changeSet.placement.taskId,
      dateISO: changeSet.placement.dateISO,
      placementMode: changeSet.placement.placementMode,
    })
    expect(runtime.auditEvent).toMatchObject({
      id: changeSet.auditEvent.id,
      targetId: changeSet.auditEvent.targetId,
    })
  })

  it('keeps bootstrap parity between the new per-entity routes and the legacy sync routes', async () => {
    const narrowApp = await createTestApp()
    const syncApp = await createTestApp()

    try {
      const narrowCookie = await loginCourseLeader(narrowApp.app)
      const syncCookie = await loginCourseLeader(syncApp.app)
      const narrowScope = await pickRuntimeScope(narrowApp.app, narrowCookie)
      const syncScope = await pickRuntimeScope(syncApp.app, syncCookie)
      const narrowChangeSet = buildRuntimeChangeSet(narrowScope)
      const syncChangeSet = buildRuntimeChangeSet(syncScope)

      await applyRuntimeChanges(narrowApp.app, narrowCookie, 'narrow', narrowChangeSet)
      await applyRuntimeChanges(syncApp.app, syncCookie, 'sync', syncChangeSet)

      const narrowRuntime = await readRuntimeProjection(narrowApp.app, narrowCookie, narrowChangeSet)
      const syncRuntime = await readRuntimeProjection(syncApp.app, syncCookie, syncChangeSet)

      expect(narrowRuntime).toEqual(syncRuntime)
    } finally {
      await narrowApp.close()
      await syncApp.close()
    }
  })

  it('marks the generic runtime slice endpoint as a deprecated compatibility surface', async () => {
    current = await createTestApp()
    const cookie = await loginCourseLeader(current.app)
    const scope = await pickRuntimeScope(current.app, cookie)

    const response = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/runtime/tasks',
      headers: { cookie, origin: TEST_ORIGIN },
      payload: [{
        id: 'compat-runtime-task',
        studentId: scope.targetStudent.id,
        offeringId: scope.targetOffering.offId,
        title: 'Compatibility runtime write',
      }],
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers.deprecation).toBe('true')
    expect(response.headers['x-airmentor-compatibility-route']).toBe('true')
    expect(String(response.headers.warning ?? '')).toContain('deprecated compatibility route')
  })

  it('marks deprecated compatibility routes with explicit deprecation headers', async () => {
    current = await createTestApp()
    const cookie = await loginCourseLeader(current.app)
    const scope = await pickRuntimeScope(current.app, cookie)
    const changeSet = buildRuntimeChangeSet(scope)

    const taskSyncResponse = await current.app.inject({
      method: 'PUT',
      url: '/api/academic/tasks/sync',
      headers: { cookie, origin: TEST_ORIGIN },
      payload: { tasks: [changeSet.task] },
    })

    expect(taskSyncResponse.statusCode).toBe(200)
    expect(taskSyncResponse.headers.deprecation).toBe('true')
    expect(taskSyncResponse.headers.sunset).toBe('2026-12-31T00:00:00Z')
    expect(String(taskSyncResponse.headers.warning ?? '')).toContain('/api/academic/tasks/sync')
  })

  it('leaves the legacy runtime shadow untouched when per-entity writes persist authoritative rows', async () => {
    current = await createTestApp()
    const cookie = await loginCourseLeader(current.app)
    const scope = await pickRuntimeScope(current.app, cookie)
    const changeSet = buildRuntimeChangeSet(scope)

    const staleShadowTaskId = `${changeSet.task.id}-shadow`
    const staleShadowAuditId = `${changeSet.auditEvent.id}-shadow`

    const runtimeSliceResponses = await Promise.all([
      current.app.inject({
        method: 'PUT',
        url: '/api/academic/runtime/tasks',
        headers: { cookie, origin: TEST_ORIGIN },
        payload: [{
          ...changeSet.task,
          id: staleShadowTaskId,
          title: 'Stale runtime shadow task',
        }],
      }),
      current.app.inject({
        method: 'PUT',
        url: '/api/academic/runtime/taskPlacements',
        headers: { cookie, origin: TEST_ORIGIN },
        payload: {
          [staleShadowTaskId]: {
            ...changeSet.placement,
            taskId: staleShadowTaskId,
            startMinutes: 630,
            endMinutes: 660,
            startTime: '10:30',
            endTime: '11:00',
          },
        },
      }),
      current.app.inject({
        method: 'PUT',
        url: '/api/academic/runtime/calendarAudit',
        headers: { cookie, origin: TEST_ORIGIN },
        payload: [{
          ...changeSet.auditEvent,
          id: staleShadowAuditId,
          eventId: staleShadowAuditId,
          targetId: staleShadowTaskId,
          note: 'Stale runtime shadow audit event.',
        }],
      }),
    ])
    runtimeSliceResponses.forEach(response => {
      expect(response.statusCode).toBe(200)
    })

    await applyRuntimeChanges(current.app, cookie, 'narrow', changeSet)

    const [tasksRow, placementsRow, auditRow] = await Promise.all([
      current.db
        .select()
        .from(academicRuntimeState)
        .where(eq(academicRuntimeState.stateKey, 'tasks'))
        .then(rows => rows[0] ?? null),
      current.db
        .select()
        .from(academicRuntimeState)
        .where(eq(academicRuntimeState.stateKey, 'taskPlacements'))
        .then(rows => rows[0] ?? null),
      current.db
        .select()
        .from(academicRuntimeState)
        .where(eq(academicRuntimeState.stateKey, 'calendarAudit'))
        .then(rows => rows[0] ?? null),
    ])

    const taskPayload = JSON.parse(tasksRow?.payloadJson ?? '[]') as Array<Record<string, unknown>>
    const placementPayload = JSON.parse(placementsRow?.payloadJson ?? '{}') as Record<string, Record<string, unknown>>
    const auditPayload = JSON.parse(auditRow?.payloadJson ?? '[]') as Array<Record<string, unknown>>

    expect(taskPayload.some(item => item.id === changeSet.task.id)).toBe(false)
    expect(placementPayload[changeSet.placement.taskId]).toBeUndefined()
    expect(auditPayload.some(item => item.id === changeSet.auditEvent.id)).toBe(false)

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie },
    })
    expect(response.statusCode).toBe(200)
    const bootstrap = response.json() as AcademicBootstrapRuntimeView
    expect(bootstrap.runtime.tasks.some((item: { id: string }) => item.id === changeSet.task.id)).toBe(true)
    expect(bootstrap.runtime.taskPlacements[changeSet.placement.taskId]).toMatchObject({
      taskId: changeSet.placement.taskId,
    })
    expect(bootstrap.runtime.calendarAudit.some((item: { id: string }) => item.id === changeSet.auditEvent.id)).toBe(true)
  })

  it('ignores shadow-only runtime extras once authoritative task, placement, and calendar rows exist', async () => {
    current = await createTestApp()
    const cookie = await loginCourseLeader(current.app)
    const scope = await pickRuntimeScope(current.app, cookie)
    const changeSet = buildRuntimeChangeSet(scope)
    await applyRuntimeChanges(current.app, cookie, 'narrow', changeSet)

    const shadowTaskId = `${changeSet.task.id}-shadow-only`
    const shadowTask = {
      ...changeSet.task,
      id: shadowTaskId,
      title: 'Ghost runtime shadow task',
      transitionHistory: [{
        id: `transition-${shadowTaskId}`,
        at: Date.parse('2026-03-16T09:45:00.000Z'),
        actorRole: 'Course Leader',
        actorTeacherId: scope.bootstrap.professor.id,
        action: 'Injected runtime shadow',
        fromOwner: 'Course Leader',
        toOwner: 'Course Leader',
        note: 'Should not leak once authoritative task rows exist.',
      }],
    }
    const shadowPlacement = {
      ...changeSet.placement,
      taskId: shadowTaskId,
      startMinutes: 630,
      endMinutes: 660,
      startTime: '10:30',
      endTime: '11:00',
      updatedAt: Date.parse('2026-03-16T09:50:00.000Z'),
    }
    const shadowAuditEvent = {
      ...changeSet.auditEvent,
      id: `${changeSet.auditEvent.id}-shadow-only`,
      targetId: shadowTaskId,
      note: 'Shadow-only calendar audit event.',
    }

    const runtimeShadowWrites = [
      current.app.inject({
        method: 'PUT',
        url: '/api/academic/runtime/tasks',
        headers: { cookie, origin: TEST_ORIGIN },
        payload: [shadowTask],
      }),
      current.app.inject({
        method: 'PUT',
        url: '/api/academic/runtime/taskPlacements',
        headers: { cookie, origin: TEST_ORIGIN },
        payload: {
          [shadowTaskId]: shadowPlacement,
        },
      }),
      current.app.inject({
        method: 'PUT',
        url: '/api/academic/runtime/calendarAudit',
        headers: { cookie, origin: TEST_ORIGIN },
        payload: [shadowAuditEvent],
      }),
    ]
    const runtimeShadowResponses = await Promise.all(runtimeShadowWrites)
    runtimeShadowResponses.forEach(response => {
      expect(response.statusCode).toBe(200)
    })

    const response = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: { cookie },
    })
    expect(response.statusCode).toBe(200)
    const bootstrap = response.json() as AcademicBootstrapRuntimeView

    expect(bootstrap.runtime.tasks.some((item: { id: string }) => item.id === changeSet.task.id)).toBe(true)
    expect(bootstrap.runtime.tasks.some((item: { id: string }) => item.id === shadowTaskId)).toBe(false)
    expect(bootstrap.runtime.taskPlacements[changeSet.placement.taskId]).toMatchObject({
      taskId: changeSet.placement.taskId,
    })
    expect(bootstrap.runtime.taskPlacements[shadowTaskId]).toBeUndefined()
    expect(bootstrap.runtime.calendarAudit.some((item: { id: string }) => item.id === changeSet.auditEvent.id)).toBe(true)
    expect(bootstrap.runtime.calendarAudit.some((item: { id: string }) => item.id === shadowAuditEvent.id)).toBe(false)
  })
})
