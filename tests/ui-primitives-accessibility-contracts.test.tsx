import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ACCESSIBLE_DANGER_ACCENT,
  ACCESSIBLE_PRIMARY_ACCENT,
  NotificationCountBadge,
  getPrimaryActionButtonStyle,
  getSegmentedButtonStyle,
} from '../src/ui-primitives'

function hexToRgb(color: string) {
  const normalized = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function relativeLuminance(color: string) {
  const { r, g, b } = hexToRgb(color)
  const toLinear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b))
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('ui-primitives accessibility contracts', () => {
  it('keeps shared primary action chrome above the minimum white-text contrast threshold', () => {
    expect(contrastRatio('#ffffff', ACCESSIBLE_PRIMARY_ACCENT)).toBeGreaterThanOrEqual(4.5)

    const primaryActionStyle = getPrimaryActionButtonStyle()
    const segmentedStyle = getSegmentedButtonStyle({ active: true })

    expect(primaryActionStyle.background).toBe(ACCESSIBLE_PRIMARY_ACCENT)
    expect(primaryActionStyle.color).toBe('#fff')
    expect(String(segmentedStyle.background)).toContain(ACCESSIBLE_PRIMARY_ACCENT)
  })

  it('renders queue count badges with the shared accessible danger tone', () => {
    expect(contrastRatio('#ffffff', ACCESSIBLE_DANGER_ACCENT)).toBeGreaterThanOrEqual(4.5)

    const markup = renderToStaticMarkup(createElement(NotificationCountBadge, { count: 72 }))

    expect(markup).toContain('data-queue-count-badge="true"')
    expect(markup).toContain(ACCESSIBLE_DANGER_ACCENT)
    expect(markup).toContain('72')
  })
})
