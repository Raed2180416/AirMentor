import { describe, expect, it } from 'vitest'
import {
  governProofQueueStage,
  proofQueueCountsTowardCapacity,
  type ProofQueueCandidate,
} from '../src/lib/proof-queue-governance.js'

function candidate(overrides: Partial<ProofQueueCandidate> = {}): ProofQueueCandidate {
  const studentId = overrides.studentId ?? 'student-1'
  const semesterNumber = overrides.semesterNumber ?? 1
  const offeringId = overrides.offeringId ?? 'off-1'
  const courseCode = overrides.courseCode ?? 'AMC301'
  const concernFamily = overrides.concernFamily ?? 'coursework-risk'
  return {
    caseKey: overrides.caseKey ?? `${studentId}::${semesterNumber}`,
    sourceKey: overrides.sourceKey ?? `${studentId}::${semesterNumber}::${offeringId}::${courseCode}`,
    concernContextKey: overrides.concernContextKey ?? `${studentId}::${semesterNumber}::${offeringId}::${courseCode}::${concernFamily}`,
    concernFamily,
    studentId,
    semesterNumber,
    sectionCode: overrides.sectionCode ?? 'A',
    stageKey: overrides.stageKey ?? 'post-assignments',
    offeringId,
    courseCode,
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
    manualInterventionCount: overrides.manualInterventionCount ?? 0,
  }
}

describe('proof queue governance', () => {
  it('keeps semester-1 pre-tt1 observation-only and emits no queue decision even for high-risk candidates', () => {
    const result = governProofQueueStage({
      stageKey: 'pre-tt1',
      candidates: [candidate({ stageKey: 'pre-tt1' })],
      sectionStudentCountByKey: new Map([['1::A', 60]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 10]]),
    })

    expect(result.decisions.get('student-1::1')).toBeUndefined()
  })

  it('puts later-semester pre-tt1 high prior-history risk on watch', () => {
    const result = governProofQueueStage({
      stageKey: 'pre-tt1',
      candidates: [candidate({
        stageKey: 'pre-tt1',
        semesterNumber: 6,
        riskBand: 'High',
        riskProbScaled: 56,
        facultyBudgetKey: 'Mentor::faculty-1::6',
      })],
      sectionStudentCountByKey: new Map([['6::A', 60]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::6', 10]]),
    })

    expect(result.decisions.get('student-1::6')).toMatchObject({
      status: 'watch',
      canonicalStatus: 'watch',
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
      canonicalStatus: 'opened',
      countsTowardCapacity: true,
      priorityRank: 1,
    })
    expect(result.decisions.get('student-2::1')).toMatchObject({
      status: 'watch',
      canonicalStatus: 'watch',
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
      canonicalStatus: 'watch',
      governanceReason: 'watch_only_after_governance',
    })
    expect(result.decisions.get('student-2::1')).toMatchObject({
      status: 'watch',
      canonicalStatus: 'watch',
      governanceReason: 'watch_only_after_governance',
    })
    expect(result.decisions.get('student-3::1')).toMatchObject({
      status: 'watch',
      canonicalStatus: 'watch',
      countsTowardCapacity: false,
      governanceReason: 'watch_only_after_governance',
    })
  })

  it('admits only high-risk candidates to the open action queue', () => {
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: [
        candidate({
          caseKey: 'student-high::1',
          studentId: 'student-high',
          sourceKey: 'student-high::1::off-1::AMC301',
          concernContextKey: 'ctx::student-high::off-1::coursework',
          riskBand: 'High',
          counterfactualLiftScaled: 5,
        }),
        candidate({
          caseKey: 'student-medium::1',
          studentId: 'student-medium',
          sourceKey: 'student-medium::1::off-2::AMC302',
          concernContextKey: 'ctx::student-medium::off-2::coursework',
          riskBand: 'Medium',
          counterfactualLiftScaled: 12,
        }),
      ],
      sectionStudentCountByKey: new Map([['1::A', 60]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 10]]),
    })

    const openDecisions = Array.from(result.decisions.values()).filter(item => item.canonicalStatus === 'opened')
    expect(openDecisions).toHaveLength(1)
    expect(openDecisions[0]).toMatchObject({
      studentId: 'student-high',
      canonicalStatus: 'opened',
      countsTowardCapacity: true,
    })
    expect(result.decisions.get('student-medium::1')).toMatchObject({
      canonicalStatus: 'watch',
      countsTowardCapacity: false,
    })
  })

  it('keeps colliding legacy case keys split by concernContextKey', () => {
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: [
        candidate({
          caseKey: 'student-1::1',
          concernContextKey: 'ctx::student-1::off-1::coursework',
          sourceKey: 'student-1::1::off-1::AMC301',
          offeringId: 'off-1',
          courseCode: 'AMC301',
          concernFamily: 'coursework-risk',
          assignedFacultyId: 'faculty-1',
          facultyBudgetKey: 'Mentor::faculty-1::1',
        }),
        candidate({
          caseKey: 'student-1::1',
          concernContextKey: 'ctx::student-1::off-2::manual',
          sourceKey: 'student-1::1::off-2::AMC302',
          offeringId: 'off-2',
          courseCode: 'AMC302',
          concernFamily: 'manual-teacher-concern',
          manualInterventionCount: 1,
          assignedFacultyId: 'faculty-2',
          facultyBudgetKey: 'Mentor::faculty-2::1',
        }),
      ],
      sectionStudentCountByKey: new Map([['1::A', 12]]),
      facultyBudgetByKey: new Map([
        ['Mentor::faculty-1::1', 2],
        ['Mentor::faculty-2::1', 2],
      ]),
    })

    expect(result.decisionsByConcernContextKey.size).toBe(2)
    expect(result.decisionContextKeysByLegacyCaseKey.get('student-1::1')).toEqual(expect.arrayContaining([
      'ctx::student-1::off-1::coursework',
      'ctx::student-1::off-2::manual',
    ]))
    expect(result.decisionsByConcernContextKey.get('ctx::student-1::off-1::coursework')).toMatchObject({
      concernFamily: 'coursework-risk',
      primaryCase: true,
      status: 'opened',
    })
    expect(result.decisionsByConcernContextKey.get('ctx::student-1::off-2::manual')).toMatchObject({
      concernFamily: 'manual-teacher-concern',
      manualInterventionCount: 1,
      primaryCase: true,
      status: 'opened',
    })
  })

  it('opens a new case episode when deterioration returns after dismissal', () => {
    const concernContextKey = 'ctx::student-1::off-1::coursework'
    const oldCaseId = 'proof_case::student-1::1::off-1::AMC301::closed'
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: [
        candidate({
          caseKey: 'student-1::1',
          concernContextKey,
          sourceKey: 'student-1::1::off-1::AMC301::reopen',
          assignedRole: 'Mentor',
          assignedFacultyId: 'faculty-1',
          facultyBudgetKey: 'Mentor::faculty-1::1',
        }),
      ],
      priorCaseStateByKey: new Map([
        [concernContextKey, {
          open: false,
          caseId: oldCaseId,
          primarySourceKey: 'student-1::1::off-1::AMC301::closed',
          concernContextKey,
          concernFamily: 'coursework-risk',
          canonicalStatus: 'dismissed',
          assignedRole: 'Mentor',
        }],
      ]),
      sectionStudentCountByKey: new Map([['1::A', 12]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 2]]),
    })

    expect(result.decisionsByConcernContextKey.get(concernContextKey)).toMatchObject({
      status: 'opened',
      canonicalStatus: 'reopened',
      reopenedFromCaseId: oldCaseId,
      workflowTaskAction: 'create',
      countsTowardCapacity: true,
    })
    expect(result.decisionsByConcernContextKey.get(concernContextKey)?.caseId).not.toBe(oldCaseId)
  })

  it('keeps workflow watch items visible without counting them as blocking primary capacity', () => {
    const concernContextKey = 'ctx::student-1::off-1::watch'
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: [
        candidate({
          caseKey: 'student-1::1',
          concernContextKey,
          counterfactualLiftScaled: 1,
          sourceKey: 'student-1::1::off-1::AMC301::watch',
        }),
      ],
      sectionStudentCountByKey: new Map([['1::A', 12]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 2]]),
    })

    const decision = result.decisionsByConcernContextKey.get(concernContextKey)
    expect(decision).toMatchObject({
      status: 'watch',
      canonicalStatus: 'watch',
      primaryCase: true,
      workflowTaskAction: 'monitor',
      countsTowardCapacity: false,
    })
    expect(proofQueueCountsTowardCapacity(decision!.canonicalStatus)).toBe(false)
  })

  it('auto-resolves prior open cases when post-see leaves only watch semantics', () => {
    const concernContextKey = 'ctx::student-1::off-1::post-see-watch'
    const result = governProofQueueStage({
      stageKey: 'post-see',
      candidates: [
        candidate({
          caseKey: 'student-1::1',
          concernContextKey,
          sourceKey: 'student-1::1::off-1::AMC301::post-see-watch',
          stageKey: 'post-see',
          riskBand: 'High',
          counterfactualLiftScaled: 1,
        }),
      ],
      priorCaseStateByKey: new Map([
        [concernContextKey, {
          open: true,
          caseId: 'proof_case::student-1::1::open',
          primarySourceKey: 'student-1::1::off-1::AMC301::open',
          concernContextKey,
          concernFamily: 'coursework-risk',
          canonicalStatus: 'open',
          assignedRole: 'Mentor',
        }],
      ]),
      sectionStudentCountByKey: new Map([['1::A', 40]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 4]]),
    })

    expect(result.decisionsByConcernContextKey.get(concernContextKey)).toMatchObject({
      status: 'resolved',
      canonicalStatus: 'dismissed',
      workflowTaskAction: 'close',
      governanceReason: 'watch_only_after_governance',
      countsTowardCapacity: false,
    })
  })

  it('auto-resolves prior open cases when no actionable candidate remains at post-see', () => {
    const concernContextKey = 'ctx::student-2::off-2::post-see-idle'
    const result = governProofQueueStage({
      stageKey: 'post-see',
      candidates: [
        candidate({
          caseKey: 'student-2::1',
          concernContextKey,
          studentId: 'student-2',
          sourceKey: 'student-2::1::off-2::AMC302::post-see-idle',
          stageKey: 'post-see',
          recommendedAction: null,
          riskBand: 'Low',
        }),
      ],
      priorCaseStateByKey: new Map([
        [concernContextKey, {
          open: true,
          caseId: 'proof_case::student-2::1::open',
          primarySourceKey: 'student-2::1::off-2::AMC302::open',
          concernContextKey,
          concernFamily: 'coursework-risk',
          canonicalStatus: 'open',
          assignedRole: 'Mentor',
        }],
      ]),
      sectionStudentCountByKey: new Map([['1::A', 40]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 4]]),
    })

    expect(result.decisionsByConcernContextKey.get(concernContextKey)).toMatchObject({
      status: 'resolved',
      canonicalStatus: 'dismissed',
      workflowTaskAction: 'close',
      governanceReason: 'no_longer_actionable',
      countsTowardCapacity: false,
    })
  })

  it('caps newly admitted watch cases per section using deterministic priority order', () => {
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: Array.from({ length: 6 }, (_, index) => candidate({
        caseKey: `student-${index + 1}::1`,
        concernContextKey: `ctx::student-${index + 1}::off-${index + 1}::watch`,
        sourceKey: `student-${index + 1}::1::off-${index + 1}::AMC30${index + 1}`,
        studentId: `student-${index + 1}`,
        offeringId: `off-${index + 1}`,
        courseCode: `AMC30${index + 1}`,
        riskBand: 'High',
        riskProbScaled: 90 - index,
        counterfactualLiftScaled: 1,
      })),
      sectionStudentCountByKey: new Map([['1::A', 10]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 10]]),
    })

    const watchDecisions = Array.from(result.decisionsByConcernContextKey.values())
      .filter(decision => decision.canonicalStatus === 'watch')

    expect(watchDecisions).toHaveLength(4)
    expect(result.watchUsageByKey.get('1::A')).toBe(4)
    expect(watchDecisions.map(decision => decision.studentId)).toEqual([
      'student-1',
      'student-2',
      'student-3',
      'student-4',
    ])
    expect(result.decisionsByConcernContextKey.get('ctx::student-5::off-5::watch')).toMatchObject({
      status: 'deferred',
      canonicalStatus: 'deferred',
      governanceReason: 'watch_cap_deferred',
      workflowTaskAction: 'monitor',
      countsTowardCapacity: false,
    })
    expect(result.decisionsByConcernContextKey.get('ctx::student-6::off-6::watch')).toMatchObject({
      status: 'deferred',
      canonicalStatus: 'deferred',
      governanceReason: 'watch_cap_deferred',
      workflowTaskAction: 'monitor',
      countsTowardCapacity: false,
    })
  })

  it('keeps existing open cases visible even when new watch admissions are capped', () => {
    const concernContextKey = 'ctx::student-existing::off-1::watch'
    const result = governProofQueueStage({
      stageKey: 'post-assignments',
      candidates: [
        candidate({
          caseKey: 'student-existing::1',
          concernContextKey,
          sourceKey: 'student-existing::1::off-1::AMC301',
          studentId: 'student-existing',
          counterfactualLiftScaled: 1,
        }),
      ],
      priorCaseStateByKey: new Map([
        [concernContextKey, {
          open: true,
          caseId: 'proof_case::student-existing::1::open',
          primarySourceKey: 'student-existing::1::off-1::AMC301::open',
          concernContextKey,
          concernFamily: 'coursework-risk',
          canonicalStatus: 'open',
          assignedRole: 'Mentor',
        }],
      ]),
      sectionStudentCountByKey: new Map([['1::A', 1]]),
      facultyBudgetByKey: new Map([['Mentor::faculty-1::1', 10]]),
    })

    expect(result.watchUsageByKey.get('1::A')).toBeUndefined()
    expect(result.decisionsByConcernContextKey.get(concernContextKey)).toMatchObject({
      studentId: 'student-existing',
      canonicalStatus: 'watch',
      workflowTaskAction: 'monitor',
      countsTowardCapacity: false,
    })
  })
})
