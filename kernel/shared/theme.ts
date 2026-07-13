export type ThemeMode = 'frosted-focus-light' | 'frosted-focus-dark'

export function normalizeThemeMode(raw: string | null): ThemeMode {
  if (raw === 'light') return 'frosted-focus-light'
  if (raw === 'dark') return 'frosted-focus-dark'
  if (raw === 'frosted-focus-light' || raw === 'frosted-focus-dark') return raw
  return 'frosted-focus-light'
}
