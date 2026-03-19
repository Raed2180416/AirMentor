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

  it('resolves the home route into a remembered workspace when session context exists', () => {
    const adminStorage = {
      getItem(key: string) {
        return key === 'airmentor-current-admin-faculty-id' ? 'fac_sysadmin' : null
      },
    }
    const academicStorage = {
      getItem(key: string) {
        return key === 'airmentor-current-faculty-id' ? 'fac_course_leader' : null
      },
    }

    expect(resolvePortalRoute('#/', adminStorage)).toBe('admin')
    expect(resolvePortalRoute('#/', academicStorage)).toBe('app')
    expect(resolvePortalRoute('#/admin', academicStorage)).toBe('admin')
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
