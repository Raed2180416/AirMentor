import { useState, useCallback } from 'react'

export type SessionNotice = { tone: 'neutral' | 'error'; message: string }

export function useDismissibleSessionNotice() {
  const [notice, setNotice] = useState<SessionNotice | null>(null)
  const dismissNotice = useCallback(() => setNotice(null), [])
  return { notice, setNotice, dismissNotice }
}
