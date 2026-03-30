// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ProofSurfaceHero,
  ProofSurfaceLauncher,
  ProofSurfaceTabPanel,
  ProofSurfaceTabs,
} from '../src/proof-surface-shell'

afterEach(() => {
  cleanup()
})

function ProofTabsHarness() {
  const [activeTab, setActiveTab] = useState('overview')

  return createElement(
    'div',
    null,
    createElement(ProofSurfaceTabs, {
      idBase: 'proof-shell',
      controlId: 'proof-shell-controls',
      tabs: [
        { id: 'overview', label: 'Overview' },
        { id: 'details', label: 'Details' },
      ],
      activeTab,
      onChange: setActiveTab,
      ariaLabel: 'Shared proof sections',
    }),
    createElement(
      ProofSurfaceTabPanel,
      {
        idBase: 'proof-shell',
        tabId: 'overview',
        activeTab,
        sectionId: 'proof-panel-overview',
      },
      createElement('div', null, 'Overview panel'),
    ),
    createElement(
      ProofSurfaceTabPanel,
      {
        idBase: 'proof-shell',
        tabId: 'details',
        activeTab,
        sectionId: 'proof-panel-details',
      },
      createElement('div', null, 'Details panel'),
    ),
  )
}

describe('ProofSurfaceShell', () => {
  it('renders the shared proof shell owner and floating launcher contract', () => {
    render(createElement(
      ProofSurfaceHero,
      {
        surface: 'proof-shell-test',
        eyebrow: 'Proof Shell',
        title: 'Shared Proof Shell',
        description: 'Shared proof shell contract.',
      },
      createElement(ProofSurfaceLauncher, { targetId: 'proof-surface-controls' }),
      createElement('div', { id: 'proof-surface-controls' }, 'Proof controls'),
    ))

    const shell = document.querySelector('[data-proof-shell="shared"]')
    const launcher = document.querySelector('[data-proof-launcher="floating"]')
    const button = screen.getByRole('button', { name: 'Jump to proof controls' })

    expect(shell?.getAttribute('data-proof-surface')).toBe('proof-shell-test')
    expect(launcher).not.toBeNull()
    expect(button.getAttribute('data-proof-action')).toBe('proof-shell-launcher')
    expect(button.getAttribute('aria-controls')).toBe('proof-surface-controls')
  })

  it('renders the shared tablist and active panel contract', () => {
    render(createElement(ProofTabsHarness))

    const tablist = screen.getByRole('tablist', { name: 'Shared proof sections' })
    const overviewTab = screen.getByRole('tab', { name: 'Overview' })
    const detailsTab = screen.getByRole('tab', { name: 'Details' })

    expect(tablist.getAttribute('data-proof-shell-tabs')).toBe('shared')
    expect(overviewTab.getAttribute('aria-selected')).toBe('true')
    expect(detailsTab.getAttribute('aria-selected')).toBe('false')

    let panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('data-proof-shell-panel')).toBe('shared')
    expect(panel.getAttribute('data-proof-section')).toBe('proof-panel-overview')
    expect(screen.getByText('Overview panel')).toBeTruthy()
    expect(screen.queryByText('Details panel')).toBeNull()

    fireEvent.click(detailsTab)

    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')).toBe('true')

    panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('data-proof-shell-panel')).toBe('shared')
    expect(panel.getAttribute('data-proof-section')).toBe('proof-panel-details')
    expect(screen.queryByText('Overview panel')).toBeNull()
    expect(screen.getByText('Details panel')).toBeTruthy()
  })
})
