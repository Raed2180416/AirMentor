import { describe, expect, it } from 'vitest'
import {
  governProofQueueStage,
  type ProofQueueCandidate,
} from '../src/lib/proof-queue-governance.js'

function candidate(overrides: Partial<ProofQueueCandidate> = {}): ProofQueueCandidate {
  return {
    caseKey: overrides.caseKey ?? 'student-1::1',
    sourceKey: overrides.sourceKey ?? 'student-1::1::off-1::AMC301',
    studentId: overrides.studentId ?? 'student-1',
    semesterNumber: overrides.semesterNumber ?? 1,
    sectionCode: overrides.sectionCode ?? 'A',
    stageKey: overrides.stageKey ?? 'post-assignments',
    offeringId: overrides.offeringId ?? 'off-1',
    courseCode: overrides.courseCode ?? 'AMC301',
    courseTitle: overrides.courseTitle ?? 'Algorithms',
    riskBand: overrides.riskBand ?? 'High',
    riskProbScaled: overrides.riskProbScaled ?? 82,
    noActionRiskProbScaled: overrides.noActionRiskProbScaled ?? 86,
    riskChangeFromPreviousCheckpointScaled: overrides.riskChangeFromPreviousCheckpointScaled ?? 8,
    counterfactualLiftScaled: overrides.counterfactualLiftScaled ?? 4,
    policyPhenotype: overrides.policyPhenotype ?? 'academic-weakness',
    recommendedAction: overrides.recommendedAction ?? 'targeted-tutoring',
    utilityDelta: overrides.utilityDelta ?? 0.72,
    nextCheckpointBenefitScaled: overrides.nextCheckpointBenefitScaled ?? 11,
    capacityCost: overrides.capacityCost ?? 0.35,
    assignedRole: overrides.assignedRole ?? 'Mentor',
    assignedFacultyId: overrides.assignedFacultyId ?? 'faculty-1',
    facultyBudgetKey: overrides.facultyBudgetKey ?? 'Mentor::faculty-1::1',
  }
}

describe('proof queue governance', () => {
  it('keeps pre-tt1 watch-only even for high-risk candidates', () => {
    const result = governProofQueueStage({
      stageKey: 'pre-tt1',
      candidates: [candidate({ stageKey: 'pre-tt1' })],
      sectionStudentCountByKey: new Map([['1::A', 60]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 10]]),
    })

    expect(result.decisions.get('student-1::1')).toMatchObject({
      status: 'watch',
      countsTowardCapacity: false,
      governanceReason: 'pre_tt1_watch_only',
    })
  })

  it('uses proxy utility at post-tt1 and prunes by caps deterministically', () => {
    const result = governProofQueueStage({
      stageKey: 'post-tt1',
      candidates: [
        candidate({
          caseKey: 'student-1::1',
          sourceKey: 'student-1::1::off-1::AMC301',
          stageKey: 'post-tt1',
          utilityDelta: 0.8,
          riskProbScaled: 76,
          assignedFacultyId: 'faculty-1',
          facultyBudgetKey: 'Mentor::faculty-1::1',
        }),
        candidate({
          caseKey: 'student-2::1',
          sourceKey: 'student-2::1::off-2::AMC302',
          studentId: 'student-2',
          stageKey: 'post-tt1',
          utilityDelta: 0.65,
          riskProbScaled: 71,
          assignedFacultyId: 'faculty-1',
          facultyBudgetKey: 'Mentor::faculty-1::1',
        }),
      ],
      sectionStudentCountByKey: new Map([['1::A', 10]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 1]]),
    })

    expect(result.decisions.get('student-1::1')).toMatchObject({
      status: 'opened',
      countsTowardCapacity: true,
      priorityRank: 1,
    })
    expect(result.decisions.get('student-2::1')).toMatchObject({
      status: 'watch',
      countsTowardCapacity: false,
      governanceReason: 'open_candidate_pruned_by_caps',
    })
  })

  it('enforces lift gates after tt2 and keeps diffuse amber medium cases on watch', () => {
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: [
        candidate({
          caseKey: 'student-1::1',
          stageKey: 'post-assignments',
          counterfactualLiftScaled: 1,
          riskBand: 'High',
        }),
        candidate({
          caseKey: 'student-2::1',
          studentId: 'student-2',
          sourceKey: 'student-2::1::off-2::AMC302',
          stageKey: 'post-assignments',
          riskBand: 'Medium',
          counterfactualLiftScaled: 6,
          policyPhenotype: 'diffuse-amber',
        }),
        candidate({
          caseKey: 'student-3::1',
          studentId: 'student-3',
          sourceKey: 'student-3::1::off-3::AMC303',
          stageKey: 'post-assignments',
          riskBand: 'Medium',
          counterfactualLiftScaled: 6,
          policyPhenotype: 'academic-weakness',
          assignedFacultyId: 'faculty-2',
          facultyBudgetKey: 'Course Leader::faculty-2::1',
          assignedRole: 'Course Leader',
        }),
      ],
      sectionStudentCountByKey: new Map([['1::A', 10]]),
      facultyBudgetByKey: new Map([
        ['Mentor::faculty-1::1', 4],
        ['Course Leader::faculty-2::1', 4],
      ]),
    })

    expect(result.decisions.get('student-1::1')).toMatchObject({
      status: 'watch',
      governanceReason: 'watch_only_after_governance',
    })
    expect(result.decisions.get('student-2::1')).toMatchObject({
      status: 'watch',
      governanceReason: 'watch_only_after_governance',
    })
    expect(result.decisions.get('student-3::1')).toMatchObject({
      status: 'opened',
      countsTowardCapacity: true,
    })
  })
})
