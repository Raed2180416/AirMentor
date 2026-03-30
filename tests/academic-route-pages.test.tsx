// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLDashboard, MenteeDetailPage, MentorView, QueueHistoryPage } from '../src/academic-route-pages'
import { AppSelectorsContext, createAppSelectors } from '../src/selectors'

function getNativeButton(name: string | RegExp, index = 0) {
  return screen.getAllByRole('button', { name }).filter(element => element.tagName === 'BUTTON')[index]
}

afterEach(() => {
  cleanup()
})

const mentee = {
  id: 'mentee-student_001',
  name: 'Aarav Sharma',
  usn: '1MS23MC001',
  year: 'III Year',
  section: 'A',
  dept: 'MNC',
  avs: 0.72,
  courseRisks: [
    { code: 'MC601', title: 'Graph Theory', risk: 0.72, band: 'High' },
  ],
  interventions: [
    { date: '2026-03-14', type: 'Follow-up', note: 'Tracked after TT2 slump.' },
  ],
  prevCgpa: 7.1,
  phone: '+91-9000000001',
}

const history = {
  studentName: 'Aarav Sharma',
  usn: '1MS23MC001',
  currentCgpa: 7.1,
  terms: [
    {
      termId: 'term_1',
      label: 'Sem 1',
      semesterNumber: 1,
      sgpa: 7.1,
      subjects: [
        { code: 'MC101', title: 'Calculus', score: 78 },
        { code: 'MC102', title: 'Programming', score: 64 },
      ],
    },
  ],
}

const task = {
  id: 'task_001',
  studentId: 'student_001',
  studentName: 'Aarav Sharma',
  studentUsn: '1MS23MC001',
  offeringId: 'off_mc601_a',
  courseCode: 'MC601',
  courseName: 'Graph Theory',
  year: 'III Year',
  riskProb: 0.72,
  riskBand: 'High',
  title: 'Follow up with proof cohort student',
  due: 'Today',
  dueDateISO: '2026-03-20',
  status: 'In Progress',
  actionHint: 'Review the checkpoint-bound weakness drivers.',
  priority: 72,
  createdAt: Date.parse('2026-03-16T09:00:00.000Z'),
  updatedAt: Date.parse('2026-03-16T10:00:00.000Z'),
  assignedTo: 'Mentor',
  taskType: 'Follow-up',
  manual: true,
  sourceRole: 'Course Leader',
  transitionHistory: [
    {
      id: 'transition_001',
      at: Date.parse('2026-03-16T10:00:00.000Z'),
      actorRole: 'Course Leader',
      actorTeacherId: 'mnc_t1',
      action: 'Assigned to mentor',
      fromOwner: 'Course Leader',
      toOwner: 'Mentor',
      note: 'Mentor should follow up on the proof queue item.',
    },
  ],
  dismissal: null,
  unlockRequest: null,
}

const proofProfile = {
  facultyId: 'mnc_t1',
  displayName: 'Dr. Asha Rao',
  designation: 'Professor',
  employeeCode: 'F001',
  joinedOn: '2020-06-01',
  email: 'asha.rao@example.edu',
  phone: '9999999999',
  primaryDepartment: {
    departmentId: 'dept_mnc',
    name: 'Mathematics and Computing',
    code: 'MNC',
  },
  appointments: [],
  permissions: [],
  subjectRunCourseLeaderScope: [],
  mentorScope: { activeStudentCount: 2, studentIds: ['student_001', 'student_002'] },
  currentOwnedClasses: [{ offeringId: 'off_mc601_a', courseCode: 'MC601', title: 'Graph Theory', yearLabel: 'III Year', sectionCode: 'A', ownershipRole: 'owner', departmentName: 'MNC', branchName: 'B.Tech Mathematics and Computing' }],
  currentBatchContexts: [],
  timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
  requestSummary: { openCount: 3, recent: [] },
  reassessmentSummary: { openCount: 2, nextDueAt: null, recentDecisionTypes: [] },
  proofOperations: {
    scopeDescriptor: {
      scopeType: 'proof',
      scopeId: 'checkpoint_001',
      label: '2023 Mathematics and Computing',
      batchId: 'batch_mnc_2023',
      sectionCode: null,
      branchName: 'B.Tech Mathematics and Computing',
      simulationRunId: 'run_001',
      simulationStageCheckpointId: 'checkpoint_001',
      studentId: null,
    },
    resolvedFrom: {
      kind: 'proof-checkpoint',
      scopeType: 'proof',
      scopeId: 'checkpoint_001',
      label: 'Semester Close · Proof Run 1',
    },
    scopeMode: 'proof',
    countSource: 'proof-checkpoint',
    activeOperationalSemester: 6,
    activeRunContexts: [],
    selectedCheckpoint: {
      simulationStageCheckpointId: 'checkpoint_001',
      simulationRunId: 'run_001',
      semesterNumber: 6,
      stageKey: 'semester-close',
      stageLabel: 'Semester Close',
      stageDescription: 'Final checkpoint.',
      stageOrder: 6,
      previousCheckpointId: 'checkpoint_000',
      nextCheckpointId: null,
      highRiskCount: 8,
      openQueueCount: 13,
    },
    monitoringQueue: [],
    electiveFits: [],
  },
}

function renderWithSelectors(node: ReturnType<typeof createElement>) {
  const selectors = createAppSelectors({
    studentPatches: {},
    schemeByOffering: {},
    ttBlueprintsByOffering: {},
    studentsByOffering: {},
    studentSourceMode: 'live',
  })
  return render(createElement(AppSelectorsContext.Provider, { value: selectors }, node))
}

describe('academic route pages', () => {
  it('opens mentor queue drilldowns into mentee, risk explorer, and student shell', () => {
    const onOpenMentee = vi.fn()
    const onOpenRiskExplorer = vi.fn()
    const onOpenStudentShell = vi.fn()

    render(createElement(MentorView, {
      mentees: [mentee],
      tasks: [task],
      proofProfile,
      onOpenMentee,
      onOpenRiskExplorer,
      onOpenStudentShell,
    }))

    fireEvent.click(getNativeButton('Open Student'))
    fireEvent.click(getNativeButton('Risk Explorer'))
    fireEvent.click(getNativeButton('Student Shell'))

    expect(onOpenMentee).toHaveBeenCalledWith(mentee)
    expect(onOpenRiskExplorer).toHaveBeenCalledWith('student_001')
    expect(onOpenStudentShell).toHaveBeenCalledWith('student_001')
  })

  it('opens partial-profile and proof drilldowns from mentee detail', () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })

    const onOpenHistory = vi.fn()
    const onOpenRiskExplorer = vi.fn()
    const onOpenStudentShell = vi.fn()

    render(createElement(MenteeDetailPage, {
      mentee,
      history,
      onBack: vi.fn(),
      onOpenHistory,
      onOpenRiskExplorer,
      onOpenStudentShell,
    }))

    fireEvent.click(getNativeButton(/View Student History/i))
    fireEvent.click(getNativeButton(/Risk Explorer/i))
    fireEvent.click(getNativeButton(/Student Shell/i))

    expect(onOpenHistory).toHaveBeenCalledWith(mentee)
    expect(onOpenRiskExplorer).toHaveBeenCalledWith('student_001')
    expect(onOpenStudentShell).toHaveBeenCalledWith('student_001')
  })

  it('opens queue-history drilldowns into the same bounded student surfaces', () => {
    const onOpenTaskStudent = vi.fn()
    const onOpenRiskExplorer = vi.fn()
    const onOpenStudentShell = vi.fn()

    render(createElement(QueueHistoryPage, {
      role: 'Mentor',
      tasks: [task],
      resolvedTaskIds: {},
      proofProfile,
      onBack: vi.fn(),
      onOpenTaskStudent,
      onOpenUnlockReview: vi.fn(),
      onRestoreTask: vi.fn(),
      onOpenRiskExplorer,
      onOpenStudentShell,
    }))

    fireEvent.click(getNativeButton('Open Student'))
    fireEvent.click(getNativeButton('Risk Explorer'))
    fireEvent.click(getNativeButton('Student Shell'))

    expect(onOpenTaskStudent).toHaveBeenCalledWith(task)
    expect(onOpenRiskExplorer).toHaveBeenCalledWith('student_001')
    expect(onOpenStudentShell).toHaveBeenCalledWith('student_001')
  })

  it('shows the same proof summary strip on dashboard, mentor, and queue surfaces', () => {
    renderWithSelectors(createElement(CLDashboard, {
      offerings: [],
      pendingTaskCount: 3,
      proofProfile,
      onOpenCourse: vi.fn(),
      onOpenStudent: vi.fn(),
      onOpenUpload: vi.fn(),
      onOpenCalendar: vi.fn(),
      onOpenPendingActions: vi.fn(),
      teacherInitials: 'AR',
      greetingHeadline: 'Welcome back',
      greetingMeta: 'Proof-aligned teaching scope',
      greetingSubline: 'Checkpoint-bound view',
    }))
    expect(screen.getByText('Course Leader Dashboard')).toBeTruthy()
    expect(screen.getByText('Semester 6')).toBeTruthy()
    expect(document.querySelector('[data-proof-summary-scope-label="2023 Mathematics and Computing"]')).toBeTruthy()
    expect(document.querySelector('[data-proof-summary-mode="proof"]')).toBeTruthy()
    expect(document.querySelector('[data-proof-summary-value="open-queue"]')?.textContent).toBe('13')
    cleanup()

    render(createElement(MentorView, {
      mentees: [mentee],
      tasks: [task],
      proofProfile,
      onOpenMentee: vi.fn(),
      onOpenRiskExplorer: vi.fn(),
      onOpenStudentShell: vi.fn(),
    }))
    expect(screen.getByText('Mentor View')).toBeTruthy()
    expect(screen.getByText('13')).toBeTruthy()
    cleanup()

    render(createElement(QueueHistoryPage, {
      role: 'Mentor',
      tasks: [task],
      resolvedTaskIds: {},
      proofProfile,
      onBack: vi.fn(),
      onOpenTaskStudent: vi.fn(),
      onOpenUnlockReview: vi.fn(),
      onRestoreTask: vi.fn(),
      onOpenRiskExplorer: vi.fn(),
      onOpenStudentShell: vi.fn(),
    }))
    expect(screen.getAllByText('Queue History').length).toBeGreaterThan(0)
    expect(screen.getByText('Authoritative queue history proof context. Use these checkpoint-bound counts and scope labels when comparing teacher, mentor, and queue surfaces.')).toBeTruthy()
  })
})
