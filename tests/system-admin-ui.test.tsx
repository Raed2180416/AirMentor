import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RestoreBanner } from '../src/system-admin-ui'

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
