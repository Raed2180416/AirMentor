import { describe, expect, it } from 'vitest'
import { getPortalHash, navigateToPortal, parsePortalRoute } from '../src/portal-routing'

describe('portal routing', () => {
  it('parses supported hash routes', () => {
    expect(parsePortalRoute(undefined)).toBe('home')
    expect(parsePortalRoute('')).toBe('home')
    expect(parsePortalRoute('#/app')).toBe('app')
    expect(parsePortalRoute('#/app/session')).toBe('app')
    expect(parsePortalRoute('#/admin')).toBe('admin')
    expect(parsePortalRoute('#/admin/users')).toBe('admin')
    expect(parsePortalRoute('#/unknown')).toBe('home')
  })

  it('maps routes back to canonical hashes', () => {
    expect(getPortalHash('home')).toBe('#/')
    expect(getPortalHash('app')).toBe('#/app')
    expect(getPortalHash('admin')).toBe('#/admin')
  })

  it('navigates by mutating the location hash', () => {
    const locationLike = { hash: '#/' }

    navigateToPortal('admin', locationLike)
    expect(locationLike.hash).toBe('#/admin')

    navigateToPortal('app', locationLike)
    expect(locationLike.hash).toBe('#/app')
  })
})
