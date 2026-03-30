import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QueueBulkActions, RestoreBanner } from '../src/system-admin-ui'
import {
  ACCESSIBLE_DANGER_ACCENT,
  ACCESSIBLE_PRIMARY_ACCENT,
  NotificationCountBadge,
  getAccessibleDangerAccent,
  getAccessiblePrimaryAccent,
  getPrimaryActionButtonStyle,
} from '../src/ui-primitives'

describe('RestoreBanner', () => {
  it('renders explicit restore messaging and a reset action', () => {
    const markup = renderToStaticMarkup(createElement(RestoreBanner, {
      title: 'Proof playback restored',
      message: 'Proof playback restored to Semester 6 · Semester Close. Use Reset playback to clear the saved checkpoint.',
      actionLabel: 'Reset playback',
      onAction: () => {},
    }))

    expect(markup).toContain('data-restore-banner="true"')
    expect(markup).toContain('Proof playback restored')
    expect(markup).toContain('Reset playback')
    expect(markup).toContain('Semester 6')
  })
})

describe('QueueBulkActions', () => {
  it('renders hide-all and restore-all-hidden controls with hidden-count messaging', () => {
    const markup = renderToStaticMarkup(createElement(QueueBulkActions, {
      canHideAll: true,
      hiddenCount: 3,
      onHideAll: () => {},
      onRestoreAll: () => {},
    }))

    expect(markup).toContain('data-queue-bulk-actions="true"')
    expect(markup).toContain('Hide all')
    expect(markup).toContain('Restore all hidden')
    expect(markup).toContain('3 hidden right now.')
  })
})

describe('NotificationCountBadge', () => {
  it('caps large queue counts and uses the accessible danger accent', () => {
    const markup = renderToStaticMarkup(createElement('div', { style: { position: 'relative' } },
      createElement(NotificationCountBadge, { count: 108 }),
    ))

    expect(markup).toContain('data-queue-count-badge="true"')
    expect(markup).toContain('99')
    expect(markup).toContain(ACCESSIBLE_DANGER_ACCENT)
  })
})

describe('queue action chrome', () => {
  it('uses darker accessible accent helpers for light-theme queue controls', () => {
    expect(getAccessiblePrimaryAccent('#3b82f6')).toBe('#1d4ed8')
    expect(getAccessiblePrimaryAccent('#006DDD')).toBe('#1d4ed8')
    expect(getAccessibleDangerAccent('#ef4444')).toBe('#b91c1c')
  })

  it('returns a full-width primary action style for sticky queue actions', () => {
    const style = getPrimaryActionButtonStyle({ fullWidth: true })

    expect(style.width).toBe('100%')
    expect(style.background).toBe(ACCESSIBLE_PRIMARY_ACCENT)
    expect(style.color).toBe('#fff')
  })
})
