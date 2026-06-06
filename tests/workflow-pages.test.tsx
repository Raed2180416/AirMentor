// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AllStudentsPage, EntryWorkspacePage } from '../src/pages/workflow-pages'
import { AppSelectorsContext, createAppSelectors, defaultSchemeForOffering } from '../src/selectors'
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

  it('keeps direct-entry current CE and CGPA scoped to the proof playback stage', () => {
    const offering: Offering = {
      ...makeOffering(),
      stage: 5,
      stageInfo: { stage: 5, label: 'Post SEE', desc: 'Late live state', color: '#22c55e' },
      tt1Done: true,
      tt2Done: true,
    }
    const student: Student = {
      ...makeStudent(1),
      present: 50,
      totalClasses: 50,
      tt1Score: 25,
      tt2Score: 25,
      quiz1: 10,
      asgn1: 10,
      proofObservedTt1Pct: 100,
      proofObservedTt2Pct: 100,
      proofObservedQuizPct: 100,
      proofObservedAssignmentPct: 100,
      proofObservedSeePct: 100,
      predictedCgpa: 9.1,
    }
    const scheme = defaultSchemeForOffering(offering)
    const selectors = createAppSelectors({
      studentPatches: {},
      schemeByOffering: { [offering.offId]: scheme },
      ttBlueprintsByOffering: {},
      studentsByOffering: { [offering.offId]: [student] },
      studentSourceMode: 'live',
    })

    render(createElement(AppSelectorsContext.Provider, { value: selectors }, createElement(EntryWorkspacePage, {
      capabilities: { canApproveUnlock: false, canEditMarks: true },
      offeringId: offering.offId,
      kind: 'tt1',
      onBack: vi.fn(),
      lockByOffering: { [offering.offId]: { attendance: false, tt1: false, tt2: false, quiz: false, assignment: false, finals: false } },
      draftBySection: {},
      onSaveDraft: vi.fn(),
      onSubmitLock: vi.fn(),
      onRequestUnlock: vi.fn(),
      cellValues: {},
      onCellValueChange: vi.fn(),
      onOpenStudent: vi.fn(),
      onOpenTaskComposer: vi.fn(),
      onUpdateStudentAttendance: vi.fn(),
      schemeByOffering: { [offering.offId]: scheme },
      ttBlueprintsByOffering: {},
      studentHistoryByUsn: {},
      lockAuditByTarget: {},
      availableOfferings: [offering],
      proofStageKey: 'post-tt1',
    })))

    const pageText = document.body.textContent ?? ''
    expect(pageText).toContain(`CE ${scheme.termTestWeights.tt1.toFixed(1)}/${scheme.policyContext.ce}`)
    expect(pageText).toContain('CGPA —')
    expect(pageText).not.toContain(`CE ${scheme.policyContext.ce.toFixed(1)}/${scheme.policyContext.ce}`)
    expect(pageText).not.toContain('CGPA 9.10')
  })
})
