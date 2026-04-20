// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useApiConnectionTarget } from '../src/api-connection'

function SnapshotProbe({ primaryBaseUrl }: { primaryBaseUrl: string }) {
  const snapshot = useApiConnectionTarget(primaryBaseUrl, {
    pollIntervalMs: 60_000,
    timeoutMs: 100,
  })

  return createElement('pre', { 'data-testid': 'snapshot' }, JSON.stringify(snapshot))
}

function readSnapshot() {
  return JSON.parse(screen.getByTestId('snapshot').textContent ?? '{}') as {
    activeBaseUrl: string
    activeSource: 'primary' | 'fallback' | 'none'
    usingFallback: boolean
    initialCheckComplete: boolean
  }
}

async function flushProbe(ms = 0) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const originalFallbacks = import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS = originalFallbacks
})

describe('useApiConnectionTarget', () => {
  it('keeps a single configured backend available immediately', () => {
    import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS = ''
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    render(createElement(SnapshotProbe, { primaryBaseUrl: 'http://localhost:4173' }))

    expect(readSnapshot()).toMatchObject({
      activeBaseUrl: 'http://localhost:4173',
      activeSource: 'primary',
      usingFallback: false,
      initialCheckComplete: true,
    })
  })

  it('probes all candidates in parallel and picks the first healthy one in priority order', async () => {
    vi.useFakeTimers()
    import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS = 'http://127.0.0.1:4173'
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return {
        ok: url === 'http://127.0.0.1:4173/health',
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(createElement(SnapshotProbe, { primaryBaseUrl: 'https://api-production.example.com' }))

    expect(readSnapshot()).toMatchObject({
      activeBaseUrl: '',
      activeSource: 'none',
      usingFallback: false,
      initialCheckComplete: false,
    })

    await flushProbe(0)
    await flushProbe(0)

    expect(readSnapshot()).toMatchObject({
      activeBaseUrl: 'http://127.0.0.1:4173',
      activeSource: 'fallback',
      usingFallback: true,
      initialCheckComplete: true,
    })

    // Both candidates must have been probed (parallel, not short-circuit on first)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-production.example.com/health',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4173/health',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('prefers primary over fallback when both are healthy', async () => {
    vi.useFakeTimers()
    import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS = 'http://127.0.0.1:4173'
    // Both candidates return healthy
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true } as Response)))

    render(createElement(SnapshotProbe, { primaryBaseUrl: 'https://api-production.example.com' }))

    await flushProbe(0)
    await flushProbe(0)

    // Primary wins because it appears first in preference order
    expect(readSnapshot()).toMatchObject({
      activeBaseUrl: 'https://api-production.example.com',
      activeSource: 'primary',
      usingFallback: false,
      initialCheckComplete: true,
    })
  })
})
