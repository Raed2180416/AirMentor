import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QueueBulkActions, RestoreBanner } from '../src/system-admin-ui'

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
