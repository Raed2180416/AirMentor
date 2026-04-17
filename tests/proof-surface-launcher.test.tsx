// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProofSurfaceLauncher } from '../src/proof-surface-shell'

afterEach(() => {
  cleanup()
})

describe('ProofSurfaceLauncher popup contract', () => {
  it('opens a popup preview, stays dark-mode legible, and closes again on repeat click', () => {
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
    const launcherShell = document.querySelector('[data-proof-launcher="floating"]') as HTMLElement | null
    const launcherCard = launcherShell?.firstElementChild as HTMLElement | null
    expect(launcher.getAttribute('data-proof-action')).toBe('proof-shell-launcher')
    expect(launcherShell?.style.zIndex).toBe('1200')
    expect(launcherShell?.style.pointerEvents).toBe('auto')
    expect(launcherCard?.style.background).toContain('rgba(13, 16, 23')
    expect(launcher.style.background).not.toContain('linear-gradient')

    fireEvent.click(launcher)

    expect(screen.getByRole('dialog', { name: 'Proof dashboard preview' })).toBeTruthy()
    expect(screen.getAllByText('Queue and checkpoint snapshot for the active proof branch.')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Open full dashboard' })).toHaveLength(2)
    expect(document.querySelector('[data-proof-launcher-state="open"]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Open proof dashboard.*open dialog/i }))

    expect(document.querySelector('[data-proof-launcher-state="closed"]')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Proof dashboard preview' })).toBeNull()
  })
})
