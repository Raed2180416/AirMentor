// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AcademicSessionBoundary } from '../src/academic-session-shell'

afterEach(() => {
  cleanup()
})

describe('academic session shell', () => {
  it('requests a password setup link from the login help panel', async () => {
    const onRequestPasswordSetup = vi.fn().mockResolvedValue(undefined)

    render(createElement(AcademicSessionBoundary, {
      backendReady: true,
      booting: false,
      sessionReady: false,
      facultyOptions: [],
      authBusy: false,
      authError: '',
      passwordSetupToken: null,
      passwordSetupInspect: null,
      passwordSetupMessage: '',
      passwordSetupRequestResult: null,
      onBackToPortal: vi.fn(),
      onRequestPasswordSetup,
      onRedeemPasswordSetup: vi.fn(),
      onClearPasswordSetupToken: vi.fn(),
      onLogin: vi.fn(),
      children: null,
    }))

    fireEvent.change(screen.getByPlaceholderText('Username or email'), {
      target: { value: 'kavitha.rao@msruas.ac.in' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send Link' }))

    expect(onRequestPasswordSetup).toHaveBeenCalledWith('kavitha.rao@msruas.ac.in')
  })

  it('renders password redeem mode when a setup token is active', () => {
    const onRedeemPasswordSetup = vi.fn().mockResolvedValue(undefined)

    render(createElement(AcademicSessionBoundary, {
      backendReady: true,
      booting: false,
      sessionReady: false,
      facultyOptions: [],
      authBusy: false,
      authError: '',
      passwordSetupToken: 'token_123',
      passwordSetupInspect: {
        purpose: 'invite',
        username: 'kavitha.rao',
        email: 'kavitha.rao@msruas.ac.in',
        facultyId: 'fac_1',
        displayName: 'Prof. Kavitha Rao',
        expiresAt: '2026-03-20T10:00:00.000Z',
        credentialStatus: {
          passwordConfigured: false,
          activeSetupRequest: true,
          latestPurpose: 'invite',
          latestRequestedAt: '2026-03-19T10:00:00.000Z',
          latestExpiresAt: '2026-03-20T10:00:00.000Z',
        },
      },
      passwordSetupMessage: '',
      passwordSetupRequestResult: null,
      onBackToPortal: vi.fn(),
      onRequestPasswordSetup: vi.fn(),
      onRedeemPasswordSetup,
      onClearPasswordSetupToken: vi.fn(),
      onLogin: vi.fn(),
      children: null,
    }))

    fireEvent.change(screen.getByPlaceholderText('Minimum 8 characters'), {
      target: { value: 'invitepass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repeat password'), {
      target: { value: 'invitepass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }))

    expect(screen.getByText('Password setup')).toBeTruthy()
    expect(onRedeemPasswordSetup).toHaveBeenCalledWith('invitepass123')
  })
})
