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
})
