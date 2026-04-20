import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_POLL_INTERVAL_MS = 15_000
const DEFAULT_TIMEOUT_MS = 4_000

export type ApiConnectionTargetSnapshot = {
  configuredPrimaryBaseUrl: string
  candidateBaseUrls: string[]
  activeBaseUrl: string
  activeSource: 'primary' | 'fallback' | 'none'
  usingFallback: boolean
  initialCheckComplete: boolean
  checking: boolean
  lastHealthyByUrl: Record<string, number>
}

type ApiConnectionTargetOptions = {
  enabled?: boolean
  pollIntervalMs?: number
  timeoutMs?: number
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function parseCsvList(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function hasAbsoluteScheme(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
}

function resolveBaseUrl(rawValue: string, locationHref: string) {
  const normalized = rawValue.trim()
  if (!normalized) return ''
  try {
    const resolved = hasAbsoluteScheme(normalized)
      ? new URL(normalized)
      : new URL(normalized, locationHref)
    return normalizeBaseUrl(resolved.toString())
  } catch {
    return normalizeBaseUrl(normalized)
  }
}

function dedupePreservingOrder(values: string[]) {
  const seen = new Set<string>()
  const ordered: string[] = []
  values.forEach(value => {
    if (!value || seen.has(value)) return
    seen.add(value)
    ordered.push(value)
  })
  return ordered
}

export function resolveApiBaseUrlCandidates(primaryBaseUrl: string, locationHref?: string) {
  const baseLocationHref = locationHref
    ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  const fallbackCsv = import.meta.env.VITE_AIRMENTOR_API_FALLBACK_BASE_URLS?.trim() || ''
  const fallbackCandidates = parseCsvList(fallbackCsv)
  const allCandidates = [primaryBaseUrl.trim(), ...fallbackCandidates]
    .map(candidate => resolveBaseUrl(candidate, baseLocationHref))
    .filter(Boolean)
  return dedupePreservingOrder(allCandidates)
}

async function probeBackendHealth(baseUrl: string, timeoutMs: number) {
  const abortController = new AbortController()
  const timeout = window.setTimeout(() => abortController.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: abortController.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timeout)
  }
}

export function useApiConnectionTarget(primaryBaseUrl: string, options: ApiConnectionTargetOptions = {}): ApiConnectionTargetSnapshot {
  const {
    enabled = true,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options

  const locationHref = typeof window !== 'undefined' ? window.location.href : 'http://localhost/'
  const configuredPrimaryBaseUrl = useMemo(
    () => resolveBaseUrl(primaryBaseUrl, locationHref),
    [locationHref, primaryBaseUrl],
  )
  const candidateBaseUrls = useMemo(
    () => resolveApiBaseUrlCandidates(primaryBaseUrl, locationHref),
    [locationHref, primaryBaseUrl],
  )

  const shouldWaitForInitialProbe = enabled && candidateBaseUrls.length > 1
  const [activeBaseUrl, setActiveBaseUrl] = useState(shouldWaitForInitialProbe ? '' : (candidateBaseUrls[0] ?? ''))
  const [initialCheckComplete, setInitialCheckComplete] = useState(!shouldWaitForInitialProbe)
  const [checking, setChecking] = useState(false)
  const [lastHealthyByUrl, setLastHealthyByUrl] = useState<Record<string, number>>({})
  const activeBaseUrlRef = useRef(activeBaseUrl)

  useEffect(() => {
    activeBaseUrlRef.current = activeBaseUrl
  }, [activeBaseUrl])

  useEffect(() => {
    if (candidateBaseUrls.length === 0) {
      setActiveBaseUrl('')
      setInitialCheckComplete(true)
      activeBaseUrlRef.current = ''
      return
    }
    if (shouldWaitForInitialProbe) {
      setActiveBaseUrl('')
      setInitialCheckComplete(false)
      activeBaseUrlRef.current = ''
      return
    }
    setInitialCheckComplete(true)
    setActiveBaseUrl(current => {
      const nextActive = candidateBaseUrls.includes(current) ? current : candidateBaseUrls[0]
      activeBaseUrlRef.current = nextActive
      return nextActive
    })
  }, [candidateBaseUrls, shouldWaitForInitialProbe])

  useEffect(() => {
    if (!enabled || candidateBaseUrls.length === 0) return
    let cancelled = false
    let probeInFlight = false

    const runProbe = async () => {
      if (probeInFlight) return
      probeInFlight = true
      if (!cancelled) setChecking(true)
      try {
        const currentActive = activeBaseUrlRef.current
        const orderedCandidates = dedupePreservingOrder([
          ...(currentActive ? [currentActive] : []),
          ...candidateBaseUrls,
        ]).filter(candidate => candidateBaseUrls.includes(candidate))

        let selectedUrl = currentActive && candidateBaseUrls.includes(currentActive)
          ? currentActive
          : (candidateBaseUrls[0] ?? '')

        // Probe all candidates simultaneously so total wait = one timeout, not n×timeout
        const probeResults = await Promise.all(
          orderedCandidates.map(async candidate => ({
            candidate,
            healthy: await probeBackendHealth(candidate, timeoutMs),
          })),
        )
        if (cancelled) return
        // Pick first healthy in preference order (deterministic tie-breaking)
        const winner = probeResults.find(result => result.healthy)
        if (winner) {
          selectedUrl = winner.candidate
          setLastHealthyByUrl(previous => ({
            ...previous,
            [winner.candidate]: Date.now(),
          }))
        }

        if (!cancelled) {
          activeBaseUrlRef.current = selectedUrl
          setActiveBaseUrl(previous => (previous === selectedUrl ? previous : selectedUrl))
          setInitialCheckComplete(true)
        }
      } finally {
        probeInFlight = false
        if (!cancelled) setChecking(false)
      }
    }

    const firstProbe = window.setTimeout(() => {
      void runProbe()
    }, 0)
    const interval = window.setInterval(() => {
      void runProbe()
    }, pollIntervalMs)

    return () => {
      cancelled = true
      window.clearTimeout(firstProbe)
      window.clearInterval(interval)
    }
  }, [candidateBaseUrls, enabled, pollIntervalMs, timeoutMs])

  const activeSource: ApiConnectionTargetSnapshot['activeSource'] = !activeBaseUrl
    ? 'none'
    : (configuredPrimaryBaseUrl && activeBaseUrl !== configuredPrimaryBaseUrl ? 'fallback' : 'primary')

  return {
    configuredPrimaryBaseUrl,
    candidateBaseUrls,
    activeBaseUrl,
    activeSource,
    usingFallback: activeSource === 'fallback',
    initialCheckComplete,
    checking,
    lastHealthyByUrl,
  }
}
