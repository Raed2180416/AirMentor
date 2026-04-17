// @vitest-environment jsdom
import { createElement, type ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FacultyProfilePage } from '../src/academic-faculty-profile-page'

afterEach(() => {
  cleanup()
})

describe('FacultyProfilePage proof mode', () => {
  it('renders explicit proof authority labeling alongside the teacher proof panel', () => {
    const props: ComponentProps<typeof FacultyProfilePage> = {
      currentTeacher: {
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
      },
      activeRole: 'Course Leader',
      profile: {
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
        permissions: [
          {
            grantId: 'grant_1',
            facultyId: 'mnc_t1',
            roleCode: 'COURSE_LEADER',
            scopeType: 'branch',
            scopeId: 'branch_mnc',
            scopeLabel: 'Mathematics and Computing',
            startDate: '2026-01-01',
            endDate: null,
            status: 'active',
            version: 1,
          },
        ],
        appointments: [],
        currentOwnedClasses: [],
        currentBatchContexts: [],
        subjectRunCourseLeaderScope: [],
        mentorScope: { activeStudentCount: 24, studentIds: ['student_001', 'student_002'] },
        timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
        requestSummary: { openCount: 0, recent: [] },
        reassessmentSummary: { openCount: 2, nextDueAt: null, recentDecisionTypes: ['acknowledged', 'targeted-tutoring'] },
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
          monitoringQueue: [
            {
              riskAssessmentId: 'risk_001',
              simulationRunId: 'run_001',
              batchId: 'batch_mnc_2023',
              batchLabel: '2023 Mathematics and Computing',
              branchName: 'B.Tech Mathematics and Computing',
              studentId: 'student_001',
              studentName: 'Aarav Sharma',
              usn: '1MS23MC001',
              offeringId: 'off_mc601_a',
              courseCode: 'MC601',
              courseTitle: 'Graph Theory',
              sectionCode: 'A',
              riskBand: 'High',
              riskProbScaled: 78,
              recommendedAction: 'targeted-tutoring',
              dueAt: '2026-03-18T00:00:00.000Z',
              reassessmentStatus: 'Open',
              decisionType: 'targeted-tutoring',
              decisionNote: 'Monitor attendance and TT2 recovery.',
              observedEvidence: {
                attendancePct: 68,
                tt1Pct: 34,
                tt2Pct: 41,
                quizPct: 52,
                assignmentPct: 61,
                seePct: 46,
                weakCoCount: 2,
                weakQuestionCount: 4,
                cgpa: 6.8,
                backlogCount: 1,
                interventionRecoveryStatus: 'watch',
              },
              drivers: [{ label: 'Attendance below threshold', feature: 'attendancePct', impact: 0.31 }],
              override: null,
              acknowledgement: null,
              resolution: null,
            },
          ],
          electiveFits: [
            {
              electiveRecommendationId: 'elective_fit_001',
              studentId: 'student_001',
              studentName: 'Aarav Sharma',
              usn: '1MS23MC001',
              recommendedCode: 'MC6E01',
              recommendedTitle: 'Applied Optimization',
              stream: 'Data Intelligence',
              rationale: ['Stable math signal'],
              alternatives: [],
              updatedAt: '2026-03-16T00:00:00.000Z',
            },
          ],
        },
      },
      calendarMarkers: [],
      loading: false,
      error: '',
      pendingTaskCount: 3,
      assignedOfferings: [],
      currentFacultyTimetable: null,
      onBack: () => {},
      onOpenStudentProfile: () => {},
      onOpenStudentShell: () => {},
      onOpenRiskExplorer: () => {},
    }
    const markup = renderToStaticMarkup(createElement(FacultyProfilePage, props))

    expect(markup).toContain('data-proof-section="proof-mode-authority"')
    expect(markup).toContain('Proof mode is active')
    expect(markup).toContain('data-proof-shell="shared"')
    expect(markup).toContain('data-proof-launcher="floating"')
    expect(markup).toContain('data-proof-action="proof-shell-launcher"')
    expect(markup).toContain('data-proof-surface="teacher-proof-panel"')
    expect(markup).toContain('data-proof-section="proof-authority-note"')
    expect(markup).toContain('Authoritative proof panel for this faculty scope')
    expect(markup).toContain('data-proof-launcher-mode="popup-capable"')
    expect(markup).toContain('data-proof-section="active-run-contexts"')
    expect(markup).toContain('data-proof-section="checkpoint-overlay"')
    expect(markup).toContain('data-proof-section="monitoring-queue"')
    expect(markup).toContain('data-proof-section="elective-fit"')
    expect(markup).toContain('Proof Queue Items')
    expect(markup).toContain('Monitored Students')
    expect(markup).toContain('Checkpoint proof scope: 1 monitored student')
    expect(markup).toContain('Checkpoint-bound teaching scope across 1 monitored offering in semester 6.')
    expect(markup).toContain('Semester 6 · Sections A · COURSE_LEADER, MENTOR')
    expect(markup).toContain('Checkpoint-bound batch context derived from the active proof scope.')
    expect(markup).toContain('Checkpoint-bound course-leader scope derived from monitored proof offerings.')
    expect(markup).toContain('Checkpoint-bound proof counts')
    expect(markup).toContain('Model usefulness and proof-semester counts')
    expect(markup).toContain('checkpoint semester 6')
    expect(markup).toContain('Proof-semester elective fit')
    expect(markup).toContain('teacher-proof-open-partial-profile')
  })

  it('opens the teacher proof popup surface with proof-semester guidance', () => {
    render(createElement(FacultyProfilePage, {
      currentTeacher: {
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
      },
      activeRole: 'Course Leader',
      profile: {
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
        mentorScope: { activeStudentCount: 24, studentIds: ['student_001', 'student_002'] },
        timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
        requestSummary: { openCount: 0, recent: [] },
        reassessmentSummary: { openCount: 2, nextDueAt: null, recentDecisionTypes: ['acknowledged', 'targeted-tutoring'] },
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
      },
      calendarMarkers: [],
      loading: false,
      error: '',
      pendingTaskCount: 3,
      assignedOfferings: [],
      currentFacultyTimetable: null,
      onBack: () => {},
      onOpenStudentProfile: () => {},
      onOpenStudentShell: () => {},
      onOpenRiskExplorer: () => {},
    }))

    fireEvent.click(screen.getByRole('button', { name: /Jump to teacher proof controls/ }))

    expect(screen.getAllByText('Teacher proof control surface').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Model usefulness is checkpoint-bound here\./)).toBeTruthy()
    expect(screen.getByText('Open proof controls')).toBeTruthy()
  })

  it('does not backfill admin-owned faculty fields from the session teacher when the live profile is missing', () => {
    const markup = renderToStaticMarkup(createElement(FacultyProfilePage, {
      currentTeacher: {
        facultyId: 'mnc_t1',
        name: 'Dr. Asha Rao',
        initials: 'AR',
        allowedRoles: ['Course Leader', 'Mentor', 'HoD'],
        dept: 'Session Department',
        roleTitle: 'Session Professor',
        email: 'session-only@example.edu',
        courseCodes: ['MC601'],
        offeringIds: ['off_mc601_a'],
        menteeIds: ['student_001', 'student_002'],
      },
      activeRole: 'Course Leader',
      profile: null,
      calendarMarkers: [],
      loading: false,
      error: '',
      pendingTaskCount: 0,
      assignedOfferings: [],
      currentFacultyTimetable: null,
      onBack: () => {},
      onOpenStudentProfile: () => {},
      onOpenStudentShell: () => {},
      onOpenRiskExplorer: () => {},
    }))

    expect(markup).toContain('Not provisioned in the admin faculty record')
    expect(markup).toContain('This page will not synthesize permissions')
    expect(markup).not.toContain('Session Department')
    expect(markup).not.toContain('Session Professor')
    expect(markup).not.toContain('session-only@example.edu')
  })

  it('opens the bounded partial profile from proof queue rows', () => {
    const onOpenStudentProfile = vi.fn()

    render(createElement(FacultyProfilePage, {
      currentTeacher: {
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
      },
      activeRole: 'Course Leader',
      profile: {
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
        mentorScope: { activeStudentCount: 24, studentIds: ['student_001', 'student_002'] },
        timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
        requestSummary: { openCount: 0, recent: [] },
        reassessmentSummary: { openCount: 2, nextDueAt: null, recentDecisionTypes: ['acknowledged', 'targeted-tutoring'] },
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
          selectedCheckpoint: null,
          monitoringQueue: [
            {
              riskAssessmentId: 'risk_001',
              simulationRunId: 'run_001',
              batchId: 'batch_mnc_2023',
              batchLabel: '2023 Mathematics and Computing',
              branchName: 'B.Tech Mathematics and Computing',
              studentId: 'student_001',
              studentName: 'Aarav Sharma',
              usn: '1MS23MC001',
              offeringId: 'off_mc601_a',
              courseCode: 'MC601',
              courseTitle: 'Graph Theory',
              sectionCode: 'A',
              riskBand: 'High',
              riskProbScaled: 78,
              recommendedAction: 'targeted-tutoring',
              dueAt: '2026-03-18T00:00:00.000Z',
              reassessmentStatus: 'Open',
              decisionType: 'targeted-tutoring',
              decisionNote: 'Monitor attendance and TT2 recovery.',
              observedEvidence: {
                attendancePct: 68,
                tt1Pct: 34,
                tt2Pct: 41,
                quizPct: 52,
                assignmentPct: 61,
                seePct: 46,
                weakCoCount: 2,
                weakQuestionCount: 4,
                cgpa: 6.8,
                backlogCount: 1,
                interventionRecoveryStatus: 'watch',
              },
              drivers: [{ label: 'Attendance below threshold', feature: 'attendancePct', impact: 0.31 }],
              override: null,
              acknowledgement: null,
              resolution: null,
            },
          ],
          electiveFits: [],
        },
      },
      calendarMarkers: [],
      loading: false,
      error: '',
      pendingTaskCount: 3,
      assignedOfferings: [],
      currentFacultyTimetable: null,
      onBack: () => {},
      onOpenStudentProfile,
      onOpenStudentShell: () => {},
      onOpenRiskExplorer: () => {},
    }))

    expect(screen.getByRole('button', { name: /Jump to teacher proof controls/ })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Student' })[0])
    expect(onOpenStudentProfile).toHaveBeenCalledWith('student_001', 'off_mc601_a')
  })

  it('uses checkpoint-derived scope counts instead of operational mentor totals in proof mode', () => {
    render(createElement(FacultyProfilePage, {
      currentTeacher: {
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
      },
      activeRole: 'Mentor',
      profile: {
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
        mentorScope: { activeStudentCount: 24, studentIds: Array.from({ length: 24 }, (_, index) => `student_${String(index + 1).padStart(3, '0')}`) },
        timetableStatus: { hasTemplate: true, publishedAt: '2026-03-10T00:00:00.000Z', directEditWindowEndsAt: null },
        requestSummary: { openCount: 7, recent: [] },
        reassessmentSummary: { openCount: 4, nextDueAt: null, recentDecisionTypes: [] },
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
            previousCheckpointId: null,
            nextCheckpointId: null,
            highRiskCount: 2,
            openQueueCount: 2,
          },
          monitoringQueue: [
            {
              riskAssessmentId: 'risk_001',
              simulationRunId: 'run_001',
              batchId: 'batch_mnc_2023',
              batchLabel: '2023 Mathematics and Computing',
              branchName: 'B.Tech Mathematics and Computing',
              studentId: 'student_001',
              studentName: 'Aarav Sharma',
              usn: '1MS23MC001',
              offeringId: 'off_mc601_a',
              courseCode: 'MC601',
              courseTitle: 'Graph Theory',
              sectionCode: 'A',
              riskBand: 'High',
              riskProbScaled: 78,
              recommendedAction: 'targeted-tutoring',
              dueAt: null,
              reassessmentStatus: 'Open',
              decisionType: 'targeted-tutoring',
              decisionNote: null,
              observedEvidence: {
                attendancePct: 68,
                tt1Pct: 34,
                tt2Pct: 41,
                quizPct: 52,
                assignmentPct: 61,
                seePct: 46,
                weakCoCount: 2,
                weakQuestionCount: 4,
                cgpa: 6.8,
                backlogCount: 1,
                interventionRecoveryStatus: 'watch',
              },
              drivers: [{ label: 'Attendance below threshold', feature: 'attendancePct', impact: 0.31 }],
              override: null,
              acknowledgement: null,
              resolution: null,
            },
            {
              riskAssessmentId: 'risk_002',
              simulationRunId: 'run_001',
              batchId: 'batch_mnc_2023',
              batchLabel: '2023 Mathematics and Computing',
              branchName: 'B.Tech Mathematics and Computing',
              studentId: 'student_002',
              studentName: 'Nisha Patel',
              usn: '1MS23MC002',
              offeringId: 'off_mc602_b',
              courseCode: 'MC602',
              courseTitle: 'Optimization',
              sectionCode: 'B',
              riskBand: 'High',
              riskProbScaled: 74,
              recommendedAction: 'mentor-checkin',
              dueAt: null,
              reassessmentStatus: 'Open',
              decisionType: 'mentor-checkin',
              decisionNote: null,
              observedEvidence: {
                attendancePct: 71,
                tt1Pct: 42,
                tt2Pct: 39,
                quizPct: 48,
                assignmentPct: 57,
                seePct: 44,
                weakCoCount: 1,
                weakQuestionCount: 2,
                cgpa: 7.1,
                backlogCount: 0,
                interventionRecoveryStatus: null,
              },
              drivers: [{ label: 'TT2 below safe range', feature: 'tt2Pct', impact: 0.23 }],
              override: null,
              acknowledgement: null,
              resolution: null,
            },
          ],
          electiveFits: [],
        },
      },
      calendarMarkers: [],
      loading: false,
      error: '',
      pendingTaskCount: 3,
      assignedOfferings: [],
      currentFacultyTimetable: null,
      onBack: () => {},
      onOpenStudentProfile: () => {},
      onOpenStudentShell: () => {},
      onOpenRiskExplorer: () => {},
    }))

    expect(screen.getByText('Checkpoint proof scope: 2 monitored students')).toBeTruthy()
    expect(screen.queryByText('Mentor scope: 24 active students')).toBeNull()
  })
})
