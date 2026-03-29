export const AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER_ENV = 'AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER'
export const AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD_ENV = 'AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD'

function firstNonEmpty(values) {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() ?? ''
}

export function resolveSystemAdminLiveCredentials(options = {}) {
  const {
    scriptLabel = 'System admin live verification',
    identifierAliases = [],
    passwordAliases = [],
  } = options

  const identifier = firstNonEmpty([
    process.env[AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER_ENV],
    ...identifierAliases.map(name => process.env[name]),
  ])
  const password = firstNonEmpty([
    process.env[AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD_ENV],
    ...passwordAliases.map(name => process.env[name]),
  ])

  if (!identifier || !password) {
    throw new Error(
      `${scriptLabel} requires ${AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER_ENV} and ${AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD_ENV}.`,
    )
  }

  return { identifier, password }
}
