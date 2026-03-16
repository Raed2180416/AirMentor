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
})
