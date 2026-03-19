import { T } from './data'
import type { ThemeMode } from './domain'

export const THEME_PRESETS: Record<ThemeMode, typeof T> = {
  'frosted-focus-light': {
    ...T,
    bg: '#edf3f8',
    surface: '#f7fbff',
    surface2: '#edf5ff',
    surface3: '#e4effa',
    border: '#d5e3f2',
    border2: '#c6d8ec',
    text: '#11243d',
    muted: '#4d647f',
    dim: '#8ea1b8',
    accent: '#3b82f6',
    accentLight: '#70a6ff',
  },
  'frosted-focus-dark': {
    ...T,
    bg: '#0a1018',
    surface: '#101a27',
    surface2: '#152131',
    surface3: '#1a293d',
    border: '#25364b',
    border2: '#2d435d',
    text: '#d5dfee',
    muted: '#9badc3',
    dim: '#607790',
    accent: '#5ea0ff',
    accentLight: '#84b8ff',
  },
}

export function isLightTheme(mode: ThemeMode) {
  return mode.endsWith('-light')
}

export function applyThemePreset(mode: ThemeMode) {
  const preset = THEME_PRESETS[mode]
  Object.assign(T, preset)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--app-bg', preset.bg)
  root.style.setProperty('--app-surface', preset.surface)
  root.style.setProperty('--app-surface-2', preset.surface2)
  root.style.setProperty('--app-surface-3', preset.surface3)
  root.style.setProperty('--app-border', preset.border)
  root.style.setProperty('--app-border-2', preset.border2)
  root.style.setProperty('--app-text', preset.text)
  root.style.setProperty('--app-muted', preset.muted)
  root.style.setProperty('--app-dim', preset.dim)
  root.style.setProperty('--app-accent', preset.accent)
  root.style.setProperty('--app-autofill-bg', preset.surface2)
  root.style.setProperty('--app-autofill-text', preset.text)
  root.style.setProperty('--ui-radius-chip', '10px')
  root.style.setProperty('--ui-radius-button', '12px')
  root.style.setProperty('--ui-radius-field', '14px')
  root.style.setProperty('--ui-radius-card', '18px')
  root.style.setProperty('--ui-radius-panel', '20px')
  root.style.setProperty('--ui-radius-modal', '24px')
  root.style.setProperty('--ui-shadow-soft', isLightTheme(mode) ? '0 12px 30px rgba(15, 23, 42, 0.08)' : '0 14px 30px rgba(2, 6, 23, 0.22)')
  root.style.setProperty('--ui-shadow-strong', isLightTheme(mode) ? '0 18px 42px rgba(15, 23, 42, 0.12)' : '0 24px 48px rgba(2, 6, 23, 0.3)')
  root.style.colorScheme = isLightTheme(mode) ? 'light' : 'dark'
}
