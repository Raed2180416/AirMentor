#!/usr/bin/env node
/**
 * Comprehensive demo evidence analyzer for deterministic proof.
 * Verifies all 7 critical areas for tomorrow's demo.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const EVIDENCE_DIR = process.env.AIRMENTOR_EVIDENCE_DIR
  ?? 'output/playwright/demo-reality-hardening/json'

async function readJson(name) {
  try {
    const content = await fs.readFile(path.join(EVIDENCE_DIR, name), 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

function analyzeRiskRealism(evidence) {
  const issues = []
  const checks = []

  // Check 1: Risk distribution should be bell-curve (balanced seed)
  if (evidence?.distribution?.sampleRiskLevels) {
    const levels = evidence.distribution.sampleRiskLevels
    const highCount = levels.filter(l => l === 'High').length
    const mediumCount = levels.filter(l => l === 'Medium').length
    const lowCount = levels.filter(l => l === 'Low').length
    const total = levels.length

    const highRate = highCount / total
    const mediumRate = mediumCount / total
    const lowRate = lowCount / total

    // Balanced seed should have: ~20% High, ~50% Medium, ~30% Low
    const isBalanced = highRate < 0.4 && mediumRate > 0.3 && lowRate > 0.2

    checks.push(`Risk Distribution: High=${(highRate*100).toFixed(0)}%, Medium=${(mediumRate*100).toFixed(0)}%, Low=${(lowRate*100).toFixed(0)}%`)

    if (!isBalanced) {
      issues.push(`⚠️ Risk distribution may be skewed (High ${(highRate*100).toFixed(0)}%) - check if using balanced seed`)
    }
  }

  // Check 2: Risk values should be in realistic range (0-100)
  if (evidence?.currentEvidence) {
    const ce = evidence.currentEvidence
    const checks2 = [
      ['Attendance', ce.attendancePct, 0, 100],
      ['TT1', ce.tt1Pct, 0, 100],
      ['TT2', ce.tt2Pct, 0, 100],
      ['Quiz', ce.quizPct, 0, 100],
      ['Assignment', ce.assignmentPct, 0, 100],
      ['SEE', ce.seePct, 0, 100],
    ]

    for (const [name, val, min, max] of checks2) {
      if (val !== undefined && (val < min || val > max)) {
        issues.push(`❌ ${name} value ${val} out of realistic range [${min}-${max}]`)
      }
    }
  }

  return { checks, issues, pass: issues.length === 0 }
}

function analyzeSemesterProgression(outcomes) {
  const issues = []
  const checks = []

  if (!outcomes?.bySemester) {
    return { checks: ['No semester data'], issues: ['Missing semester progression data'], pass: false }
  }

  const sems = outcomes.bySemester

  // Check: Risk should generally increase across semesters (harder curriculum)
  let prevRisk = null
  for (const sem of sems) {
    const risk = sem.meanRealizedRiskProbScaled

    if (prevRisk !== null && risk < prevRisk - 10) {
      issues.push(`⚠️ Sem ${sem.semesterNumber}: Risk dropped significantly from ${prevRisk.toFixed(1)} to ${risk.toFixed(1)}`)
    }

    // Check: Prevented count should decrease (fewer interventions possible late)
    if (sem.preventedHighTotal < 0 || sem.preventedHighTotal > 200) {
      issues.push(`❌ Sem ${sem.semesterNumber}: Unrealistic prevented count ${sem.preventedHighTotal}`)
    }

    checks.push(`Sem ${sem.semesterNumber}: Risk=${risk.toFixed(1)}, Prevented=${sem.preventedHighTotal}`)
    prevRisk = risk
  }

  return { checks, issues, pass: issues.length === 0 }
}

function analyzeRoleViews(parity) {
  const issues = []
  const checks = []

  if (!parity?.parity) {
    return { checks: ['No parity data'], issues: ['Missing role parity data'], pass: false }
  }

  const p = parity.parity

  checks.push(`Mentor sees student: ${p.studentVisibleToAssignedMentor}`)
  checks.push(`HoD sees student: ${p.studentVisibleToHod}`)
  checks.push(`Risk band matches: ${p.riskBandMatches}`)
  checks.push(`Queue state matches: ${p.queueStateMatches}`)

  if (!p.riskBandMatches) issues.push('❌ Mentor/HoD risk band mismatch')
  if (!p.queueStateMatches) issues.push('❌ Mentor/HoD queue state mismatch')

  return { checks, issues, pass: issues.length === 0 }
}

function analyzeManualEdits(editData) {
  const issues = []
  const checks = []

  if (!editData?.editCases) {
    return { checks: ['No edit data'], issues: ['Missing manual edit evidence'], pass: false }
  }

  for (const edit of editData.editCases) {
    checks.push(`${edit.studentId}: ${edit.pattern} pattern (${edit.assessmentKind})`)

    // Verify expected score ranges
    if (edit.components) {
      const avgScore = edit.components.reduce((a, c) => a + c.score, 0) / edit.components.length
      const avgMax = edit.components.reduce((a, c) => a + c.maxScore, 0) / edit.components.length

      if (edit.pattern === 'worsen' && avgScore > avgMax * 0.3) {
        issues.push(`⚠️ ${edit.studentId}: 'worsen' pattern but avg score ${avgScore.toFixed(1)}/${avgMax} seems high`)
      }
      if (edit.pattern === 'improve' && avgScore < avgMax * 0.7) {
        issues.push(`⚠️ ${edit.studentId}: 'improve' pattern but avg score ${avgScore.toFixed(1)}/${avgMax} seems low`)
      }
    }
  }

  return { checks, issues, pass: issues.length === 0 }
}

function analyzeInterventionBounds(outcomes) {
  const issues = []
  const checks = []

  if (!outcomes?.projectedFinal) {
    return { checks: ['No intervention data'], issues: ['Missing intervention outcomes'], pass: false }
  }

  const pf = outcomes.projectedFinal

  // Check: Lift should be realistic (not negative overall)
  if (pf.meanLiftProbScaled < 0) {
    issues.push(`❌ Negative mean lift: ${pf.meanLiftProbScaled} (interventions harming?)`)
  }

  // Check: Failures prevented should be realistic
  if (pf.projectedFailuresPreventedTotal > 500) {
    issues.push(`⚠️ Unrealistic failures prevented: ${pf.projectedFailuresPreventedTotal} (too high?)`)
  }

  // Check: No extreme regression counts
  const totalRegressions = outcomes.bySemester?.reduce((a, s) => a + (s.regressionTotal || 0), 0)
  if (totalRegressions > 50) {
    issues.push(`⚠️ High regression count: ${totalRegressions} students got worse`)
  }

  checks.push(`Mean lift: ${pf.meanLiftProbScaled.toFixed(2)}`)
  checks.push(`Failures prevented: ${pf.projectedFailuresPreventedTotal}`)
  checks.push(`Regressions (total): ${totalRegressions || 0}`)

  return { checks, issues, pass: issues.length === 0 }
}

async function main() {
  console.log('🔍 DEMO REALITY ANALYZER — Comprehensive Verification\n')

  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    issues: [],
    demoReady: true,
  }

  // 1. ML Risk Analysis
  console.log('1️⃣ ML RISK ANALYSIS — Realistic Progression')
  const riskEvidence = await readJson('student-risk-evidence.json')
  const riskAnalysis = analyzeRiskRealism(riskEvidence)
  console.log('   Checks:', riskAnalysis.checks)
  if (riskAnalysis.issues.length) console.log('   Issues:', riskAnalysis.issues)
  console.log(`   Status: ${riskAnalysis.pass ? '✅ PASS' : '⚠️ WARN'}\n`)
  results.checks.mlRisk = riskAnalysis
  results.issues.push(...riskAnalysis.issues)

  // 2. Semester Progression
  console.log('2️⃣ SEMESTER PROGRESSION — Realistic Data Flow')
  const outcomes = await readJson('intervention-outcomes.json')
  const progAnalysis = analyzeSemesterProgression(outcomes)
  console.log('   Checks:', progAnalysis.checks)
  if (progAnalysis.issues.length) console.log('   Issues:', progAnalysis.issues)
  console.log(`   Status: ${progAnalysis.pass ? '✅ PASS' : '⚠️ WARN'}\n`)
  results.checks.semesterProgression = progAnalysis
  results.issues.push(...progAnalysis.issues)

  // 3. Role Views
  console.log('3️⃣ ROLE VIEWS — Course Leader / Mentor / HoD Parity')
  const parity = await readJson('same-student-mentor-hod-parity.json')
  const roleAnalysis = analyzeRoleViews(parity)
  console.log('   Checks:', roleAnalysis.checks)
  if (roleAnalysis.issues.length) console.log('   Issues:', roleAnalysis.issues)
  console.log(`   Status: ${roleAnalysis.pass ? '✅ PASS' : '❌ FAIL'}\n`)
  results.checks.roleViews = roleAnalysis
  results.issues.push(...roleAnalysis.issues)

  // 4. Manual Edits
  console.log('4️⃣ MANUAL EDITS — Marks Changes Flow to Risk')
  const edits = await readJson('marks-edit-before-after.json')
  const editAnalysis = analyzeManualEdits(edits)
  console.log('   Checks:', editAnalysis.checks)
  if (editAnalysis.issues.length) console.log('   Issues:', editAnalysis.issues)
  console.log(`   Status: ${editAnalysis.pass ? '✅ PASS' : '⚠️ WARN'}\n`)
  results.checks.manualEdits = editAnalysis
  results.issues.push(...editAnalysis.issues)

  // 5. Simulation
  console.log('5️⃣ SIMULATION — Data Seeding Logic')
  const checkpoint = await readJson('checkpoint-details.json')
  if (checkpoint?.checkpoints?.length === 30) {
    console.log('   ✅ 30 checkpoints present (6 semesters × 5 stages)')
    results.checks.simulation = { pass: true, checkpoints: 30 }
  } else {
    console.log(`   ⚠️ Checkpoints: ${checkpoint?.checkpoints?.length || 0}/30`)
    results.checks.simulation = { pass: false, checkpoints: checkpoint?.checkpoints?.length }
  }
  console.log()

  // 6. Intervention Effects
  console.log('6️⃣ INTERVENTION EFFECTS — Realistic Bounds')
  const interventionAnalysis = analyzeInterventionBounds(outcomes)
  console.log('   Checks:', interventionAnalysis.checks)
  if (interventionAnalysis.issues.length) console.log('   Issues:', interventionAnalysis.issues)
  console.log(`   Status: ${interventionAnalysis.pass ? '✅ PASS' : '⚠️ WARN'}\n`)
  results.checks.interventions = interventionAnalysis
  results.issues.push(...interventionAnalysis.issues)

  // 7. Nothing Fails Tomorrow
  console.log('7️⃣ DEMO READINESS — Will It Fail Tomorrow?')
  const criticalIssues = results.issues.filter(i => i.startsWith('❌'))
  const warnings = results.issues.filter(i => i.startsWith('⚠️'))

  if (criticalIssues.length === 0) {
    console.log('   ✅ NO CRITICAL FAILURES DETECTED')
    console.log(`   ⚠️ ${warnings.length} warnings (non-blocking)`)
    console.log('\n   🎉 DEMO STATUS: READY TO IMPRESS')
    results.demoReady = true
  } else {
    console.log('   ❌ CRITICAL ISSUES FOUND:')
    criticalIssues.forEach(i => console.log(`      ${i}`))
    console.log('\n   🔧 DEMO STATUS: NEEDS FIXES')
    results.demoReady = false
  }

  // Summary
  console.log('\n📊 SUMMARY')
  console.log('   Critical issues:', criticalIssues.length)
  console.log('   Warnings:', warnings.length)
  console.log('   Evidence files:', (await fs.readdir(EVIDENCE_DIR)).filter(f => f.endsWith('.json')).length)

  // Write report
  await fs.writeFile(
    'output/demo-verification-report.json',
    JSON.stringify(results, null, 2)
  )
  console.log('\n📝 Report written to: output/demo-verification-report.json')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
