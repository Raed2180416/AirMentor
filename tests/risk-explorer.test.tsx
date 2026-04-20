import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RiskExplorerPage } from '../src/pages/risk-explorer'

const completeFeatureCompleteness = {
  graphAvailable: true,
  historyAvailable: true,
  complete: true,
  missing: [],
  fallbackMode: 'graph-aware' as const,
  confidenceClass: 'high' as const,
}

const completeFeatureProvenance = {
  curriculumImportVersionId: 'import_001',
  curriculumFeatureProfileFingerprint: 'fingerprint_001',
  graphNodeCount: 42,
  graphEdgeCount: 84,
  historyCourseCount: 12,
}

describe('RiskExplorerPage', () => {
  it('renders proof-backed model provenance, trained heads, and bounded counterfactual copy', () => {
    const props: ComponentProps<typeof RiskExplorerPage> = {
      role: 'Course Leader',
      studentId: 'mnc_student_001',
      onBack: () => {},
      initialExplorer: {
        simulationRunId: 'run_001',
        simulationStageCheckpointId: 'checkpoint_001',
        disclaimer: 'Simulation-calibrated proof analysis only. Formal academic status remains policy-derived.',
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_001',
          label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'A',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_001',
          simulationStageCheckpointId: 'checkpoint_001',
          studentId: 'mnc_student_001',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_001',
          label: 'Post TT1 · Proof Run 1',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 6,
        runContext: {
          simulationRunId: 'run_001',
          runLabel: 'Proof Run 1',
          status: 'active',
          seed: 42,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_001',
          semesterNumber: 6,
          stageKey: 'post-tt1',
          stageLabel: 'Post TT1',
          stageDescription: 'First major risk checkpoint after TT1 evidence lands.',
          stageOrder: 2,
          previousCheckpointId: 'checkpoint_000',
          nextCheckpointId: 'checkpoint_002',
        },
        student: {
          studentId: 'mnc_student_001',
          studentName: 'Aarav Sharma',
          usn: '1MS23MC001',
          sectionCode: 'A',
          currentSemester: 6,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        modelProvenance: {
          modelVersion: 'risk-prod-v1',
          calibrationVersion: 'identity',
          featureSchemaVersion: 'risk-feature-v1',
          evidenceWindow: 'post-tt1',
          simulationCalibrated: true,
        },
        featureCompleteness: completeFeatureCompleteness,
        featureConfidenceClass: completeFeatureCompleteness.confidenceClass,
        featureProvenance: completeFeatureProvenance,
        trainedRiskHeads: {
          currentRiskBand: 'High',
          currentRiskProbScaled: 78,
          attendanceRiskProbScaled: 63,
          ceRiskProbScaled: 71,
          seeRiskProbScaled: 59,
          overallCourseRiskProbScaled: 78,
          downstreamCarryoverRiskProbScaled: 42,
        },
        derivedScenarioHeads: {
          semesterSgpaDropRiskProbScaled: 66,
          cumulativeCgpaDropRiskProbScaled: 58,
          electiveMismatchRiskProbScaled: 39,
          scale: 'advisory-index-0-100',
          displayProbabilityAllowed: false,
          supportWarning: 'Derived scenario heads are advisory indices, not calibrated probabilities.',
          note: 'Derived from trained heads plus observed trend.',
        },
        currentEvidence: {
          attendancePct: 68,
          tt1Pct: 34,
          tt2Pct: 41,
          quizPct: 52,
          assignmentPct: 61,
          seePct: 46,
          weakCoCount: 2,
          weakQuestionCount: 4,
          interventionRecoveryStatus: 'watch',
        },
        currentStatus: {
          riskBand: 'High',
          riskProbScaled: 78,
          reassessmentStatus: 'Open',
          nextDueAt: '2026-03-18T09:00:00.000Z',
          recommendedAction: 'targeted-tutoring',
          queueState: 'open',
          simulatedActionTaken: 'targeted-tutoring',
          attentionAreas: ['Attendance below threshold'],
        },
        topDrivers: [
          { label: 'Attendance below threshold', impact: 0.31, feature: 'attendancePct' },
        ],
        crossCourseDrivers: ['Linear Algebra weakness is increasing downstream graph risk.'],
        prerequisiteMap: {
          prerequisiteCourseCodes: ['MCC201A', 'MCC301A'],
          weakPrerequisiteCourseCodes: ['MCC201A'],
          prerequisitePressureScaled: 52,
          prerequisiteAveragePct: 48,
          prerequisiteFailureCount: 1,
        },
        weakCourseOutcomes: [
          {
            coCode: 'MC601-CO2',
            coTitle: 'Graph application competency',
            trend: 'flat',
            topics: ['Graph Traversal'],
            tt1Pct: 34,
            tt2Pct: 41,
            seePct: 46,
            transferGap: -0.1,
          },
        ],
        questionPatterns: {
          weakQuestionCount: 4,
          carelessErrorCount: 1,
          transferGapCount: 2,
          commonWeakTopics: ['Graph Traversal'],
          commonWeakCourseOutcomes: ['MC601-CO2'],
        },
        semesterSummaries: [
          {
            semesterNumber: 5,
            riskBands: ['Medium'],
            sgpa: 6.9,
            cgpaAfterSemester: 6.8,
            backlogCount: 1,
            weakCoCount: 2,
            questionResultCoverage: 18,
            interventionCount: 1,
          },
        ],
        assessmentComponents: [
          {
            courseCode: 'MC601',
            courseTitle: 'Graph Theory',
            sectionCode: 'A',
            attendancePct: 68,
            tt1Pct: 34,
            tt2Pct: 41,
            quizPct: 52,
            assignmentPct: 61,
            seePct: 46,
            weakCoCount: 2,
            weakQuestionCount: 4,
            drivers: [{ label: 'Attendance below threshold', impact: 0.31, feature: 'attendancePct' }],
          },
        ],
        counterfactual: {
          panelLabel: 'Policy Derived',
          noActionRiskBand: 'High',
          noActionRiskProbScaled: 86,
          counterfactualLiftScaled: 8,
          note: 'Advisory comparison only.',
        },
        electiveFit: {
          recommendedCode: 'MC6E01',
          recommendedTitle: 'Applied Optimization',
          stream: 'Data Intelligence',
          rationale: ['Stable math signal'],
          alternatives: [],
        },
      },
    }
    const markup = renderToStaticMarkup(createElement(RiskExplorerPage, props))
    const markupDetails = renderToStaticMarkup(createElement(RiskExplorerPage, { ...props, initialTab: 'details' }))
    const markupAdvanced = renderToStaticMarkup(createElement(RiskExplorerPage, { ...props, initialTab: 'advanced' }))

    // Just replace the assertions
    expect(markup).toContain('Student Success Profile')
    expect(markup).toContain('data-proof-surface="risk-explorer"')
    expect(markup).toContain('data-proof-shell="shared"')
    expect(markup).toContain('data-proof-launcher="floating"')
    expect(markup).toContain('data-proof-action="risk-explorer-back"')
    expect(markup).toContain('data-proof-section="authority-banner"')
    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('data-proof-shell-tabs="shared"')
    expect(markup).toContain('aria-label="Risk explorer sections"')
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('aria-controls="risk-explorer-panel-overview"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('role="tabpanel"')
    expect(markup).toContain('data-proof-shell-panel="shared"')
    expect(markup).toContain('data-proof-section="risk-explorer-panel-overview"')
    expect(markupAdvanced).toContain('data-proof-section="derived-risk-heads"')
    expect(markupDetails).toContain('data-proof-section="current-evidence"')
    expect(markup).toContain('data-proof-section="current-status"')
    expect(markup).toContain('data-proof-section="weak-course-outcomes"')
    expect(markupDetails).toContain('data-proof-section="question-patterns"')
    expect(markupDetails).toContain('data-proof-section="semester-trajectory"')
    expect(markupAdvanced).toContain('data-proof-section="elective-fit"')
    expect(markupDetails).toContain('data-proof-section="component-evidence-grid"')
    expect(markup).toContain('Simulation-calibrated proof analysis only')
    expect(markup).toContain('Viewing the saved checkpoint')
    expect(markup).toContain('Numbers are fixed to the selected preview checkpoint.')
    expect(markup).toContain('You are viewing a saved preview checkpoint (Semester 6)')
    expect(markup).toContain('risk-prod-v1')
    expect(markupAdvanced).toContain('Trained Risk Heads')
    expect(markupAdvanced).toContain('Derived Scenario Heads')
    expect(markupAdvanced).toContain('Simulated Intervention / Realized Path')
    expect(markupAdvanced).toContain('Advisory comparison only.')
    expect(markupAdvanced).toContain('Cross-Course And Prerequisite Pressure')
    expect(markup).not.toContain('Assign ')
    expect(markup).not.toContain('AI says')
  })

  it('renders early-semester trajectory coverage for semesters 1 through 3', () => {
    const props: ComponentProps<typeof RiskExplorerPage> = {
      role: 'Course Leader',
      studentId: 'mnc_student_003',
      onBack: () => {},
      initialExplorer: {
        simulationRunId: 'run_003',
        simulationStageCheckpointId: 'checkpoint_003',
        disclaimer: 'Simulation-calibrated proof analysis only. Formal academic status remains policy-derived.',
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_003',
          label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'A',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_003',
          simulationStageCheckpointId: 'checkpoint_003',
          studentId: 'mnc_student_003',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_003',
          label: 'Semester 3 · Proof Run 3',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 3,
        runContext: {
          simulationRunId: 'run_003',
          runLabel: 'Proof Run 3',
          status: 'active',
          seed: 303,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_003',
          semesterNumber: 3,
          stageKey: 'semester-3',
          stageLabel: 'Semester 3',
          stageDescription: 'Early-semester checkpoint used to verify activation determinism.',
          stageOrder: 3,
          previousCheckpointId: 'checkpoint_002',
          nextCheckpointId: null,
        },
        student: {
          studentId: 'mnc_student_003',
          studentName: 'Aarav Sharma',
          usn: '1MS23MC003',
          sectionCode: 'A',
          currentSemester: 3,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        modelProvenance: {
          modelVersion: 'risk-prod-v3',
          calibrationVersion: 'identity',
          featureSchemaVersion: 'risk-feature-v1',
          evidenceWindow: 'semester-3',
          simulationCalibrated: true,
        },
        featureCompleteness: completeFeatureCompleteness,
        featureConfidenceClass: completeFeatureCompleteness.confidenceClass,
        featureProvenance: completeFeatureProvenance,
        trainedRiskHeads: {
          currentRiskBand: 'Medium',
          currentRiskProbScaled: 58,
          attendanceRiskProbScaled: 52,
          ceRiskProbScaled: 49,
          seeRiskProbScaled: 47,
          overallCourseRiskProbScaled: 58,
          downstreamCarryoverRiskProbScaled: 34,
        },
        derivedScenarioHeads: {
          semesterSgpaDropRiskProbScaled: 44,
          cumulativeCgpaDropRiskProbScaled: 40,
          electiveMismatchRiskProbScaled: 29,
          scale: 'advisory-index-0-100',
          displayProbabilityAllowed: false,
          supportWarning: 'Derived scenario heads are advisory indices, not calibrated probabilities.',
          note: 'Derived from trained heads plus observed trend.',
        },
        currentEvidence: {
          attendancePct: 84,
          tt1Pct: 72,
          tt2Pct: 68,
          quizPct: 65,
          assignmentPct: 70,
          seePct: 63,
          weakCoCount: 0,
          weakQuestionCount: 1,
          interventionRecoveryStatus: 'stable',
        },
        currentStatus: {
          riskBand: 'Medium',
          riskProbScaled: 58,
          reassessmentStatus: 'Watch',
          nextDueAt: null,
          recommendedAction: 'structured-study-plan',
          queueState: 'watch',
          simulatedActionTaken: 'structured-study-plan',
          attentionAreas: ['Maintaining progress in early semesters'],
        },
        topDrivers: [
          { label: 'Attendance is stable', impact: 0.12, feature: 'attendancePct' },
        ],
        crossCourseDrivers: ['Early-semester signals are still under active calibration.'],
        prerequisiteMap: {
          prerequisiteCourseCodes: ['MCC101A'],
          weakPrerequisiteCourseCodes: [],
          prerequisitePressureScaled: 18,
          prerequisiteAveragePct: 72,
          prerequisiteFailureCount: 0,
        },
        weakCourseOutcomes: [],
        questionPatterns: {
          weakQuestionCount: 1,
          carelessErrorCount: 0,
          transferGapCount: 0,
          commonWeakTopics: ['Foundations'],
          commonWeakCourseOutcomes: [],
        },
        semesterSummaries: [
          {
            semesterNumber: 1,
            riskBands: ['Low'],
            sgpa: 7.6,
            cgpaAfterSemester: 7.6,
            backlogCount: 0,
            weakCoCount: 0,
            questionResultCoverage: 18,
            interventionCount: 0,
          },
          {
            semesterNumber: 2,
            riskBands: ['Low'],
            sgpa: 7.4,
            cgpaAfterSemester: 7.5,
            backlogCount: 0,
            weakCoCount: 0,
            questionResultCoverage: 18,
            interventionCount: 0,
          },
          {
            semesterNumber: 3,
            riskBands: ['Medium'],
            sgpa: 6.9,
            cgpaAfterSemester: 7.3,
            backlogCount: 0,
            weakCoCount: 1,
            questionResultCoverage: 18,
            interventionCount: 1,
          },
        ],
        assessmentComponents: [
          {
            courseCode: 'MC301',
            courseTitle: 'Graphs and Combinatorics',
            sectionCode: 'A',
            attendancePct: 84,
            tt1Pct: 72,
            tt2Pct: 68,
            quizPct: 65,
            assignmentPct: 70,
            seePct: 63,
            weakCoCount: 0,
            weakQuestionCount: 1,
            drivers: [{ label: 'Early-semester stability', impact: 0.12, feature: 'attendancePct' }],
          },
        ],
        counterfactual: {
          panelLabel: 'Policy Derived',
          noActionRiskBand: 'Medium',
          noActionRiskProbScaled: 61,
          counterfactualLiftScaled: 3,
          note: 'Advisory comparison only.',
        },
        electiveFit: {
          recommendedCode: 'MC3E01',
          recommendedTitle: 'Applied Foundations',
          stream: 'Data Intelligence',
          rationale: ['Stable foundational signal'],
          alternatives: [],
        },
      },
      initialTab: 'details',
    }

    const markup = renderToStaticMarkup(createElement(RiskExplorerPage, props))
    const markupDetails = renderToStaticMarkup(createElement(RiskExplorerPage, { ...props, initialTab: 'details' }))

    expect(markup).toContain('Sem 3')
    expect(markup).toContain('You are viewing a saved preview checkpoint (Semester 3)')
    expect(markupDetails).toContain('data-proof-section="semester-trajectory"')
    expect(markupDetails).toContain('Semester 1')
    expect(markupDetails).toContain('Semester 2')
    expect(markupDetails).toContain('Semester 3')
  })

  it('renders blocked late-stage proof semantics before the final checkpoint', () => {
    const props: ComponentProps<typeof RiskExplorerPage> = {
      role: 'Course Leader',
      studentId: 'mnc_student_005',
      onBack: () => {},
      initialExplorer: {
        simulationRunId: 'run_005',
        simulationStageCheckpointId: 'checkpoint_005',
        disclaimer: 'Simulation-calibrated proof analysis only. Formal academic status remains policy-derived.',
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_005',
          label: 'Aarav Sharma · Section A · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'A',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_005',
          simulationStageCheckpointId: 'checkpoint_005',
          studentId: 'mnc_student_005',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_005',
          label: 'Post TT2 · Proof Run 5',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 5,
        runContext: {
          simulationRunId: 'run_005',
          runLabel: 'Proof Run 5',
          status: 'active',
          seed: 505,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_005',
          semesterNumber: 5,
          stageKey: 'post-tt2',
          stageLabel: 'Post TT2',
          stageDescription: 'Late-semester checkpoint before the final SEE evidence window.',
          stageOrder: 4,
          previousCheckpointId: 'checkpoint_004',
          nextCheckpointId: 'checkpoint_006',
          stageAdvanceBlocked: true,
          blockingQueueItemCount: 3,
        },
        student: {
          studentId: 'mnc_student_005',
          studentName: 'Aarav Sharma',
          usn: '1MS23MC005',
          sectionCode: 'A',
          currentSemester: 5,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        modelProvenance: {
          modelVersion: 'risk-prod-v5',
          calibrationVersion: 'identity',
          featureSchemaVersion: 'risk-feature-v1',
          evidenceWindow: 'post-tt2',
          simulationCalibrated: true,
        },
        featureCompleteness: completeFeatureCompleteness,
        featureConfidenceClass: completeFeatureCompleteness.confidenceClass,
        featureProvenance: completeFeatureProvenance,
        trainedRiskHeads: {
          currentRiskBand: 'High',
          currentRiskProbScaled: 76,
          attendanceRiskProbScaled: 64,
          ceRiskProbScaled: 72,
          seeRiskProbScaled: 69,
          overallCourseRiskProbScaled: 76,
          downstreamCarryoverRiskProbScaled: 48,
        },
        derivedScenarioHeads: {
          semesterSgpaDropRiskProbScaled: 63,
          cumulativeCgpaDropRiskProbScaled: 57,
          electiveMismatchRiskProbScaled: 36,
          scale: 'advisory-index-0-100',
          displayProbabilityAllowed: false,
          supportWarning: 'Derived scenario heads are advisory indices, not calibrated probabilities.',
          note: 'Derived from trained heads plus observed trend.',
        },
        currentEvidence: {
          attendancePct: 69,
          tt1Pct: 43,
          tt2Pct: 39,
          quizPct: 48,
          assignmentPct: 58,
          seePct: 0,
          weakCoCount: 2,
          weakQuestionCount: 3,
          interventionRecoveryStatus: 'watch',
        },
        currentStatus: {
          riskBand: 'High',
          riskProbScaled: 76,
          reassessmentStatus: 'Open',
          nextDueAt: '2026-03-18T09:00:00.000Z',
          recommendedAction: 'targeted-tutoring',
          queueState: 'open',
          simulatedActionTaken: 'targeted-tutoring',
          attentionAreas: ['Queue items remain unresolved'],
        },
        topDrivers: [
          { label: 'Queue backlog remains open', impact: 0.26, feature: 'openQueueCount' },
        ],
        crossCourseDrivers: ['Late-semester intervention pressure is elevated.'],
        prerequisiteMap: {
          prerequisiteCourseCodes: ['MCC301A'],
          weakPrerequisiteCourseCodes: ['MCC301A'],
          prerequisitePressureScaled: 44,
          prerequisiteAveragePct: 49,
          prerequisiteFailureCount: 1,
        },
        weakCourseOutcomes: [],
        questionPatterns: {
          weakQuestionCount: 3,
          carelessErrorCount: 1,
          transferGapCount: 1,
          commonWeakTopics: ['Optimization Constraints'],
          commonWeakCourseOutcomes: ['MC501-CO3'],
        },
        semesterSummaries: [
          {
            semesterNumber: 4,
            riskBands: ['Medium'],
            sgpa: 7.0,
            cgpaAfterSemester: 7.1,
            backlogCount: 0,
            weakCoCount: 1,
            questionResultCoverage: 16,
            interventionCount: 1,
          },
          {
            semesterNumber: 5,
            riskBands: ['High'],
            sgpa: 6.4,
            cgpaAfterSemester: 6.9,
            backlogCount: 1,
            weakCoCount: 2,
            questionResultCoverage: 16,
            interventionCount: 2,
          },
        ],
        assessmentComponents: [],
        counterfactual: {
          panelLabel: 'Policy Derived',
          noActionRiskBand: 'High',
          noActionRiskProbScaled: 84,
          counterfactualLiftScaled: 8,
          note: 'Advisory comparison only.',
        },
        electiveFit: null,
      },
    }

    const markup = renderToStaticMarkup(createElement(RiskExplorerPage, props))

    expect(markup).toContain('Sem 5 · Post TT2')
    expect(markup).toContain('You are viewing a saved preview checkpoint (Semester 5)')
    expect(markup).toContain('Stage blocked')
    expect(markup).toContain('Playback progression is blocked at this checkpoint until 3 queue item(s) are resolved.')
  })

  it('renders band-only trained heads with calibration and support warnings when probability display is suppressed', () => {
    const markup = renderToStaticMarkup(createElement(RiskExplorerPage, {
      role: 'Mentor',
      studentId: 'mnc_student_002',
      onBack: () => {},
      initialExplorer: {
        simulationRunId: 'run_002',
        simulationStageCheckpointId: 'checkpoint_002',
        disclaimer: 'Simulation-calibrated proof analysis only. Formal academic status remains policy-derived.',
        scopeDescriptor: {
          scopeType: 'student',
          scopeId: 'mnc_student_002',
          label: 'Nandini Rao · Section B · 2023 Mathematics and Computing',
          batchId: 'batch_mnc_2023',
          sectionCode: 'B',
          branchName: 'B.Tech Mathematics and Computing',
          simulationRunId: 'run_002',
          simulationStageCheckpointId: 'checkpoint_002',
          studentId: 'mnc_student_002',
        },
        resolvedFrom: {
          kind: 'proof-checkpoint',
          scopeType: 'proof',
          scopeId: 'checkpoint_002',
          label: 'Post SEE · Proof Run 2',
        },
        scopeMode: 'proof',
        countSource: 'proof-checkpoint',
        activeOperationalSemester: 6,
        runContext: {
          simulationRunId: 'run_002',
          runLabel: 'Proof Run 2',
          status: 'active',
          seed: 84,
          createdAt: '2026-03-16T00:00:00.000Z',
          batchLabel: '2023 Mathematics and Computing',
          branchName: 'B.Tech Mathematics and Computing',
        },
        checkpointContext: {
          simulationStageCheckpointId: 'checkpoint_002',
          semesterNumber: 6,
          stageKey: 'post-see',
          stageLabel: 'Post SEE',
          stageDescription: 'Final evidence checkpoint after SEE lands.',
          stageOrder: 5,
          previousCheckpointId: 'checkpoint_001',
          nextCheckpointId: null,
        },
        student: {
          studentId: 'mnc_student_002',
          studentName: 'Nandini Rao',
          usn: '1MS23MC002',
          sectionCode: 'B',
          currentSemester: 6,
          programScopeVersion: 'mnc-first-6-sem-v1',
          mentorTrack: 'mixed',
        },
        modelProvenance: {
          modelVersion: 'risk-prod-v2',
          calibrationVersion: 'post-hoc-calibration-v1',
          featureSchemaVersion: 'risk-feature-v1',
          evidenceWindow: 'post-see',
          simulationCalibrated: true,
          calibrationMethod: 'isotonic',
          displayProbabilityAllowed: false,
          supportWarning: 'Held-out positive support is below the probability display threshold.',
          coEvidenceMode: 'synthetic-blueprint',
          headDisplay: {
            attendanceRisk: {
              displayProbabilityAllowed: false,
              supportWarning: 'Held-out positive support is below the probability display threshold.',
              calibrationMethod: 'isotonic',
              riskBand: 'Medium',
            },
          },
        },
        featureCompleteness: completeFeatureCompleteness,
        featureConfidenceClass: completeFeatureCompleteness.confidenceClass,
        featureProvenance: completeFeatureProvenance,
        trainedRiskHeads: {
          currentRiskBand: 'Medium',
          currentRiskProbScaled: 48,
          attendanceRiskProbScaled: 41,
          ceRiskProbScaled: 57,
          seeRiskProbScaled: 44,
          overallCourseRiskProbScaled: 48,
          downstreamCarryoverRiskProbScaled: 39,
        },
        trainedRiskHeadDisplays: {
          attendanceRisk: {
            displayProbabilityAllowed: false,
            supportWarning: 'Held-out positive support is below the probability display threshold.',
            calibrationMethod: 'isotonic',
            riskBand: 'Medium',
          },
        },
        derivedScenarioHeads: {
          semesterSgpaDropRiskProbScaled: 46,
          cumulativeCgpaDropRiskProbScaled: 44,
          electiveMismatchRiskProbScaled: 38,
          scale: 'advisory-index-0-100',
          displayProbabilityAllowed: false,
          supportWarning: 'Derived scenario heads are advisory indices, not calibrated probabilities.',
          note: 'Derived from trained heads plus observed trend.',
        },
        currentEvidence: {
          attendancePct: 82,
          tt1Pct: 63,
          tt2Pct: 58,
          quizPct: 64,
          assignmentPct: 67,
          seePct: 61,
          weakCoCount: 1,
          weakQuestionCount: 2,
          interventionRecoveryStatus: 'stable',
          coEvidenceMode: 'offering-blueprint',
        },
        currentStatus: {
          riskBand: 'Medium',
          riskProbScaled: 48,
          reassessmentStatus: 'Watching',
          nextDueAt: null,
          recommendedAction: 'structured-study-plan',
          queueState: 'watch',
          simulatedActionTaken: 'structured-study-plan',
          attentionAreas: ['Weak question transfer gap'],
          policyComparison: {
            recommendedAction: 'structured-study-plan',
            simulatedActionTaken: 'structured-study-plan',
            noActionRiskBand: 'High',
            noActionRiskProbScaled: 62,
            counterfactualLiftScaled: 14,
            rationale: 'Advisory comparison only.',
          },
        },
        topDrivers: [
          { label: 'Weak transfer gap', impact: 0.22, feature: 'weakQuestionCount' },
        ],
        crossCourseDrivers: ['Discrete Math weakness historically lifts graph outcomes.'],
        prerequisiteMap: {
          prerequisiteCourseCodes: ['MCC201A'],
          weakPrerequisiteCourseCodes: [],
          prerequisitePressureScaled: 24,
          prerequisiteAveragePct: 67,
          prerequisiteFailureCount: 0,
        },
        weakCourseOutcomes: [
          {
            coCode: 'MC602-CO1',
            coTitle: 'Numerical reasoning',
            trend: 'improving',
            topics: ['Linear systems'],
            tt1Pct: 63,
            tt2Pct: 58,
            seePct: 61,
            transferGap: 0.03,
            coEvidenceMode: 'synthetic-blueprint',
          },
        ],
        questionPatterns: {
          weakQuestionCount: 2,
          carelessErrorCount: 0,
          transferGapCount: 1,
          commonWeakTopics: ['Linear systems'],
          commonWeakCourseOutcomes: ['MC602-CO1'],
        },
        semesterSummaries: [
          {
            semesterNumber: 6,
            riskBands: ['Medium'],
            sgpa: 7.4,
            cgpaAfterSemester: 7.2,
            backlogCount: 0,
            weakCoCount: 1,
            questionResultCoverage: 12,
            interventionCount: 1,
          },
        ],
        assessmentComponents: [
          {
            courseCode: 'MC602',
            courseTitle: 'Optimization Techniques',
            sectionCode: 'B',
            attendancePct: 82,
            tt1Pct: 63,
            tt2Pct: 58,
            quizPct: 64,
            assignmentPct: 67,
            seePct: 61,
            weakCoCount: 1,
            weakQuestionCount: 2,
            coEvidenceMode: 'rubric-derived',
            drivers: [{ label: 'Transfer gap', impact: 0.19, feature: 'transferGapCount' }],
          },
        ],
        counterfactual: null,
        policyComparison: {
          recommendedAction: 'structured-study-plan',
          simulatedActionTaken: 'structured-study-plan',
          noActionRiskBand: 'High',
          noActionRiskProbScaled: 62,
          counterfactualLiftScaled: 14,
          policyRationale: 'Advisory comparison only.',
          candidates: [],
        },
        electiveFit: null,
      },
      initialTab: 'advanced',
    }))

    expect(markup).toContain('risk-prod-v2')
    expect(markup).toContain('Cal isotonic')
    expect(markup).toContain('Band only')
    expect(markup).toContain('Held-out positive support is below the probability display threshold.')
    expect(markup).toContain('synthetic-blueprint')
    expect(markup).toContain('Simulated Intervention / Realized Path')
    expect(markup).toContain('structured-study-plan')
  })

  it('renders an explicit proof load error before the unavailable empty state', () => {
    const markup = renderToStaticMarkup(createElement(RiskExplorerPage, {
      role: 'Mentor',
      studentId: 'mnc_student_404',
      onBack: () => {},
      initialExplorer: null,
      initialError: 'You do not have access to this proof explorer.',
    }))

    expect(markup).toContain('data-proof-surface="risk-explorer"')
    expect(markup).toContain('data-proof-state="load-error"')
    expect(markup).toContain('data-proof-section="load-error"')
    expect(markup).toContain('You do not have access to this proof explorer.')
    expect(markup).toContain('Risk explorer unavailable')
    expect(markup).toContain('failed to load')
  })
})
