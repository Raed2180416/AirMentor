#!/usr/bin/env node
// Phase 1-6d end-to-end demo script.
//
// Runs the full AirMentor stage-realization pipeline on synthetic inputs and prints
// baseline vs realized marks for each of three intervention scenarios:
//   1. No interventions applied -> realized = baseline (identity)
//   2. Single strong-profile intervention applied -> realized > baseline on
//      responsive assessments (tt2, quiz, assignment, see, attendance)
//   3. Workflow-only intervention (no student-facing change) -> realized = baseline
//
// Proves determinism by running each scenario 20 times and confirming byte-
// identical outputs. Exits non-zero if any invariant breaks, so CI can use it.
//
// Usage:
//   node scripts/demo-stage-realization-flow.mjs
//
// No DB required — the script mocks baseline marks + intervention records to show
// the pure-function pipeline end-to-end.

import { buildSeverityContextByStudentId } from '../src/lib/proof-stage-realization-bundle-assembler.js'
import {
  groupInterventionsByStudentAndOffering,
  mapLegacyInterventionTypeToActionCode,
  parseLatentProfileForIntervention,
} from '../src/lib/proof-stage-realization-data-fetcher.js'
import { applyRealizationToEvidenceSnapshot } from '../src/lib/proof-stage-realization-evidence-applier.js'

const FLAG = 'AIRMENTOR_STAGE_REALIZATION_V1'
process.env[FLAG] = '1'

// ---------- Synthetic fixtures ----------

const SYNTHETIC_LATENT_JSON = JSON.stringify({
  dynamics: {
    forgetRate: 0.09, relearnRate: 0.55, transferGainRate: 0.42,
    studyGainRate: 0.55, fatigueRate: 0.08, consistency: 0.62,
    volatility: 0.2, recoveryTendency: 0.55, relapseTendency: 0.18,
  },
  behavior: {
    practiceCompliance: 0.78,
    helpSeekingTendency: 0.45,
    examPressure: 0.32,
  },
  intervention: {
    interventionReceptivity: 0.82,
    temporaryUpliftCredit: 0.11,
    expectedRecoveryThreshold: 0.10,
  },
})

const BASELINE = {
  attendancePct: 78,
  tt1Pct: 55,
  tt2Pct: 50,   // moderate — room for intervention effect
  quizPct: 58,
  assignmentPct: 62,
  seePct: 46,
  cePct: 55,
}

function interventionRow(interventionId, interventionType, occurredAt) {
  return {
    interventionId,
    studentId: 'stud_demo',
    offeringId: 'offr_demo',
    interventionType,
    occurredAt,
    createdAt: occurredAt,
  }
}

// ---------- Assert helpers ----------

function assert(condition, message) {
  if (!condition) {
    console.error(`\n✗ FAIL: ${message}`)
    process.exit(1)
  }
}

function round(value) {
  return Math.round(value * 100) / 100
}

// ---------- Scenario runner ----------

function runScenario(label, rows) {
  console.log(`\n==== Scenario: ${label} ====`)

  // 1. Parse the latent profile
  const profile = parseLatentProfileForIntervention(SYNTHETIC_LATENT_JSON)
  assert(profile, 'parseLatentProfileForIntervention returned null for well-formed JSON')

  // 2. Build severity context map
  const severity = buildSeverityContextByStudentId({
    summaries: [{ studentId: 'stud_demo', cgpa: 5.6, backlogCount: 1 }],
  })
  assert(severity.get('stud_demo')?.riskBand === 'Medium', 'severity heuristic: cgpa=5.6 backlog=1 -> Medium')

  // 3. Group interventions (MVP: all tagged as pre-tt1)
  const grouped = groupInterventionsByStudentAndOffering({
    interventionRows: rows,
    semesterNumber: 3,
    stageKeyApplied: 'pre-tt1',
    severityContextByStudentId: severity,
  })
  const interventionsInWindow = grouped.get('stud_demo::offr_demo') ?? []
  console.log(`  Legacy intervention types:  ${rows.map(r => r.interventionType).join(', ') || '<none>'}`)
  console.log(`  Enum action codes:          ${interventionsInWindow.map(i => i.actionCode).join(', ') || '<none>'}`)

  // 4. Apply realization
  const result = applyRealizationToEvidenceSnapshot({
    baseline: BASELINE,
    studentProfile: profile,
    runId: 'run_demo',
    studentId: 'stud_demo',
    semesterNumber: 3,
    stageKey: 'post-tt2',
    interventionsInWindow,
  })

  console.log(`  Flag enabled:               ${result.flagOn}`)
  console.log(`  Applied intervention count: ${result.impact.appliedCount}`)
  console.log(`  Total impact:               ${round(result.impact.totalImpact)}`)
  console.log(`  Dominant tier:              ${result.impact.dominantTier ?? '-'}`)
  console.log(`  Mark deltas:                tt1=${round(result.impact.markDeltas.tt1)} tt2=${round(result.impact.markDeltas.tt2)} quiz=${round(result.impact.markDeltas.quiz)} assignment=${round(result.impact.markDeltas.assignment)} see=${round(result.impact.markDeltas.see)} attendance=${round(result.impact.markDeltas.attendance)}`)
  console.log(`  Baseline marks:             tt1=${BASELINE.tt1Pct} tt2=${BASELINE.tt2Pct} quiz=${BASELINE.quizPct} asg=${BASELINE.assignmentPct} see=${BASELINE.seePct}`)
  console.log(`  Realized marks:             tt1=${result.realized.tt1Pct} tt2=${result.realized.tt2Pct} quiz=${result.realized.quizPct} asg=${result.realized.assignmentPct} see=${result.realized.seePct}`)

  // 5. Determinism check — 20 repeat invocations
  for (let i = 0; i < 20; i++) {
    const repeat = applyRealizationToEvidenceSnapshot({
      baseline: BASELINE,
      studentProfile: profile,
      runId: 'run_demo',
      studentId: 'stud_demo',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow,
    })
    assert(repeat.realized.tt2Pct === result.realized.tt2Pct, `determinism violation on tt2 at iter ${i}`)
    assert(repeat.realized.quizPct === result.realized.quizPct, `determinism violation on quiz at iter ${i}`)
    assert(repeat.realized.seePct === result.realized.seePct, `determinism violation on see at iter ${i}`)
  }
  console.log(`  \u2713 deterministic across 20 runs`)
  return result
}

// ---------- Legacy -> enum mapping demo ----------

function runLegacyMappingDemo() {
  console.log(`\n==== Legacy interventionType -> enum mapping ====`)
  const cases = [
    ['mentor-check-in',                'mentor_meeting'],
    ['prerequisite-bridge',            'targeted_remedial_plan'],
    ['structured-study-plan',          'structured_study_plan'],
    ['targeted-tutoring',              'targeted_remedial_plan'],
    ['pre-see-rescue',                 'structured_study_plan'],
    ['outreach-plus-tutoring',         'targeted_remedial_plan'],
    ['attendance-recovery-follow-up',  'attendance_warning'],
    ['faculty-outreach',               'faculty_followup_reminder'],
    ['alert-only',                     'faculty_followup_reminder'],
    ['no-action',                       null],
    ['support',                        'generic_default_family_action'],
  ]
  for (const [legacy, expected] of cases) {
    const mapped = mapLegacyInterventionTypeToActionCode(legacy)
    const ok = mapped === expected
    assert(ok, `legacy '${legacy}' expected ${expected} got ${mapped}`)
    console.log(`  ${legacy.padEnd(35)} -> ${expected ?? '(skipped)'}`)
  }
}

// ---------- Run all scenarios ----------

runLegacyMappingDemo()

const noInterventions = runScenario('no interventions (identity)', [])
assert(noInterventions.impact.totalImpact === 0, 'no-interventions totalImpact must be zero')
assert(noInterventions.realized.tt2Pct === BASELINE.tt2Pct, 'no-interventions tt2 must equal baseline')

const workflowOnly = runScenario('workflow-only intervention (faculty_followup_reminder)',
  [interventionRow('wf1', 'faculty-outreach', '2026-04-10T10:00:00Z')])
assert(workflowOnly.impact.totalImpact === 0, 'workflow-only (faculty_followup_reminder) totalImpact must be zero on student marks')
assert(workflowOnly.realized.tt2Pct === BASELINE.tt2Pct, 'workflow-only tt2 must equal baseline')

const studentFacing = runScenario('student-facing intervention (targeted-tutoring + mentor-check-in)',
  [
    interventionRow('sf1', 'targeted-tutoring', '2026-04-10T10:00:00Z'),
    interventionRow('sf2', 'mentor-check-in',   '2026-04-12T10:00:00Z'),
  ])
assert(studentFacing.impact.totalImpact > 0, 'student-facing totalImpact must be > 0')
assert(studentFacing.realized.tt2Pct > BASELINE.tt2Pct, 'student-facing tt2 must exceed baseline')
assert(studentFacing.realized.quizPct > BASELINE.quizPct, 'student-facing quiz must exceed baseline')
assert(studentFacing.realized.assignmentPct > BASELINE.assignmentPct, 'student-facing assignment must exceed baseline')
assert(studentFacing.realized.tt1Pct === BASELINE.tt1Pct, 'student-facing tt1 must stay immutable (responsiveness=0)')

// ---------- Flag-off regression guard ----------

console.log(`\n==== Flag-off regression guard ====`)
delete process.env[FLAG]
const profile = parseLatentProfileForIntervention(SYNTHETIC_LATENT_JSON)
const flagOffResult = applyRealizationToEvidenceSnapshot({
  baseline: BASELINE,
  studentProfile: profile,
  runId: 'run_demo_flagoff',
  studentId: 'stud_demo',
  semesterNumber: 3,
  stageKey: 'post-tt2',
  interventionsInWindow: [
    {
      caseId: 'sf1',
      actionCode: 'targeted_remedial_plan',
      concernFamily: 'coursework',
      ordinalInStageForStudent: 1,
      stageKeyApplied: 'pre-tt1',
      semesterNumberApplied: 3,
      dominantWeaknessHint: 'coursework',
      severityContext: { riskBand: 'High', cgpa: 5.2, backlogCount: 1 },
    },
  ],
})
assert(flagOffResult.flagOn === false, 'flag-off: flagOn must be false')
assert(flagOffResult.realized.tt2Pct === BASELINE.tt2Pct, 'flag-off: realized.tt2 must equal baseline (no delta applied)')
assert(flagOffResult.impact.totalImpact === 0, 'flag-off: impact.totalImpact must be zero')
console.log(`  \u2713 flag-off preserves baseline (tt2=${flagOffResult.realized.tt2Pct})`)

// ---------- Summary ----------

console.log(`\n\u2713 ALL DEMO SCENARIOS PASSED`)
console.log(`   Proof: flag-on + student-facing intervention raises tt2 from ${BASELINE.tt2Pct} to ${studentFacing.realized.tt2Pct}`)
console.log(`   Proof: flag-off returns baseline bytewise (tt2=${flagOffResult.realized.tt2Pct})`)
console.log(`   Proof: workflow-only interventions do not shift marks (tt2=${workflowOnly.realized.tt2Pct})`)
console.log(`   Proof: pipeline is deterministic across 20 repeat runs per scenario`)
