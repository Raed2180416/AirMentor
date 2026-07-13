import { T, mono } from '@web/simulation/fixtures'

export function segmentedButtonStyle(active: boolean) {
  return {
    border: 'none',
    borderRadius: 999,
    background: active ? T.accent : 'transparent',
    color: active ? '#fff' : T.muted,
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    ...mono,
    fontSize: 11,
    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
  } as const
}

export function iconButtonStyle() {
  return {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface2,
    color: T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)',
  } as const
}

export function miniIconButtonStyle() {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface,
    color: T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.05)',
  } as const
}

export function edgeHandleStyle() {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${T.border2}`,
    background: T.surface,
    color: T.muted,
    cursor: 'ns-resize',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.05)',
  } as const
}

export function taskTextButtonStyle(compact: boolean, disabled = false) {
  return {
    border: 'none',
    background: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? T.dim : T.muted,
    ...mono,
    fontSize: compact ? 9 : 10,
    padding: 0,
    opacity: disabled ? 0.5 : 1,
    transition: 'color 0.15s ease, transform 0.15s ease, opacity 0.15s ease',
  } as const
}

export function sheetFieldStyle() {
  return {
    ...mono,
    fontSize: 11,
    background: T.surface2,
    color: T.text,
    border: `1px solid ${T.border2}`,
    borderRadius: 8,
    padding: '8px 10px',
    width: '100%',
  } as const
}

export function timeInputStyle(disabled: boolean) {
  return {
    ...mono,
    fontSize: 10,
    background: disabled ? T.surface3 : T.surface2,
    color: disabled ? T.dim : T.text,
    border: `1px solid ${T.border2}`,
    borderRadius: 8,
    padding: '6px 8px',
  } as const
}
