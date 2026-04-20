import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPool } from '../src/db/client.js'

describe('createPool', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers a pool error listener so idle pg disconnects do not crash the process', async () => {
    const pool = createPool('postgres://postgres:postgres@127.0.0.1:5432/postgres')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(pool.listenerCount('error')).toBeGreaterThan(0)
    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow()
    expect(consoleErrorSpy).toHaveBeenCalled()

    await pool.end().catch(() => undefined)
  })
})
