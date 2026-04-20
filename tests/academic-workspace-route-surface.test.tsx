import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ApiAcademicFacultyProfile } from '../src/api/types'
import type { FacultyAccount, SharedTask } from '../src/domain'
import { AcademicWorkspaceRouteSurface } from '../src/academic-workspace-route-surface'

const facultyProfile: ApiAcademicFacultyProfile = {
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
  permissions: [],
  appointments: [],
  currentOwnedClasses: [],
  currentBatchContexts: [],
  subjectRunCourseLeaderScope: [],
  mentorScope: { activeStudentCount: 2, studentIds: ['student_001', 'student_002'] },
  timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
  requestSummary: { openCount: 1, recent: [{ adminRequestId: 'request_001', summary: 'Need mentor review', status: 'Open', updatedAt: '2026-03-16T00:00:00.000Z' }] },
  reassessmentSummary: { openCount: 2, nextDueAt: null, recentDecisionTypes: ['acknowledged'] },
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
    activeRunContexts: [
      {
        batchId: 'batch_mnc_2023',
        simulationRunId: 'run_001',
        runLabel: 'Proof Run 1',
        batchLabel: '2023 Mathematics and Computing',
        branchName: 'B.Tech Mathematics and Computing',
        status: 'active',
        seed: 42,
        createdAt: '2026-03-16T00:00:00.000Z',
      },
    ],
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

const mentorTask: SharedTask = {
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
}

const currentTeacher: FacultyAccount = {
  facultyId: 'mnc_t1',
  name: 'Dr. Asha Rao',
  initials: 'AR',
  allowedRoles: ['Course Leader', 'Mentor', 'HoD'],
  dept: 'Mathematics and Computing',
  roleTitle: 'Professor',
  email: 'asha.rao@example.edu',
  courseCodes: ['MC601'],
  offeringIds: ['off_mc601_a'],
  menteeIds: ['student_001', 'student_002'],
}

describe('AcademicWorkspaceRouteSurface', () => {
  it('routes faculty-profile pages through the extracted proof surface', () => {
    const markup = renderToStaticMarkup(createElement(AcademicWorkspaceRouteSurface, {
      workspace: {
        role: 'Course Leader',
        page: 'faculty-profile',
        currentTeacher,
        facultyProfile,
        currentFacultyCalendarMarkers: [],
        facultyProfileLoading: false,
        facultyProfileError: '',
        pendingActionCount: 3,
        assignedOfferings: [],
        filteredCurrentFacultyTimetable: null,
        handleNavigateBack: () => {},
        handleOpenStudentProfile: () => {},
        handleOpenStudentShell: () => {},
        handleOpenRiskExplorer: () => {},
      },
      layoutMode: 'three-column',
      proofPlaybackNotice: null,
      routeError: '',
      routeLoadingLabel: 'Loading route...',
      onResetProofPlaybackSelection: () => {},
    }))

    expect(markup).toContain('Teaching Profile')
    expect(markup).toContain('data-proof-surface="teacher-proof-panel"')
    expect(markup).toContain('Checkpoint overlay')
  })

  it('routes mentor queue-history pages with partial-profile drilldown actions intact', () => {
    const markup = renderToStaticMarkup(createElement(AcademicWorkspaceRouteSurface, {
      workspace: {
        role: 'Mentor',
        page: 'queue-history',
        facultyProfile,
        roleTasks: [mentorTask],
        resolvedTasks: {},
        handleNavigateBack: () => {},
        handleOpenTaskStudent: () => {},
        handleOpenUnlockReview: () => {},
        handleRestoreTask: () => {},
        handleOpenStudentShell: () => {},
        handleOpenRiskExplorer: () => {},
      },
      layoutMode: 'three-column',
      proofPlaybackNotice: null,
      routeError: '',
      routeLoadingLabel: 'Loading route...',
      onResetProofPlaybackSelection: () => {},
    }))

    expect(markup).toContain('Queue History')
    expect(markup).toContain('data-proof-surface="academic-proof-summary"')
    expect(markup).toContain('data-proof-scope="queue-history"')
    expect(markup).toMatch(/data-proof-summary-metric="(selected-checkpoint|preview-semester|live-semester)"/)
    expect(markup).toContain('Open Student')
    expect(markup).toContain('Risk Explorer')
    expect(markup).toContain('Student Shell')
  })
})
