import { describe, expect, it } from 'vitest'
import { collectFrontendStartupDiagnostics } from '../src/startup-diagnostics'

describe('collectFrontendStartupDiagnostics', () => {
  it('fails when the API base URL is missing', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: '',
      locationHref: 'https://raed.github.io/air-mentor-ui/',
    })

    expect(diagnostics.some(item => item.code === 'API_BASE_URL_MISSING' && item.level === 'error')).toBe(true)
  })

  it('fails when a production-like frontend points at a localhost API', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: 'http://127.0.0.1:4000',
      locationHref: 'https://raed.github.io/air-mentor-ui/',
    })

    expect(diagnostics.some(item => item.code === 'PRODUCTION_LIKE_REQUIRES_REMOTE_API')).toBe(true)
    expect(diagnostics.some(item => item.code === 'HTTPS_PAGE_REQUIRES_HTTPS_API')).toBe(true)
  })

  it('warns when a local frontend points at a remote API', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: 'https://air-mentor-api.up.railway.app',
      locationHref: 'http://localhost:5173/',
    })

    expect(diagnostics.some(item => item.code === 'LOCAL_FRONTEND_REMOTE_API' && item.level === 'warning')).toBe(true)
  })

  it('accepts a local proxy path for preview-mode frontend verification', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: '/',
      locationHref: 'http://127.0.0.1:4173/',
    })

    expect(diagnostics.some(item => item.code === 'API_BASE_URL_INVALID')).toBe(false)
    expect(diagnostics.some(item => item.level === 'error')).toBe(false)
  })

  it('fails when a production-like frontend uses a relative API base path', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: '/api',
      locationHref: 'https://raed.github.io/air-mentor-ui/',
    })

    expect(diagnostics.some(item => item.code === 'PRODUCTION_LIKE_REQUIRES_ABSOLUTE_API' && item.level === 'error')).toBe(true)
  })

  it('accepts the derived backend telemetry relay for a production-like frontend', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: 'https://air-mentor-api.up.railway.app',
      telemetrySinkUrl: '',
      locationHref: 'https://raed.github.io/air-mentor-ui/',
    })

    expect(diagnostics.some(item => item.code === 'TELEMETRY_SINK_NOT_CONFIGURED')).toBe(false)
  })

  it('warns when a production-like frontend uses a relative telemetry sink', () => {
    const diagnostics = collectFrontendStartupDiagnostics({
      apiBaseUrl: 'https://air-mentor-api.up.railway.app',
      telemetrySinkUrl: '/telemetry',
      locationHref: 'https://raed.github.io/air-mentor-ui/',
    })

    expect(diagnostics.some(item => item.code === 'PRODUCTION_LIKE_REQUIRES_ABSOLUTE_TELEMETRY_SINK' && item.level === 'warning')).toBe(true)
  })
})
