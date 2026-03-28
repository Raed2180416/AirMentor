/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GradePointSubjectAttempt, MsruasDeterministicPolicy } from './msruas-rules.js'
import type { RuntimeCourse, SimulatedQuestionTemplate } from './msruas-proof-control-plane.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'

export type SeededTrajectoryLike = any

export type ProofControlPlaneSeededSemesterServiceDeps = {
  calculateCgpa: (input: any) => number
  calculateSgpa: (input: any) => number
  buildCourseOutcomeStates: (input: any) => { rows: any[]; summaries: any[]; weakCoCount: number }
  buildTopicStateRows: (input: any) => any[]
  courseCodeForRuntime: (course: Pick<RuntimeCourse, 'officialWebCode' | 'internalCompilerId'>) => string
  createId: (prefix: string) => string
  buildMonitoringDecision: (input: any) => any
  inferObservableRisk: (input: any) => any
  mentorFaculty: Array<{ facultyId: string }>
  PROOF_TERM_DEFS: ReadonlyArray<{ semesterNumber: number; termId: string }>
  roundToTwo: (value: number) => number
  simulateQuestionResults: (input: any) => { results: any[]; summary: any }
  simulateSemesterCourse: (input: any) => any
  stableUnit: (seed: string) => number
}

export type BuildSeededHistoricalSemesterRowsInput = {
  courseLeaderFaculty: Array<{ facultyId: string }>
  deterministicPolicy: MsruasDeterministicPolicy
  now: string
  questionTemplatesByScope: Map<string, SimulatedQuestionTemplate[]>
  runSeed: number
  runtimeCourses: RuntimeCourse[]
  simulationRunId: string
  trajectory: SeededTrajectoryLike
  trajectoryIndex: number
  latentRows: any[]
  topicStateRows: any[]
  coStateRows: any[]
  questionResultRows: any[]
  interventionRows: any[]
  interventionResponseRows: any[]
  observedRows: any[]
  transitionRows: any[]
  transcriptTermRowsInsert: any[]
  transcriptSubjectRowsInsert: any[]
}

export type BuildSeededHistoricalSemesterRowsResult = {
  activeBacklogCount: number
  courseScores: Map<string, number>
  currentCgpa: number
}

export type BuildSeededSemesterSixRowsInput = {
  activeBacklogCount: number
  attendanceRows: any[]
  assessmentRows: any[]
  currentCgpa: number
  courseLeaderFaculty: Array<{ facultyId: string }>
  courseScores: Map<string, number>
  deterministicPolicy: MsruasDeterministicPolicy
  coStateRows: any[]
  interventionRows: any[]
  interventionResponseRows: any[]
  mentorFaculty: Array<{ facultyId: string }>
  now: string
  observedRows: any[]
  questionResultRows: any[]
  questionTemplatesByScope: Map<string, SimulatedQuestionTemplate[]>
  reassessmentRows: any[]
  riskRows: any[]
  runSeed: number
  sem6: RuntimeCourse[]
  sem6OfferingByCourseTitleSection: Map<string, { offeringId: string }>
  simulationRunId: string
  student: SeededTrajectoryLike
  topicStateRows: any[]
  alertRows: any[]
  alertOutcomeRows: any[]
  policy: ResolvedPolicy
  trajectoryIndex: number
}

export function buildSeededHistoricalSemesterRows(
  input: BuildSeededHistoricalSemesterRowsInput,
  deps: ProofControlPlaneSeededSemesterServiceDeps,
): BuildSeededHistoricalSemesterRowsResult {
  const courseScores = new Map<string, number>()
  const cumulativeAttempts: GradePointSubjectAttempt[][] = []
  let currentCgpa = 0
  let activeBacklogCount = 0

  for (let semesterNumber = 1; semesterNumber <= 5; semesterNumber += 1) {
    const semesterCourses = input.runtimeCourses.filter(course => course.semesterNumber === semesterNumber)
    const semesterAttempts: GradePointSubjectAttempt[] = []
    const subjectScores: any[] = []
    let semesterWeakCoCount = 0
    let semesterQuestionCoverage = 0
    let semesterInterventionCount = 0

    semesterCourses.forEach((course, courseIndex) => {
      const faculty = input.courseLeaderFaculty[(courseIndex + (input.trajectory.sectionCode === 'B' ? 1 : 0)) % input.courseLeaderFaculty.length]
      const simulation = deps.simulateSemesterCourse({
        student: input.trajectory,
        course,
        semesterNumber,
        scoresByCourseTitle: courseScores,
        facultyId: faculty.facultyId,
        policy: input.deterministicPolicy,
        runSeed: input.runSeed,
      })
      const templates = input.questionTemplatesByScope.get(course.curriculumNodeId) ?? []
      const questionResults = deps.simulateQuestionResults({
        student: input.trajectory,
        course,
        templates,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        seePct: simulation.seePct,
        runSeed: input.runSeed,
      })
      const coStates = deps.buildCourseOutcomeStates({
        simulationRunId: input.simulationRunId,
        student: input.trajectory,
        course,
        semesterNumber,
        mastery: Number(simulation.latentSummary.mastery ?? 0),
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        seePct: simulation.seePct,
        templates,
        questionResults: questionResults.results,
        runSeed: input.runSeed,
        now: input.now,
      })
      input.topicStateRows.push(...deps.buildTopicStateRows({
        simulationRunId: input.simulationRunId,
        student: input.trajectory,
        course,
        semesterNumber,
        mastery: Number(simulation.latentSummary.mastery ?? 0),
        prereq: Number(simulation.latentSummary.prereq ?? 0),
        runSeed: input.runSeed,
        now: input.now,
      }))
      input.coStateRows.push(...coStates.rows)
      questionResults.results.forEach(result => {
        input.questionResultRows.push({
          studentQuestionResultId: deps.createId('question_result'),
          simulationRunId: input.simulationRunId,
          studentId: input.trajectory.studentId,
          semesterNumber,
          curriculumNodeId: course.curriculumNodeId,
          offeringId: null,
          simulationQuestionTemplateId: result.simulationQuestionTemplateId,
          componentType: result.componentType,
          sectionCode: input.trajectory.sectionCode,
          score: result.score,
          maxScore: result.maxScore,
          resultJson: JSON.stringify({
            studentScoreOnQuestion: result.score,
            studentPartialCreditProfile: result.partialCreditProfile,
            errorTypeObserved: result.errorType,
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
      })

      const historicalInterventionNeeded = (simulation.result === 'Failed' || simulation.prerequisiteCarryoverRisk >= 0.68) && semesterNumber >= 3
      let historicalInterventionSummary: Record<string, unknown> | null = null
      if (historicalInterventionNeeded) {
        semesterInterventionCount += 1
        const interventionId = deps.createId('intervention')
        const interventionType = simulation.prerequisiteCarryoverRisk >= 0.68 ? 'prerequisite-bridge' : 'structured-study-plan'
        const accepted = deps.stableUnit(`run-${input.runSeed}-${input.trajectory.studentId}-${course.internalCompilerId}-historical-intervention`) < input.trajectory.profile.intervention.interventionReceptivity
        const completed = accepted && deps.stableUnit(`run-${input.runSeed}-${input.trajectory.studentId}-${course.internalCompilerId}-historical-completion`) < input.trajectory.profile.behavior.practiceCompliance
        const temporalLift = interventionType === 'prerequisite-bridge' ? (simulation.seePct - simulation.tt1Pct) / 100 : (simulation.tt2Pct - simulation.tt1Pct) / 100
        const residual = deps.roundToTwo(temporalLift - input.trajectory.profile.intervention.expectedRecoveryThreshold)
        if (deps.mentorFaculty.length > 0) {
          input.interventionRows.push({
            interventionId,
            studentId: input.trajectory.studentId,
            facultyId: deps.mentorFaculty[input.trajectoryIndex % deps.mentorFaculty.length].facultyId,
            offeringId: null,
            interventionType,
            note: `Generated ${interventionType} for ${deps.courseCodeForRuntime(course)} in semester ${semesterNumber}.`,
            occurredAt: input.now,
            createdAt: input.now,
            updatedAt: input.now,
          })
        }
        input.interventionResponseRows.push({
          studentInterventionResponseStateId: deps.createId('intervention_response'),
          simulationRunId: input.simulationRunId,
          studentId: input.trajectory.studentId,
          semesterNumber,
          sectionCode: input.trajectory.sectionCode,
          offeringId: null,
          interventionId,
          interventionType,
          responseStateJson: JSON.stringify({
            interventionOfferFlag: true,
            interventionAcceptanceProb: deps.roundToTwo(input.trajectory.profile.intervention.interventionReceptivity),
            interventionCompletionProb: deps.roundToTwo(input.trajectory.profile.behavior.practiceCompliance),
            interventionReceptivity: deps.roundToTwo(input.trajectory.profile.intervention.interventionReceptivity),
            temporaryUpliftCredit: deps.roundToTwo(input.trajectory.profile.intervention.temporaryUpliftCredit),
            expectedRecoveryThreshold: deps.roundToTwo(input.trajectory.profile.intervention.expectedRecoveryThreshold),
            observedVsExpectedResidual: residual,
            recoveryConfirmedFlag: residual >= 0 && completed,
            watchModeFlag: residual < 0.02,
            escalationNeededFlag: !completed || residual < -0.05,
            nonresponseCount: accepted ? 0 : 1,
            switchInterventionFlag: completed ? false : residual < -0.08,
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
        historicalInterventionSummary = {
          interventionType,
          accepted,
          completed,
          recoveryConfirmed: residual >= 0 && completed,
          residual,
        }
      }

      courseScores.set(course.title, simulation.overallMark)
      semesterAttempts.push({
        courseCode: deps.courseCodeForRuntime(course),
        credits: course.credits,
        gradePoint: simulation.gradePoint,
        result: simulation.result as any,
      })
      semesterWeakCoCount += coStates.weakCoCount
      semesterQuestionCoverage += questionResults.results.length
      subjectScores.push({
        courseCode: deps.courseCodeForRuntime(course),
        title: course.title,
        credits: course.credits,
        score: simulation.overallMark,
        attendancePct: simulation.attendancePct,
        attendanceHistory: simulation.attendanceHistory,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        quizPct: simulation.quizPct,
        assignmentPct: simulation.assignmentPct,
        cePct: simulation.cePct,
        seePct: simulation.seePct,
        gradeLabel: simulation.gradeLabel,
        gradePoint: simulation.gradePoint,
        result: simulation.result,
        weakCoCount: coStates.weakCoCount,
        coSummary: coStates.summaries,
        questionEvidenceSummary: questionResults.summary,
        courseworkToTtGap: simulation.courseworkToTtGap,
        ttMomentum: simulation.ttMomentum,
        prerequisiteCarryoverRisk: simulation.prerequisiteCarryoverRisk,
        interventionResponse: historicalInterventionSummary,
      })
      input.latentRows.push({
        studentLatentStateId: deps.createId('latent_state'),
        simulationRunId: input.simulationRunId,
        studentId: input.trajectory.studentId,
        semesterNumber,
        sectionCode: input.trajectory.sectionCode,
        latentStateJson: JSON.stringify({
          ...input.trajectory.latentBase,
          archetype: input.trajectory.archetype,
          readiness: input.trajectory.profile.readiness,
          dynamics: input.trajectory.profile.dynamics,
          courseInternalId: course.internalCompilerId,
          courseTitle: course.title,
          scoreForecast: simulation.overallMark,
          ...simulation.latentSummary,
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
    })

    const sgpa = deps.calculateSgpa({
      attempts: semesterAttempts,
      policy: input.deterministicPolicy,
    })
    cumulativeAttempts.push(semesterAttempts)
    currentCgpa = deps.calculateCgpa({
      termAttempts: cumulativeAttempts,
      policy: input.deterministicPolicy,
    })
    const registeredCredits = semesterCourses.reduce((sum, course) => sum + course.credits, 0)
    const earnedCredits = subjectScores.filter(subject => subject.result === 'Passed').reduce((sum, subject) => sum + Number(subject.credits ?? 0), 0)
    activeBacklogCount += subjectScores.filter(subject => subject.result === 'Failed').length
    const term = deps.PROOF_TERM_DEFS.find(item => item.semesterNumber === semesterNumber)
    if (!term) continue
    const transcriptTermResultId = deps.createId('transcript_term')
    input.transcriptTermRowsInsert.push({
      transcriptTermResultId,
      studentId: input.trajectory.studentId,
      termId: term.termId,
      sgpaScaled: Math.round(sgpa * 100),
      registeredCredits,
      earnedCredits,
      backlogCount: activeBacklogCount,
      createdAt: input.now,
      updatedAt: input.now,
    })
    subjectScores.forEach(subject => {
      input.transcriptSubjectRowsInsert.push({
        transcriptSubjectResultId: deps.createId('transcript_subject'),
        transcriptTermResultId,
        courseCode: String(subject.courseCode),
        title: String(subject.title),
        credits: Number(subject.credits ?? 0),
        score: Number(subject.score ?? 0),
        gradeLabel: String(subject.gradeLabel ?? 'F'),
        gradePoint: Number(subject.gradePoint ?? 0),
        result: String(subject.result ?? 'Failed'),
        createdAt: input.now,
        updatedAt: input.now,
      })
    })
    input.observedRows.push({
      studentObservedSemesterStateId: deps.createId('observed_state'),
      simulationRunId: input.simulationRunId,
      studentId: input.trajectory.studentId,
      termId: term.termId,
      semesterNumber,
      sectionCode: input.trajectory.sectionCode,
      observedStateJson: JSON.stringify({
        sgpa,
        cgpaAfterSemester: currentCgpa,
        registeredCredits,
        earnedCredits,
        backlogCount: activeBacklogCount,
        weakCoCount: semesterWeakCoCount,
        questionResultCoverage: semesterQuestionCoverage,
        interventionCount: semesterInterventionCount,
        subjectScores,
      }),
      createdAt: input.now,
      updatedAt: input.now,
    })
    if (semesterNumber > 1) {
      input.transitionRows.push({
        semesterTransitionLogId: deps.createId('semester_transition'),
        simulationRunId: input.simulationRunId,
        studentId: input.trajectory.studentId,
        fromSemester: semesterNumber - 1,
        toSemester: semesterNumber,
        summaryJson: JSON.stringify({
          cgpa: currentCgpa,
          backlogCount: activeBacklogCount,
          transitionReadiness: activeBacklogCount === 0 && currentCgpa >= 6 ? 'stable' : activeBacklogCount <= 1 ? 'review' : 'support-required',
        }),
        createdAt: input.now,
      })
    }
  }

  return {
    activeBacklogCount,
    courseScores,
    currentCgpa,
  }
}

export function buildSeededSemesterSixRows(
  input: BuildSeededSemesterSixRowsInput,
  deps: ProofControlPlaneSeededSemesterServiceDeps,
) {
  input.sem6.forEach((course, courseIndex) => {
    const offering = input.sem6OfferingByCourseTitleSection.get(`${course.title}::${input.student.sectionCode}`)
    if (!offering) return
    const faculty = input.courseLeaderFaculty[(courseIndex + (input.student.sectionCode === 'B' ? 1 : 0)) % input.courseLeaderFaculty.length]
    const simulation = deps.simulateSemesterCourse({
      student: input.student,
      course,
      semesterNumber: 6,
      scoresByCourseTitle: input.courseScores,
      facultyId: faculty.facultyId,
      policy: input.deterministicPolicy,
      runSeed: input.runSeed,
    })
    const templates = input.questionTemplatesByScope.get(offering.offeringId) ?? []
    const questionResults = deps.simulateQuestionResults({
      student: input.student,
      course,
      templates,
      tt1Pct: simulation.tt1Pct,
      tt2Pct: simulation.tt2Pct,
      seePct: simulation.seePct,
      runSeed: input.runSeed,
    })
    const coStates = deps.buildCourseOutcomeStates({
      simulationRunId: input.simulationRunId,
      student: input.student,
      course,
      semesterNumber: 6,
      offeringId: offering.offeringId,
      mastery: Number(simulation.latentSummary.mastery ?? 0),
      tt1Pct: simulation.tt1Pct,
      tt2Pct: simulation.tt2Pct,
      seePct: simulation.seePct,
      templates,
      questionResults: questionResults.results,
      runSeed: input.runSeed,
      now: input.now,
    })
    input.topicStateRows.push(...deps.buildTopicStateRows({
      simulationRunId: input.simulationRunId,
      student: input.student,
      course,
      semesterNumber: 6,
      offeringId: offering.offeringId,
      mastery: Number(simulation.latentSummary.mastery ?? 0),
      prereq: Number(simulation.latentSummary.prereq ?? 0),
      runSeed: input.runSeed,
      now: input.now,
    }))
    input.coStateRows.push(...coStates.rows)
    questionResults.results.forEach(result => {
      input.questionResultRows.push({
        studentQuestionResultId: deps.createId('question_result'),
        simulationRunId: input.simulationRunId,
        studentId: input.student.studentId,
        semesterNumber: 6,
        curriculumNodeId: course.curriculumNodeId,
        offeringId: offering.offeringId,
        simulationQuestionTemplateId: result.simulationQuestionTemplateId,
        componentType: result.componentType,
        sectionCode: input.student.sectionCode,
        score: result.score,
        maxScore: result.maxScore,
        resultJson: JSON.stringify({
          studentScoreOnQuestion: result.score,
          studentPartialCreditProfile: result.partialCreditProfile,
          errorTypeObserved: result.errorType,
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
    })

    const recoveryInterventionType = coStates.weakCoCount >= 2
      ? 'targeted-tutoring'
      : simulation.prerequisiteCarryoverRisk >= 0.65
        ? 'prerequisite-bridge'
        : simulation.tt2Pct < 50
          ? 'pre-see-rescue'
          : 'mentor-check-in'
    const interventionAccepted = deps.stableUnit(`run-${input.runSeed}-${input.student.studentId}-${offering.offeringId}-accept`) < input.student.profile.intervention.interventionReceptivity
    const interventionCompleted = interventionAccepted && deps.stableUnit(`run-${input.runSeed}-${input.student.studentId}-${offering.offeringId}-complete`) < input.student.profile.behavior.practiceCompliance
    const temporalLift = recoveryInterventionType === 'pre-see-rescue'
      ? (simulation.seePct - simulation.tt2Pct) / 100
      : recoveryInterventionType === 'prerequisite-bridge'
        ? (simulation.seePct - simulation.tt1Pct) / 100
        : (simulation.tt2Pct - simulation.tt1Pct) / 100
    const responseResidual = deps.roundToTwo(temporalLift - input.student.profile.intervention.expectedRecoveryThreshold)
    const inference = deps.inferObservableRisk({
      attendancePct: simulation.attendancePct,
      currentCgpa: input.currentCgpa,
      backlogCount: input.activeBacklogCount,
      tt1Pct: simulation.tt1Pct,
      tt2Pct: simulation.tt2Pct,
      quizPct: simulation.quizPct,
      assignmentPct: simulation.assignmentPct,
      seePct: simulation.seePct,
      weakCoCount: coStates.weakCoCount,
      interventionResponseScore: interventionCompleted ? responseResidual : -Math.abs(responseResidual),
      attendanceHistoryRiskCount: simulation.attendanceHistory.filter((entry: any) => entry.attendancePct < input.policy.attendanceRules.minimumRequiredPercent).length,
      questionWeaknessCount: questionResults.summary.weakQuestionCount,
      policy: input.policy,
    })
    const monitoring = deps.buildMonitoringDecision({
      riskProb: inference.riskProb,
      riskBand: inference.riskBand,
      previousRiskBand: inference.riskBand === 'High' && deps.stableUnit(`run-${input.runSeed}-${input.student.studentId}-${offering.offeringId}-prev`) > 0.55 ? 'Medium' : null,
      cooldownUntil: null,
      evidenceWindowCount: 3,
      interventionResidual: responseResidual,
      nowIso: input.now,
    })

    const riskAssessmentId = deps.createId('risk_assessment')
    const evidenceSnapshotId = deps.createId('evidence_snapshot')
    input.riskRows.push({
      riskAssessmentId,
      simulationRunId: input.simulationRunId,
      studentId: input.student.studentId,
      offeringId: offering.offeringId,
      termId: 'term_mnc_sem6',
      assessmentScope: 'observable-only',
      riskProbScaled: Math.round(inference.riskProb * 100),
      riskBand: inference.riskBand,
      recommendedAction: inference.recommendedAction,
      driversJson: JSON.stringify(inference.observableDrivers),
      evidenceWindow: simulation.seePct > 0 ? 'semester-6-see' : simulation.tt2Pct > 0 ? 'semester-6-tt2' : 'semester-6-tt1',
      evidenceSnapshotId,
      modelVersion: 'observable-inference-v2',
      policyVersion: 'resolved-batch-policy',
      sourceType: 'simulation',
      assessedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
    const interventionId = deps.createId('intervention')
    input.interventionRows.push({
      interventionId,
      studentId: input.student.studentId,
      facultyId: input.mentorFaculty[input.trajectoryIndex % input.mentorFaculty.length].facultyId,
      offeringId: offering.offeringId,
      interventionType: recoveryInterventionType,
      note: `Generated ${recoveryInterventionType} for ${deps.courseCodeForRuntime(course)} from the active proof run.`,
      occurredAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
    input.interventionResponseRows.push({
      studentInterventionResponseStateId: deps.createId('intervention_response'),
      simulationRunId: input.simulationRunId,
      studentId: input.student.studentId,
      semesterNumber: 6,
      sectionCode: input.student.sectionCode,
      offeringId: offering.offeringId,
      interventionId,
      interventionType: recoveryInterventionType,
      responseStateJson: JSON.stringify({
        interventionOfferFlag: true,
        interventionAcceptanceProb: deps.roundToTwo(input.student.profile.intervention.interventionReceptivity),
        interventionCompletionProb: deps.roundToTwo(input.student.profile.behavior.practiceCompliance),
        interventionReceptivity: deps.roundToTwo(input.student.profile.intervention.interventionReceptivity),
        temporaryUpliftCredit: deps.roundToTwo(input.student.profile.intervention.temporaryUpliftCredit),
        expectedRecoveryThreshold: deps.roundToTwo(input.student.profile.intervention.expectedRecoveryThreshold),
        observedVsExpectedResidual: responseResidual,
        recoveryConfirmedFlag: responseResidual >= 0 && interventionCompleted,
        watchModeFlag: Math.abs(responseResidual) < 0.04,
        escalationNeededFlag: !interventionCompleted || responseResidual < -0.05,
        nonresponseCount: interventionAccepted ? 0 : 1,
        switchInterventionFlag: !interventionCompleted || responseResidual < -0.08,
        accepted: interventionAccepted,
        completed: interventionCompleted,
      }),
      createdAt: input.now,
      updatedAt: input.now,
    })
    input.observedRows.push({
      studentObservedSemesterStateId: deps.createId('observed_state'),
      simulationRunId: input.simulationRunId,
      studentId: input.student.studentId,
      termId: 'term_mnc_sem6',
      semesterNumber: 6,
      sectionCode: input.student.sectionCode,
      observedStateJson: JSON.stringify({
        offeringId: offering.offeringId,
        courseTitle: course.title,
        courseCode: deps.courseCodeForRuntime(course),
        attendancePct: simulation.attendancePct,
        attendanceHistory: simulation.attendanceHistory,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        quizPct: simulation.quizPct,
        assignmentPct: simulation.assignmentPct,
        seePct: simulation.seePct,
        cePct: simulation.cePct,
        finalMark: simulation.overallMark,
        gradeLabel: simulation.gradeLabel,
        gradePoint: simulation.gradePoint,
        result: simulation.result,
        weakCoCount: coStates.weakCoCount,
        coSummary: coStates.summaries,
        questionEvidenceSummary: questionResults.summary,
        cgpa: input.currentCgpa,
        backlogCount: input.activeBacklogCount,
        riskBand: inference.riskBand,
        riskProb: inference.riskProb,
        drivers: inference.observableDrivers,
        interventionResponse: {
          interventionType: recoveryInterventionType,
          accepted: interventionAccepted,
          completed: interventionCompleted,
          recoveryConfirmed: responseResidual >= 0 && interventionCompleted,
          residual: responseResidual,
        },
      }),
      createdAt: input.now,
      updatedAt: input.now,
    })
    const alertDecisionId = deps.createId('alert_decision')
    input.alertRows.push({
      alertDecisionId,
      riskAssessmentId,
      studentId: input.student.studentId,
      offeringId: offering.offeringId,
      decisionType: monitoring.decisionType,
      queueOwnerRole: monitoring.queueOwnerRole,
      note: monitoring.note,
      reassessmentDueAt: monitoring.reassessmentDueAt,
      cooldownUntil: monitoring.cooldownUntil,
      monitoringPolicyVersion: 'monitoring-policy-v2',
      createdAt: input.now,
      updatedAt: input.now,
    })
    input.alertOutcomeRows.push({
      alertOutcomeId: deps.createId('alert_outcome'),
      alertDecisionId,
      outcomeStatus: monitoring.decisionType === 'suppress' ? 'Suppressed' : 'Pending',
      acknowledgedByFacultyId: null,
      acknowledgedAt: null,
      outcomeNote: monitoring.note,
      createdAt: input.now,
      updatedAt: input.now,
    })
    if (monitoring.decisionType !== 'suppress') {
      input.reassessmentRows.push({
        reassessmentEventId: deps.createId('reassessment'),
        riskAssessmentId,
        studentId: input.student.studentId,
        offeringId: offering.offeringId,
        assignedToRole: monitoring.queueOwnerRole,
        dueAt: monitoring.reassessmentDueAt ?? input.now,
        status: 'Open',
        payloadJson: JSON.stringify({
          riskBand: inference.riskBand,
          riskProb: inference.riskProb,
          recommendedAction: inference.recommendedAction,
          evidence: {
            attendancePct: simulation.attendancePct,
            tt1Pct: simulation.tt1Pct,
            tt2Pct: simulation.tt2Pct,
            quizPct: simulation.quizPct,
            assignmentPct: simulation.assignmentPct,
            seePct: simulation.seePct,
          },
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
  })
}
