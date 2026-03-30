import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('openapi', () => {
  it('publishes the implemented route surface', async () => {
    current = await createTestApp()
    const response = await current.app.inject({
      method: 'GET',
      url: '/openapi.json',
    })
    expect(response.statusCode).toBe(200)
    const document = response.json()
    expect(Object.keys(document.paths).sort()).toMatchSnapshot()
  })

  it('documents the semester activation request and response contract', async () => {
    current = await createTestApp()
    const response = await current.app.inject({
      method: 'GET',
      url: '/openapi.json',
    })
    expect(response.statusCode).toBe(200)
    const document = response.json()
    const activateSemester = document.paths['/api/admin/proof-runs/{simulationRunId}/activate-semester']?.post
    expect(activateSemester).toBeTruthy()
    expect(activateSemester.requestBody?.content?.['application/json']?.schema).toMatchObject({
      type: 'object',
      required: ['semesterNumber'],
      properties: {
        semesterNumber: {
          type: 'integer',
          enum: [1, 2, 3, 4, 5, 6],
        },
      },
    })
    expect(activateSemester.responses?.['200']?.content?.['application/json']?.schema).toMatchObject({
      type: 'object',
      required: ['ok', 'simulationRunId', 'batchId', 'activeOperationalSemester', 'previousOperationalSemester'],
      properties: {
        ok: {
          type: 'boolean',
          enum: [true],
        },
        simulationRunId: {
          type: 'string',
        },
        batchId: {
          type: 'string',
        },
        activeOperationalSemester: {
          type: 'integer',
        },
        previousOperationalSemester: {
          type: 'integer',
          nullable: true,
        },
      },
    })
  })
})
