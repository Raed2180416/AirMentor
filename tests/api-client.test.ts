import { describe, expect, it, vi } from 'vitest'
import { AirMentorApiClient, AirMentorApiError } from '../src/api/client'

describe('AirMentorApiClient', () => {
  it('binds the default global fetch to the window/global scope', async () => {
    const fetchMock = vi.fn(async function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
      expect(this).toBe(globalThis)
      return new Response(JSON.stringify({
        userId: 'user-1',
        themeMode: 'frosted-focus-light',
        version: 1,
        updatedAt: '2026-03-16T00:00:00.000Z',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    vi.stubGlobal('fetch', fetchMock as typeof fetch)

    try {
      const client = new AirMentorApiClient('http://127.0.0.1:4000')
      const result = await client.getUiPreferences()
      expect(result.themeMode).toBe('frosted-focus-light')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('sends JSON requests with cookies included', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      userId: 'user-1',
      themeMode: 'frosted-focus-dark',
      version: 2,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000/', fetchMock as typeof fetch)
    const result = await client.saveUiPreferences({
      themeMode: 'frosted-focus-dark',
      version: 1,
    })

    expect(result.themeMode).toBe('frosted-focus-dark')
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/api/preferences/ui', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
    }))
  })

  it('throws an API error for non-2xx responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      error: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)

    await expect(client.login({ identifier: 'sysadmin', password: 'wrong' })).rejects.toBeInstanceOf(AirMentorApiError)
  })

  it('does not send a JSON content-type header for bodyless requests like logout', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, {
      status: 204,
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)
    await client.logout()

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/api/session', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
      headers: {},
    }))
  })

  it('stores the session CSRF token and sends it on later mutating requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sessionId: 'session-1',
        csrfToken: 'csrf-token-1',
        user: {
          userId: 'user-1',
          username: 'sysadmin',
          email: 'sysadmin@example.com',
        },
        faculty: {
          facultyId: 'fac_sysadmin',
          displayName: 'System Admin',
        },
        activeRoleGrant: {
          grantId: 'grant-1',
          facultyId: 'fac_sysadmin',
          roleCode: 'SYSTEM_ADMIN',
          scopeType: 'institution',
          scopeId: 'inst-1',
          status: 'active',
          version: 1,
        },
        availableRoleGrants: [],
        preferences: {
          userId: 'user-1',
          themeMode: 'frosted-focus-light',
          version: 1,
          updatedAt: '2026-03-16T00:00:00.000Z',
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        userId: 'user-1',
        themeMode: 'frosted-focus-dark',
        version: 2,
        updatedAt: '2026-03-16T00:00:00.000Z',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)
    await client.restoreSession()
    await client.saveUiPreferences({
      themeMode: 'frosted-focus-dark',
      version: 1,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:4000/api/preferences/ui', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-AirMentor-CSRF': 'csrf-token-1',
      }),
    }))
  })

  it('threads checkpoint playback filters and admin checkpoint routes through the API client', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      ok: true,
      items: [],
      checkpoint: {
        simulationStageCheckpointId: 'checkpoint_001',
        simulationRunId: 'run_001',
        semesterNumber: 6,
        stageKey: 'post-tt1',
        stageLabel: 'Post TT1',
        stageDescription: 'Checkpoint',
        stageOrder: 2,
        previousCheckpointId: null,
        nextCheckpointId: null,
      },
      queuePreview: [],
      offeringRollups: [],
      student: {
        studentId: 'student_001',
        studentName: 'Aarav Sharma',
        usn: '1MS23MC001',
      },
      projections: [],
      proofPlayback: null,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)

    await client.getAcademicBootstrap({ simulationStageCheckpointId: 'checkpoint_001' })
    await client.getAcademicFacultyProfile('mnc_t1', { simulationStageCheckpointId: 'checkpoint_001' })
    await client.getAcademicHodProofBundle({ simulationStageCheckpointId: 'checkpoint_001' })
    await client.getAcademicHodProofSummary({ simulationStageCheckpointId: 'checkpoint_001' })
    await client.getAcademicStudentAgentCard('student_001', { simulationStageCheckpointId: 'checkpoint_001' })
    await client.getAcademicStudentRiskExplorer('student_001', { simulationStageCheckpointId: 'checkpoint_001' })
    await client.startAcademicStudentAgentSession('student_001', { simulationStageCheckpointId: 'checkpoint_001' })
    await client.getProofRunCheckpoints('run_001')
    await client.getProofRunCheckpointDetail('run_001', 'checkpoint_001')
    await client.getProofRunCheckpointStudentDetail('run_001', 'checkpoint_001', 'student_001')

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:4000/api/academic/bootstrap?simulationStageCheckpointId=checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:4000/api/academic/faculty-profile/mnc_t1?simulationStageCheckpointId=checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:4000/api/academic/hod/proof-bundle?simulationStageCheckpointId=checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:4000/api/academic/hod/proof-summary?simulationStageCheckpointId=checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'http://127.0.0.1:4000/api/academic/student-shell/students/student_001/card?simulationStageCheckpointId=checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(6, 'http://127.0.0.1:4000/api/academic/students/student_001/risk-explorer?simulationStageCheckpointId=checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(7, 'http://127.0.0.1:4000/api/academic/student-shell/students/student_001/sessions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ simulationStageCheckpointId: 'checkpoint_001' }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(8, 'http://127.0.0.1:4000/api/admin/proof-runs/run_001/checkpoints', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(9, 'http://127.0.0.1:4000/api/admin/proof-runs/run_001/checkpoints/checkpoint_001', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(10, 'http://127.0.0.1:4000/api/admin/proof-runs/run_001/checkpoints/checkpoint_001/students/student_001', expect.any(Object))
  })

  it('threads the additive academic runtime resource routes through the API client', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      ok: true,
      created: true,
      deleted: true,
      task: {
        id: 'task_001',
        version: 2,
      },
      placement: {
        taskId: 'task_001',
      },
      event: {
        id: 'audit_001',
      },
      items: [],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)

    await client.listAcademicTasks()
    await client.saveAcademicTask('task_001', {
      task: {
        id: 'task_001',
        studentId: 'student_001',
        studentName: 'Aarav Sharma',
        studentUsn: '1MS23MC001',
        offeringId: 'off_001',
        courseCode: 'MCC301A',
        courseName: 'Graph Theory',
        year: '3rd Year',
        riskProb: 0.64,
        riskBand: 'Medium',
        title: 'Follow-up',
        due: 'Today',
        status: 'In Progress',
        actionHint: 'Check in',
        priority: 64,
        createdAt: 1,
        assignedTo: 'Course Leader',
      },
      expectedVersion: 1,
    })
    await client.listAcademicTaskPlacements()
    await client.saveAcademicTaskPlacement('task_001', {
      placement: {
        taskId: 'task_001',
        dateISO: '2026-03-20',
        placementMode: 'timed',
        startMinutes: 570,
        endMinutes: 600,
        startTime: '09:30',
        endTime: '10:00',
        updatedAt: 1,
      },
      expectedUpdatedAt: 1,
    })
    await client.deleteAcademicTaskPlacement('task_001', 1)
    await client.listAcademicCalendarAuditEvents()
    await client.appendAcademicCalendarAuditEvent({
      event: {
        id: 'audit_001',
        facultyId: 'mnc_t1',
        actorRole: 'Course Leader',
        actorFacultyId: 'mnc_t1',
        timestamp: 1,
        actionKind: 'task-created-and-scheduled',
        targetType: 'task',
        targetId: 'task_001',
        note: 'Created and scheduled a task.',
      },
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:4000/api/academic/tasks', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:4000/api/academic/tasks/task_001', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('"expectedVersion":1'),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:4000/api/academic/task-placements', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:4000/api/academic/task-placements/task_001', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('"expectedUpdatedAt":1'),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'http://127.0.0.1:4000/api/academic/task-placements/task_001?expectedUpdatedAt=1', expect.objectContaining({
      method: 'DELETE',
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(6, 'http://127.0.0.1:4000/api/academic/calendar-audit', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(7, 'http://127.0.0.1:4000/api/academic/calendar-audit', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"event"'),
    }))
  })

  it('uses named academic runtime routes for drafts, cell values, and lock state writes', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      ok: true,
      stateKey: 'drafts',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)

    await client.saveAcademicDrafts({ cellA: 2 })
    await client.saveAcademicCellValues({ cellA: 5 })
    await client.saveAcademicLockByOffering({ off_001: { attendance: true } })
    await client.saveAcademicLockAuditByTarget({
      attendance: [{ action: 'lock', actorRole: 'Course Leader', at: 1 }],
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:4000/api/academic/runtime/drafts', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ cellA: 2 }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:4000/api/academic/runtime/cell-values', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ cellA: 5 }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:4000/api/academic/runtime/lock-by-offering', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ off_001: { attendance: true } }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:4000/api/academic/runtime/lock-audit-by-target', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        attendance: [{ action: 'lock', actorRole: 'Course Leader', at: 1 }],
      }),
    }))
  })
})
