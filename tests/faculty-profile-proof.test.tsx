import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FacultyProfilePage } from '../src/App'

describe('FacultyProfilePage proof mode', () => {
  it('renders explicit proof authority labeling alongside the teacher proof panel', () => {
    const markup = renderToStaticMarkup(createElement(FacultyProfilePage, {
      currentTeacher: {
        facultyId: 'mnc_t1',
        name: 'Dr. Asha Rao',
        allowedRoles: ['COURSE_LEADER', 'MENTOR', 'HOD'],
        dept: 'Mathematics and Computing',
        roleTitle: 'Professor',
        email: 'asha.rao@example.edu',
        menteeIds: ['student_001', 'student_002'],
      } as any,
      activeRole: 'Course Leader',
      profile: {
        displayName: 'Dr. Asha Rao',
        designation: 'Professor',
        employeeCode: 'F001',
        email: 'asha.rao@example.edu',
        phone: '9999999999',
        primaryDepartment: { name: 'Mathematics and Computing' },
        permissions: [
          {
            grantId: 'grant_1',
            roleCode: 'COURSE_LEADER',
            scopeType: 'branch',
            scopeId: 'branch_mnc',
            scopeLabel: 'Mathematics and Computing',
            startDate: '2026-01-01',
            endDate: null,
            status: 'active',
          },
        ],
        appointments: [],
        currentOwnedClasses: [],
        currentBatchContexts: [],
        subjectRunCourseLeaderScope: [],
        mentorScope: { activeStudentCount: 24 },
        timetableStatus: { hasTemplate: true, directEditWindowEndsAt: null },
        reassessmentSummary: { openCount: 2, nextDueAt: null },
        proofOperations: {
          activeRunContexts: [
            {
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
            semesterNumber: 6,
            stageLabel: 'Semester Close',
            stageDescription: 'Final checkpoint.',
            highRiskCount: 8,
            openQueueCount: 13,
          },
          monitoringQueue: [
            {
              riskAssessmentId: 'risk_001',
              studentId: 'student_001',
              studentName: 'Aarav Sharma',
              courseCode: 'MC601',
              riskBand: 'High',
              recommendedAction: 'targeted-tutoring',
              dueAt: '2026-03-18T00:00:00.000Z',
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
              },
              drivers: [{ label: 'Attendance below threshold', feature: 'attendancePct', impact: 0.31 }],
            },
          ],
          electiveFits: [
            {
              studentId: 'student_001',
              studentName: 'Aarav Sharma',
              recommendedCode: 'MC6E01',
              recommendedTitle: 'Applied Optimization',
              stream: 'Data Intelligence',
              rationale: ['Stable math signal'],
              alternatives: [],
            },
          ],
        },
      } as any,
      calendarMarkers: [],
      loading: false,
      error: '',
      pendingTaskCount: 3,
      assignedOfferings: [],
      currentFacultyTimetable: null,
      onBack: () => {},
      onOpenStudentShell: () => {},
      onOpenRiskExplorer: () => {},
    }))

    expect(markup).toContain('data-proof-section="proof-mode-authority"')
    expect(markup).toContain('Proof mode is active')
    expect(markup).toContain('data-proof-surface="teacher-proof-panel"')
    expect(markup).toContain('data-proof-section="proof-authority-note"')
    expect(markup).toContain('Authoritative proof panel for this faculty scope')
    expect(markup).toContain('data-proof-section="active-run-contexts"')
    expect(markup).toContain('data-proof-section="checkpoint-overlay"')
    expect(markup).toContain('data-proof-section="monitoring-queue"')
    expect(markup).toContain('data-proof-section="elective-fit"')
  })
})
