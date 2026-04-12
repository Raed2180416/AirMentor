// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProofSurfaceLauncher } from '../src/proof-surface-shell'

afterEach(() => {
  cleanup()
})

describe('ProofSurfaceLauncher popup contract', () => {
  it('opens a popup preview before jumping to the shared proof dashboard target', () => {
    render(createElement(
      'div',
      null,
      createElement('div', { id: 'proof-dashboard-target' }, 'Proof dashboard target'),
      createElement(ProofSurfaceLauncher, {
        targetId: 'proof-dashboard-target',
        label: 'Open proof dashboard',
        popupTitle: 'Proof dashboard preview',
        popupCaption: 'Queue and checkpoint snapshot for the active proof branch.',
        popupContent: ({ jumpToTarget }) => createElement('button', { type: 'button', onClick: jumpToTarget }, 'Open full dashboard'),
      }),
    ))

    const launcher = screen.getByRole('button', { name: /Open proof dashboard.*open dialog/i })
    expect(launcher.getAttribute('data-proof-action')).toBe('proof-shell-launcher')

    fireEvent.click(launcher)

    expect(screen.getByRole('dialog', { name: 'Proof dashboard preview' })).toBeTruthy()
    expect(screen.getAllByText('Queue and checkpoint snapshot for the active proof branch.')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Open full dashboard' })).toHaveLength(2)
    expect(document.querySelector('[data-proof-launcher-state="open"]')).toBeTruthy()
  })
})
