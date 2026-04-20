import { afterEach, describe, expect, it, vi } from 'vitest'

const originalApiBaseUrl = process.env.VITE_AIRMENTOR_API_BASE_URL
const originalProxyTarget = process.env.AIRMENTOR_UI_PROXY_API_TARGET

async function loadConfig() {
  vi.resetModules()
  return (await import('../vite.config.ts')).default
}

afterEach(() => {
  vi.resetModules()
  if (originalApiBaseUrl === undefined) {
    delete process.env.VITE_AIRMENTOR_API_BASE_URL
  } else {
    process.env.VITE_AIRMENTOR_API_BASE_URL = originalApiBaseUrl
  }
  if (originalProxyTarget === undefined) {
    delete process.env.AIRMENTOR_UI_PROXY_API_TARGET
  } else {
    process.env.AIRMENTOR_UI_PROXY_API_TARGET = originalProxyTarget
  }
})

describe('vite live API proxy config', () => {
  it('proxies root health checks with api traffic when root base URL uses Vite proxy', async () => {
    process.env.VITE_AIRMENTOR_API_BASE_URL = '/'
    process.env.AIRMENTOR_UI_PROXY_API_TARGET = 'http://127.0.0.1:4000'

    const config = await loadConfig()
    const expectedProxy = {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
    }

    expect(config.server).toMatchObject({ proxy: expectedProxy })
    expect(config.preview).toMatchObject({ proxy: expectedProxy })
  })

  it('does not create proxy config for non-root API base URLs', async () => {
    process.env.VITE_AIRMENTOR_API_BASE_URL = 'http://127.0.0.1:4000'
    process.env.AIRMENTOR_UI_PROXY_API_TARGET = 'http://127.0.0.1:4000'

    const config = await loadConfig()

    expect(config.server).toBeUndefined()
    expect(config.preview).toBeUndefined()
  })
})
