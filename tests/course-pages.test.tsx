// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CourseDetail } from '../src/pages/course-pages'
import { AppSelectorsContext, createAppSelectors, defaultSchemeForOffering } from '../src/selectors'
import type { Offering, Student } from '../src/data'

afterEach(() => {
  cleanup()
})

const sem1Offering: Offering = {
  offId: 'sem1_eee_a',
  id: 'sem1_eee_a',
  code: 'EEE105A',
  title: 'Basic Electrical Engineering',
  year: '1st Year',
  dept: 'EEE',
  sem: 1,
  section: 'A',
  count: 60,
  attendance: 0,
  stage: 1,
  stageInfo: { stage: 1, label: 'Pre TT1', desc: 'Opening stage before TT1 closes', color: '#f97316' },
  tt1Done: false,
  tt2Done: false,
  pendingAction: null,
  sections: ['A'],
  enrolled: [60],
  att: [0],
}

const sem1Student: Student = {
  id: 'student_001',
  usn: '1MS23MC001',
  name: 'Aarav Sharma',
  phone: '+91-9000000001',
  present: 0,
  totalClasses: 0,
  tt1Score: null,
  tt1Max: 25,
  tt2Score: null,
  tt2Max: 25,
  quiz1: null,
  quiz2: null,
  asgn1: null,
  asgn2: null,
  prevCgpa: 0,
  currentCgpa: 0,
  riskProb: 0.74,
  riskBand: 'High',
  reasons: [{ label: 'seeded mock risk', impact: 0.2, feature: 'mock' }],
  coScores: [],
  whatIf: [],
  interventions: [],
  flags: { backlog: false, lowAttendance: false, declining: false },
}

function renderCourse(initialTab = 'overview') {
  const selectors = createAppSelectors({
    studentPatches: {},
    schemeByOffering: { [sem1Offering.offId]: defaultSchemeForOffering(sem1Offering) },
    ttBlueprintsByOffering: {},
    studentsByOffering: { [sem1Offering.offId]: [sem1Student] },
    studentSourceMode: 'live',
  })

  return render(createElement(AppSelectorsContext.Provider, { value: selectors }, createElement(CourseDetail, {
    offering: sem1Offering,
    onBack: vi.fn(),
    onOpenStudent: vi.fn(),
    onOpenEntryHub: vi.fn(),
    onOpenSchemeSetup: vi.fn(),
    initialTab,
    scheme: defaultSchemeForOffering(sem1Offering),
    lockMap: { attendance: false, tt1: false, tt2: true, quiz: true, assignment: true, finals: true },
    blueprints: selectors.getBlueprintsForOffering(sem1Offering),
    onUpdateBlueprint: vi.fn(),
    courseOutcomes: [
      { id: 'CO1', desc: 'Explain the core laws of electric circuits and measurements.', bloom: 'Understand' },
      { id: 'CO2', desc: 'Apply basic circuit analysis methods to structured problems.', bloom: 'Apply' },
    ],
    coAttainmentRows: [],
  })))
}

describe('course pages', () => {
  it('shows Sem1 Pre-TT1 risk and attendance as not applicable until evidence exists', () => {
    renderCourse('attendance')

    expect(screen.getAllByText(/Not applicable yet/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/NaN%/i)).toBeNull()
    expect(screen.queryByText(/High · 74%/i)).toBeNull()
    expect(screen.queryByText(/Detained/i)).toBeNull()
  })

  it('opens a cohesive Course Outcome explanation popup only while hovering the CO button', () => {
    renderCourse('tt1')

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'CO1' }))
    expect(screen.getByRole('tooltip').textContent).toContain('Explain the core laws of electric circuits and measurements.')
    expect(screen.getByRole('tooltip').getAttribute('data-co-tooltip')).toBe('true')

    fireEvent.mouseLeave(screen.getByRole('button', { name: 'CO1' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
