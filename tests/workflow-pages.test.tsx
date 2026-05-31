// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AllStudentsPage } from '../src/pages/workflow-pages'
import { AppSelectorsContext, createAppSelectors } from '../src/selectors'
import type { Offering, Student } from '../src/data'

afterEach(() => {
  cleanup()
})

function makeOffering(): Offering {
  return {
    offId: 'sem1_eee_a',
    id: 'sem1_eee_a',
    code: 'EEE105A',
    title: 'Basic Electrical Engineering',
    year: '1st Year',
    dept: 'EEE',
    sem: 1,
    section: 'A',
    count: 120,
    attendance: 0,
    stage: 1,
    stageInfo: { stage: 1, label: 'Pre TT1', desc: 'Opening stage', color: '#f97316' },
    tt1Done: false,
    tt2Done: false,
    pendingAction: null,
    sections: ['A'],
    enrolled: [120],
    att: [0],
  }
}

function makeStudent(index: number): Student {
  return {
    id: `student_${index}`,
    usn: `1MS23MC${String(index).padStart(3, '0')}`,
    name: `Student ${index}`,
    phone: '+91-9000000000',
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
    riskProb: null,
    riskBand: null,
    reasons: [],
    coScores: [],
    whatIf: [],
    interventions: [],
    flags: { backlog: false, lowAttendance: false, declining: false },
  }
}

describe('workflow pages', () => {
  it('keeps the full student roster vertically scrollable and opens a profile from the row', () => {
    const offering = makeOffering()
    const students = Array.from({ length: 120 }, (_, index) => makeStudent(index + 1))
    const onOpenStudent = vi.fn()
    const selectors = createAppSelectors({
      studentPatches: {},
      schemeByOffering: {},
      ttBlueprintsByOffering: {},
      studentsByOffering: { [offering.offId]: students },
      studentSourceMode: 'live',
    })

    render(createElement(AppSelectorsContext.Provider, { value: selectors }, createElement(AllStudentsPage, {
      offerings: [offering],
      onBack: vi.fn(),
      onOpenStudent,
      onOpenHistory: vi.fn(),
      onOpenUpload: vi.fn(),
    })))

    const roster = document.querySelector('[data-roster-scroll="all-students"]') as HTMLElement | null
    expect(roster).toBeTruthy()
    expect(roster?.style.overflowY).toBe('auto')

    fireEvent.click(screen.getByText('Student 37'))
    expect(onOpenStudent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'student_37' }),
      expect.objectContaining({ offId: 'sem1_eee_a' }),
    )
  }, 15000)
})
