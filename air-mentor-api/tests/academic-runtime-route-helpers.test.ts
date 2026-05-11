import { describe, expect, it } from 'vitest'
import { taskPayloadWithPlacementDate } from '../src/modules/academic-runtime-routes.js'

describe('academic runtime route helpers', () => {
  it('writes the placement date back into the task payload and recurring schedule metadata', () => {
    const payloadJson = JSON.stringify({
      id: 'task_001',
      title: 'Proof follow-up',
      dueDateISO: '2026-03-20',
      scheduleMeta: {
        mode: 'scheduled',
        preset: 'weekly',
        status: 'active',
        nextDueDateISO: '2026-03-20',
      },
    })

    const nextPayload = JSON.parse(taskPayloadWithPlacementDate(payloadJson, '2026-03-24', 1_763_654_400_000))

    expect(nextPayload).toMatchObject({
      dueDateISO: '2026-03-24',
      updatedAt: 1_763_654_400_000,
      scheduleMeta: {
        nextDueDateISO: '2026-03-24',
      },
    })
    expect(nextPayload.title).toBe('Proof follow-up')
  })
})
