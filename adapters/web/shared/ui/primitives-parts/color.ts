import { T } from '@web/simulation/fixtures'

export function getAccessiblePrimaryAccent(tone = T.accent) {
  return (tone === '#3b82f6' || tone === '#5ea0ff' || tone === '#006DDD' || tone === '#2D8AF0') ? '#1d4ed8' : tone
}

export function getAccessibleDangerAccent(tone = T.danger) {
  return tone === '#ef4444' ? '#b91c1c' : tone
}

export const ACCESSIBLE_PRIMARY_ACCENT = getAccessiblePrimaryAccent()
export const ACCESSIBLE_DANGER_ACCENT = getAccessibleDangerAccent()

export type SemanticTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

export function getSemanticTone(tone: SemanticTone) {
  if (tone === 'success') return T.success
  if (tone === 'warning') return T.warning
  if (tone === 'danger') return T.danger
  if (tone === 'neutral') return T.dim
  return T.accent
}

export function withAlpha(color: string, alpha: string) {
  if (!color.startsWith('#')) return color
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}${alpha}`
  }
  return `${color.slice(0, 7)}${alpha}`
}

function hexToRgb(color: string) {
  if (!color.startsWith('#')) return null
  const normalized = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color.slice(0, 7)
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return `#${clampChannel(r).toString(16).padStart(2, '0')}${clampChannel(g).toString(16).padStart(2, '0')}${clampChannel(b).toString(16).padStart(2, '0')}`
}

function blendHex(base: string, target: string, weight: number) {
  const baseRgb = hexToRgb(base)
  const targetRgb = hexToRgb(target)
  if (!baseRgb || !targetRgb) return target
  const normalizedWeight = Math.max(0, Math.min(1, weight))
  return rgbToHex({
    r: baseRgb.r + (targetRgb.r - baseRgb.r) * normalizedWeight,
    g: baseRgb.g + (targetRgb.g - baseRgb.g) * normalizedWeight,
    b: baseRgb.b + (targetRgb.b - baseRgb.b) * normalizedWeight,
  })
}

function relativeLuminance(color: string) {
  const rgb = hexToRgb(color)
  if (!rgb) return 0
  const toLinear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b))
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getAccessibleChipPalette(color: string) {
  const chipSurface = T.surface2
  const isLightSurface = relativeLuminance(chipSurface) > 0.45
  const blendTarget = isLightSurface ? '#111827' : '#f8fafc'
  const backgroundWeight = isLightSurface ? 0.08 : 0.18
  const borderWeight = isLightSurface ? 0.16 : 0.26
  const candidateSteps = [0, 0.08, 0.14, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84, 0.92]

  for (const step of candidateSteps) {
    const tone = step === 0 ? color : blendHex(color, blendTarget, step)
    const background = blendHex(chipSurface, tone, backgroundWeight)
    if (contrastRatio(tone, background) >= 4.5) {
      return {
        tone,
        background,
        border: blendHex(chipSurface, tone, borderWeight),
      }
    }
  }

  const fallbackTone = isLightSurface ? '#1f2937' : '#f8fafc'
  return {
    tone: fallbackTone,
    background: blendHex(chipSurface, fallbackTone, backgroundWeight),
    border: blendHex(chipSurface, fallbackTone, borderWeight),
  }
}
