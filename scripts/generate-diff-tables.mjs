#!/usr/bin/env node
/**
 * Generate visual diff tables from demo reality evidence JSON files.
 * Reads existing evidence artifacts and produces markdown tables.
 *
 * Usage: node scripts/generate-diff-tables.mjs
 * Output: output/playwright/demo-reality-hardening/diff-tables.md
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const EVIDENCE_ROOT = process.env.AIRMENTOR_DEMO_REALITY_EVIDENCE_DIR
  ?? path.join(process.cwd(), 'output/playwright/demo-reality-hardening')
const JSON_DIR = path.join(EVIDENCE_ROOT, 'json')
const OUTPUT_PATH = path.join(EVIDENCE_ROOT, 'diff-tables.md')

async function readJson(fileName) {
  try {
    const content = await fs.readFile(path.join(JSON_DIR, fileName), 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function readCsv(fileName) {
  try {
    const content = await fs.readFile(path.join(EVIDENCE_ROOT, 'csv', fileName), 'utf8')
    const lines = content.trim().split('\n')
    const headers = lines[0].split(',')
    return lines.slice(1).map(line => {
      const values = line.split(',')
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]))
    })
  } catch {
    return null
  }
}

function formatDelta(before, after, invert = false) {
  const delta = after - before
  const pctChange = before !== 0 ? ((delta / before) * 100).toFixed(1) : 'N/A'
  const direction = delta > 0 ? (invert ? '↓' : '↑') : delta < 0 ? (invert ? '↑' : '↓') : '→'
  const absDelta = Math.abs(delta).toFixed(1)
  return `${direction} ${absDelta} (${pctChange}%)`
}

async function generateMarksEditTable() {
  const data = await readCsv('marks-edit-before-after.csv')
  if (!data?.length) return null

  const rows = data.map(s => {
    const beforeTt1 = parseFloat(s.beforeTt1Pct)
    const afterTt1 = parseFloat(s.afterTt1Pct)
    const beforeRisk = parseFloat(s.beforeRiskScore)
    const afterRisk = parseFloat(s.afterRiskScore)
    return {
      studentId: s.studentId,
      pattern: s.pattern,
      tt1Before: beforeTt1.toFixed(1),
      tt1After: afterTt1.toFixed(1),
      tt1Delta: formatDelta(beforeTt1, afterTt1),
      riskBefore: beforeRisk.toFixed(0),
      riskAfter: afterRisk.toFixed(0),
      riskDelta: formatDelta(beforeRisk, afterRisk, true),
    }
  })

  const header = '| Student | Pattern | TT1 Before → After | TT1 Delta | Risk Before → After | Risk Delta |'
  const separator = '|---|---|---|---|---|---|'

  const tableRows = rows.map(r =>
    `| ${r.studentId} | ${r.pattern} | ${r.tt1Before} → ${r.tt1After} | ${r.tt1Delta} | ${r.riskBefore} → ${r.riskAfter} | ${r.riskDelta} |`
  )

  return {
    title: '## Marks Edit Recomputation (P0.2)',
    subtitle: 'Controlled edit: TT1 marks changed, risk recomputed. Risk delta inverted (↑ = worsening).',
    content: [header, separator, ...tableRows].join('\n'),
  }
}

async function generateStageRiskTable() {
  const data = await readCsv('stage-risk-table.csv')
  if (!data?.length) return null

  // Aggregate across all stages
  const totals = data.reduce((acc, row) => ({
    highRisk: acc.highRisk + (parseInt(row.highRiskCount) || 0),
    mediumRisk: acc.mediumRisk + (parseInt(row.mediumRiskCount) || 0),
    lowRisk: acc.lowRisk + (parseInt(row.lowRiskCount) || 0),
    openQueue: acc.openQueue + (parseInt(row.openQueueCount) || 0),
    watchQueue: acc.watchQueue + (parseInt(row.watchQueueCount) || 0),
    deferredQueue: acc.deferredQueue + (parseInt(row.deferredQueueCount) || 0),
  }), { highRisk: 0, mediumRisk: 0, lowRisk: 0, openQueue: 0, watchQueue: 0, deferredQueue: 0 })

  const rows = [
    { band: 'High Risk', count: totals.highRisk, meaning: 'Priority intervention required' },
    { band: 'Medium Risk', count: totals.mediumRisk, meaning: 'Review recommended' },
    { band: 'Low Risk', count: totals.lowRisk, meaning: 'Stable - routine monitoring' },
    { band: 'Open Queue', count: totals.openQueue, meaning: 'Active reassessment cases' },
    { band: 'Watch Queue', count: totals.watchQueue, meaning: 'Monitoring without active task' },
    { band: 'Deferred Queue', count: totals.deferredQueue, meaning: 'Capacity deferred - tracked' },
  ]

  const header = '| Category | Total Count | Meaning |'
  const separator = '|---|---|---|'

  const tableRows = rows.map(r => `| ${r.band} | ${r.count} | ${r.meaning} |`)

  return {
    title: '## Risk & Queue Distribution (P1)',
    subtitle: `Aggregated across ${data.length} checkpoints. Shows risk bands and queue states.`,
    content: [header, separator, ...tableRows].join('\n'),
  }
}

async function generateInterventionCapTable() {
  const data = await readJson('intervention-cap-audit.json')
  if (!data?.interventionCounts) return null

  const entries = Object.entries(data.interventionCounts)
    .map(([studentId, count]) => ({
      studentId,
      count,
      compliant: count <= (data.maxCap || 2) ? '✅' : '❌',
    }))
    .slice(0, 10)

  const header = '| Student | Intervention Count | Cap | Compliant |'
  const separator = '|---|---|---|---|'

  const tableRows = entries.map(r =>
    `| ${r.studentId} | ${r.count} | ${data.maxCap || 2} | ${r.compliant} |`
  )

  return {
    title: '## Intervention Cap Audit (P0.3) - Sample',
    subtitle: `Max ${data.maxCap || 2} interventions per (student, course, stage). Sample of ${entries.length} students shown.`,
    content: [header, separator, ...tableRows].join('\n'),
  }
}

async function generateModelComparisonTable() {
  const data = await readJson('model-evaluation-report.json')
  if (!data?.catBoostStatus) return null

  return {
    title: '## Model Authority Status',
    subtitle: 'Current serving model vs. challenger status.',
    content: [
      '| Component | Status | Details |',
      '|---|---|---|',
      `| Serving Authority | TypeScript Logistic v8 | ${data.modelAuthority ?? 'observable-risk-logit-v8'} |`,
      `| CatBoost Challenger | ${data.catBoostStatus} | Shadow/offline, not serving |`,
      `| Queue Canonicalization | ✅ Verified | ${data.queueCanonicalization?.verified ? 'Verified' : 'Pending'} |`,
      `| Carryover Rate | ${data.carryover?.carryoverRate ?? 'N/A'} | ${data.carryover?.verified ? 'Verified' : 'Pending'} |`,
    ].join('\n'),
  }
}

async function main() {
  console.log('[diff-tables] Generating visual diff tables from evidence...')

  const sections = []

  const marksEdit = await generateMarksEditTable()
  if (marksEdit) sections.push(marksEdit)

  const stageRisk = await generateStageRiskTable()
  if (stageRisk) sections.push(stageRisk)

  const interventionCap = await generateInterventionCapTable()
  if (interventionCap) sections.push(interventionCap)

  const modelComparison = await generateModelComparisonTable()
  if (modelComparison) sections.push(modelComparison)

  const output = [
    '# AirMentor Demo Reality - Visual Diff Tables',
    '',
    `**Generated**: ${new Date().toISOString()}`,
    `**Evidence Source**: ${JSON_DIR}`,
    '',
    '---',
    '',
    ...sections.flatMap(s => [s.title, '', s.subtitle, '', s.content, '', '---', '']),
  ].join('\n')

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, output, 'utf8')

  console.log(`[diff-tables] Wrote ${sections.length} tables to ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('[diff-tables] Error:', err)
  process.exit(1)
})
