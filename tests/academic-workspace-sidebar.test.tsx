// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { Calendar, History, Users } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FacultyAccount } from '../src/domain'
import { AcademicWorkspaceSidebar } from '../src/academic-workspace-sidebar'

const currentTeacher: FacultyAccount = {
  facultyId: 't1',
  name: 'Dr. Kavitha Rao QA',
  initials: 'DK',
  allowedRoles: ['Course Leader', 'Mentor', 'HoD'],
  dept: 'CSE',
  roleTitle: 'Professor',
  email: 'kavitha.rao@example.edu',
  courseCodes: ['CS101'],
  offeringIds: ['off_cs101_a'],
  menteeIds: ['student_001'],
}

const mentorNavItems: Parameters<typeof AcademicWorkspaceSidebar>[0]['navItems'] = [
  { id: 'mentees', icon: Users, label: 'My Mentees' },
  { id: 'queue-history', icon: History, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar / Timetable' },
]

function renderSidebar(overrides: Partial<Parameters<typeof AcademicWorkspaceSidebar>[0]> = {}) {
  const onSelectNavItem = vi.fn()
  render(createElement(AcademicWorkspaceSidebar, {
    currentTeacher,
    role: 'Mentor',
    page: 'queue-history',
    historyBackPage: null,
    navItems: mentorNavItems,
    sidebarYearGroups: [],
    sidebarCompletenessRows: [],
    sidebarCollapsed: false,
    sidebarToggleLabel: 'Collapse sidebar',
    isCompactTopbar: false,
    onOpenFacultyProfile: vi.fn(),
    onSelectNavItem,
    onExpandSidebar: vi.fn(),
    onCollapseSidebar: vi.fn(),
    ...overrides,
  }))
  return { onSelectNavItem }
}

describe('AcademicWorkspaceSidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('marks queue history as the active mentor nav item on queue-history pages', () => {
    renderSidebar()

    expect(screen.getByRole('button', { name: 'Queue History' }).getAttribute('data-active')).toBe('true')
    expect(screen.getByRole('button', { name: 'My Mentees' }).getAttribute('data-active')).toBe('false')
  })

  it('routes queue history selection through the sidebar nav button', () => {
    const { onSelectNavItem } = renderSidebar({ page: 'mentees' })

    fireEvent.click(screen.getByRole('button', { name: 'Queue History' }))

    expect(onSelectNavItem).toHaveBeenCalledWith('queue-history')
  })
})
