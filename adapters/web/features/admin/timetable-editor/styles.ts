import type { CSSProperties } from 'react'
import { T, mono } from '@web/simulation/fixtures'

export function iconButtonStyle() {
  return {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: T.surface2,
    color: T.muted,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } satisfies CSSProperties
}

export function timeInputStyle(disabled: boolean) {
  return {
    minHeight: 36,
    borderRadius: 10,
    border: `1px solid ${T.border2}`,
    background: disabled ? T.surface2 : T.surface,
    color: disabled ? T.dim : T.text,
    padding: '0 12px',
    ...mono,
    fontSize: 11,
  } satisfies CSSProperties
}

export const fieldStyle: CSSProperties = {
  width: '100%',
  minHeight: 40,
  borderRadius: 10,
  border: `1px solid ${T.border2}`,
  background: T.surface2,
  color: T.text,
  padding: '0 12px',
  ...mono,
  fontSize: 11,
}

export const textAreaStyle: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: `1px solid ${T.border2}`,
  background: T.surface2,
  color: T.text,
  padding: '10px 12px',
  ...mono,
  fontSize: 11,
  resize: 'vertical',
}

export const sheetBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.62)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 160,
}

export function sheetCardStyle(maxWidth: number): CSSProperties {
  return {
    width: '100%',
    maxWidth,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 18,
    padding: 18,
    display: 'grid',
    gap: 16,
    boxShadow: '0 28px 70px rgba(2, 6, 23, 0.34)',
  }
}
