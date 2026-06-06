// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudentDrawer } from '../src/App'
import { AppSelectorsContext, createAppSelectors, defaultSchemeForOffering } from '../src/selectors'
import type { Offering, Student } from '../src/data'

afterEach(() => {
  cleanup()
})

const offering: Offering = {
  offId: 'sem1_eee_a',
  id: 'sem1_eee_a',
  code: 'EEE105A',
  title: 'Basic Electrical Engineering',
  year: '1st Year',
  dept: 'EEE',
  sem: 1,
  section: 'A',
  count: 60,
  attendance: 100,
  stage: 5,
  stageInfo: { stage: 5, label: 'Post SEE', desc: 'SEE complete', color: '#22c55e' },
  tt1Done: true,
  tt2Done: true,
  pendingAction: null,
  sections: ['A'],
  enrolled: [60],
  att: [100],
}

const student: Student = {
  id: 'student_001',
  usn: '1MS23MC001',
  name: 'Aarav Sharma',
  phone: '+91-9000000001',
  present: 45,
  totalClasses: 50,
  tt1Score: 25,
  tt1Max: 25,
  tt2Score: 25,
  tt2Max: 25,
  quiz1: 10,
  quiz2: null,
  asgn1: 10,
  asgn2: null,
  prevCgpa: 8.2,
  currentCgpa: 8.3,
  predictedCgpa: 9.1,
  proofObservedTt1Pct: 100,
  proofObservedTt2Pct: 100,
  proofObservedQuizPct: 100,
  proofObservedAssignmentPct: 100,
  proofObservedSeePct: 100,
  riskProb: 0.74,
  riskBand: 'High',
  reasons: [{ label: 'Attendance pressure', impact: 0.24, feature: 'attendance' }],
  coScores: [],
  whatIf: [],
  interventions: [],
  flags: { backlog: false, lowAttendance: false, declining: false },
}

function renderDrawer(proofStageKey: string) {
  const scheme = defaultSchemeForOffering(offering)
  const selectors = createAppSelectors({
    studentPatches: {},
    schemeByOffering: { [offering.offId]: scheme },
    ttBlueprintsByOffering: {},
    studentsByOffering: { [offering.offId]: [student] },
    studentSourceMode: 'live',
  })

  return render(createElement(AppSelectorsContext.Provider, { value: selectors }, createElement(StudentDrawer, {
    student,
    offering,
    historyByUsn: {},
    role: 'Course Leader',
    meetings: [],
    onClose: vi.fn(),
    onEscalate: vi.fn(),
    onOpenTaskComposer: vi.fn(),
    onAssignToMentor: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenStudentShell: vi.fn(),
    onOpenRiskExplorer: vi.fn(),
    onScheduleMeeting: vi.fn(),
    proofStageKey,
  })))
}

describe('StudentDrawer', () => {
  it('does not label previous CGPA as predicted before SEE evidence is visible', () => {
    renderDrawer('post-assignments')

    expect(screen.getByText('Pred CGPA').previousSibling?.textContent).toBe('—')
    expect(screen.queryByText('9.10')).toBeNull()
    expect(screen.queryByText('8.2')).toBeNull()
    expect(screen.getByText('SEE Readiness')).toBeTruthy()
  })

  it('uses post-SEE status language and predicted CGPA after SEE evidence is visible', () => {
    renderDrawer('post-see')

    expect(screen.getByText('Pred CGPA').previousSibling?.textContent).toBe('9.10')
    expect(screen.getByText('Post-SEE Status')).toBeTruthy()
    expect(screen.getByText('Needs follow-up')).toBeTruthy()
    expect(screen.queryByText('SEE Readiness')).toBeNull()
    expect(screen.queryByText('Needs support')).toBeNull()
  })
})
