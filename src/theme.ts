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
  Object.assign(T, THEME_PRESETS[mode])
}
