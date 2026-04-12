import { describe, expect, it } from 'vitest'
import { clearPortalWorkspaceHints, getPortalHash, hashBelongsToPortalRoute, navigateToPortal, parsePortalRoute, resolvePortalRoute } from '../src/portal-routing'

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

  it('parses admin routes into structured LiveAdminRoutes', async () => {
    // import late since it's a UI component to avoid unnecessary dom setup for routing tests elsewhere
    const { parseAdminRoute } = await import('../src/system-admin-live-app')
    expect(parseAdminRoute('#/admin/requests/request_001')).toEqual({
      section: 'requests',
      requestId: 'request_001',
    })
    expect(parseAdminRoute('#/admin/proof-dashboard')).toEqual({
      section: 'proof-dashboard',
    })
  })

  it('keeps the home route on the portal selector until the hash explicitly changes', () => {
    expect(resolvePortalRoute('#/')).toBe('home')
    expect(resolvePortalRoute('#/admin')).toBe('admin')
    expect(resolvePortalRoute('#/app')).toBe('app')
  })

  it('maps routes back to canonical hashes', () => {
    expect(getPortalHash('home')).toBe('#/')
    expect(getPortalHash('app')).toBe('#/app')
    expect(getPortalHash('admin')).toBe('#/admin')
  })

  it('recognizes sub-routes as belonging to their portal workspace', () => {
    expect(hashBelongsToPortalRoute('#/admin/requests/request_001', 'admin')).toBe(true)
    expect(hashBelongsToPortalRoute('#/app/calendar', 'app')).toBe(true)
    expect(hashBelongsToPortalRoute('#/admin/requests/request_001', 'app')).toBe(false)
  })

  it('navigates by mutating the location hash', () => {
    const locationLike = { hash: '#/' }

    navigateToPortal('admin', locationLike)
    expect(locationLike.hash).toBe('#/admin')

    navigateToPortal('app', locationLike)
    expect(locationLike.hash).toBe('#/app')
  })

  it('clears every remembered workspace hint when leaving the portal', () => {
    const removed: string[] = []
    clearPortalWorkspaceHints({
      removeItem(key: string) {
        removed.push(key)
      },
    })

    expect(removed).toEqual([
      'airmentor-current-admin-faculty-id',
      'airmentor-current-faculty-id',
      'airmentor-current-teacher-id',
    ])
  })
})
