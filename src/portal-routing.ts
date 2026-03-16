import { AIRMENTOR_STORAGE_KEYS } from './repositories'

export type PortalRoute = 'home' | 'app' | 'admin'

const PORTAL_HASH_BY_ROUTE: Record<PortalRoute, string> = {
  home: '#/',
  app: '#/app',
  admin: '#/admin',
}

export function parsePortalRoute(hash: string | null | undefined): PortalRoute {
  const normalized = (hash ?? '').trim().toLowerCase()
  if (normalized === '#/app' || normalized.startsWith('#/app/')) return 'app'
  if (normalized === '#/admin' || normalized.startsWith('#/admin/')) return 'admin'
  return 'home'
}

type StorageLike = Pick<Storage, 'getItem'>

export function resolvePortalRoute(
  hash: string | null | undefined,
  storageLike?: StorageLike | null,
): PortalRoute {
  const parsedRoute = parsePortalRoute(hash)
  if (parsedRoute !== 'home') return parsedRoute
  if (!storageLike) return 'home'

  if (storageLike.getItem(AIRMENTOR_STORAGE_KEYS.currentAdminFacultyId)) return 'admin'
  if (
    storageLike.getItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId)
    || storageLike.getItem(AIRMENTOR_STORAGE_KEYS.legacyCurrentTeacherId)
  ) return 'app'

  return 'home'
}

export function getPortalHash(route: PortalRoute) {
  return PORTAL_HASH_BY_ROUTE[route]
}

export function navigateToPortal(route: PortalRoute, locationLike: Pick<Location, 'hash'> = window.location) {
  const nextHash = getPortalHash(route)
  if (locationLike.hash !== nextHash) locationLike.hash = nextHash
}
