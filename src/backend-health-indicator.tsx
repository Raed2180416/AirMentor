/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { T, mono } from './data'

const DEFAULT_POLL_INTERVAL_MS = 15_000
const DEFAULT_TIMEOUT_MS = 6_000
const DEFAULT_FAILURE_THRESHOLD = 2

export type BackendHealthMonitorSnapshot = {
  isOffline: boolean
  checking: boolean
  lastHealthyAt: number | null
  checkNow: () => Promise<void>
}

type BackendHealthMonitorOptions = {
  enabled?: boolean
  pollIntervalMs?: number
  timeoutMs?: number
  failureThreshold?: number
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

async function probeBackendHealth(baseUrl: string, timeoutMs: number) {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: abortController.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function formatLastHealthyTimestamp(timestamp: number | null) {
  if (!timestamp) return 'No successful sync captured yet.'
  return new Date(timestamp).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBackendHealthMonitor(apiBaseUrl: string, options: BackendHealthMonitorOptions = {}): BackendHealthMonitorSnapshot {
  const {
    enabled = true,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  } = options
  const normalizedBaseUrl = useMemo(() => normalizeBaseUrl(apiBaseUrl), [apiBaseUrl])
  const [isOffline, setIsOffline] = useState(false)
  const [checking, setChecking] = useState(false)
  const [lastHealthyAt, setLastHealthyAt] = useState<number | null>(null)
  const consecutiveFailures = useRef(0)
  const checkSequence = useRef(0)

  // Intentionally reset state when the monitor identity (URL / enabled flag) changes.
  useEffect(() => {
    checkSequence.current += 1
    consecutiveFailures.current = 0
    setIsOffline(false)
    setChecking(false)
    setLastHealthyAt(null)
  }, [enabled, normalizedBaseUrl])

  const runCheck = useCallback(async () => {
    if (!enabled || !normalizedBaseUrl) return
    const sequence = checkSequence.current + 1
    checkSequence.current = sequence
    setChecking(true)
    const healthy = await probeBackendHealth(normalizedBaseUrl, timeoutMs)
    if (sequence !== checkSequence.current) return
    if (healthy) {
      consecutiveFailures.current = 0
      setIsOffline(false)
      setLastHealthyAt(Date.now())
    } else {
      consecutiveFailures.current += 1
      if (consecutiveFailures.current >= failureThreshold) {
        setIsOffline(true)
      }
    }
    setChecking(false)
  }, [enabled, normalizedBaseUrl, timeoutMs, failureThreshold])

  useEffect(() => {
    if (!enabled || !normalizedBaseUrl) return
    const bootProbe = window.setTimeout(() => {
      void runCheck()
    }, 0)
    const interval = window.setInterval(() => {
      void runCheck()
    }, pollIntervalMs)
    return () => {
      window.clearTimeout(bootProbe)
      window.clearInterval(interval)
    }
  }, [enabled, normalizedBaseUrl, pollIntervalMs, runCheck])

  const monitorEnabled = enabled && Boolean(normalizedBaseUrl)

  return {
    isOffline: monitorEnabled ? isOffline : false,
    checking: monitorEnabled ? checking : false,
    lastHealthyAt: monitorEnabled ? lastHealthyAt : null,
    checkNow: runCheck,
  }
}

export function BackendOfflineIndicator({
  monitor,
  workspaceLabel,
}: {
  monitor: BackendHealthMonitorSnapshot
  workspaceLabel: string
}) {
  if (!monitor.isOffline) return null
  const lastHealthyLabel = formatLastHealthyTimestamp(monitor.lastHealthyAt)
  return (
    <button
      type="button"
      onClick={() => { void monitor.checkNow() }}
      aria-live="polite"
      title="Backend health check failed. Click to retry now."
      style={{
        position: 'fixed',
        top: 14,
        right: 14,
        zIndex: 240,
        maxWidth: 420,
        width: 'min(92vw, 420px)',
        borderRadius: 14,
        border: `1px solid ${T.warning}66`,
        background: `linear-gradient(140deg, ${T.warning}2b, ${T.warning}1a)`,
        boxShadow: `0 10px 28px ${T.warning}35`,
        color: T.text,
        textAlign: 'left',
        padding: '11px 13px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <AlertTriangle size={15} color={T.warning} />
        <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em' }}>Server Not Running</span>
      </div>
      <div style={{ ...mono, fontSize: 10, lineHeight: 1.7, color: T.text }}>
        {`Showing stale ${workspaceLabel} data. ${monitor.checking ? 'Re-checking backend...' : 'Click to re-check now.'}`}
      </div>
      <div style={{ ...mono, fontSize: 10, lineHeight: 1.7, color: T.muted }}>
        {`Last healthy sync: ${lastHealthyLabel}`}
      </div>
    </button>
  )
}

export function ApiFallbackIndicator({
  usingFallback,
  activeBaseUrl,
  workspaceLabel,
}: {
  usingFallback: boolean
  activeBaseUrl: string
  workspaceLabel: string
}) {
  if (!usingFallback || !activeBaseUrl) return null
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 14,
        left: 14,
        zIndex: 239,
        maxWidth: 520,
        width: 'min(92vw, 520px)',
        borderRadius: 14,
        border: `1px solid ${T.success}55`,
        background: `linear-gradient(140deg, ${T.success}24, ${T.success}16)`,
        boxShadow: `0 10px 28px ${T.success}33`,
        color: T.text,
        textAlign: 'left',
        padding: '10px 12px',
      }}
    >
      <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: T.text }}>
        Fallback API Active
      </div>
      <div style={{ ...mono, fontSize: 10, lineHeight: 1.7, color: T.text }}>
        {`Connected to fallback backend for ${workspaceLabel}.`}
      </div>
      <div style={{ ...mono, fontSize: 10, lineHeight: 1.7, color: T.muted, wordBreak: 'break-all' }}>
        {activeBaseUrl}
      </div>
    </div>
  )
}
