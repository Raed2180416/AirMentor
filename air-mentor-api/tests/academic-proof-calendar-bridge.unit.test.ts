import { describe, expect, it } from 'vitest'
import {
  buildProofWorkflowTaskFromQueueProjection,
  proofPlaybackCurrentDateISO,
  proofWorkflowTaskIdFromQueueCaseId,
} from '../src/modules/academic.js'

describe('academic proof calendar bridge helpers', () => {
  it('prefers the run simulated date over the checkpoint timestamp for proof playback', () => {
    expect(proofPlaybackCurrentDateISO({
      checkpoint: {
        createdAt: '2026-03-16T00:00:00.000Z',
      } as never,
      run: {
        simulatedDateIso: '2026-03-20T00:00:00.000Z',
      } as never,
    })).toBe('2026-03-20')
  })

  it('builds a workflow task only for primary actionable proof queue rows', () => {
    const queueCaseId = 'queue_case_001'
    const task = buildProofWorkflowTaskFromQueueProjection({
      queueProjection: {
        simulationStageQueueProjectionId: 'projection_001',
        simulationStageCheckpointId: 'checkpoint_001',
        simulationRunId: 'run_001',
        simulationStageQueueCaseId: queueCaseId,
        studentId: 'student_001',
        offeringId: 'off_mc601_a',
        semesterNumber: 6,
        sectionCode: 'A',
        courseCode: 'MC601',
        courseTitle: 'Graph Theory',
        assignedToRole: 'Course Leader',
        assignedFacultyId: 'mnc_t1',
        taskType: 'Follow-up',
        status: 'Open',
        riskBand: 'High',
        riskProbScaled: 83,
        noActionRiskProbScaled: 91,
        recommendedAction: 'Targeted tutoring',
        simulatedActionTaken: 'Targeted tutoring',
        detailJson: JSON.stringify({
          queueCaseId,
          primaryCase: true,
          countsTowardCapacity: true,
          dueAt: '2026-03-20T10:00:00.000Z',
          note: 'Review the proof workflow task and confirm the next intervention.',
          priorityRank: 1,
        }),
        createdAt: '2026-03-16T09:00:00.000Z',
        updatedAt: '2026-03-16T09:10:00.000Z',
      } as never,
      studentById: {
        student_001: {
          studentId: 'student_001',
          name: 'Aarav Sharma',
          usn: '1MS23MC001',
        } as never,
      },
      offeringById: {
        off_mc601_a: {
          offeringId: 'off_mc601_a',
          yearLabel: 'III Year',
        } as never,
      },
      anchorDateISO: '2026-03-20',
    })

    expect(task).toMatchObject({
      id: proofWorkflowTaskIdFromQueueCaseId(queueCaseId),
      assignedTo: 'Course Leader',
      dueDateISO: '2026-03-20',
      due: 'Today',
      riskBand: 'High',
      taskType: 'Follow-up',
      sourceRole: 'System',
    })

    const supportingTask = buildProofWorkflowTaskFromQueueProjection({
      queueProjection: {
        simulationStageQueueProjectionId: 'projection_002',
        simulationStageCheckpointId: 'checkpoint_001',
        simulationRunId: 'run_001',
        simulationStageQueueCaseId: queueCaseId,
        studentId: 'student_001',
        offeringId: 'off_mc601_a',
        semesterNumber: 6,
        sectionCode: 'A',
        courseCode: 'MC601',
        courseTitle: 'Graph Theory',
        assignedToRole: 'Course Leader',
        assignedFacultyId: 'mnc_t1',
        taskType: 'Follow-up',
        status: 'Open',
        riskBand: 'High',
        riskProbScaled: 83,
        noActionRiskProbScaled: 91,
        recommendedAction: 'Targeted tutoring',
        simulatedActionTaken: 'Targeted tutoring',
        detailJson: JSON.stringify({
          queueCaseId,
          primaryCase: false,
          countsTowardCapacity: false,
          dueAt: '2026-03-20T10:00:00.000Z',
        }),
        createdAt: '2026-03-16T09:00:00.000Z',
        updatedAt: '2026-03-16T09:10:00.000Z',
      } as never,
      studentById: {
        student_001: {
          studentId: 'student_001',
          name: 'Aarav Sharma',
          usn: '1MS23MC001',
        } as never,
      },
      offeringById: {
        off_mc601_a: {
          offeringId: 'off_mc601_a',
          yearLabel: 'III Year',
        } as never,
      },
      anchorDateISO: '2026-03-20',
    })

    expect(supportingTask).toBeNull()
  })
})
