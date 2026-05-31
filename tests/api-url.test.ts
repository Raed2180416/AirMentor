import { afterEach, describe, expect, it } from 'vitest'
import { apiPath } from '../tests-e2e/helpers/api-url'

const originalApiBase = process.env.AIRMENTOR_PW_API_BASE_URL

afterEach(() => {
  if (originalApiBase == null) {
    delete process.env.AIRMENTOR_PW_API_BASE_URL
  } else {
    process.env.AIRMENTOR_PW_API_BASE_URL = originalApiBase
  }
})

describe('apiPath', () => {
  it('defaults to the local backend base when no explicit API base is configured', () => {
    delete process.env.AIRMENTOR_PW_API_BASE_URL

    expect(apiPath('/api/session/login')).toBe('http://127.0.0.1:4000/api/session/login')
  })

  it('prefixes API paths with the explicit local backend base', () => {
    process.env.AIRMENTOR_PW_API_BASE_URL = 'http://127.0.0.1:4000'

    expect(apiPath('/api/session/login')).toBe('http://127.0.0.1:4000/api/session/login')
  })

  it('does not rewrite already absolute URLs', () => {
    process.env.AIRMENTOR_PW_API_BASE_URL = 'http://127.0.0.1:4000'

    expect(apiPath('http://127.0.0.1:4000/api/session/login')).toBe('http://127.0.0.1:4000/api/session/login')
  })
})
