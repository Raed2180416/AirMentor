#!/usr/bin/env node
/**
 * Deep Forensic Analysis of student_risk_trajectories.csv
 * Analyzes ML risk model calibration, stage-wise distributions,
 * archetype boundary validation, and generates exhaustive statistics.
 */
import { createReadStream } from 'fs'
import { writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const csvPath = join(__dirname, '..', 'student_risk_trajectories.csv')
const outPath = join(__dirname, '..', 'output', 'forensic_risk_analysis.md')

interface Row {
  run_id: string
  split: string
  student_id: string
  semester_number: number
  stage_key: string
  scenario_family: string
  section_code: string
  course_code: string
  course_credits: number
  label_attendance: number
  label_ce: number
  label_see: number
  label_overall: number
  label_downstream: number
  feats: number[]
}

async function parseCSV(): Promise<Row[]> {
  const rows: Row[] = []
  const rl = createInterface({ input: createReadStream(csvPath) })
  let headers: string[] = []
  let lineNum = 0
  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) {
      headers = line.split(',')
      continue
    }
    const vals = line.split(',')
    const feats: number[] = []
    for (let i = 23; i < vals.length; i++) {
      feats.push(parseFloat(vals[i]) || 0)
    }
    rows.push({
      run_id: vals[0],
      split: vals[1],
      student_id: vals[2],
      semester_number: parseInt(vals[3]) || 0,
      stage_key: vals[4],
      scenario_family: vals[5],
      section_code: vals[6],
      course_code: vals[8],
      course_credits: parseInt(vals[10]) || 0,
      label_attendance: parseInt(vals[18]) || 0,
      label_ce: parseInt(vals[19]) || 0,
      label_see: parseInt(vals[20]) || 0,
      label_overall: parseInt(vals[21]) || 0,
      label_downstream: parseInt(vals[22]) || 0,
      feats,
    })
  }
  return rows
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1))
}

async function main() {
  console.log('Parsing CSV...')
  const rows = await parseCSV()
  console.log(`Parsed ${rows.length} rows`)

  const report: string[] = []
  report.push('# Forensic Risk Trajectory Analysis')
  report.push('')
  report.push(`> Generated: ${new Date().toISOString()}`)
  report.push(`> Total rows: ${rows.length.toLocaleString()}`)
  report.push('')

  // ─── 1. Basic Distribution ───
  const uniqueStudents = new Set(rows.map(r => r.student_id))
  const uniqueRuns = new Set(rows.map(r => r.run_id))
  const semesters = new Set(rows.map(r => r.semester_number))
  const stages = new Set(rows.map(r => r.stage_key))
  const scenarios = new Set(rows.map(r => r.scenario_family))

  report.push('## 1. Dataset Overview')
  report.push(`| Metric | Value |`)
  report.push(`|---|---|`)
  report.push(`| Total rows | ${rows.length.toLocaleString()} |`)
  report.push(`| Unique students | ${uniqueStudents.size.toLocaleString()} |`)
  report.push(`| Unique simulation runs | ${uniqueRuns.size.toLocaleString()} |`)
  report.push(`| Semesters | ${[...semesters].sort().join(', ')} |`)
  report.push(`| Stage keys | ${[...stages].sort().join(', ')} |`)
  report.push(`| Scenario families | ${[...scenarios].sort().join(', ')} |`)
  report.push('')

  // ─── 2. Label Distribution by Semester ───
  report.push('## 2. Label Distribution by Semester × Stage')
  report.push('')
  const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']
  for (const sem of [...semesters].sort()) {
    report.push(`### Semester ${sem}`)
    report.push(`| Stage | N | Attendance=1 (%) | CE=1 (%) | SEE=1 (%) | Overall=1 (%) | Downstream=1 (%) |`)
    report.push(`|---|---|---|---|---|---|---|`)
    for (const stage of stageOrder) {
      const subset = rows.filter(r => r.semester_number === sem && r.stage_key === stage)
      if (subset.length === 0) continue
      const n = subset.length
      const attPct = (subset.filter(r => r.label_attendance === 1).length / n * 100).toFixed(1)
      const cePct = (subset.filter(r => r.label_ce === 1).length / n * 100).toFixed(1)
      const seePct = (subset.filter(r => r.label_see === 1).length / n * 100).toFixed(1)
      const overPct = (subset.filter(r => r.label_overall === 1).length / n * 100).toFixed(1)
      const downPct = (subset.filter(r => r.label_downstream === 1).length / n * 100).toFixed(1)
      report.push(`| ${stage} | ${n} | ${attPct} | ${cePct} | ${seePct} | ${overPct} | ${downPct} |`)
    }
    report.push('')
  }

  // ─── 3. Feature Statistics by Stage ───
  report.push('## 3. Feature Statistics by Stage (Mean ± Std)')
  report.push('')
  const featNames = Array.from({ length: 48 }, (_, i) => `feat_${i}`)
  for (const stage of stageOrder) {
    const subset = rows.filter(r => r.stage_key === stage && r.semester_number === 1)
    if (subset.length === 0) continue
    report.push(`### ${stage} (Semester 1, N=${subset.length})`)
    report.push(`| Feature | Mean | Std | Min | P25 | Median | P75 | Max |`)
    report.push(`|---|---|---|---|---|---|---|---|`)
    for (let fi = 0; fi < Math.min(48, subset[0].feats.length); fi++) {
      const vals = subset.map(r => r.feats[fi])
      const m = mean(vals)
      const s = std(vals)
      const mn = Math.min(...vals)
      const mx = Math.max(...vals)
      report.push(`| feat_${fi} | ${m.toFixed(4)} | ${s.toFixed(4)} | ${mn.toFixed(4)} | ${percentile(vals, 25).toFixed(4)} | ${percentile(vals, 50).toFixed(4)} | ${percentile(vals, 75).toFixed(4)} | ${mx.toFixed(4)} |`)
    }
    report.push('')
  }

  // ─── 4. Scenario Family Breakdown ───
  report.push('## 4. Scenario Family Breakdown')
  report.push(`| Scenario | Count | % of Total | Overall Risk=1 % |`)
  report.push(`|---|---|---|---|`)
  for (const sc of [...scenarios].sort()) {
    const subset = rows.filter(r => r.scenario_family === sc)
    const n = subset.length
    const overPct = (subset.filter(r => r.label_overall === 1).length / n * 100).toFixed(1)
    report.push(`| ${sc} | ${n} | ${(n / rows.length * 100).toFixed(1)} | ${overPct} |`)
  }
  report.push('')

  // ─── 5. Calibration Check: Risk Probability vs Label ───
  report.push('## 5. Calibration Summary')
  report.push('')
  // Features feat_0 through feat_5 are typically attendance_pct, tt1_pct, etc.
  // The label_overall is the binary risk label
  // We analyze calibration by binning feat_0 (attendance) and checking overall risk rate
  const attBins = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
  report.push('### Attendance Feature (feat_0) vs Overall Risk Rate')
  report.push(`| Attendance Bin | N | Overall Risk=1 % | Mean feat_0 |`)
  report.push(`|---|---|---|---|`)
  for (let i = 0; i < attBins.length - 1; i++) {
    const lo = attBins[i]
    const hi = attBins[i + 1]
    const subset = rows.filter(r => r.feats[0] >= lo && r.feats[0] < hi)
    if (subset.length === 0) continue
    const n = subset.length
    const riskPct = (subset.filter(r => r.label_overall === 1).length / n * 100).toFixed(1)
    const meanAtt = mean(subset.map(r => r.feats[0]))
    report.push(`| [${lo}, ${hi}) | ${n} | ${riskPct} | ${meanAtt.toFixed(3)} |`)
  }
  report.push('')

  // ─── 6. Stage Progression Realism Check ───
  report.push('## 6. Stage Progression Realism')
  report.push('')
  report.push('Checking that risk labels don\'t wildly fluctuate across stages within the same student-semester:')
  report.push('')
  let flipCount = 0
  let totalTransitions = 0
  const studentSemGroups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = `${r.student_id}__${r.semester_number}`
    if (!studentSemGroups.has(key)) studentSemGroups.set(key, [])
    studentSemGroups.get(key)!.push(r)
  }
  for (const [, group] of studentSemGroups) {
    group.sort((a, b) => stageOrder.indexOf(a.stage_key) - stageOrder.indexOf(b.stage_key))
    for (let i = 1; i < group.length; i++) {
      totalTransitions++
      if (group[i].label_overall !== group[i - 1].label_overall) flipCount++
    }
  }
  report.push(`| Metric | Value |`)
  report.push(`|---|---|`)
  report.push(`| Total stage transitions | ${totalTransitions.toLocaleString()} |`)
  report.push(`| Risk label flips | ${flipCount.toLocaleString()} |`)
  report.push(`| Flip rate | ${(flipCount / totalTransitions * 100).toFixed(2)}% |`)
  report.push('')
  report.push(flipCount / totalTransitions < 0.15
    ? '> [!TIP]\n> Flip rate is under 15% — **stage progression is realistic**.'
    : '> [!WARNING]\n> Flip rate exceeds 15% — stage progression may be unrealistic.')
  report.push('')

  // ─── 7. Cross-semester trajectory consistency ───
  report.push('## 7. Cross-Semester Trajectory Consistency')
  report.push('')
  // Check that high-risk students in sem N tend to remain high-risk in sem N+1 unless intervention
  const studentOverallRisk = new Map<string, Map<number, number>>()
  for (const r of rows.filter(r => r.stage_key === 'post-see')) {
    if (!studentOverallRisk.has(r.student_id)) studentOverallRisk.set(r.student_id, new Map())
    studentOverallRisk.get(r.student_id)!.set(r.semester_number, r.label_overall)
  }
  let persistentHigh = 0
  let recoveredFromHigh = 0
  let persistentLow = 0
  let degradedToHigh = 0
  let crossSemTransitions = 0
  for (const [, semMap] of studentOverallRisk) {
    const sems = [...semMap.keys()].sort()
    for (let i = 1; i < sems.length; i++) {
      crossSemTransitions++
      const prev = semMap.get(sems[i - 1])!
      const curr = semMap.get(sems[i])!
      if (prev === 1 && curr === 1) persistentHigh++
      if (prev === 1 && curr === 0) recoveredFromHigh++
      if (prev === 0 && curr === 0) persistentLow++
      if (prev === 0 && curr === 1) degradedToHigh++
    }
  }
  report.push(`| Transition | Count | % |`)
  report.push(`|---|---|---|`)
  if (crossSemTransitions > 0) {
    report.push(`| Persistent High (1→1) | ${persistentHigh} | ${(persistentHigh / crossSemTransitions * 100).toFixed(1)} |`)
    report.push(`| Recovered (1→0) | ${recoveredFromHigh} | ${(recoveredFromHigh / crossSemTransitions * 100).toFixed(1)} |`)
    report.push(`| Persistent Low (0→0) | ${persistentLow} | ${(persistentLow / crossSemTransitions * 100).toFixed(1)} |`)
    report.push(`| Degraded (0→1) | ${degradedToHigh} | ${(degradedToHigh / crossSemTransitions * 100).toFixed(1)} |`)
  }
  report.push('')

  // Write report
  const md = report.join('\n')
  writeFileSync(outPath, md)
  console.log(`\nReport written to ${outPath}`)
  console.log(`Total length: ${md.length} chars`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
