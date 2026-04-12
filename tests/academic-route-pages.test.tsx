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
      studentCount: 120,
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

function renderWithSelectorOverrides(
  node: ReturnType<typeof createElement>,
  overrides: Partial<Parameters<typeof createAppSelectors>[0]>,
) {
  const selectors = createAppSelectors({
    studentPatches: {},
    schemeByOffering: {},
    ttBlueprintsByOffering: {},
    studentsByOffering: {},
    studentSourceMode: 'live',
    ...overrides,
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
    expect(screen.getByText('Authoritative queue history proof context. Use these checkpoint-bound counts, model usefulness cues, and scope labels when comparing policy-derived status, no-action comparator, and simulated intervention / realized path surfaces.')).toBeTruthy()
  })

  it('prefers proof-scoped totals over summed offering totals on the course leader dashboard', () => {
    const offerings = [
      {
        offId: 'off_mc601_a',
        id: 'off_mc601_a',
        code: 'MC601',
        title: 'Graph Theory',
        year: 'III Year',
        dept: 'MNC',
        sem: 6,
        section: 'A',
        count: 60,
        attendance: 84,
        stage: 2,
        stageInfo: { stage: 2, label: 'In Progress', desc: 'Checkpoint active', color: '#3b82f6' },
        tt1Done: true,
        tt2Done: true,
        pendingAction: null,
        sections: ['A'],
        enrolled: [2],
        att: [84],
        branchId: 'branch_mnc',
        termId: 'term_6_a',
      },
      {
        offId: 'off_mc602_b',
        id: 'off_mc602_b',
        code: 'MC602',
        title: 'Optimization',
        year: 'III Year',
        dept: 'MNC',
        sem: 6,
        section: 'B',
        count: 60,
        attendance: 82,
        stage: 2,
        stageInfo: { stage: 2, label: 'In Progress', desc: 'Checkpoint active', color: '#3b82f6' },
        tt1Done: true,
        tt2Done: true,
        pendingAction: null,
        sections: ['B'],
        enrolled: [2],
        att: [82],
        branchId: 'branch_mnc',
        termId: 'term_6_b',
      },
    ]

    renderWithSelectorOverrides(createElement(CLDashboard, {
      offerings,
      pendingTaskCount: 0,
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
    }), {
      studentsByOffering: {
        off_mc601_a: [mentee],
        off_mc602_b: [mentee],
      },
    })

    const totalStudentsLabel = screen.getByText('Total Students')
    expect(totalStudentsLabel.parentElement?.firstElementChild?.textContent).toBe('120')
  })

  it('prefers checkpoint queue alerts over per-offering duplicate high-risk rows on the course leader dashboard', () => {
    const offerings = [
      {
        offId: 'off_mc601_a',
        id: 'off_mc601_a',
        code: 'MC601',
        title: 'Graph Theory',
        year: 'III Year',
        dept: 'MNC',
        sem: 6,
        section: 'A',
        count: 60,
        attendance: 84,
        stage: 2,
        stageInfo: { stage: 2, label: 'In Progress', desc: 'Checkpoint active', color: '#3b82f6' },
        tt1Done: true,
        tt2Done: true,
        pendingAction: null,
        sections: ['A'],
        enrolled: [2],
        att: [84],
        branchId: 'branch_mnc',
        termId: 'term_6_a',
      },
      {
        offId: 'off_mc602_b',
        id: 'off_mc602_b',
        code: 'MC602',
        title: 'Optimization',
        year: 'III Year',
        dept: 'MNC',
        sem: 6,
        section: 'B',
        count: 60,
        attendance: 82,
        stage: 2,
        stageInfo: { stage: 2, label: 'In Progress', desc: 'Checkpoint active', color: '#3b82f6' },
        tt1Done: true,
        tt2Done: true,
        pendingAction: null,
        sections: ['B'],
        enrolled: [2],
        att: [82],
        branchId: 'branch_mnc',
        termId: 'term_6_b',
      },
    ]
    const onOpenStudent = vi.fn()
    const proofProfileWithQueue = {
      ...proofProfile,
      proofOperations: {
        ...proofProfile.proofOperations,
        monitoringQueue: [
          {
            riskAssessmentId: 'risk_001',
            simulationRunId: 'run_001',
            batchId: 'batch_mnc_2023',
            batchLabel: '2023 Proof',
            branchName: 'B.Tech Mathematics and Computing',
            studentId: 'student_001',
            studentName: 'Aarav Sharma',
            usn: '1MS23MC001',
            offeringId: 'off_mc601_a',
            courseCode: 'MC601',
            courseTitle: 'Graph Theory',
            sectionCode: 'A',
            riskBand: 'High',
            riskProbScaled: 81,
            recommendedAction: 'Open a mentor checkpoint and assign remedial work.',
            riskChangeFromPreviousCheckpointScaled: 9,
            counterfactualLiftScaled: 14,
            drivers: [{ label: 'Checkpoint risk spike', impact: 0.24, feature: 'proof-checkpoint' }],
            dueAt: null,
            reassessmentStatus: 'Open',
            decisionType: 'open',
            decisionNote: null,
            observedEvidence: {
              attendancePct: 62,
              tt1Pct: 38,
              tt2Pct: 0,
              quizPct: 0,
              assignmentPct: 0,
              seePct: 0,
              cgpa: 6.8,
              backlogCount: 1,
              weakCoCount: 2,
              weakQuestionCount: 4,
              interventionRecoveryStatus: null,
              coEvidenceMode: 'checkpoint-observed',
            },
            override: null,
            acknowledgement: null,
            resolution: null,
          },
          {
            riskAssessmentId: 'risk_002',
            simulationRunId: 'run_001',
            batchId: 'batch_mnc_2023',
            batchLabel: '2023 Proof',
            branchName: 'B.Tech Mathematics and Computing',
            studentId: 'student_001',
            studentName: 'Aarav Sharma',
            usn: '1MS23MC001',
            offeringId: 'off_mc602_b',
            courseCode: 'MC602',
            courseTitle: 'Optimization',
            sectionCode: 'B',
            riskBand: 'High',
            riskProbScaled: 76,
            recommendedAction: 'Continue watchful course follow-up.',
            riskChangeFromPreviousCheckpointScaled: 7,
            counterfactualLiftScaled: 10,
            drivers: [{ label: 'Optimization score drop', impact: 0.18, feature: 'proof-checkpoint' }],
            dueAt: null,
            reassessmentStatus: 'Watching',
            decisionType: 'watch',
            decisionNote: null,
            observedEvidence: {
              attendancePct: 65,
              tt1Pct: 42,
              tt2Pct: 0,
              quizPct: 0,
              assignmentPct: 0,
              seePct: 0,
              cgpa: 6.8,
              backlogCount: 1,
              weakCoCount: 1,
              weakQuestionCount: 2,
              interventionRecoveryStatus: null,
              coEvidenceMode: 'checkpoint-observed',
            },
            override: null,
            acknowledgement: null,
            resolution: null,
          },
          {
            riskAssessmentId: 'risk_003',
            simulationRunId: 'run_001',
            batchId: 'batch_mnc_2023',
            batchLabel: '2023 Proof',
            branchName: 'B.Tech Mathematics and Computing',
            studentId: 'student_002',
            studentName: 'Nisha Patel',
            usn: '1MS23MC002',
            offeringId: 'off_mc602_b',
            courseCode: 'MC602',
            courseTitle: 'Optimization',
            sectionCode: 'B',
            riskBand: 'High',
            riskProbScaled: 72,
            recommendedAction: 'Assign a structured recovery plan.',
            riskChangeFromPreviousCheckpointScaled: 6,
            counterfactualLiftScaled: 8,
            drivers: [{ label: 'Weak checkpoint outcomes', impact: 0.16, feature: 'proof-checkpoint' }],
            dueAt: null,
            reassessmentStatus: 'Open',
            decisionType: 'open',
            decisionNote: null,
            observedEvidence: {
              attendancePct: 69,
              tt1Pct: 45,
              tt2Pct: 0,
              quizPct: 0,
              assignmentPct: 0,
              seePct: 0,
              cgpa: 7,
              backlogCount: 0,
              weakCoCount: 1,
              weakQuestionCount: 1,
              interventionRecoveryStatus: null,
              coEvidenceMode: 'checkpoint-observed',
            },
            override: null,
            acknowledgement: null,
            resolution: null,
          },
        ],
      },
    }

    renderWithSelectorOverrides(createElement(CLDashboard, {
      offerings,
      pendingTaskCount: 0,
      proofProfile: proofProfileWithQueue,
      onOpenCourse: vi.fn(),
      onOpenStudent,
      onOpenUpload: vi.fn(),
      onOpenCalendar: vi.fn(),
      onOpenPendingActions: vi.fn(),
      teacherInitials: 'AR',
      greetingHeadline: 'Welcome back',
      greetingMeta: 'Proof-aligned teaching scope',
      greetingSubline: 'Checkpoint-bound view',
    }), {
      studentsByOffering: {
        off_mc601_a: [
          { id: 'off_mc601_a::student_001', name: 'Aarav Sharma', usn: '1MS23MC001', phone: '+91-9000000001', riskProb: 0.81, riskBand: 'High', reasons: [{ label: 'Operational duplicate', impact: 0.2, feature: 'legacy' }] },
        ],
        off_mc602_b: [
          { id: 'off_mc602_b::student_001', name: 'Aarav Sharma', usn: '1MS23MC001', phone: '+91-9000000001', riskProb: 0.76, riskBand: 'High', reasons: [{ label: 'Operational duplicate', impact: 0.2, feature: 'legacy' }] },
          { id: 'off_mc602_b::student_002', name: 'Nisha Patel', usn: '1MS23MC002', phone: '+91-9000000002', riskProb: 0.72, riskBand: 'High', reasons: [{ label: 'Operational duplicate', impact: 0.2, feature: 'legacy' }] },
        ],
      },
    })

    const highWatchLabel = screen.getByText('High Watch Students')
    expect(highWatchLabel.parentElement?.firstElementChild?.textContent).toBe('2')

    fireEvent.click(screen.getByText('Aarav Sharma'))
    expect(onOpenStudent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'off_mc601_a::student_001' }),
      expect.objectContaining({ offId: 'off_mc601_a' }),
    )
  })
})
