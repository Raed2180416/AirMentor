import { resolveClientTelemetrySinkUrl } from './telemetry'

export type FrontendStartupDiagnostic = {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
}

type FrontendStartupInput = {
  apiBaseUrl: string
  telemetrySinkUrl?: string
  locationHref?: string
}

type ResolvedApiCandidate = {
  raw: string
  absoluteInput: boolean
  url: URL
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

function parseStringList(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function resolveApiCandidate(rawCandidate: string, locationUrl: URL): ResolvedApiCandidate {
  const absoluteInput = hasAbsoluteScheme(rawCandidate)
  const url = absoluteInput
    ? new URL(rawCandidate)
    : new URL(rawCandidate, locationUrl)
  return {
    raw: rawCandidate,
    absoluteInput,
    url,
  }
}

export function collectFrontendStartupDiagnostics(input: FrontendStartupInput) {
  const diagnostics: FrontendStartupDiagnostic[] = []
  const locationHref = input.locationHref
    ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  const locationUrl = new URL(locationHref)
  const productionLike = isProductionLikeLocation(locationUrl)
  const telemetrySinkUrl = resolveClientTelemetrySinkUrl(input.telemetrySinkUrl ?? undefined, input.apiBaseUrl)
  const explicitTelemetrySinkUrl = input.telemetrySinkUrl?.trim() || ''

  diagnostics.push({
    level: 'info',
    code: 'FRONTEND_STARTUP_MODE',
    message: productionLike
      ? 'Running with production-like frontend origin expectations.'
      : 'Running with local-first frontend origin expectations.',
  })

  const fallbackApiBaseUrls = parseStringList(import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS?.trim())
  const rawCandidates = [input.apiBaseUrl.trim(), ...fallbackApiBaseUrls].filter(Boolean)

  if (rawCandidates.length === 0) {
    diagnostics.push({
      level: 'error',
      code: 'API_BASE_URL_MISSING',
      message: 'Configure VITE_AIRMENTOR_API_BASE_URL or VITE_AIRMENTOR_API_FALLBACK_BASE_URLS before the live workspace can start.',
    })
    return diagnostics
  }

  const resolvedCandidates: ResolvedApiCandidate[] = []
  rawCandidates.forEach(rawCandidate => {
    try {
      resolvedCandidates.push(resolveApiCandidate(rawCandidate, locationUrl))
    } catch {
      diagnostics.push({
        level: 'error',
        code: 'API_BASE_URL_INVALID',
        message: `API candidate "${rawCandidate}" must be a valid absolute URL or local proxy path.`,
      })
    }
  })

  if (resolvedCandidates.length === 0) return diagnostics

  if (productionLike && resolvedCandidates.some(candidate => !candidate.absoluteInput)) {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_ABSOLUTE_API',
      message: 'Production-like frontend origins must use absolute API URLs instead of relative proxy paths.',
    })
  }

  if (locationUrl.protocol === 'https:' && resolvedCandidates.some(candidate => candidate.url.protocol !== 'https:')) {
    diagnostics.push({
      level: 'error',
      code: 'HTTPS_PAGE_REQUIRES_HTTPS_API',
      message: 'HTTPS frontend origins cannot call non-HTTPS API candidates because browsers block mixed-content requests.',
    })
  }

  if (productionLike && resolvedCandidates.some(candidate => isLocalHost(candidate.url.hostname))) {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_REMOTE_API',
      message: 'Production-like frontend origins cannot point at localhost or 127.0.0.1 API candidates directly.',
    })
  }

  if (productionLike && resolvedCandidates.some(candidate => candidate.url.protocol !== 'https:')) {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_HTTPS_API',
      message: 'Production-like frontend origins require HTTPS API candidates.',
    })
  }

  if (!productionLike && resolvedCandidates.some(candidate => !isLocalHost(candidate.url.hostname))) {
    diagnostics.push({
      level: 'warning',
      code: 'LOCAL_FRONTEND_REMOTE_API',
      message: 'Local frontend includes remote API candidates; verify cookie and CORS posture before using this as a dev default.',
    })
  }

  if (productionLike && !telemetrySinkUrl) {
    diagnostics.push({
      level: 'warning',
      code: 'TELEMETRY_SINK_NOT_CONFIGURED',
      message: 'Production-like frontend origins should route client telemetry either through the backend relay or to an explicit external sink.',
    })
  }

  if (productionLike && explicitTelemetrySinkUrl) {
    if (!hasAbsoluteScheme(explicitTelemetrySinkUrl)) {
      diagnostics.push({
        level: 'warning',
        code: 'PRODUCTION_LIKE_REQUIRES_ABSOLUTE_TELEMETRY_SINK',
        message: 'Production-like frontend origins should use an absolute telemetry sink URL.',
      })
    } else {
      const telemetryUrl = new URL(explicitTelemetrySinkUrl)
      if (locationUrl.protocol === 'https:' && telemetryUrl.protocol !== 'https:') {
        diagnostics.push({
          level: 'warning',
          code: 'HTTPS_PAGE_REQUIRES_HTTPS_TELEMETRY_SINK',
          message: 'HTTPS frontend origins should forward telemetry to an HTTPS sink.',
        })
      }
    }
  }

  return diagnostics
}
