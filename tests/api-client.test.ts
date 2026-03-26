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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({
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
})
