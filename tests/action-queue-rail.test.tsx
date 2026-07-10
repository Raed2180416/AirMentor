// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ActionQueueRail,
  type ActionQueueHiddenItem,
} from '../src/admin/action-queue-rail'

afterEach(() => {
  cleanup()
})

function renderActionQueueRail(overrides: Partial<Parameters<typeof ActionQueueRail>[0]> = {}) {
  const onHideAll = vi.fn()
  const onRestoreAll = vi.fn()
  const onDismissItem = vi.fn()
  const onNavigate = vi.fn()
  const onToggleReminderStatus = vi.fn()
  const onRestoreHiddenItem = vi.fn()
  const onCreateReminder = vi.fn()

  const hiddenItem: ActionQueueHiddenItem = {
    key: 'student:student_1',
    label: 'Ada Lovelace',
    meta: 'Student',
    updatedAt: '2026-07-10T00:00:00.000Z',
    onRestore: async () => {},
  }

  render(createElement(ActionQueueRail, {
    isRendered: true,
    isVisible: true,
    actionCount: 3,
    remindersSupported: true,
    visibleQueueDismissKeys: ['request:req_1', 'reminder:rem_1', 'hidden:student:student_1'],
    dismissedQueueItemKeys: [],
    openRequests: [{
      adminRequestId: 'req_1',
      requestType: 'Curriculum change',
      scopeType: 'branch',
      scopeId: 'branch_1',
      targetEntityRefs: [],
      priority: 'P1',
      status: 'New',
      requestedByRole: 'HOD',
      requestedByFacultyId: 'faculty_1',
      ownedByRole: 'SYSTEM_ADMIN',
      ownedByFacultyId: null,
      summary: 'Review assessment rules',
      details: 'Review the assessment rules for the current term.',
      notesThreadId: 'thread_1',
      dueAt: '2026-07-12T00:00:00.000Z',
      slaPolicyCode: 'P1-24H',
      decision: null,
      payload: {},
      version: 1,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      requesterName: 'Dr. Rao',
    }],
    pendingReminders: [{
      reminderId: 'rem_1',
      facultyId: 'faculty_1',
      title: 'Confirm timetable',
      body: 'Confirm the faculty timetable before publication.',
      dueAt: '2026-07-11T00:00:00.000Z',
      status: 'pending',
      version: 1,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    }],
    visibleHiddenItems: [hiddenItem],
    onHideAll,
    onRestoreAll,
    onDismissItem,
    onNavigate,
    onToggleReminderStatus,
    onRestoreHiddenItem,
    onCreateReminder,
    ...overrides,
  }))

  return {
    hiddenItem,
    onHideAll,
    onRestoreAll,
    onDismissItem,
    onNavigate,
    onToggleReminderStatus,
    onRestoreHiddenItem,
    onCreateReminder,
  }
}

describe('ActionQueueRail', () => {
  it('does not render the control rail when its responsive layout slot is closed', () => {
    renderActionQueueRail({ isRendered: false })

    expect(screen.queryByText('Action Queue')).toBeNull()
  })

  it('opens a request in the governed request workspace', () => {
    const { onNavigate } = renderActionQueueRail()

    fireEvent.click(screen.getByText('Review assessment rules'))

    expect(onNavigate).toHaveBeenCalledWith({ section: 'requests', requestId: 'req_1' })
  })

  it('keeps request, reminder, restore, and quick-add actions connected to their shell handlers', () => {
    const {
      hiddenItem,
      onDismissItem,
      onToggleReminderStatus,
      onRestoreHiddenItem,
      onCreateReminder,
    } = renderActionQueueRail()

    fireEvent.click(screen.getAllByRole('button', { name: 'Hide forever' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quick Add Reminder' }))

    expect(onDismissItem).toHaveBeenCalledWith('request:req_1')
    expect(onToggleReminderStatus).toHaveBeenCalledWith(expect.objectContaining({ reminderId: 'rem_1' }))
    expect(onRestoreHiddenItem).toHaveBeenCalledWith(hiddenItem)
    expect(onCreateReminder).toHaveBeenCalledOnce()
  })
})
