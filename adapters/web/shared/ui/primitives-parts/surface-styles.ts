import type { CSSProperties } from 'react'
import { T, mono, sora } from '@web/simulation/fixtures'
import type { ThemeMode } from '@kernel/shared/domain'
import { isLightTheme } from '@web/shared/ui/theme'
import { UI_FONT_SIZES, UI_RADII } from './tokens'
import { getAccessiblePrimaryAccent, withAlpha } from './color'

type SurfaceRole = 'primary' | 'secondary' | 'field' | 'selected' | 'warning' | 'danger' | 'success' | 'modal'

export function getSurfaceStyle(role: SurfaceRole, tone = T.accent): CSSProperties {
  if (role === 'field') {
    return {
      background: T.surface,
      border: `1px solid ${T.border2}`,
      boxShadow: `inset 0 1px 0 ${withAlpha(T.surface3, 'f2')}`,
      borderRadius: UI_RADII.field,
    }
  }
  if (role === 'selected') {
    return {
      background: `linear-gradient(180deg, ${withAlpha(tone, '0a')}, ${T.surface})`,
      border: `1px solid ${withAlpha(tone, '16')}`,
      boxShadow: `0 0 0 1px ${withAlpha(tone, '06')} inset, 0 8px 18px ${withAlpha(tone, '08')}`,
      borderRadius: UI_RADII.card,
    }
  }
  if (role === 'warning' || role === 'danger' || role === 'success') {
    return {
      background: `linear-gradient(180deg, ${withAlpha(tone, '12')}, ${T.surface})`,
      border: `1px solid ${withAlpha(tone, '30')}`,
      boxShadow: `0 18px 40px ${withAlpha(tone, '16')}`,
      borderRadius: UI_RADII.card,
    }
  }
  if (role === 'secondary') {
    return {
      background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`,
      border: `1px solid ${T.border}`,
      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
      borderRadius: UI_RADII.card,
    }
  }
  if (role === 'modal') {
    return {
      background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
      border: `1px solid ${T.border}`,
      boxShadow: '0 32px 86px rgba(2, 6, 23, 0.32)',
      borderRadius: UI_RADII.modal,
    }
  }
  return {
    background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
    border: `1px solid ${T.border}`,
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
    borderRadius: UI_RADII.card,
  }
}

export function getFieldChromeStyle({
  minHeight = 42,
  dense = false,
  tone = 'neutral',
}: {
  minHeight?: number
  dense?: boolean
  tone?: 'neutral' | 'selected'
} = {}): CSSProperties {
  const toneColor = tone === 'selected' ? T.accent : T.border2
  return {
    width: '100%',
    minHeight,
    ...mono,
    fontSize: dense ? UI_FONT_SIZES.meta : UI_FONT_SIZES.body,
    background: T.surface,
    color: T.text,
    colorScheme: 'inherit',
    border: `1px solid ${tone === 'selected' ? withAlpha(T.accent, '55') : toneColor}`,
    borderRadius: UI_RADII.field,
    padding: dense ? '8px 10px' : '10px 12px',
    boxShadow: `inset 0 1px 0 ${withAlpha(T.surface3, 'f2')}`,
  }
}

export function getShellBarStyle(themeMode: ThemeMode): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'grid',
    gap: 12,
    padding: '12px 20px 16px',
    background: isLightTheme(themeMode) ? 'rgba(247,251,255,0.88)' : 'rgba(9,14,22,0.88)',
    backdropFilter: 'blur(16px)',
    borderBottom: `1px solid ${T.border}`,
    boxShadow: isLightTheme(themeMode) ? '0 12px 28px rgba(15, 23, 42, 0.06)' : '0 16px 34px rgba(2, 6, 23, 0.22)',
  }
}

export function getIconButtonStyle({
  active = false,
  tone = T.accent,
  subtle = false,
  size = 38,
}: {
  active?: boolean
  tone?: string
  subtle?: boolean
  size?: number
} = {}): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: UI_RADII.button,
    border: `1px solid ${active ? withAlpha(tone, '55') : subtle ? T.border : T.border2}`,
    background: active
      ? `linear-gradient(180deg, ${withAlpha(tone, '16')}, ${T.surface})`
      : subtle
        ? 'transparent'
        : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
    color: active ? tone : T.muted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    boxShadow: active ? `0 12px 28px ${withAlpha(tone, '18')}` : '0 8px 18px rgba(15, 23, 42, 0.05)',
  }
}

export function getSegmentedGroupStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: 4,
    padding: 4,
    borderRadius: UI_RADII.panel,
    background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`,
    border: `1px solid ${T.border}`,
    boxShadow: `inset 0 1px 0 ${withAlpha(T.surface3, 'f0')}`,
  }
}

export function getSegmentedButtonStyle({
  active,
  disabled = false,
  tone = T.accent,
  compact = false,
}: {
  active: boolean
  disabled?: boolean
  tone?: string
  compact?: boolean
}): CSSProperties {
  const activeTone = tone === T.accent ? getAccessiblePrimaryAccent(tone) : tone
  return {
    ...sora,
    fontWeight: 700,
    fontSize: compact ? UI_FONT_SIZES.meta : UI_FONT_SIZES.body,
    padding: compact ? '7px 12px' : '8px 14px',
    minHeight: compact ? 34 : 38,
    borderRadius: UI_RADII.button,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? `linear-gradient(180deg, ${activeTone}, ${withAlpha(activeTone, 'd8')})` : 'transparent',
    color: active ? '#fff' : disabled ? T.dim : T.muted,
    opacity: disabled ? 0.55 : 1,
    boxShadow: active ? `0 12px 24px ${withAlpha(activeTone, '26')}` : 'none',
    whiteSpace: 'nowrap',
  }
}

export function getPrimaryActionButtonStyle({
  disabled = false,
  fullWidth = false,
}: {
  disabled?: boolean
  fullWidth?: boolean
} = {}): CSSProperties {
  const background = getAccessiblePrimaryAccent(T.accent)
  return {
    width: fullWidth ? '100%' : undefined,
    border: 'none',
    borderRadius: UI_RADII.button,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? T.surface3 : background,
    color: disabled ? T.dim : '#fff',
    padding: '10px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...sora,
    fontWeight: 700,
    fontSize: UI_FONT_SIZES.body,
    boxShadow: disabled ? 'none' : `0 14px 28px ${withAlpha(background, '26')}`,
  }
}
