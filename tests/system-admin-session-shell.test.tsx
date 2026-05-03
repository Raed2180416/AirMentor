// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SystemAdminSessionBoundary } from '../src/system-admin-session-shell'

afterEach(() => {
  cleanup()
})

describe('system admin session shell', () => {
  it('lets operators reveal the password field before submitting credentials', () => {
    render(createElement(SystemAdminSessionBoundary, {
      booting: false,
      activeRoleCode: null,
      canSwitchToSystemAdmin: false,
      authBusy: false,
      authError: '',
      identifier: 'sysadmin',
      password: 'admin1234',
      apiBaseUrl: '/',
      onIdentifierChange: vi.fn(),
      onPasswordChange: vi.fn(),
      onLogin: vi.fn(),
      onSwitchToSystemAdmin: vi.fn(),
      onLogout: vi.fn(),
      children: null,
    }))

    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show Password' }))

    expect(passwordInput.getAttribute('type')).toBe('text')
    expect(screen.getByDisplayValue('admin1234')).toBe(passwordInput)
    expect(screen.getByRole('button', { name: 'Hide Password' })).toBeTruthy()
  })
})
