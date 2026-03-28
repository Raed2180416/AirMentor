export type FrontendStartupDiagnostic = {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
}

type FrontendStartupInput = {
  apiBaseUrl: string
  locationHref?: string
}

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function isProductionLikeLocation(locationUrl: URL) {
  return !isLocalHost(locationUrl.hostname)
}

function hasAbsoluteScheme(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
}

export function collectFrontendStartupDiagnostics(input: FrontendStartupInput) {
  const diagnostics: FrontendStartupDiagnostic[] = []
  const locationHref = input.locationHref
    ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  const locationUrl = new URL(locationHref)
  const productionLike = isProductionLikeLocation(locationUrl)

  diagnostics.push({
    level: 'info',
    code: 'FRONTEND_STARTUP_MODE',
    message: productionLike
      ? 'Running with production-like frontend origin expectations.'
      : 'Running with local-first frontend origin expectations.',
  })

  if (!input.apiBaseUrl.trim()) {
    diagnostics.push({
      level: 'error',
      code: 'API_BASE_URL_MISSING',
      message: 'VITE_AIRMENTOR_API_BASE_URL must be configured before the live workspace can start.',
    })
    return diagnostics
  }

  const trimmedApiBaseUrl = input.apiBaseUrl.trim()
  const absoluteApiBaseUrl = hasAbsoluteScheme(trimmedApiBaseUrl)

  let apiUrl: URL
  try {
    apiUrl = absoluteApiBaseUrl
      ? new URL(trimmedApiBaseUrl)
      : new URL(trimmedApiBaseUrl, locationUrl)
  } catch {
    diagnostics.push({
      level: 'error',
      code: 'API_BASE_URL_INVALID',
      message: 'VITE_AIRMENTOR_API_BASE_URL must be a valid absolute URL or local proxy path.',
    })
    return diagnostics
  }

  if (productionLike && !absoluteApiBaseUrl) {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_ABSOLUTE_API',
      message: 'Production-like frontend origins must use an absolute API base URL instead of a relative proxy path.',
    })
  }

  if (locationUrl.protocol === 'https:' && apiUrl.protocol !== 'https:') {
    diagnostics.push({
      level: 'error',
      code: 'HTTPS_PAGE_REQUIRES_HTTPS_API',
      message: 'HTTPS frontend origins cannot call a non-HTTPS API because browsers block mixed-content requests.',
    })
  }

  if (productionLike && isLocalHost(apiUrl.hostname)) {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_REMOTE_API',
      message: 'Production-like frontend origins cannot point at localhost or 127.0.0.1 for the API base URL.',
    })
  }

  if (productionLike && apiUrl.protocol !== 'https:') {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_HTTPS_API',
      message: 'Production-like frontend origins require an HTTPS API base URL.',
    })
  }

  if (!productionLike && !isLocalHost(apiUrl.hostname)) {
    diagnostics.push({
      level: 'warning',
      code: 'LOCAL_FRONTEND_REMOTE_API',
      message: 'Local frontend is pointed at a remote API base URL; verify the cookie and CORS posture before using this as a dev default.',
    })
  }

  return diagnostics
}
