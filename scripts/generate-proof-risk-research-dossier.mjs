import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const historicalRoot = '/home/raed/Archives/airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive'
const archiveRoot = '/home/raed/Archives'
const outputPath = path.join(repoRoot, 'docs/PROOF_RISK_RESEARCH_DOSSIER_2026-06-06.md')
const evalReportPath = path.join(historicalRoot, 'pre-coverage33-20260601/evaluation-report.json')
const contractBundlePath = path.join(repoRoot, 'air-mentor-api/model-contract/proof-risk-model/risk-model-bundle.json')
const contractDecisionPath = path.join(repoRoot, 'air-mentor-api/model-contract/proof-risk-model/promotion-decision.json')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function rel(filePath) {
  if (filePath.startsWith(repoRoot)) return path.relative(repoRoot, filePath)
  if (filePath.startsWith('/home/raed/Archives')) return path.relative('/home/raed/Archives', filePath)
  return filePath
}

function walk(root, predicate, files = []) {
  if (!existsSync(root)) return files
  for (const entry of readdirSync(root)) {
    const filePath = path.join(root, entry)
    let info
    try {
      info = lstatSync(filePath)
    } catch {
      continue
    }
    if (info.isSymbolicLink()) continue
    if (info.isDirectory()) walk(filePath, predicate, files)
    else if (!predicate || predicate(filePath)) files.push(filePath)
  }
  return files
}

function fmt(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
  }
  return String(value)
}

function pct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return `${(Number(value) * 100).toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}%`
}

function metric(source, keys) {
  if (!source) return undefined
  for (const key of keys) {
    if (source[key] !== undefined) return source[key]
  }
  return undefined
}

function compactMetricCells(m) {
  return [
    fmt(metric(m, ['rocAuc'])),
    fmt(metric(m, ['averagePrecision', 'prAuc'])),
    fmt(metric(m, ['brier', 'brierScore'])),
    fmt(metric(m, ['logLoss'])),
    fmt(metric(m, ['expectedCalibrationError', 'globalEce'])),
    fmt(metric(m, ['precisionAt50'])),
    fmt(metric(m, ['recallAt50'])),
    fmt(metric(m, ['overloadRatio'])),
  ]
}

function table(headers, rows) {
  const safe = value => String(value ?? '').replace(/\n/g, '<br>').replace(/\|/g, '\\|')
  const separator = headers.map(() => '---')
  return [
    `| ${headers.map(safe).join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map(row => `| ${row.map(safe).join(' | ')} |`),
  ].join('\n')
}

function section(title) {
  return `\n## ${title}\n`
}

function stageOrder(stageKey) {
  return {
    'pre-tt1': 1,
    'post-tt1': 2,
    'post-tt2': 3,
    'post-assignments': 4,
    'post-see': 5,
  }[stageKey] ?? 99
}

function summarizeDecision(decision) {
  if (!decision) return ''
  const blocked = Array.isArray(decision.blockedHeads) ? decision.blockedHeads.length : 0
  const promoted = Array.isArray(decision.promotableHeads) ? decision.promotableHeads.length : 0
  return `${decision.decision ?? ''}; promotable=${promoted}; blocked=${blocked}`
}

function readMetricsRuns() {
  const historicalMetrics = walk(historicalRoot, file => path.basename(file) === 'metrics.json')
    .filter(file => file.includes('/old-benchmark-runs/'))
    .sort()
  const currentMetrics = path.join(repoRoot, 'air-mentor-api/output/proof-risk-model/metrics.json')
  const files = existsSync(currentMetrics) ? [...historicalMetrics, currentMetrics] : historicalMetrics
  return files.map(file => {
    const json = readJson(file)
    const runName = file === currentMetrics
      ? 'current-local-runtime-output'
      : path.relative(path.join(historicalRoot, 'old-benchmark-runs'), path.dirname(file))
    return { file, runName, json }
  })
}

function headMetricRows(metricsRuns) {
  const rows = []
  for (const run of metricsRuns) {
    const heads = run.json.heads ?? {}
    for (const head of Object.keys(heads).sort()) {
      const entry = heads[head]
      const baseline = entry.baseline?.test ?? entry.baseline
      const challenger = entry.challenger?.test ?? entry.challenger
      rows.push([
        run.runName,
        head,
        entry.selectedModel ?? '',
        entry.headPromotable === undefined ? '' : String(entry.headPromotable),
        ...(compactMetricCells(baseline)),
        ...(compactMetricCells(challenger)),
        Array.isArray(entry.blockedReasons) ? entry.blockedReasons.join('; ') : '',
      ])
    }
  }
  return rows
}

function currentContractRows(bundle) {
  const heads = bundle.production?.heads ?? {}
  return Object.keys(heads).sort().map(head => {
    const entry = heads[head]
    const m = entry.metrics ?? {}
    const s = entry.support ?? {}
    return [
      head,
      bundle.production?.modelFamily ?? '',
      bundle.production?.modelVersion ?? '',
      s.testSupport ?? m.support ?? '',
      s.testPositives ?? '',
      pct(m.positiveRate),
      fmt(m.rocAuc),
      fmt(m.averagePrecision),
      fmt(m.brierScore),
      fmt(m.logLoss),
      fmt(m.expectedCalibrationError),
      entry.calibration?.displayProbabilityAllowed === undefined ? '' : String(entry.calibration.displayProbabilityAllowed),
    ]
  })
}

function challengerContractRows(bundle) {
  const heads = bundle.challenger?.heads ?? {}
  return Object.keys(heads).sort().map(head => {
    const entry = heads[head]
    const m = entry.metrics ?? {}
    return [
      head,
      bundle.challenger?.modelFamily ?? '',
      bundle.challenger?.modelVersion ?? '',
      fmt(m.rocAuc),
      fmt(m.averagePrecision),
      fmt(m.brierScore),
      fmt(m.logLoss),
      fmt(m.expectedCalibrationError),
      entry.calibration?.displayProbabilityAllowed === undefined ? '' : String(entry.calibration.displayProbabilityAllowed),
    ]
  })
}

function runInventoryRows(metricsRuns) {
  return metricsRuns.map(run => {
    const j = run.json
    return [
      run.runName,
      j.generatedAt ?? '',
      j.trainingProtocol ?? '',
      j.featureSchema?.featureCount ?? '',
      j.featureSchema?.featureKeyHash ?? '',
      Array.isArray(j.trainFamilies) ? j.trainFamilies.join(', ') : '',
      Array.isArray(j.testFamilies) ? j.testFamilies.join(', ') : '',
      j.featuresCsvSha256 ?? '',
      summarizeDecision(j.promotion),
      rel(run.file),
    ]
  })
}

function headToHeadRows() {
  return walk(historicalRoot, file => path.basename(file) === 'head-to-head.json')
    .sort()
    .map(file => {
      const json = readJson(file)
      const runName = path.basename(path.dirname(file))
      const overall = json.heads?.overallCourseRisk
      const baseline = overall?.baseline
      const challenger = overall?.challenger
      const promoted = Object.values(json.heads ?? {}).filter(head => head.headPromotable).length
      return [
        runName,
        json.generatedAt ?? '',
        json.seed ?? '',
        json.promotion?.decision ?? '',
        `${promoted}/5`,
        fmt(baseline?.rocAuc),
        fmt(challenger?.rocAuc),
        fmt(baseline?.prAuc),
        fmt(challenger?.prAuc),
        fmt(baseline?.brier),
        fmt(challenger?.brier),
        fmt(baseline?.globalEce),
        fmt(challenger?.globalEce),
        fmt(baseline?.overloadRatio),
        fmt(challenger?.overloadRatio),
        rel(file),
      ]
    })
}

function checkpointRows(report) {
  return (report.stageRollups ?? [])
    .slice()
    .sort((a, b) => (a.semesterNumber - b.semesterNumber) || (a.stageOrder - b.stageOrder))
    .map(row => [
      row.semesterNumber,
      row.stageKey,
      row.uniqueStudentCount,
      row.projectionCount,
      row.highRiskStudentCount,
      row.highRiskProjectionCount,
      row.mediumRiskProjectionCount,
      fmt(row.averageRiskProbScaled, 1),
      row.openQueueStudentCount,
      row.openQueueProjectionCount,
      row.watchStudentCount,
      row.deferredWatchStudentCount,
      fmt(row.averageCounterfactualLiftScaled, 1),
    ])
}

function runtimeByStageRows(summaryByStage) {
  return Object.keys(summaryByStage ?? {})
    .sort((a, b) => stageOrder(a) - stageOrder(b))
    .map(stage => {
      const model = summaryByStage[stage].model ?? {}
      const heuristic = summaryByStage[stage].heuristic ?? {}
      return [
        stage,
        model.support ?? '',
        pct(model.positiveRate),
        fmt(model.rocAuc),
        fmt(heuristic.rocAuc),
        fmt(model.averagePrecision),
        fmt(heuristic.averagePrecision),
        fmt(model.brier),
        fmt(heuristic.brier),
        fmt(model.expectedCalibrationError),
        fmt(heuristic.expectedCalibrationError),
        pct(model.highThreshold?.precision),
        pct(model.highThreshold?.recall),
        pct(model.mediumThreshold?.flaggedRate),
        fmt(summaryByStage[stage].aucLift),
        fmt(summaryByStage[stage].brierLift),
      ]
    })
}

function variantBySemesterRows(summaryBySemester) {
  return Object.keys(summaryBySemester ?? {})
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')))
    .map(sem => {
      const item = summaryBySemester[sem]
      const current = item.current ?? {}
      const baseline = item.baseline ?? {}
      const challenger = item.challenger ?? {}
      const heuristic = item.heuristic ?? {}
      const vsHeuristic = item.currentVsHeuristic ?? {}
      const vsChallenger = item.currentVsChallenger ?? {}
      return [
        sem,
        current.support ?? '',
        pct(current.positiveRate),
        fmt(current.rocAuc),
        fmt(baseline.rocAuc),
        fmt(challenger.rocAuc),
        fmt(heuristic.rocAuc),
        fmt(current.averagePrecision),
        fmt(baseline.averagePrecision),
        fmt(challenger.averagePrecision),
        fmt(heuristic.averagePrecision),
        fmt(current.brier),
        fmt(current.expectedCalibrationError),
        fmt(vsHeuristic.aucLift),
        fmt(vsHeuristic.averagePrecisionLift),
        fmt(vsChallenger.aucLift),
      ]
    })
}

function variantByStageRows(summaryByStage) {
  return Object.keys(summaryByStage ?? {})
    .sort((a, b) => stageOrder(a) - stageOrder(b))
    .map(stage => {
      const item = summaryByStage[stage]
      const current = item.current ?? {}
      const baseline = item.baseline ?? {}
      const challenger = item.challenger ?? {}
      const hybrid = item.hybrid ?? {}
      const heuristic = item.heuristic ?? {}
      return [
        stage,
        current.support ?? '',
        pct(current.positiveRate),
        fmt(current.rocAuc),
        fmt(baseline.rocAuc),
        fmt(challenger.rocAuc),
        fmt(hybrid.rocAuc),
        fmt(heuristic.rocAuc),
        fmt(current.averagePrecision),
        fmt(baseline.averagePrecision),
        fmt(challenger.averagePrecision),
        fmt(hybrid.averagePrecision),
        fmt(heuristic.averagePrecision),
        fmt(current.brier),
        fmt(current.expectedCalibrationError),
      ]
    })
}

function corpusRowsFromReport(report) {
  const c = report.corpus ?? {}
  const positives = c.positiveCountsByHeadBySplit ?? {}
  return Object.keys(positives).sort().map(head => [
    head,
    c.splitSummary?.train ?? '',
    positives[head].train ?? '',
    c.splitSummary?.validation ?? '',
    positives[head].validation ?? '',
    c.splitSummary?.test ?? '',
    positives[head].test ?? '',
  ])
}

function archivedCorpusLedgerRows() {
  return [
    [
      'Root features.csv',
      'air-mentor-api/output/proof-risk-model/features.csv',
      '2,024,000',
      '71',
      'fc28d65c87b6ea1b468cda6424cbbea6c9e3f72c4c3851342c2f7c17f3e9bafc',
      'Largest early feature corpus; keep only in the external training-corpora vault.',
    ],
    [
      'features_v3_fixed.csv',
      'air-mentor-api/output/proof-risk-model/features_v3_fixed.csv',
      '607,200',
      '71',
      '6e19c0e54c4a9e8759eb4e316b67ee5158dfd24d956aa6ac3d5948259d949b68',
      'Fixed v3 corpus lineage used for historical SOTA-style training comparisons.',
    ],
    [
      'features_v3_realistic.csv',
      'air-mentor-api/output/proof-risk-model/features_v3_realistic.csv',
      '1,012,000',
      '61',
      '94199c0a9c8d06eda1e8216d4d3bcffa502faa7db228ba8fb4979ffdaa1a2b82',
      'Realism-oriented v3 feature set with fewer columns and more scenario volume.',
    ],
    [
      'May 31 promoted benchmark',
      'air-mentor-api/output/proof-risk-model/sota-policy-benchmark-20260531T000827Z/features.csv',
      '607,200',
      '71',
      'fe927deecbb74151a393b43b5411a418531f908ffd246f52da63c4538d70db46',
      'Promoted benchmark corpus from the late-May model tournament phase.',
    ],
    [
      'June 2 completed benchmark',
      'air-mentor-api/output/proof-risk-model/sota-policy-benchmark-20260602T215646Z/features.csv',
      '607,200',
      '71',
      'ccab092e01484c157e8d86fcf4d4b13d73eb97da2bbc8e42f7f74a86248f46cc',
      'Completed benchmark corpus tied to the later proof-readiness evidence pass.',
    ],
    [
      'Full v6 contract corpus',
      'air-mentor-api/output/proof-risk-model/full-v6-contract-current/features.csv',
      '441,600',
      '58',
      '8719183588241ab25bae0686c0874b16e27493b8125dc1fc6cae69b04e9d20df',
      'Current compact contract corpus; current and baseline v6 feature CSVs are byte-identical.',
    ],
  ]
}

function archiveSourceTable() {
  return [
    ['Current serving contract', rel(contractBundlePath), 'Tracked 53 KiB runtime bundle used by fresh clones.'],
    ['Current promotion decision', rel(contractDecisionPath), 'Governed decision that keeps CatBoost shadow-only and serves logistic.'],
    ['Historical model archive', 'airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive', '31 GiB extracted cold archive; source inventory says 32,861,115,170 bytes across 4,064 files.'],
    ['Runtime model vault', 'airmentor-model-vault/2026-06-06/airmentor-model-vault-2026-06-06.tar.zst', '26 MiB compressed archive with 129 selected serving/research files.'],
    ['Training corpora vault', 'airmentor-training-corpora/2026-06-06/airmentor-training-corpora-2026-06-06.tar.zst', '225 MiB compressed archive of distinct training corpora.'],
    ['Coverage evaluation report', rel(evalReportPath), 'Primary 30-checkpoint and stage/semester metric source.'],
  ]
}

function buildDocument() {
  const report = readJson(evalReportPath)
  const bundle = readJson(contractBundlePath)
  const decision = readJson(contractDecisionPath)
  const metricsRuns = readMetricsRuns()
  const h2hRows = headToHeadRows()
  const corpus = report.corpus ?? {}
  const gate = report.acceptanceGateSummary ?? {}
  const runtime = report.overallCourseRuntimeSummary ?? {}

  const lines = []
  lines.push('# AirMentor Proof Risk Research Dossier')
  lines.push('')
  lines.push('**Generated:** 2026-06-06')
  lines.push('**Scope:** Historical proof-risk model research, current governed serving contract, synthetic corpus provenance, and stage/checkpoint behavior from Semester 1 through Semester 6.')
  lines.push('')
  lines.push('## Executive Finding')
  lines.push('')
  lines.push('The research history shows a progression from experimental CatBoost and SOTA model-family tournaments toward a governed, deterministic runtime contract. The current product should treat the model work as evidence governance for a synthetic decision-rehearsal platform, not as a claim of real-student predictive validity.')
  lines.push('')
  lines.push('The most defensible current contract is the logistic serving path backed by the tracked bundle and promotion decision. The CatBoost/depth-2-tree challenger has strong calibration on several heads, but the promotion gate keeps it in shadow because several heads worsen local calibration or overload. That is a good product decision: the demo needs stable, explainable, stage-aware behavior more than leaderboard movement.')
  lines.push('')
  lines.push('Important claim boundary: every metric below is based on synthetic proof-run data and governed simulation evidence. It supports deterministic rehearsal and model-governance claims. It does not support real-student production prediction without a governed data partnership and a new validation protocol.')
  lines.push('')

  lines.push(section('Evidence Sources'))
  lines.push(table(['Source', 'Path', 'Use in this dossier'], archiveSourceTable()))

  lines.push(section('Current Runtime Contract'))
  lines.push(`The tracked bundle declares production model version \`${bundle.production?.modelVersion ?? ''}\` with feature schema \`${bundle.production?.featureSchemaVersion ?? ''}\`. Its raw family label is \`${bundle.production?.modelFamily ?? ''}\`, but the adjacent promotion decision is \`${decision.decision}\`; runtime seeding resolves this to the logistic serving contract and keeps the tree challenger in shadow.`)
  lines.push('')
  lines.push(`Training manifest: \`${bundle.production?.trainingManifestVersion ?? ''}\`; trained at \`${bundle.production?.trainedAt ?? ''}\`; split summary train/validation/test = ${fmt(bundle.production?.splitSummary?.train)}/${fmt(bundle.production?.splitSummary?.validation)}/${fmt(bundle.production?.splitSummary?.test)} rows.`)
  lines.push('')
  lines.push(table(
    ['Head', 'Family label', 'Version', 'Test support', 'Test positives', 'Positive rate', 'ROC AUC', 'Avg precision', 'Brier', 'Log loss', 'ECE', 'Display probability allowed'],
    currentContractRows(bundle),
  ))
  lines.push('')
  lines.push('### Shadow Challenger Contract')
  lines.push('')
  lines.push(table(
    ['Head', 'Family', 'Version', 'ROC AUC', 'Avg precision', 'Brier', 'Log loss', 'ECE', 'Display probability allowed'],
    challengerContractRows(bundle),
  ))
  lines.push('')
  lines.push('### Promotion Gate')
  lines.push('')
  lines.push(`Decision: \`${decision.decision}\`.`)
  lines.push('')
  lines.push(`Promotable heads: ${(decision.promotableHeads ?? []).join(', ') || 'none'}.`)
  lines.push('')
  lines.push(`Blocked heads: ${(decision.blockedHeads ?? []).join(', ') || 'none'}.`)
  lines.push('')
  lines.push(table(
    ['Blocked head', 'Reasons'],
    Object.entries(decision.blockedReasonsByHead ?? {}).map(([head, reasons]) => [head, Array.isArray(reasons) ? reasons.join('<br>') : String(reasons)]),
  ))

  lines.push(section('What The Current Model Was Trained On'))
  lines.push(`The coverage report corpus is \`${corpus.manifestVersion ?? ''}\` with ${fmt(corpus.totalStageEvidenceRows)} total stage-evidence rows, ${fmt(corpus.totalTestRows)} test rows, and ${fmt(corpus.sourceRunCount)} source runs. The complete governed runs each span ${fmt(corpus.completenessGate?.stageCountPerSemester)} stages per semester and 30 expected checkpoints.`)
  lines.push('')
  lines.push(`Rows by semester: ${Object.entries(corpus.rowsBySemester ?? {}).map(([k, v]) => `Sem ${k}: ${v}`).join('; ')}.`)
  lines.push('')
  lines.push(`Rows by stage: ${Object.entries(corpus.rowsByStage ?? {}).map(([k, v]) => `${k}: ${v}`).join('; ')}.`)
  lines.push('')
  lines.push(`Scenario-family rows: ${Object.entries(corpus.rowsByScenarioFamily ?? {}).map(([k, v]) => `${k}: ${v}`).join('; ')}.`)
  lines.push('')
  lines.push(table(
    ['Risk head', 'Train rows', 'Train positives', 'Validation rows', 'Validation positives', 'Test rows', 'Test positives'],
    corpusRowsFromReport(report),
  ))
  lines.push('')
  lines.push('Completeness gate notes: one duplicate/incomplete governed seed was skipped from complete checkpoint evidence; three complete runs contributed 30 checkpoints and 21,600 stage-evidence rows each.')
  lines.push('')
  lines.push('### Archived Corpus Ledger')
  lines.push('')
  lines.push('These six corpus identities are the retraining archaeology worth preserving outside Git. They are not all active runtime inputs; they explain how the historical approaches evolved and provide checksum anchors if a past run ever has to be reconstructed.')
  lines.push('')
  lines.push(table(
    ['Corpus', 'Archived path', 'Rows', 'Columns', 'SHA-256', 'Why it matters'],
    archivedCorpusLedgerRows(),
  ))

  lines.push(section('Acceptance And Product Readiness Gates'))
  lines.push(table(
    ['Gate area', 'Result'],
    [
      ['Policy', Object.entries(gate.policy ?? {}).map(([k, v]) => `${k}=${v}`).join('<br>')],
      ['CO evidence', Object.entries(gate.coEvidence ?? {}).map(([k, v]) => `${k}=${v}`).join('<br>')],
      ['Queue burden', Object.entries(gate.queueBurden ?? {}).map(([k, v]) => `${k}=${v}`).join('<br>')],
    ],
  ))

  lines.push(section('Overall Runtime Accuracy Against Heuristic'))
  lines.push(table(
    ['Variant', 'Support', 'Positive rate', 'ROC AUC', 'Avg precision', 'Brier', 'Log loss', 'ECE', 'Medium precision', 'Medium recall', 'High precision', 'High recall', 'High FPR'],
    ['model', 'heuristic'].map(name => {
      const m = runtime[name] ?? {}
      return [
        name,
        m.support ?? '',
        pct(m.positiveRate),
        fmt(m.rocAuc),
        fmt(m.averagePrecision),
        fmt(m.brier),
        fmt(m.logLoss),
        fmt(m.expectedCalibrationError),
        pct(m.mediumThreshold?.precision),
        pct(m.mediumThreshold?.recall),
        pct(m.highThreshold?.precision),
        pct(m.highThreshold?.recall),
        pct(m.highThreshold?.falsePositiveRate),
      ]
    }),
  ))
  lines.push('')
  lines.push(`Overall lift: Brier +${fmt(runtime.brierLift)}, ROC AUC +${fmt(runtime.aucLift)} versus the heuristic baseline. The largest practical improvement is queue discipline: the model flags fewer medium-risk cases while preserving useful recall.`)

  lines.push(section('Accuracy By Stage'))
  lines.push(table(
    ['Stage', 'Support', 'Positive rate', 'Model AUC', 'Heuristic AUC', 'Model AP', 'Heuristic AP', 'Model Brier', 'Heuristic Brier', 'Model ECE', 'Heuristic ECE', 'High precision', 'High recall', 'Medium flagged', 'AUC lift', 'Brier lift'],
    runtimeByStageRows(report.overallCourseRuntimeSummaryByStage),
  ))

  lines.push(section('Accuracy By Semester'))
  lines.push(table(
    ['Semester', 'Support', 'Positive rate', 'Current AUC', 'Baseline AUC', 'Challenger AUC', 'Heuristic AUC', 'Current AP', 'Baseline AP', 'Challenger AP', 'Heuristic AP', 'Current Brier', 'Current ECE', 'AUC lift vs heuristic', 'AP lift vs heuristic', 'AUC lift vs challenger'],
    variantBySemesterRows(report.overallCourseVariantSummaryBySemester),
  ))

  lines.push(section('Variant Comparison By Stage'))
  lines.push(table(
    ['Stage', 'Support', 'Positive rate', 'Current AUC', 'Baseline AUC', 'Challenger AUC', 'Hybrid AUC', 'Heuristic AUC', 'Current AP', 'Baseline AP', 'Challenger AP', 'Hybrid AP', 'Heuristic AP', 'Current Brier', 'Current ECE'],
    variantByStageRows(report.overallCourseVariantSummaryByStage),
  ))

  lines.push(section('Semester 1 Through Semester 6 Demo Checkpoint Rollups'))
  lines.push('Each row below is a staged proof checkpoint: five stages per semester, six semesters, 30 checkpoints total. `Projection count` is course/offering-level risk projection volume; `students` is the unique student count visible in the checkpoint rollup.')
  lines.push('')
  lines.push(table(
    ['Semester', 'Stage', 'Students', 'Projection count', 'High-risk students', 'High-risk projections', 'Medium-risk projections', 'Avg risk scaled', 'Open queue students', 'Open queue projections', 'Watch students', 'Deferred watch students', 'Avg counterfactual lift'],
    checkpointRows(report),
  ))

  lines.push(section('Historical Metrics Run Inventory'))
  lines.push(table(
    ['Run', 'Generated', 'Protocol', 'Feature count', 'Feature hash', 'Train families', 'Test families', 'Feature CSV SHA', 'Promotion summary', 'Source'],
    runInventoryRows(metricsRuns),
  ))

  lines.push(section('Historical Per-Head Accuracy Tables'))
  lines.push('Columns prefixed with `B` are the baseline model in that run; columns prefixed with `C` are the challenger or selected challenger comparison recorded by that run. Metrics are test-split metrics where the artifact provided them.')
  lines.push('')
  lines.push(table(
    ['Run', 'Head', 'Selected model', 'Promotable', 'B AUC', 'B AP', 'B Brier', 'B LogLoss', 'B ECE', 'B P@50', 'B R@50', 'B overload', 'C AUC', 'C AP', 'C Brier', 'C LogLoss', 'C ECE', 'C P@50', 'C R@50', 'C overload', 'Blocked reasons'],
    headMetricRows(metricsRuns),
  ))

  lines.push(section('CatBoost Challenger Head-To-Head History'))
  lines.push('These are the repeated local CatBoost challenger runs from the early research sediment. The table reports the overall-course head because it is the clearest proxy for the product-facing risk card; the per-head JSON files remain in the archive.')
  lines.push('')
  lines.push(table(
    ['Run', 'Generated', 'Seed', 'Decision', 'Promoted heads', 'Baseline AUC', 'Challenger AUC', 'Baseline PR AUC', 'Challenger PR AUC', 'Baseline Brier', 'Challenger Brier', 'Baseline ECE', 'Challenger ECE', 'Baseline overload', 'Challenger overload', 'Source'],
    h2hRows,
  ))

  lines.push(section('Chronology Of Approaches'))
  lines.push('1. Early local CatBoost challenger runs explored whether heavy tree models could beat the observable logistic baseline on the five risk heads. Many runs produced head-to-head JSON plus `.cbm` binaries, but the value today is the comparison evidence, not the repeated binaries.')
  lines.push('')
  lines.push('2. `v2-training` and some early SOTA runs produced extremely high metrics on several heads. Those results are useful historically, but they are less credible as product evidence because near-perfect synthetic metrics are a warning sign for easy splits, overly aligned synthetic labels, or leakage-prone feature/label construction.')
  lines.push('')
  lines.push('3. The `sota-fixed`, `sota-ensemble`, and dated `sota-run-*` artifacts moved toward governed promotion gates: ranking, proper scoring, local calibration, overload, replayability, feature schema, and corpus admissibility.')
  lines.push('')
  lines.push('4. The later coverage report reframed the model around stage-aware operation: 30 proof checkpoints, role-visible playback, queue burden, policy diagnostics, CO evidence, and stage/semester variant comparisons.')
  lines.push('')
  lines.push('5. The current tracked contract keeps the runtime small and explainable. It preserves the shadow challenger result while avoiding automatic promotion.')

  lines.push(section('Critical Findings'))
  lines.push('- The strongest model lift appears after evidence has accumulated, especially at post-SEE, where the model materially reduces queue overload and false positives compared with the heuristic.')
  lines.push('- Pre-TT1 is the hardest stage. The model can rank early risk, but early-stage calibration and precision are naturally weaker because the simulator has less observed assessment evidence.')
  lines.push('- Attendance risk is highly separable in several runs. CE and SEE risk are more sensitive to stage evidence and calibration, so they should stay governed by local ECE and overload gates.')
  lines.push('- CatBoost/depth-2-tree challengers can look attractive on ROC AUC and calibration for some heads, but the product gate correctly blocks promotion when local calibration or overload worsens on operationally important heads.')
  lines.push('- The real product asset is not the best historical leaderboard score. It is the combination of reproducible seed/corpus lineage, stage-aware risk, cross-role checkpoint parity, queue-aware thresholds, and a promotion decision that does not overclaim.')

  lines.push(section('Retention Verdict'))
  lines.push('Keep the tracked contract, the selected model vault, the distinct corpora, and this dossier. Keep the 31 GiB historical model archive only as cold storage until the archive is uploaded to a durable external bucket. Do not copy it back into Git.')
  lines.push('')
  lines.push('The most valuable files inside the sediment are `metrics.json`, `promotion-decision.json`, `evaluation-report.json`, `risk-model-bundle*.json`, `synthetic-quality.json`, `manifest.json`, and the final selected model sidecars. Repeated `.cbm`, LightGBM, XGBoost, and per-run scratch binaries are useful only if they are tied to one of those decision records.')

  lines.push(section('Reproducibility Pointers'))
  lines.push(table(
    ['Purpose', 'Pointer'],
    [
      ['Regenerate this dossier', 'node scripts/generate-proof-risk-research-dossier.mjs'],
      ['Serving bundle', rel(contractBundlePath)],
      ['Serving promotion decision', rel(contractDecisionPath)],
      ['Primary coverage report', rel(evalReportPath)],
      ['Model vault checksum', 'airmentor-model-vault/2026-06-06/airmentor-model-vault-2026-06-06.tar.zst.sha256'],
      ['Training corpus checksum set', 'airmentor-training-corpora/2026-06-06/FILES.sha256'],
      ['Historical model inventory', 'airmentor-historical-model-runs/2026-06-06/SOURCE-INVENTORY.txt'],
    ],
  ))

  return `${lines.join('\n')}\n`
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, buildDocument(), 'utf8')
console.log(outputPath)
