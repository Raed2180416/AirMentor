// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { createElement, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModalWorkspace } from '../src/ui-primitives'

function ModalHarness() {
  const [open, setOpen] = useState(true)
  return open
    ? createElement(
        ModalWorkspace,
        {
          title: 'Edit Student',
          onClose: () => setOpen(false),
          children: [
            createElement('input', { key: 'name', 'aria-label': 'Name' }),
            createElement('button', { key: 'save', type: 'button' }, 'Save'),
          ],
        },
      )
    : null
}

function RerenderModalHarness() {
  const [version, setVersion] = useState(1)
  return createElement(
    ModalWorkspace,
    {
      title: 'Edit Student',
      caption: `Version ${version}`,
      onClose: () => undefined,
      children: [
        createElement('button', { key: 'rerender', type: 'button', onClick: () => setVersion(current => current + 1) }, 'Rerender'),
        createElement('input', { key: 'name', 'aria-label': 'Name' }),
        createElement('button', { key: 'save', type: 'button' }, 'Save'),
      ],
    },
  )
}

describe('ModalWorkspace', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('focuses inside the modal, traps tab navigation, and restores focus to the opener', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open editor'
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(createElement(ModalHarness))
    vi.runAllTimers()

    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    const nameInput = screen.getByRole('textbox', { name: 'Name' })
    const saveButton = screen.getByRole('button', { name: 'Save' })

    expect(document.activeElement).toBe(closeButton)

    closeButton.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(saveButton)

    saveButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)

    nameInput.focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)

    unmount()
    opener.remove()
  })

  it('wraps reverse tabbing back to the last actionable control even if the dialog itself has focus', () => {
    render(createElement(ModalHarness))
    vi.runAllTimers()

    const dialog = screen.getByRole('dialog', { name: 'Edit Student' })
    const saveButton = screen.getByRole('button', { name: 'Save' })

    dialog.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(saveButton)
  })

  it('preserves the focus trap across rerenders while the dialog remains open', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open editor'
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(createElement(RerenderModalHarness))
    vi.runAllTimers()

    const closeButton = screen.getAllByRole('button', { name: 'Close dialog' }).at(-1)
    const rerenderButton = screen.getAllByRole('button', { name: 'Rerender' }).at(-1)
    const saveButton = screen.getAllByRole('button', { name: 'Save' }).at(-1)

    expect(closeButton).toBeTruthy()
    expect(rerenderButton).toBeTruthy()
    expect(saveButton).toBeTruthy()

    expect(document.activeElement).toBe(closeButton!)

    fireEvent.click(rerenderButton!)
    vi.runAllTimers()

    expect(document.activeElement).not.toBe(opener)
    closeButton!.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(saveButton!)

    unmount()
    opener.remove()
  })
})
