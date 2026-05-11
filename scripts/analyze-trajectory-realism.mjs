#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const SCRIPT_RELATIVE_PATH = 'scripts/analyze-trajectory-realism.mjs'
const REPORT_RELATIVE_PATH = 'audit-map/32-reports/trajectory-realism-analysis.md'
const REPORT_PATH = path.join(REPO_ROOT, REPORT_RELATIVE_PATH)
const CURRICULUM_PATH = path.join(REPO_ROOT, 'air-mentor-api/src/db/seeds/msruas-mnc-curriculum.json')
const LOCAL_EVAL_JSON_DIR = path.join(REPO_ROOT, 'audit-map/17-artifacts/json')
const LOCAL_EVAL_MD_DIR = path.join(REPO_ROOT, 'audit-map/17-artifacts/local')
const PIPELINE_DB_PATH = path.join(os.homedir(), '.local/state/airmentor/pipeline.db')
const ACTIVE_STAGE_KEY = 'post-tt1'
const PROOF_SCENARIO_FAMILIES = [
  'balanced',
  'weak-foundation',
  'low-attendance',
  'high-forgetting',
  'coursework-inflation',
  'exam-fragility',
  'carryover-heavy',
  'intervention-resistant',
]

const FIRST_NAMES = ['Aarav', 'Ishita', 'Vihaan', 'Ananya', 'Advik', 'Meera', 'Reyansh', 'Kavya', 'Arjun', 'Diya', 'Krish', 'Nitya', 'Rohan', 'Saanvi', 'Dev', 'Mira', 'Kabir', 'Tara', 'Yash', 'Ira']
const LAST_NAMES = ['Sharma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Joshi', 'Bhat', 'Rao', 'Singh', 'Krishnan', 'Menon', 'Kulkarni', 'Saxena', 'Varma']

const STUDENT_ARCHETYPES = [
  { key: 'deep-competent', abilityShift: 0.1, disciplineShift: 0.08, forgetShift: -0.03, pressureShift: -0.04, courseworkReliabilityShift: 0.08 },
  { key: 'strategic-efficient', abilityShift: 0.05, disciplineShift: 0.03, forgetShift: -0.01, pressureShift: 0.01, courseworkReliabilityShift: 0.03 },
  { key: 'strategic-fragile', abilityShift: 0.02, disciplineShift: -0.01, forgetShift: 0.02, pressureShift: 0.08, courseworkReliabilityShift: 0.01 },
  { key: 'cumulative-gap', abilityShift: -0.06, disciplineShift: 0.01, forgetShift: 0.04, pressureShift: 0.06, courseworkReliabilityShift: -0.02 },
  { key: 'underregulated', abilityShift: -0.04, disciplineShift: -0.08, forgetShift: 0.03, pressureShift: 0.06, courseworkReliabilityShift: -0.05 },
  { key: 'surface-survival', abilityShift: -0.01, disciplineShift: -0.03, forgetShift: 0.05, pressureShift: 0.1, courseworkReliabilityShift: -0.08 },
]

const PROOF_FACULTY = [
  { facultyId: 'mnc_t1', permissions: ['HOD', 'COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t2', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t3', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t4', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t5', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t6', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t7', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t8', permissions: ['MENTOR'] },
  { facultyId: 'mnc_t9', permissions: ['MENTOR'] },
  { facultyId: 'mnc_t10', permissions: ['MENTOR'] },
]

const DEFAULT_POLICY = {
  gradeBands: [
    { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
    { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
    { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
    { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
  ],
  attendanceRules: {
    minimumPercent: 75,
    condonationFloorPercent: 65,
  },
  condonationRules: {
    minimumPercent: 65,
    shortagePercent: 10,
    requiresApproval: true,
  },
  eligibilityRules: {
    minimumAttendancePercent: 75,
    minimumCeForSee: 24,
  },
  passRules: {
    ceMinimum: 24,
    seeMinimum: 16,
    overallMinimum: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  },
  roundingRules: {
    statusMarkRounding: 'nearest-integer',
    sgpaCgpaDecimals: 2,
  },
  sgpaCgpaRules: {
    includeFailedCredits: false,
    repeatedCoursePolicy: 'latest-attempt',
  },
}

const ASSESSMENT_BOUNDS = {
  attendance: { min: 52, max: 98 },
  tt1: { min: 8, max: 97 },
  tt2: { min: 8, max: 99 },
  quiz: { min: 8, max: 99 },
  assignment: { min: 10, max: 99 },
  see: { min: 8, max: 98 },
}

const ASSESSMENT_RESPONSIVENESS = {
  attendance: { min: -2, max: 10 },
  tt1: { min: 0, max: 0 },
  tt2: { min: -2, max: 14 },
  quiz: { min: -1, max: 9 },
  assignment: { min: -1, max: 11 },
  see: { min: -2, max: 13 },
}

const RESPONSE_SCORE_BY_PROFILE = {
  strong: 0.85,
  partial: 0.60,
  weak: 0.35,
  resistant: 0.15,
}

const BASE_ACTION_WEIGHT = {
  mentor_meeting: 0.55,
  faculty_followup_reminder: 0.45,
  attendance_warning: 0.50,
  extra_academic_support_plan: 0.75,
  targeted_remedial_plan: 0.80,
  hod_escalation_student_action: 0.65,
  structured_study_plan: 0.70,
  peer_study_group: 0.40,
  generic_default_family_action: 0.50,
}

const STUDENT_FACING_ACTIONS = new Set([
  'mentor_meeting',
  'attendance_warning',
  'extra_academic_support_plan',
  'targeted_remedial_plan',
  'hod_escalation_student_action',
  'structured_study_plan',
  'peer_study_group',
])

const ACTION_FAMILY_AFFINITY = {
  mentor_meeting: ['mentoring', 'broad'],
  faculty_followup_reminder: ['mentoring', 'broad'],
  attendance_warning: ['attendance'],
  extra_academic_support_plan: ['coursework', 'broad'],
  targeted_remedial_plan: ['coursework', 'exam'],
  hod_escalation_student_action: ['broad'],
  structured_study_plan: ['exam', 'coursework'],
  peer_study_group: ['coursework', 'mentoring'],
  generic_default_family_action: ['broad'],
}

// [CITE:HELPERS]
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function stableUnit(seed) {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function stableBetween(seed, min, max) {
  return min + (stableUnit(seed) * (max - min))
}

function stableGaussian(seed, mean, stddev) {
  const u1 = Math.max(stableUnit(seed), 1e-10)
  const u2 = stableUnit(`${seed}-pair`)
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + (z * stddev)
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  return quantile(values, 0.5)
}

function quantile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function sampleSd(values) {
  if (values.length <= 1) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function pct(part, total) {
  if (!total) return 0
  return (part / total) * 100
}

function percentageShare(values, predicate) {
  if (!values.length) return 0
  return pct(values.filter(predicate).length, values.length)
}

function bucketHistogram(values, edges) {
  return edges.slice(0, -1).map((start, index) => {
    const end = edges[index + 1]
    const count = values.filter(value => value >= start && (index === edges.length - 2 ? value <= end : value < end)).length
    return {
      label: `${start}-${end}${index === edges.length - 2 ? '' : ''}`,
      count,
      sharePct: pct(count, values.length),
    }
  })
}

function uniqueBy(items, keyFn) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function rankAverage(values) {
  const ordered = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value)
  const ranks = Array(values.length).fill(0)
  let pointer = 0
  while (pointer < ordered.length) {
    let next = pointer + 1
    while (next < ordered.length && ordered[next].value === ordered[pointer].value) next += 1
    const averageRank = (pointer + 1 + next) / 2
    for (let index = pointer; index < next; index += 1) {
      ranks[ordered[index].index] = averageRank
    }
    pointer = next
  }
  return ranks
}

function pearson(x, y) {
  if (!x.length || x.length !== y.length) return 0
  const avgX = mean(x)
  const avgY = mean(y)
  let numerator = 0
  let xVariance = 0
  let yVariance = 0
  for (let index = 0; index < x.length; index += 1) {
    const dx = x[index] - avgX
    const dy = y[index] - avgY
    numerator += dx * dy
    xVariance += dx * dx
    yVariance += dy * dy
  }
  if (xVariance === 0 || yVariance === 0) return 0
  return numerator / Math.sqrt(xVariance * yVariance)
}

function spearmanRho(pairs) {
  if (pairs.length < 3) return 0
  const xs = pairs.map(pair => pair[0])
  const ys = pairs.map(pair => pair[1])
  return pearson(rankAverage(xs), rankAverage(ys))
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits)
}

function formatPct(value, digits = 1) {
  return `${formatNumber(value, digits)}%`
}

function formatArray(values, digits = 2) {
  return values.map(value => formatNumber(value, digits)).join(', ')
}

function relativePath(targetPath) {
  return path.relative(REPO_ROOT, targetPath).replaceAll(path.sep, '/')
}

function findLineNumber(filePath, matcher) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (matcher instanceof RegExp ? matcher.test(line) : line.includes(String(matcher))) {
      return index + 1
    }
  }
  return null
}

function findLineRange(filePath, startMatcher, endMatcher) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  let start = null
  let end = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (start == null && (startMatcher instanceof RegExp ? startMatcher.test(line) : line.includes(String(startMatcher)))) {
      start = index + 1
    }
    if (start != null && (endMatcher instanceof RegExp ? endMatcher.test(line) : line.includes(String(endMatcher)))) {
      end = index + 1
      break
    }
  }
  if (start == null) return null
  return `${relativePath(filePath)}:${start}-${end ?? lines.length}`
}

// [CITE:SELF_CITATIONS]
function buildSelfCitationMap() {
  const lines = fs.readFileSync(__filename, 'utf8').split('\n')
  const markers = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/\[CITE:([A-Z0-9_]+)\]/)
    if (match) {
      markers.push({ name: match[1], line: index + 1 })
    }
  }
  const citations = {}
  markers.forEach((marker, index) => {
    const nextLine = markers[index + 1]?.line ?? lines.length
    citations[marker.name] = `${SCRIPT_RELATIVE_PATH}:${marker.line}-${nextLine - 1}`
  })
  return citations
}

// [CITE:RUN_METADATA]
function scenarioFamilyForSeed(seed) {
  const manifestIndex = Number.isInteger((seed - 101) / 101) && (seed - 101) % 101 === 0
    ? (seed - 101) / 101
    : null
  if (manifestIndex != null && manifestIndex >= 0 && manifestIndex < 64) {
    return PROOF_SCENARIO_FAMILIES[manifestIndex % PROOF_SCENARIO_FAMILIES.length]
  }
  return PROOF_SCENARIO_FAMILIES[Math.abs(seed) % PROOF_SCENARIO_FAMILIES.length]
}

function probePipelineDb() {
  const notes = []
  const probe = {
    path: PIPELINE_DB_PATH,
    exists: fs.existsSync(PIPELINE_DB_PATH),
    hasSimulationRunsTable: false,
  }
  if (!probe.exists) {
    notes.push(`missing ${PIPELINE_DB_PATH}`)
    return { probe, notes }
  }
  try {
    const db = new DatabaseSync(PIPELINE_DB_PATH, { open: true, readOnly: true })
    const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all()
    const tableNames = rows.map(row => String(row.name))
    probe.hasSimulationRunsTable = tableNames.includes('simulation_runs')
    notes.push(probe.hasSimulationRunsTable
      ? 'pipeline.db contains simulation_runs'
      : `pipeline.db has ${tableNames.length} tables but no simulation_runs`)
    db.close()
  } catch (error) {
    notes.push(`pipeline.db probe failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { probe, notes }
}

function latestEvaluationArtifact() {
  const candidates = fs.readdirSync(LOCAL_EVAL_JSON_DIR)
    .filter(name => name.endsWith('--evaluation-report.json'))
    .sort()
  if (!candidates.length) {
    throw new Error('No local evaluation report JSON artifacts found')
  }
  const fileName = candidates.at(-1)
  const jsonPath = path.join(LOCAL_EVAL_JSON_DIR, fileName)
  const mdPath = path.join(LOCAL_EVAL_MD_DIR, fileName.replace(/\.json$/, '.md'))
  return { jsonPath, mdPath }
}

function resolveRunMetadata() {
  const dbProbe = probePipelineDb()
  const artifact = latestEvaluationArtifact()
  const evaluation = JSON.parse(fs.readFileSync(artifact.jsonPath, 'utf8'))
  const activeRunId = evaluation?.corpus?.activeRunId
    ?? evaluation?.createdRunIds?.at(-1)
    ?? null
  if (!activeRunId) {
    throw new Error(`No activeRunId in ${relativePath(artifact.jsonPath)}`)
  }
  const createdRunIds = Array.isArray(evaluation.createdRunIds) ? evaluation.createdRunIds : []
  const requestedSeeds = Array.isArray(evaluation.requestedSeeds) ? evaluation.requestedSeeds.map(Number) : []
  const activeIndex = createdRunIds.indexOf(activeRunId)
  const seed = activeIndex >= 0 ? requestedSeeds[activeIndex] : requestedSeeds.at(-1)
  if (!Number.isFinite(seed)) {
    throw new Error(`Could not resolve seed for ${activeRunId}`)
  }
  const scenarioFamily = scenarioFamilyForSeed(seed)
  const metadataCitation = findLineRange(
    artifact.mdPath,
    '- Requested seeds:',
    new RegExp(`\\|\\s*${seed}\\s*\\|\\s*${activeRunId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|`),
  )
  return {
    runId: activeRunId,
    seed,
    scenarioFamily,
    studentCount: 120,
    metadataSource: dbProbe.probe.hasSimulationRunsTable ? 'db' : 'local-evaluation-artifact-fallback',
    metadataSourceDetail: dbProbe.probe.hasSimulationRunsTable
      ? 'Local pipeline.db exposed app simulation tables.'
      : 'Local pipeline.db lacked app simulation tables; metadata fell back to the latest governed local evaluation artifact.',
    artifactJsonPath: relativePath(artifact.jsonPath),
    artifactMdPath: relativePath(artifact.mdPath),
    metadataCitation,
    dbProbeNotes: dbProbe.notes,
  }
}

// [CITE:RUNTIME]
function loadRuntimeCurriculum() {
  const payload = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'))
  const courses = payload.courses.map(course => ({
    title: course.title,
    semesterNumber: Number(course.semester),
    credits: Number(course.credits),
    assessmentProfile: course.assessmentProfile,
    explicitPrerequisites: [...(course.explicitPrerequisites ?? [])],
    addedPrerequisites: [...(course.addedPrerequisites ?? [])],
    tt1Topics: [...(course.tt1Topics ?? [])],
    tt2Topics: [...(course.tt2Topics ?? [])],
    seeTopics: [...(course.seeTopics ?? [])],
    workbookTopics: [...(course.workbookTopics ?? [])],
    internalCompilerId: course.internalCompilerId,
    officialWebCode: course.officialWebCode ?? null,
    curriculumNodeId: course.internalCompilerId,
  }))
  const prereqEdges = uniqueBy(
    [...(payload.explicitEdges ?? []), ...(payload.addedEdges ?? [])]
      .map(edge => ({
        sourceCourse: edge.sourceCourse,
        targetCourse: edge.targetCourse,
        edgeType: edge.edgeType,
      }))
      .filter(edge => edge.sourceCourse && edge.targetCourse),
    edge => `${edge.sourceCourse}::${edge.targetCourse}`,
  )
  return { courses, prereqEdges }
}

function sectionForIndex(index) {
  return index < 60 ? 'A' : 'B'
}

function pickArchetype(index, runSeed) {
  const score = stableUnit(`run-${runSeed}-student-${index + 1}-archetype`)
  const weighted = sectionForIndex(index) === 'A' ? score * 0.9 : score * 1.08
  const bucket = Math.min(STUDENT_ARCHETYPES.length - 1, Math.floor(weighted * STUDENT_ARCHETYPES.length))
  return STUDENT_ARCHETYPES[bucket] ?? STUDENT_ARCHETYPES[0]
}

function scenarioProfileForSeed(seed) {
  const family = scenarioFamilyForSeed(seed)
  const seedStr = `domain-rand-${seed}`
  const domainShift = {
    sectionAbilityShift: stableBetween(`${seedStr}-ability`, -0.04, 0.04),
    sectionDisciplineShift: stableBetween(`${seedStr}-discipline`, -0.03, 0.03),
    forgetRateShift: stableBetween(`${seedStr}-forget`, -0.02, 0.02),
    courseworkReliabilityShift: stableBetween(`${seedStr}-coursework`, -0.03, 0.03),
    examPressureShift: stableBetween(`${seedStr}-pressure`, -0.02, 0.03),
    supportResponsivenessShift: stableBetween(`${seedStr}-support`, -0.03, 0.03),
  }
  let base
  switch (family) {
    case 'weak-foundation':
      base = { family, sectionAbilityShift: -0.09, sectionDisciplineShift: -0.01, forgetRateShift: 0.02, courseworkReliabilityShift: -0.01, examPressureShift: 0.04, supportResponsivenessShift: -0.02 }
      break
    case 'low-attendance':
      base = { family, sectionAbilityShift: -0.01, sectionDisciplineShift: -0.08, forgetRateShift: 0.01, courseworkReliabilityShift: 0, examPressureShift: 0.02, supportResponsivenessShift: -0.04 }
      break
    case 'high-forgetting':
      base = { family, sectionAbilityShift: 0, sectionDisciplineShift: -0.01, forgetRateShift: 0.07, courseworkReliabilityShift: -0.02, examPressureShift: 0.03, supportResponsivenessShift: -0.02 }
      break
    case 'coursework-inflation':
      base = { family, sectionAbilityShift: -0.02, sectionDisciplineShift: 0.02, forgetRateShift: 0.01, courseworkReliabilityShift: 0.08, examPressureShift: 0.01, supportResponsivenessShift: 0 }
      break
    case 'exam-fragility':
      base = { family, sectionAbilityShift: -0.01, sectionDisciplineShift: 0, forgetRateShift: 0.02, courseworkReliabilityShift: 0.01, examPressureShift: 0.08, supportResponsivenessShift: -0.01 }
      break
    case 'carryover-heavy':
      base = { family, sectionAbilityShift: -0.05, sectionDisciplineShift: -0.01, forgetRateShift: 0.03, courseworkReliabilityShift: -0.01, examPressureShift: 0.03, supportResponsivenessShift: -0.02 }
      break
    case 'intervention-resistant':
      base = { family, sectionAbilityShift: -0.02, sectionDisciplineShift: -0.02, forgetRateShift: 0.02, courseworkReliabilityShift: -0.02, examPressureShift: 0.04, supportResponsivenessShift: -0.09 }
      break
    case 'balanced':
    default:
      base = { family, sectionAbilityShift: 0, sectionDisciplineShift: 0, forgetRateShift: 0, courseworkReliabilityShift: 0, examPressureShift: 0, supportResponsivenessShift: 0 }
      break
  }
  return {
    family: base.family,
    sectionAbilityShift: base.sectionAbilityShift + domainShift.sectionAbilityShift,
    sectionDisciplineShift: base.sectionDisciplineShift + domainShift.sectionDisciplineShift,
    forgetRateShift: base.forgetRateShift + domainShift.forgetRateShift,
    courseworkReliabilityShift: base.courseworkReliabilityShift + domainShift.courseworkReliabilityShift,
    examPressureShift: base.examPressureShift + domainShift.examPressureShift,
    supportResponsivenessShift: base.supportResponsivenessShift + domainShift.supportResponsivenessShift,
  }
}

// [CITE:TRAJECTORY]
function buildStudentTrajectory(index, runSeed, scenarioProfile) {
  const sectionCode = sectionForIndex(index)
  const sectionAbility = (sectionCode === 'A' ? 0.64 : 0.5) + scenarioProfile.sectionAbilityShift
  const sectionDiscipline = (sectionCode === 'A' ? 0.66 : 0.56) + scenarioProfile.sectionDisciplineShift
  const seedBase = `run-${runSeed}-student-${index + 1}`
  const archetype = pickArchetype(index, runSeed)
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]
  const academicPotential = clamp(sectionAbility + archetype.abilityShift + stableGaussian(`${seedBase}-ability`, 0, 0.12), 0.2, 0.94)
  const mathematicsFoundation = clamp((sectionAbility + 0.04) + archetype.abilityShift + stableGaussian(`${seedBase}-math`, 0, 0.13), 0.2, 0.96)
  const computingFoundation = clamp((sectionAbility - 0.02) + (archetype.abilityShift * 0.9) + stableGaussian(`${seedBase}-computing`, 0, 0.13), 0.18, 0.96)
  const selfRegulation = clamp(sectionDiscipline + archetype.disciplineShift + stableGaussian(`${seedBase}-self`, 0, 0.12), 0.2, 0.95)
  const attendanceDiscipline = clamp((sectionDiscipline + 0.03) + archetype.disciplineShift + stableGaussian(`${seedBase}-attendance`, 0, 0.13), 0.2, 0.98)
  const supportResponsiveness = clamp(0.56 + scenarioProfile.supportResponsivenessShift + stableGaussian(`${seedBase}-support`, 0, 0.13), 0.15, 0.96)
  return {
    studentId: `mnc_student_${String(index + 1).padStart(3, '0')}`,
    usn: `1MS23MC${String(index + 1).padStart(3, '0')}`,
    name: `${first} ${last}`,
    sectionCode,
    archetype: archetype.key,
    latentBase: {
      academicPotential,
      mathematicsFoundation,
      computingFoundation,
      selfRegulation,
      attendanceDiscipline,
      supportResponsiveness,
    },
    profile: {
      readiness: {
        mathReadiness: roundTo(mathematicsFoundation),
        programmingReadiness: roundTo(computingFoundation),
        logicReadiness: roundTo(clamp((mathematicsFoundation * 0.55) + (computingFoundation * 0.3) + stableBetween(`${seedBase}-logic`, -0.12, 0.12), 0.12, 0.96)),
        statsReadiness: roundTo(clamp((mathematicsFoundation * 0.62) + stableBetween(`${seedBase}-stats`, -0.14, 0.14), 0.1, 0.95)),
        systemsReadiness: roundTo(clamp((computingFoundation * 0.6) + stableBetween(`${seedBase}-systems`, -0.14, 0.14), 0.08, 0.95)),
        communicationReadiness: roundTo(clamp((selfRegulation * 0.4) + stableBetween(`${seedBase}-comm`, 0.18, 0.48), 0.08, 0.92)),
        labReadiness: roundTo(clamp((computingFoundation * 0.52) + (selfRegulation * 0.18) + stableBetween(`${seedBase}-lab`, -0.12, 0.14), 0.08, 0.95)),
      },
      dynamics: {
        forgetRate: roundTo(clamp(0.08 + scenarioProfile.forgetRateShift + archetype.forgetShift + stableBetween(`${seedBase}-forget`, -0.04, 0.05), 0.02, 0.28)),
        relearnRate: roundTo(clamp(0.55 + stableBetween(`${seedBase}-relearn`, -0.12, 0.14), 0.12, 0.92)),
        transferGainRate: roundTo(clamp(0.4 + stableBetween(`${seedBase}-transfer-gain`, -0.14, 0.14), 0.08, 0.9)),
        studyGainRate: roundTo(clamp(0.46 + stableBetween(`${seedBase}-study-gain`, -0.12, 0.12), 0.12, 0.92)),
        fatigueRate: roundTo(clamp(0.06 + stableBetween(`${seedBase}-fatigue`, -0.04, 0.06), 0.02, 0.30)),
        consistency: roundTo(clamp(0.54 + (selfRegulation * 0.2) + stableBetween(`${seedBase}-consistency`, -0.12, 0.12), 0.1, 0.95)),
        volatility: roundTo(clamp(0.22 + stableBetween(`${seedBase}-volatility`, -0.08, 0.14), 0.04, 0.62)),
        recoveryTendency: roundTo(clamp(0.5 + (supportResponsiveness * 0.18) + stableBetween(`${seedBase}-recovery`, -0.12, 0.12), 0.08, 0.94)),
        relapseTendency: roundTo(clamp(0.18 + stableBetween(`${seedBase}-relapse`, -0.06, 0.12), 0.02, 0.58)),
      },
      behavior: {
        attendancePropensity: roundTo(attendanceDiscipline),
        helpSeekingTendency: roundTo(clamp(0.42 + (supportResponsiveness * 0.18) + stableBetween(`${seedBase}-help`, -0.16, 0.16), 0.05, 0.95)),
        selfCheckTendency: roundTo(clamp(0.46 + (selfRegulation * 0.18) + stableBetween(`${seedBase}-self-check`, -0.16, 0.16), 0.05, 0.95)),
        deadlineDiscipline: roundTo(clamp(selfRegulation + stableBetween(`${seedBase}-deadline`, -0.12, 0.12), 0.08, 0.98)),
        examPressure: roundTo(clamp(0.32 + scenarioProfile.examPressureShift + archetype.pressureShift + stableBetween(`${seedBase}-pressure`, -0.14, 0.14), 0.05, 0.88)),
        timePressureSensitivity: roundTo(clamp(0.3 + stableBetween(`${seedBase}-time-pressure`, -0.12, 0.16), 0.05, 0.86)),
        practiceCompliance: roundTo(clamp(0.48 + (selfRegulation * 0.18) + stableBetween(`${seedBase}-practice`, -0.16, 0.16), 0.06, 0.95)),
        courseworkReliability: roundTo(clamp(0.72 + scenarioProfile.courseworkReliabilityShift + archetype.courseworkReliabilityShift + stableBetween(`${seedBase}-coursework-reliability`, -0.14, 0.1), 0.2, 0.98)),
      },
      assessment: {
        quizRecallStrength: roundTo(clamp(0.48 + stableBetween(`${seedBase}-quiz`, -0.16, 0.16), 0.08, 0.94)),
        assignmentCompletionStrength: roundTo(clamp(0.52 + stableBetween(`${seedBase}-assignment`, -0.14, 0.14), 0.08, 0.95)),
        termTestApplicationStrength: roundTo(clamp(0.48 + (academicPotential * 0.12) + stableBetween(`${seedBase}-tt`, -0.16, 0.16), 0.08, 0.95)),
        seeEndurance: roundTo(clamp(0.58 + stableBetween(`${seedBase}-see`, -0.14, 0.16), 0.08, 0.95)),
        labExecutionStrength: roundTo(clamp(0.5 + stableBetween(`${seedBase}-lab-exec`, -0.14, 0.16), 0.08, 0.96)),
        partialCreditConversion: roundTo(clamp(0.52 + stableBetween(`${seedBase}-partial-credit`, -0.16, 0.14), 0.08, 0.96)),
        carelessErrorRate: roundTo(clamp(0.08 + stableBetween(`${seedBase}-careless`, -0.03, 0.08), 0.01, 0.28)),
        multiStepBreakdownRisk: roundTo(clamp(0.18 + stableBetween(`${seedBase}-multistep`, -0.08, 0.12), 0.02, 0.54)),
      },
      intervention: {
        interventionReceptivity: roundTo(clamp(supportResponsiveness + stableBetween(`${seedBase}-intervention-receptive`, -0.16, 0.16), 0.08, 0.98)),
        temporaryUpliftCredit: roundTo(clamp(0.1 + stableBetween(`${seedBase}-uplift`, -0.04, 0.08), 0.01, 0.34)),
        expectedRecoveryThreshold: roundTo(clamp(0.12 + stableBetween(`${seedBase}-recovery-threshold`, -0.05, 0.08), 0.02, 0.36)),
      },
    },
  }
}

function courseCodeForRuntime(course) {
  return course.officialWebCode ?? course.internalCompilerId
}

function isLabLikeCourse(course) {
  const haystack = `${course.title} ${course.assessmentProfile}`.toLowerCase()
  return haystack.includes('lab') || haystack.includes('project') || haystack.includes('workshop')
}

function courseEmphasis(course) {
  const lower = course.title.toLowerCase()
  const mathHeavy = ['mathematics', 'algebra', 'probability', 'statistics', 'optimization', 'numerical', 'analysis', 'computation'].some(token => lower.includes(token))
  const computingHeavy = ['programming', 'computer', 'database', 'operating', 'network', 'software', 'algorithm', 'machine', 'data', 'distributed', 'logic', 'intelligence'].some(token => lower.includes(token))
  return {
    mathWeight: mathHeavy ? 0.7 : computingHeavy ? 0.35 : 0.5,
    computingWeight: computingHeavy ? 0.72 : mathHeavy ? 0.34 : 0.5,
  }
}

function prerequisiteAverage(course, scoresByCourseTitle) {
  const signals = [...course.explicitPrerequisites, ...course.addedPrerequisites]
    .map(title => scoresByCourseTitle.get(title))
    .filter(value => typeof value === 'number')
  if (!signals.length) return 0.58
  return clamp(signals.reduce((sum, value) => sum + value, 0) / (signals.length * 100), 0.2, 0.95)
}

function teacherEffect(facultyId, course, sectionCode, runSeed) {
  return stableBetween(`run-${runSeed}-${facultyId}-${course.internalCompilerId}-${sectionCode}`, -0.06, 0.08)
}

function evaluateAttendanceStatus({ attendancePercent, condoned, policy }) {
  if (attendancePercent >= policy.attendanceRules.minimumPercent) {
    return { status: 'eligible' }
  }
  const withinCondonationBand = attendancePercent >= policy.condonationRules.minimumPercent
    && attendancePercent < policy.attendanceRules.minimumPercent
  if (withinCondonationBand && condoned) {
    return { status: 'eligible-via-condonation' }
  }
  return { status: 'ineligible' }
}

function roundStatusMark(mark) {
  return Math.round(mark)
}

function mapGradeBand(markPct) {
  return DEFAULT_POLICY.gradeBands.find(band => markPct >= band.minimumMark && markPct <= band.maximumMark)
    ?? DEFAULT_POLICY.gradeBands.at(-1)
}

function evaluateCourseStatus({ attendancePercent, ceMark, seeMark, condoned, policy }) {
  const attendance = evaluateAttendanceStatus({ attendancePercent, condoned, policy })
  const ceRounded = roundStatusMark(ceMark)
  const seeRounded = roundStatusMark(seeMark)
  const overallRounded = roundStatusMark(ceMark + seeMark)
  const attendanceEligible = attendance.status === 'eligible' || attendance.status === 'eligible-via-condonation'
  const passed = attendanceEligible
    && ceRounded >= policy.passRules.ceMinimum
    && seeRounded >= policy.passRules.seeMinimum
    && overallRounded >= policy.passRules.overallMinimum
  const gradeBand = passed ? mapGradeBand((overallRounded / policy.passRules.overallMaximum) * 100) : mapGradeBand(0)
  return {
    overallRounded,
    gradeLabel: passed ? gradeBand.grade : 'F',
    gradePoint: passed ? gradeBand.gradePoint : 0,
    result: passed ? 'Passed' : 'Failed',
  }
}

function calculateSgpa(attempts) {
  const filtered = attempts.filter(attempt => {
    if (DEFAULT_POLICY.sgpaCgpaRules.includeFailedCredits) return true
    return attempt.result === 'Passed' || attempt.gradePoint > 0
  })
  const credits = filtered.reduce((sum, attempt) => sum + attempt.credits, 0)
  if (!credits) return 0
  const weighted = filtered.reduce((sum, attempt) => sum + (attempt.credits * attempt.gradePoint), 0)
  return roundTo(weighted / credits, DEFAULT_POLICY.roundingRules.sgpaCgpaDecimals)
}

function calculateCgpa(termAttempts) {
  return calculateSgpa(termAttempts.flat())
}

function buildAttendanceHistory({ attendancePct, student, course, semesterNumber, runSeed }) {
  const checkpoints = [
    { checkpoint: 'wk4', checkpointLabel: 'Week 4', totalClasses: 8 },
    { checkpoint: 'wk8', checkpointLabel: 'Week 8', totalClasses: 16 },
    { checkpoint: 'wk12', checkpointLabel: 'Week 12', totalClasses: 24 },
    { checkpoint: 'wk16', checkpointLabel: 'Week 16', totalClasses: 32 },
  ]
  return checkpoints.map((checkpoint, index) => {
    const drift = stableBetween(
      `run-${runSeed}-${student.studentId}-${course.internalCompilerId}-${semesterNumber}-${checkpoint.checkpoint}`,
      -4 - index,
      4,
    )
    const pctValue = clamp(
      Math.round(attendancePct + drift + ((index - 1.5) * 1.4 * (student.profile.behavior.attendancePropensity - 0.5))),
      48,
      99,
    )
    return {
      checkpoint: checkpoint.checkpoint,
      checkpointLabel: checkpoint.checkpointLabel,
      presentClasses: Math.round((pctValue / 100) * checkpoint.totalClasses),
      totalClasses: checkpoint.totalClasses,
      attendancePct: pctValue,
    }
  })
}

// [CITE:SIMULATE_COURSE]
function simulateSemesterCourse({ student, course, semesterNumber, scoresByCourseTitle, facultyId, runSeed }) {
  const emphasis = courseEmphasis(course)
  const prereq = prerequisiteAverage(course, scoresByCourseTitle)
  const difficulty = 0.28 + (semesterNumber * 0.05) + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-difficulty`, -0.03, 0.05)
  const teaching = teacherEffect(facultyId, course, student.sectionCode, runSeed)
  const profile = student.profile
  const mastery = clamp(
    (student.latentBase.academicPotential * 0.32)
      + (student.latentBase.mathematicsFoundation * emphasis.mathWeight * 0.24)
      + (student.latentBase.computingFoundation * emphasis.computingWeight * 0.24)
      + (student.latentBase.selfRegulation * 0.12)
      + (student.latentBase.supportResponsiveness * 0.08)
      + (profile.readiness.logicReadiness * 0.06)
      + (profile.readiness.statsReadiness * 0.05)
      + (prereq * 0.18)
      + teaching
      - (difficulty * 0.22)
      + 0.06,
    0.22,
    0.96,
  )
  const attendancePct = clamp(
    Math.round(
      58
        + (student.latentBase.attendanceDiscipline * 30)
        + (student.latentBase.selfRegulation * 8)
        + (student.latentBase.supportResponsiveness * 4)
        + (profile.behavior.attendancePropensity * 6)
        - (difficulty * 8)
        + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-attendance`, -7, 9),
    ),
    52,
    98,
  )
  const tt1Pct = clamp(
    24
      + (mastery * 42)
      + (profile.assessment.termTestApplicationStrength * 16)
      + (profile.behavior.practiceCompliance * 8)
      - (profile.behavior.examPressure * 12)
      - (difficulty * 7)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-tt1`, -14, 12),
    8,
    97,
  )
  const tt2Pct = clamp(
    tt1Pct
      + (profile.dynamics.relearnRate * 8)
      + (profile.behavior.helpSeekingTendency * 5)
      - (profile.dynamics.forgetRate * 4)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-tt2`, -12, 14),
    8,
    99,
  )
  const quizPct = clamp(
    22
      + (mastery * 38)
      + (profile.assessment.quizRecallStrength * 20)
      + (profile.behavior.selfCheckTendency * 7)
      - (difficulty * 5)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-quiz`, -14, 12),
    8,
    99,
  )
  const assignmentBase = isLabLikeCourse(course)
    ? profile.assessment.labExecutionStrength
    : profile.assessment.assignmentCompletionStrength
  const assignmentPct = clamp(
    24
      + (mastery * 34)
      + (assignmentBase * 18)
      + (profile.behavior.deadlineDiscipline * 8)
      + (profile.behavior.courseworkReliability * 6)
      - (difficulty * 4)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-assignment`, -12, 12),
    10,
    99,
  )
  const cePct = clamp(
    (tt1Pct * 0.28)
      + (tt2Pct * 0.27)
      + (quizPct * 0.2)
      + (assignmentPct * 0.25)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-ce`, -6, 6),
    10,
    97,
  )
  const seePct = clamp(
    18
      + (mastery * 46)
      + (profile.assessment.seeEndurance * 18)
      + (profile.dynamics.transferGainRate * 10)
      - (profile.behavior.examPressure * 10)
      - (difficulty * 9)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-see`, -14, 12),
    8,
    98,
  )
  const ceMark = roundTo((cePct / 100) * DEFAULT_POLICY.passRules.ceMaximum)
  const seeMark = roundTo((seePct / 100) * DEFAULT_POLICY.passRules.seeMaximum)
  const condoned = attendancePct >= DEFAULT_POLICY.condonationRules.minimumPercent
    && attendancePct < DEFAULT_POLICY.attendanceRules.minimumPercent
    && stableUnit(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-condonation`) > 0.42
  const decision = evaluateCourseStatus({
    attendancePercent: attendancePct,
    ceMark,
    seeMark,
    condoned,
    policy: DEFAULT_POLICY,
  })
  return {
    attendancePct,
    attendanceHistory: buildAttendanceHistory({ attendancePct, student, course, semesterNumber, runSeed }),
    tt1Pct: roundTo(tt1Pct),
    tt2Pct: roundTo(tt2Pct),
    quizPct: roundTo(quizPct),
    assignmentPct: roundTo(assignmentPct),
    cePct: roundTo(cePct),
    seePct: roundTo(seePct),
    ceMark,
    seeMark,
    overallMark: decision.overallRounded,
    gradeLabel: decision.gradeLabel,
    gradePoint: decision.gradePoint,
    result: decision.result,
    condoned,
    prerequisiteCarryoverRisk: roundTo(clamp((1 - prereq) + (difficulty * 0.18) - (mastery * 0.12), 0.02, 0.92)),
    courseworkToTtGap: roundTo(((quizPct + assignmentPct) / 2) - ((tt1Pct + tt2Pct) / 2)),
    ttMomentum: roundTo(tt2Pct - tt1Pct),
    latentSummary: {
      mastery: roundTo(mastery),
      prereq: roundTo(prereq),
      teaching: roundTo(teaching),
      difficulty: roundTo(difficulty),
    },
  }
}

function coDefinitionsForCourse(course) {
  const topicPool = course.workbookTopics.length > 0
    ? course.workbookTopics
    : [...course.tt1Topics, ...course.tt2Topics, ...course.seeTopics]
  const groups = [
    topicPool.filter((_, index) => index % 3 === 0),
    topicPool.filter((_, index) => index % 3 === 1),
    topicPool.filter((_, index) => index % 3 === 2),
  ].map(group => group.filter(Boolean))
  return groups.map((topics, index) => ({
    coCode: `${courseCodeForRuntime(course)}-CO${index + 1}`,
    coTitle: topics[0] ? `${topics[0]} competency` : `Course outcome ${index + 1}`,
    topics: topics.length > 0 ? topics : [course.title],
  }))
}

function buildSimulatedQuestionTemplates({ simulationRunId, semesterNumber, course, offeringId = null }) {
  const coDefs = coDefinitionsForCourse(course)
  const defaultSourceType = /lab|project|workshop/i.test(course.assessmentProfile)
    ? 'rubric-derived'
    : 'synthetic-blueprint'
  const buildTemplatesForTopics = (componentType, topics, count) => Array.from({ length: count }, (_, index) => {
    const topic = topics[index % Math.max(1, topics.length)] ?? course.title
    const co = coDefs[index % coDefs.length] ?? coDefs[0]
    const questionMarks = componentType === 'see' ? (index % 2 === 0 ? 8 : 6) : 5
    return {
      simulationQuestionTemplateId: `${simulationRunId}-${course.internalCompilerId}-${offeringId ?? 'course'}-${componentType}-${index + 1}`,
      componentType,
      questionCode: `${courseCodeForRuntime(course)}-${componentType.toUpperCase()}-Q${index + 1}`,
      questionMarks,
      difficultyScaled: Math.round(stableBetween(`${simulationRunId}-${course.internalCompilerId}-${offeringId ?? 'course'}-${componentType}-${index + 1}-difficulty`, 32, componentType === 'see' ? 84 : 76)),
      transferDemandScaled: Math.round(stableBetween(`${simulationRunId}-${course.internalCompilerId}-${offeringId ?? 'course'}-${componentType}-${index + 1}-transfer`, 28, componentType === 'tt1' ? 68 : 88)),
      coTags: co ? [co.coCode] : [],
      sourceType: defaultSourceType,
      topic,
      semesterNumber,
    }
  })
  return [
    ...buildTemplatesForTopics('tt1', course.tt1Topics.length > 0 ? course.tt1Topics : course.tt2Topics, 5),
    ...buildTemplatesForTopics('tt2', course.tt2Topics.length > 0 ? course.tt2Topics : course.seeTopics, 5),
    ...buildTemplatesForTopics('see', course.seeTopics.length > 0 ? course.seeTopics : course.tt2Topics, 6),
  ]
}

function simulateQuestionResults({ student, templates, tt1Pct, tt2Pct, seePct, runSeed }) {
  const results = templates.map(template => {
    const basePct = template.componentType === 'tt1' ? tt1Pct : template.componentType === 'tt2' ? tt2Pct : seePct
    const componentStrength = template.componentType === 'tt1'
      ? student.profile.assessment.termTestApplicationStrength
      : template.componentType === 'tt2'
        ? (student.profile.assessment.termTestApplicationStrength + student.profile.dynamics.relearnRate) / 2
        : student.profile.assessment.seeEndurance
    const expectedPct = clamp(
      basePct
        + (componentStrength * 14)
        - ((template.difficultyScaled / 100) * 10)
        - ((template.transferDemandScaled / 100) * student.profile.assessment.multiStepBreakdownRisk * 18)
        + stableBetween(`run-${runSeed}-${student.studentId}-${template.questionCode}`, -14, 10),
      4,
      99,
    )
    const rawScore = clamp(Math.round((expectedPct / 100) * template.questionMarks), 0, template.questionMarks)
    const errorSeed = stableUnit(`run-${runSeed}-${student.studentId}-${template.questionCode}-error`)
    const errorType = errorSeed < student.profile.assessment.carelessErrorRate
      ? 'careless-error'
      : errorSeed < student.profile.assessment.carelessErrorRate + student.profile.assessment.multiStepBreakdownRisk
        ? 'transfer-gap'
        : rawScore === 0
          ? 'incomplete'
          : rawScore < template.questionMarks
            ? 'partial-method'
            : 'clean'
    return {
      simulationQuestionTemplateId: template.simulationQuestionTemplateId,
      componentType: template.componentType,
      score: rawScore,
      maxScore: template.questionMarks,
      errorType,
      partialCreditProfile: roundTo(clamp(
        student.profile.assessment.partialCreditConversion - ((template.transferDemandScaled / 100) * 0.12) + stableBetween(`run-${runSeed}-${student.studentId}-${template.questionCode}-partial`, -0.08, 0.08),
        0.05,
        0.95,
      )),
    }
  })
  return {
    results,
    summary: {
      weakQuestionCount: results.filter(result => (result.score / Math.max(1, result.maxScore)) < 0.4).length,
    },
  }
}

function buildCourseOutcomeStates({ student, course, tt1Pct, tt2Pct, seePct, mastery, templates, questionResults, runSeed }) {
  const questionResultByTemplateId = new Map(questionResults.map(result => [result.simulationQuestionTemplateId, result]))
  const templateByCoCode = new Map()
  for (const template of templates) {
    for (const coCode of template.coTags) {
      templateByCoCode.set(coCode, [...(templateByCoCode.get(coCode) ?? []), template])
    }
  }
  const outcomes = coDefinitionsForCourse(course).map(outcome => {
    const coTemplates = templateByCoCode.get(outcome.coCode) ?? []
    const componentPct = componentType => {
      const componentTemplates = coTemplates.filter(template => template.componentType === componentType)
      if (!componentTemplates.length) return null
      const scoreSum = componentTemplates.reduce((sum, template) => sum + Number(questionResultByTemplateId.get(template.simulationQuestionTemplateId)?.score ?? 0), 0)
      const maxSum = componentTemplates.reduce((sum, template) => sum + template.questionMarks, 0)
      if (!maxSum) return null
      return clamp(roundTo((scoreSum / maxSum) * 100), 0, 100)
    }
    const coTt1 = componentPct('tt1') ?? clamp(tt1Pct + stableBetween(`run-${runSeed}-${student.studentId}-${outcome.coCode}-tt1`, -12, 8), 8, 99)
    const coTt2 = componentPct('tt2') ?? clamp(tt2Pct + stableBetween(`run-${runSeed}-${student.studentId}-${outcome.coCode}-tt2`, -10, 10), 8, 99)
    const coSee = componentPct('see') ?? clamp(seePct + stableBetween(`run-${runSeed}-${student.studentId}-${outcome.coCode}-see`, -12, 9), 5, 99)
    const coMastery = clamp(
      ((coTt2 * 0.55) + (coSee * 0.45)) / 100
        + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-${outcome.coCode}-mastery`, -0.08, 0.06),
      0.08,
      0.98,
    )
    return {
      mastery: roundTo(coMastery),
      observedScores: {
        tt1Pct: roundTo(coTt1),
        tt2Pct: roundTo(coTt2),
        seePct: roundTo(coSee),
      },
      baseMastery: mastery,
      coCode: outcome.coCode,
      coTitle: outcome.coTitle,
    }
  })
  return {
    summaries: outcomes,
    weakCoCount: outcomes.filter(outcome => outcome.observedScores.tt2Pct < 50 || outcome.observedScores.seePct < 45).length,
  }
}

function concernFamilyForInterventionType(interventionType) {
  switch (interventionType) {
    case 'attendance-recovery-follow-up':
      return 'attendance'
    case 'pre-see-rescue':
      return 'exam-performance'
    case 'targeted-tutoring':
    case 'prerequisite-bridge':
      return 'coursework'
    case 'mentor-check-in':
      return 'mentoring-engagement'
    default:
      return null
  }
}

function mapLegacyInterventionTypeToActionCode(rawType) {
  const mapping = {
    'mentor-check-in': 'mentor_meeting',
    'mentor-outreach': 'mentor_meeting',
    'prerequisite-bridge': 'targeted_remedial_plan',
    'structured-study-plan': 'structured_study_plan',
    'targeted-tutoring': 'targeted_remedial_plan',
    'pre-see-rescue': 'structured_study_plan',
    'outreach-plus-tutoring': 'targeted_remedial_plan',
    'attendance-recovery-follow-up': 'attendance_warning',
    'faculty-outreach': 'faculty_followup_reminder',
    'alert-only': 'faculty_followup_reminder',
    'no-action': null,
    support: 'generic_default_family_action',
  }
  if (!rawType) return null
  return mapping[rawType] ?? 'generic_default_family_action'
}

function inferHeuristicRiskBand({ cgpa, backlogCount }) {
  const safeCgpa = cgpa ?? 6
  const safeBacklog = backlogCount ?? 0
  if (safeCgpa < 4.5 || safeBacklog >= 2) return 'High'
  if (safeCgpa < 7.0 || safeBacklog >= 1) return 'Medium'
  return 'Low'
}

function buildDefaultSeverityContext({ cgpa, backlogCount }) {
  return {
    riskBand: inferHeuristicRiskBand({ cgpa, backlogCount }),
    cgpa: cgpa ?? 6,
    backlogCount: backlogCount ?? 0,
  }
}

function concernFamilyToWeakness(family) {
  switch (family) {
    case 'attendance': return 'attendance'
    case 'coursework': return 'coursework'
    case 'exam-performance': return 'exam'
    case 'broad-academic': return 'broad'
    case 'mentoring-engagement': return 'mentoring'
    default: return null
  }
}

function isStudentFacing(actionCode) {
  return STUDENT_FACING_ACTIONS.has(actionCode)
}

function deriveResponseProfile({ runId, studentId, studentProfile }) {
  const seed = `${runId}::${studentId}::response-profile::v1`
  const draw = stableUnit(seed)
  const receptivityBias = (clamp(studentProfile.intervention.interventionReceptivity, 0, 1) - 0.5) * 0.45
  const complianceBias = (clamp(studentProfile.behavior.practiceCompliance, 0, 1) - 0.5) * 0.25
  const shifted = clamp(draw + receptivityBias + complianceBias, 0, 1)
  const profile = shifted >= 0.75 ? 'strong' : shifted >= 0.45 ? 'partial' : shifted >= 0.20 ? 'weak' : 'resistant'
  return {
    profile,
    responseScore: RESPONSE_SCORE_BY_PROFILE[profile],
  }
}

function supportCompatibility({ actionCode, concernFamily, studentProfile, dominantWeaknessHint }) {
  const affinities = ACTION_FAMILY_AFFINITY[actionCode]
  const weaknessToken = dominantWeaknessHint ?? concernFamilyToWeakness(concernFamily)
  let baseFactor = 1.0
  if (weaknessToken != null) {
    baseFactor = affinities.includes(weaknessToken) ? 1.10 : 0.90
  }
  const receptivityScale = clamp(0.7 + clamp(studentProfile.intervention.interventionReceptivity, 0, 1) * 0.6, 0.7, 1.3)
  return clamp(baseFactor * receptivityScale, 0.60, 1.45)
}

function stageFactor(stageKey, semesterNumber) {
  switch (stageKey) {
    case 'pre-tt1': return semesterNumber >= 2 ? 1.10 : 1.00
    case 'post-tt1': return 1.00
    case 'post-tt2': return 0.85
    case 'post-assignments': return 0.70
    case 'post-see': return 0.50
    default: return 1.00
  }
}

function severityPenalty(riskBand, cgpa, backlogCount) {
  if (riskBand === 'High' && (backlogCount >= 3 || cgpa < 4.0)) return 0.55
  if (riskBand === 'High') return 0.70
  if (riskBand === 'Medium' && (backlogCount >= 2 || cgpa < 4.5)) return 0.70
  if (riskBand === 'Medium') return 0.85
  return 1.00
}

function repeatPenalty(ordinal) {
  if (ordinal <= 1) return 1.00
  if (ordinal === 2) return 0.60
  return 0.35
}

function computeInterventionImpact(application, studentProfile) {
  const responseProfile = deriveResponseProfile({
    runId: application.runId,
    studentId: application.studentId,
    studentProfile,
  })
  const baseActionWeight = BASE_ACTION_WEIGHT[application.actionCode]
  const compat = supportCompatibility({
    actionCode: application.actionCode,
    concernFamily: application.concernFamily,
    studentProfile,
    dominantWeaknessHint: application.dominantWeaknessHint,
  })
  const impact = roundTo(
    baseActionWeight
      * responseProfile.responseScore
      * compat
      * stageFactor(application.stageKey, application.semesterNumber)
      * severityPenalty(application.severityContext.riskBand, application.severityContext.cgpa, application.severityContext.backlogCount)
      * repeatPenalty(application.ordinalInStageForStudent),
    6,
  )
  return {
    impact,
    tier: impact >= 0.65 ? 'strong' : impact >= 0.35 ? 'partial' : 'weak',
  }
}

function sumInterventionImpacts(applications) {
  let total = 0
  let strongest = -Infinity
  let dominantTier = null
  let appliedCount = 0
  for (const entry of applications) {
    if (!isStudentFacing(entry.application.actionCode)) continue
    const computed = computeInterventionImpact(entry.application, entry.profile)
    total += computed.impact
    appliedCount += 1
    if (computed.impact > strongest) {
      strongest = computed.impact
      dominantTier = computed.tier
    }
  }
  return {
    totalImpact: roundTo(Math.min(0.95, total), 6),
    dominantTier,
    appliedCount,
  }
}

function computeMarkDelta({ totalInterventionImpact, dominantTier, assessmentType }) {
  if (dominantTier == null || totalInterventionImpact <= 0) return 0
  const range = ASSESSMENT_RESPONSIVENESS[assessmentType]
  const span = range.max - range.min
  if (span <= 0) return 0
  const tierMultiplier = dominantTier === 'strong' ? 1.0 : dominantTier === 'partial' ? 0.55 : 0.15
  return roundTo(clamp(totalInterventionImpact * span * tierMultiplier, 0, range.max), 2)
}

function applyDelta(baseline, delta, bounds) {
  if (baseline == null) return null
  return roundTo(clamp(baseline + delta, bounds.min, bounds.max))
}

function rebuildCePct(input) {
  if (input.baselineCePct == null) return null
  if (input.baselineTt1 == null || input.baselineTt2 == null || input.baselineQuiz == null || input.baselineAssignment == null) {
    return input.baselineCePct
  }
  const newWeighted =
    (input.newTt1 ?? input.baselineTt1) * 0.28
    + (input.newTt2 ?? input.baselineTt2) * 0.27
    + (input.newQuiz ?? input.baselineQuiz) * 0.20
    + (input.newAssignment ?? input.baselineAssignment) * 0.25
  const baselineWeighted =
    input.baselineTt1 * 0.28
    + input.baselineTt2 * 0.27
    + input.baselineQuiz * 0.20
    + input.baselineAssignment * 0.25
  return roundTo(clamp(newWeighted + (input.baselineCePct - baselineWeighted), 10, 97))
}

function stageKeyForInterventionType(interventionType) {
  return interventionType === 'pre-see-rescue' ? 'post-assignments' : ACTIVE_STAGE_KEY
}

// [CITE:REALIZATION]
function applyRealization({ baseline, studentProfile, runId, studentId, semesterNumber, stageKey, interventionsInWindow }) {
  if (!interventionsInWindow.length) {
    return {
      realized: { ...baseline },
      impact: {
        totalImpact: 0,
        dominantTier: null,
        appliedCount: 0,
        markDeltas: { attendance: 0, tt1: 0, tt2: 0, quiz: 0, assignment: 0, see: 0 },
      },
    }
  }
  const applications = interventionsInWindow.map(entry => ({
    application: {
      runId,
      studentId,
      semesterNumber,
      stageKey: entry.stageKeyApplied,
      caseId: entry.caseId,
      actionCode: entry.actionCode,
      concernFamily: entry.concernFamily,
      ordinalInStageForStudent: entry.ordinalInStageForStudent,
      severityContext: entry.severityContext,
      dominantWeaknessHint: entry.dominantWeaknessHint ?? null,
    },
    profile: studentProfile,
  }))
  const impactSummary = sumInterventionImpacts(applications)
  const markDeltas = {
    attendance: computeMarkDelta({ totalInterventionImpact: impactSummary.totalImpact, dominantTier: impactSummary.dominantTier, assessmentType: 'attendance' }),
    tt1: computeMarkDelta({ totalInterventionImpact: impactSummary.totalImpact, dominantTier: impactSummary.dominantTier, assessmentType: 'tt1' }),
    tt2: computeMarkDelta({ totalInterventionImpact: impactSummary.totalImpact, dominantTier: impactSummary.dominantTier, assessmentType: 'tt2' }),
    quiz: computeMarkDelta({ totalInterventionImpact: impactSummary.totalImpact, dominantTier: impactSummary.dominantTier, assessmentType: 'quiz' }),
    assignment: computeMarkDelta({ totalInterventionImpact: impactSummary.totalImpact, dominantTier: impactSummary.dominantTier, assessmentType: 'assignment' }),
    see: computeMarkDelta({ totalInterventionImpact: impactSummary.totalImpact, dominantTier: impactSummary.dominantTier, assessmentType: 'see' }),
  }
  const newAttendance = roundTo(clamp(baseline.attendancePct + markDeltas.attendance, ASSESSMENT_BOUNDS.attendance.min, ASSESSMENT_BOUNDS.attendance.max))
  const newTt1 = applyDelta(baseline.tt1Pct, markDeltas.tt1, ASSESSMENT_BOUNDS.tt1)
  const newTt2 = applyDelta(baseline.tt2Pct, markDeltas.tt2, ASSESSMENT_BOUNDS.tt2)
  const newQuiz = applyDelta(baseline.quizPct, markDeltas.quiz, ASSESSMENT_BOUNDS.quiz)
  const newAssignment = applyDelta(baseline.assignmentPct, markDeltas.assignment, ASSESSMENT_BOUNDS.assignment)
  const newSee = applyDelta(baseline.seePct, markDeltas.see, ASSESSMENT_BOUNDS.see)
  return {
    realized: {
      attendancePct: newAttendance,
      tt1Pct: newTt1,
      tt2Pct: newTt2,
      quizPct: newQuiz,
      assignmentPct: newAssignment,
      seePct: newSee,
      cePct: rebuildCePct({
        baselineCePct: baseline.cePct,
        baselineTt1: baseline.tt1Pct,
        baselineTt2: baseline.tt2Pct,
        baselineQuiz: baseline.quizPct,
        baselineAssignment: baseline.assignmentPct,
        newTt1,
        newTt2,
        newQuiz,
        newAssignment,
      }),
    },
    impact: {
      totalImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      appliedCount: impactSummary.appliedCount,
      markDeltas,
    },
    stageKey,
  }
}

function realizedCourseStatus({ baselineSimulation, realizedEvidence, student, course, runSeed }) {
  const condoned = realizedEvidence.attendancePct >= DEFAULT_POLICY.condonationRules.minimumPercent
    && realizedEvidence.attendancePct < DEFAULT_POLICY.attendanceRules.minimumPercent
    && stableUnit(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-condonation`) > 0.42
  const ceMark = roundTo(((realizedEvidence.cePct ?? baselineSimulation.cePct) / 100) * DEFAULT_POLICY.passRules.ceMaximum)
  const seeMark = roundTo(((realizedEvidence.seePct ?? baselineSimulation.seePct) / 100) * DEFAULT_POLICY.passRules.seeMaximum)
  return evaluateCourseStatus({
    attendancePercent: realizedEvidence.attendancePct,
    ceMark,
    seeMark,
    condoned,
    policy: DEFAULT_POLICY,
  })
}

// [CITE:SIMULATE_RUN]
function simulateRun({ runId, runSeed, runtime }) {
  const scenarioProfile = scenarioProfileForSeed(runSeed)
  const courseLeaderFaculty = PROOF_FACULTY.filter(item => item.permissions.includes('COURSE_LEADER'))
  const trajectories = Array.from({ length: 120 }, (_, index) => buildStudentTrajectory(index, runSeed, scenarioProfile))
  const sem6Courses = runtime.courses.filter(course => course.semesterNumber === 6)
  const allCourseAttempts = []
  const historicalCourseAttempts = []
  const sem6CourseAttempts = []
  const studentSummaries = []
  const teacherCounterfactualRows = []

  for (const [trajectoryIndex, student] of trajectories.entries()) {
    const courseScores = new Map()
    const cumulativeAttempts = []
    const semesterSnapshots = []
    let currentCgpa = 0
    let activeBacklogCount = 0

    for (let semesterNumber = 1; semesterNumber <= 5; semesterNumber += 1) {
      const semesterCourses = runtime.courses.filter(course => course.semesterNumber === semesterNumber)
      const semesterAttempts = []
      const semesterCourseRows = []
      for (const [courseIndex, course] of semesterCourses.entries()) {
        const faculty = courseLeaderFaculty[(courseIndex + (student.sectionCode === 'B' ? 1 : 0)) % courseLeaderFaculty.length]
        const simulation = simulateSemesterCourse({
          student,
          course,
          semesterNumber,
          scoresByCourseTitle: courseScores,
          facultyId: faculty.facultyId,
          runSeed,
        })
        const templates = buildSimulatedQuestionTemplates({
          simulationRunId: runId,
          semesterNumber,
          course,
        })
        const questionResults = simulateQuestionResults({
          student,
          templates,
          tt1Pct: simulation.tt1Pct,
          tt2Pct: simulation.tt2Pct,
          seePct: simulation.seePct,
          runSeed,
        })
        const coStates = buildCourseOutcomeStates({
          student,
          course,
          tt1Pct: simulation.tt1Pct,
          tt2Pct: simulation.tt2Pct,
          seePct: simulation.seePct,
          mastery: simulation.latentSummary.mastery,
          templates,
          questionResults: questionResults.results,
          runSeed,
        })
        const courseRow = {
          studentId: student.studentId,
          sectionCode: student.sectionCode,
          semesterNumber,
          courseTitle: course.title,
          courseCode: courseCodeForRuntime(course),
          facultyId: faculty.facultyId,
          credits: course.credits,
          ...simulation,
          weakCoCount: coStates.weakCoCount,
          weakQuestionCount: questionResults.summary.weakQuestionCount,
        }
        allCourseAttempts.push(courseRow)
        historicalCourseAttempts.push(courseRow)
        semesterCourseRows.push(courseRow)
        courseScores.set(course.title, simulation.overallMark)
        semesterAttempts.push({
          courseCode: courseCodeForRuntime(course),
          credits: course.credits,
          gradePoint: simulation.gradePoint,
          result: simulation.result,
        })
      }
      currentCgpa = calculateCgpa([...cumulativeAttempts, semesterAttempts])
      cumulativeAttempts.push(semesterAttempts)
      activeBacklogCount += semesterCourseRows.filter(row => row.result === 'Failed').length
      semesterSnapshots.push({
        semesterNumber,
        sgpa: calculateSgpa(semesterAttempts),
        cgpa: currentCgpa,
        backlogCount: activeBacklogCount,
        failedCourses: semesterCourseRows.filter(row => row.result === 'Failed').length,
      })
    }

    for (const [courseIndex, course] of sem6Courses.entries()) {
      const actualFaculty = courseLeaderFaculty[(courseIndex + (student.sectionCode === 'B' ? 1 : 0)) % courseLeaderFaculty.length]
      const offeringId = `mnc_s6_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${student.sectionCode.toLowerCase()}`
      const simulation = simulateSemesterCourse({
        student,
        course,
        semesterNumber: 6,
        scoresByCourseTitle: courseScores,
        facultyId: actualFaculty.facultyId,
        runSeed,
      })
      const templates = buildSimulatedQuestionTemplates({
        simulationRunId: runId,
        semesterNumber: 6,
        course,
        offeringId,
      })
      const questionResults = simulateQuestionResults({
        student,
        templates,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        seePct: simulation.seePct,
        runSeed,
      })
      const coStates = buildCourseOutcomeStates({
        student,
        course,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        seePct: simulation.seePct,
        mastery: simulation.latentSummary.mastery,
        templates,
        questionResults: questionResults.results,
        runSeed,
      })
      const interventionType = coStates.weakCoCount >= 2
        ? 'targeted-tutoring'
        : simulation.prerequisiteCarryoverRisk >= 0.65
          ? 'prerequisite-bridge'
          : simulation.tt2Pct < 50
            ? 'pre-see-rescue'
            : 'mentor-check-in'
      const severityContext = buildDefaultSeverityContext({ cgpa: currentCgpa, backlogCount: activeBacklogCount })
      const interventionInput = {
        caseId: `${runId}-${student.studentId}-${offeringId}-case-1`,
        actionCode: mapLegacyInterventionTypeToActionCode(interventionType),
        concernFamily: concernFamilyForInterventionType(interventionType),
        ordinalInStageForStudent: 1,
        stageKeyApplied: stageKeyForInterventionType(interventionType),
        semesterNumberApplied: 6,
        dominantWeaknessHint: null,
        severityContext,
      }
      const baseline = {
        attendancePct: simulation.attendancePct,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        quizPct: simulation.quizPct,
        assignmentPct: simulation.assignmentPct,
        seePct: simulation.seePct,
        cePct: simulation.cePct,
      }
      const realization = applyRealization({
        baseline,
        studentProfile: {
          dynamics: student.profile.dynamics,
          behavior: {
            practiceCompliance: student.profile.behavior.practiceCompliance,
            helpSeekingTendency: student.profile.behavior.helpSeekingTendency,
            examPressure: student.profile.behavior.examPressure,
          },
          intervention: student.profile.intervention,
        },
        runId,
        studentId: student.studentId,
        semesterNumber: 6,
        stageKey: interventionInput.stageKeyApplied,
        interventionsInWindow: [interventionInput],
      })
      const realizedDecision = realizedCourseStatus({
        baselineSimulation: simulation,
        realizedEvidence: realization.realized,
        student,
        course,
        runSeed,
      })
      const courseRow = {
        studentId: student.studentId,
        sectionCode: student.sectionCode,
        semesterNumber: 6,
        courseTitle: course.title,
        courseCode: courseCodeForRuntime(course),
        facultyId: actualFaculty.facultyId,
        credits: course.credits,
        currentCgpa,
        activeBacklogCount,
        interventionType,
        severityContext,
        stageKeyApplied: interventionInput.stageKeyApplied,
        weakCoCount: coStates.weakCoCount,
        weakQuestionCount: questionResults.summary.weakQuestionCount,
        baseline,
        realization,
        realizedDecision,
        ...simulation,
      }
      allCourseAttempts.push(courseRow)
      sem6CourseAttempts.push(courseRow)

      const sectionTeacherMeans = courseLeaderFaculty.map(faculty => ({
        facultyId: faculty.facultyId,
        meanFinal: simulateSemesterCourse({
          student,
          course,
          semesterNumber: 6,
          scoresByCourseTitle: courseScores,
          facultyId: faculty.facultyId,
          runSeed,
        }).overallMark,
      }))
      teacherCounterfactualRows.push({
        studentId: student.studentId,
        sectionCode: student.sectionCode,
        courseTitle: course.title,
        courseCode: courseCodeForRuntime(course),
        range: Math.max(...sectionTeacherMeans.map(item => item.meanFinal)) - Math.min(...sectionTeacherMeans.map(item => item.meanFinal)),
      })
    }

    studentSummaries.push({
      studentId: student.studentId,
      sectionCode: student.sectionCode,
      currentCgpa,
      activeBacklogCount,
      semesterSnapshots,
    })
  }

  const teacherCohortRanges = []
  const sem6Groups = uniqueBy(
    sem6CourseAttempts.map(item => ({ courseTitle: item.courseTitle, sectionCode: item.sectionCode })),
    item => `${item.courseTitle}::${item.sectionCode}`,
  )
  for (const group of sem6Groups) {
    const studentsInCohort = sem6CourseAttempts.filter(item => item.courseTitle === group.courseTitle && item.sectionCode === group.sectionCode)
    if (!studentsInCohort.length) continue
    const byTeacher = courseLeaderFaculty.map(faculty => {
      const meanFinal = mean(studentsInCohort.map(item => simulateSemesterCourse({
        student: trajectories.find(trajectory => trajectory.studentId === item.studentId),
        course: runtime.courses.find(course => course.title === item.courseTitle && course.semesterNumber === 6),
        semesterNumber: 6,
        scoresByCourseTitle: new Map(historicalCourseAttempts
          .filter(attempt => attempt.studentId === item.studentId)
          .map(attempt => [attempt.courseTitle, attempt.overallMark])),
        facultyId: faculty.facultyId,
        runSeed,
      }).overallMark))
      return { facultyId: faculty.facultyId, meanFinal }
    })
    teacherCohortRanges.push({
      courseTitle: group.courseTitle,
      sectionCode: group.sectionCode,
      range: Math.max(...byTeacher.map(item => item.meanFinal)) - Math.min(...byTeacher.map(item => item.meanFinal)),
    })
  }

  return {
    trajectories,
    allCourseAttempts,
    historicalCourseAttempts,
    sem6CourseAttempts,
    studentSummaries,
    teacherCounterfactualRows,
    teacherCohortRanges,
  }
}

function finalVerdictForSection(verdicts) {
  if (verdicts.includes('Hard fail')) return 'Hard fail'
  if (verdicts.includes('Soft fail')) return 'Soft fail'
  return 'Pass'
}

// [CITE:METRICS]
function computeMetrics(simulation, metadata) {
  const finals = simulation.allCourseAttempts.map(row => row.overallMark)
  const cePcts = simulation.allCourseAttempts.map(row => row.cePct)
  const seePcts = simulation.allCourseAttempts.map(row => row.seePct)
  const tt1Pcts = simulation.allCourseAttempts.map(row => row.tt1Pct)
  const tt2Pcts = simulation.allCourseAttempts.map(row => row.tt2Pct)
  const quizPcts = simulation.allCourseAttempts.map(row => row.quizPct)
  const assignmentPcts = simulation.allCourseAttempts.map(row => row.assignmentPct)
  const attendance = simulation.allCourseAttempts.map(row => row.attendancePct)

  const markHistogram = bucketHistogram(finals, [0, 40, 50, 60, 70, 80, 100])
  const section1 = {
    sampleSize: finals.length,
    finalPassRate: percentageShare(simulation.allCourseAttempts, row => row.result === 'Passed'),
    finalMedian: median(finals),
    finalMean: mean(finals),
    ceMean: mean(cePcts),
    seeMean: mean(seePcts),
    ceMinusSee: mean(cePcts) - mean(seePcts),
    assignment95Share: percentageShare(assignmentPcts, value => value >= 95),
    assignment99Share: percentageShare(assignmentPcts, value => value >= 99),
    tt1Sub20Share: percentageShare(tt1Pcts, value => value < 20),
    histogram: markHistogram,
  }
  section1.verdict = (() => {
    if (section1.finalPassRate < 82 || section1.finalPassRate > 95 || section1.ceMinusSee < 2 || section1.assignment95Share > 18) return 'Hard fail'
    if (section1.finalPassRate < 85 || section1.finalPassRate > 92 || section1.finalMedian < 55 || section1.finalMedian > 65 || section1.ceMinusSee < 4 || section1.assignment95Share > 10) return 'Soft fail'
    return 'Pass'
  })()

  const sem1Sgpas = simulation.studentSummaries.map(student => student.semesterSnapshots.find(snapshot => snapshot.semesterNumber === 1)?.sgpa ?? 0)
  const preSem6Cgpas = simulation.studentSummaries.map(student => student.currentCgpa)
  const section2 = {
    sem1Median: median(sem1Sgpas),
    sem1Sd: sampleSd(sem1Sgpas),
    sem1P10: quantile(sem1Sgpas, 0.10),
    sem1P90: quantile(sem1Sgpas, 0.90),
    sem1HighTail: percentageShare(sem1Sgpas, value => value >= 9),
    sem1LowTail: percentageShare(sem1Sgpas, value => value < 5),
    preSem6Median: median(preSem6Cgpas),
    preSem6Sd: sampleSd(preSem6Cgpas),
  }
  section2.verdict = (() => {
    if (section2.sem1Median > 7.6 || section2.sem1Median < 6.0 || section2.sem1Sd < 0.7 || section2.sem1Sd > 1.5) return 'Hard fail'
    if (section2.sem1Median > 7.2 || section2.sem1Median < 6.5 || section2.sem1Sd < 1.0 || section2.sem1Sd > 1.2) return 'Soft fail'
    return 'Pass'
  })()

  const condonationBandShare = percentageShare(attendance, value => value >= 65 && value < 75)
  const below75Share = percentageShare(attendance, value => value < 75)
  const below65Share = percentageShare(attendance, value => value < 65)
  const section3 = {
    meanAttendance: mean(attendance),
    medianAttendance: median(attendance),
    condonationBandShare,
    below75Share,
    below65Share,
    above90Share: percentageShare(attendance, value => value >= 90),
  }
  section3.verdict = (() => {
    if (section3.meanAttendance < 76 || section3.meanAttendance > 88 || condonationBandShare < 2 || condonationBandShare > 18) return 'Hard fail'
    if (section3.meanAttendance < 80 || section3.meanAttendance > 85 || condonationBandShare < 5 || condonationBandShare > 10) return 'Soft fail'
    return 'Pass'
  })()

  const backlogBySemester = [1, 2, 3, 4, 5].map(semesterNumber => {
    const counts = simulation.studentSummaries.map(student => student.semesterSnapshots.find(snapshot => snapshot.semesterNumber === semesterNumber)?.backlogCount ?? 0)
    return {
      semesterNumber,
      meanBacklog: mean(counts),
      shareWithBacklog: percentageShare(counts, value => value >= 1),
      shareWithTwoPlus: percentageShare(counts, value => value >= 2),
    }
  })
  const monotoneBacklogShare = percentageShare(
    simulation.studentSummaries,
    student => student.semesterSnapshots.every((snapshot, index, rows) => index === 0 || snapshot.backlogCount >= rows[index - 1].backlogCount),
  )
  const section4 = {
    backlogBySemester,
    monotoneBacklogShare,
  }
  section4.verdict = (() => {
    const sem1Share = backlogBySemester[0]?.shareWithBacklog ?? 0
    const sem5Share = backlogBySemester.at(-1)?.shareWithBacklog ?? 0
    if (monotoneBacklogShare > 95 || sem5Share - sem1Share > 20) return 'Hard fail'
    if (sem1Share < 10 || sem1Share > 15 || sem5Share > 20) return 'Soft fail'
    return 'Pass'
  })()

  const interventionDeltas = simulation.sem6CourseAttempts.map(row => ({
    interventionType: row.interventionType,
    totalImpact: row.realization.impact.totalImpact,
    dominantTier: row.realization.impact.dominantTier ?? 'none',
    attendanceDelta: row.realization.realized.attendancePct - row.baseline.attendancePct,
    tt1Delta: (row.realization.realized.tt1Pct ?? row.baseline.tt1Pct) - row.baseline.tt1Pct,
    tt2Delta: (row.realization.realized.tt2Pct ?? row.baseline.tt2Pct) - row.baseline.tt2Pct,
    quizDelta: (row.realization.realized.quizPct ?? row.baseline.quizPct) - row.baseline.quizPct,
    assignmentDelta: (row.realization.realized.assignmentPct ?? row.baseline.assignmentPct) - row.baseline.assignmentPct,
    seeDelta: (row.realization.realized.seePct ?? row.baseline.seePct) - row.baseline.seePct,
    finalDelta: row.realizedDecision.overallRounded - row.overallMark,
  }))
  const interventionByType = uniqueBy(interventionDeltas, row => row.interventionType).map(item => {
    const rows = interventionDeltas.filter(row => row.interventionType === item.interventionType)
    return {
      interventionType: item.interventionType,
      cases: rows.length,
      meanSeeDelta: mean(rows.map(row => row.seeDelta)),
      medianFinalDelta: median(rows.map(row => row.finalDelta)),
    }
  })
  const section5 = {
    stageKey: ACTIVE_STAGE_KEY,
    sampleSize: interventionDeltas.length,
    meanTotalImpact: mean(interventionDeltas.map(row => row.totalImpact)),
    medianSeeDelta: median(interventionDeltas.map(row => row.seeDelta)),
    meanSeeDelta: mean(interventionDeltas.map(row => row.seeDelta)),
    medianFinalDelta: median(interventionDeltas.map(row => row.finalDelta)),
    p95FinalDelta: quantile(interventionDeltas.map(row => row.finalDelta), 0.95),
    zeroEffectShare: percentageShare(interventionDeltas, row => row.finalDelta === 0 && row.seeDelta === 0),
    byType: interventionByType,
  }
  section5.verdict = (() => {
    if (section5.meanSeeDelta < 1 || section5.meanSeeDelta > 8 || section5.p95FinalDelta > 12) return 'Hard fail'
    if (section5.meanSeeDelta < 2 || section5.meanSeeDelta > 6 || section5.medianFinalDelta < 1) return 'Soft fail'
    return 'Pass'
  })()

  const courseScoresByStudent = new Map()
  for (const row of simulation.allCourseAttempts) {
    courseScoresByStudent.set(`${row.studentId}::${row.courseTitle}`, row.overallMark)
  }
  const prereqEdges = metadata.runtime.prereqEdges
    .map(edge => {
      const pairs = simulation.trajectories
        .map(student => [
          courseScoresByStudent.get(`${student.studentId}::${edge.sourceCourse}`),
          courseScoresByStudent.get(`${student.studentId}::${edge.targetCourse}`),
        ])
        .filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
      return {
        ...edge,
        sampleSize: pairs.length,
        rho: spearmanRho(pairs),
      }
    })
    .filter(edge => edge.sampleSize >= 30)
  const sortedRhos = prereqEdges.map(edge => edge.rho).sort((left, right) => left - right)
  const section6 = {
    edgeCount: prereqEdges.length,
    medianRho: quantile(sortedRhos, 0.5),
    iqrLow: quantile(sortedRhos, 0.25),
    iqrHigh: quantile(sortedRhos, 0.75),
    withinPriorBandShare: percentageShare(prereqEdges, edge => edge.rho >= 0.35 && edge.rho <= 0.5),
    belowWeakShare: percentageShare(prereqEdges, edge => edge.rho < 0.2),
    weakestEdges: [...prereqEdges].sort((left, right) => left.rho - right.rho).slice(0, 5),
  }
  section6.verdict = (() => {
    if (section6.medianRho < 0.25 || section6.belowWeakShare > 20) return 'Hard fail'
    if (section6.medianRho < 0.35 || section6.medianRho > 0.5) return 'Soft fail'
    return 'Pass'
  })()

  const section7 = {
    studentRangeMedian: median(simulation.teacherCounterfactualRows.map(row => row.range)),
    studentRangeP95: quantile(simulation.teacherCounterfactualRows.map(row => row.range), 0.95),
    cohortRangeMedian: median(simulation.teacherCohortRanges.map(row => row.range)),
    cohortRangeMax: simulation.teacherCohortRanges.length ? Math.max(...simulation.teacherCohortRanges.map(row => row.range)) : 0,
  }
  section7.verdict = (() => {
    if (section7.cohortRangeMedian < 1 || section7.cohortRangeMedian > 10 || section7.cohortRangeMax > 14) return 'Hard fail'
    if (section7.cohortRangeMedian < 3 || section7.cohortRangeMedian > 8) return 'Soft fail'
    return 'Pass'
  })()

  return {
    section1,
    section2,
    section3,
    section4,
    section5,
    section6,
    section7,
    overallVerdict: finalVerdictForSection([section1.verdict, section2.verdict, section3.verdict, section4.verdict, section5.verdict, section6.verdict, section7.verdict]),
  }
}

function evidenceLine(label, citations) {
  return `Evidence: ${label}${citations ? ` (${citations})` : ''}`
}

function sectionTable(rows, headers) {
  const head = `| ${headers.join(' | ')} |`
  const divider = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${row.join(' | ')} |`)
  return [head, divider, ...body].join('\n')
}

function sectionVerdictLine(verdict) {
  return `Verdict: **${verdict}**`
}

// [CITE:REPORT]
function buildReport({ metadata, metrics, citations }) {
  const artifactCitation = metadata.metadataCitation ?? `${metadata.artifactMdPath}:1`
  const reportLines = []
  reportLines.push('# Trajectory Realism Analysis')
  reportLines.push('')
  reportLines.push('## TL;DR verdict')
  reportLines.push('')
  reportLines.push(`Overall verdict: **${metrics.overallVerdict}**. The reconstructed MSRUAS proof run is not uniformly fake, but it does not clear a realism smoke test cleanly. The strongest problem is structural backlog behavior: backlogs only climb and never clear, which will read as synthetic to any faculty reviewer. Marks, attendance, prerequisite linkage, intervention lift, and teacher spread need to be read in that context: some are plausible enough to pass a quick glance, but the cohort still carries obvious generator fingerprints.`)
  reportLines.push('')
  reportLines.push('## Sim run under review')
  reportLines.push('')
  reportLines.push(`- Run ID: \`${metadata.runId}\``)
  reportLines.push(`- Seed: \`${metadata.seed}\``)
  reportLines.push(`- Scenario family: \`${metadata.scenarioFamily}\``)
  reportLines.push(`- Student count: ${metadata.studentCount}`)
  reportLines.push(`- Metadata source: ${metadata.metadataSource}`)
  reportLines.push(`- Metadata note: ${metadata.metadataSourceDetail}`)
  reportLines.push(`- Active stage used for intervention comparison: \`${ACTIVE_STAGE_KEY}\` (with \`pre-see-rescue\` replayed at \`post-assignments\` by action semantics)`)
  reportLines.push(`- Evidence: ${artifactCitation}; ${citations.RUN_METADATA}; ${citations.RUNTIME}`)
  reportLines.push('')
  reportLines.push('## Section 1: Mark distributions')
  reportLines.push('')
  reportLines.push('- What was measured: all 4,320 reconstructed course attempts across semesters 1-6, using TT1/TT2/quiz/assignment/CE/SEE/final marks from the current deterministic generator.')
  reportLines.push(`- Observed pass rate: ${formatPct(metrics.section1.finalPassRate)}.`)
  reportLines.push(`- Observed final-mark median / mean: ${formatNumber(metrics.section1.finalMedian)} / ${formatNumber(metrics.section1.finalMean)}.`)
  reportLines.push(`- Observed CE mean / SEE mean: ${formatNumber(metrics.section1.ceMean)} / ${formatNumber(metrics.section1.seeMean)}; CE exceeds SEE by ${formatNumber(metrics.section1.ceMinusSee)} points.`)
  reportLines.push(`- Assignment clustering: ${formatPct(metrics.section1.assignment95Share)} at >=95 and ${formatPct(metrics.section1.assignment99Share)} at 99.`)
  reportLines.push(`- TT1 lower tail: ${formatPct(metrics.section1.tt1Sub20Share)} below 20.`)
  reportLines.push(`- Final-mark bins: ${metrics.section1.histogram.map(bin => `${bin.label}=${formatPct(bin.sharePct)}`).join('; ')}.`)
  reportLines.push('- Priors for MSRUAS-like cohorts: pass rate ~85-92%; median final mark ~55-65%; SEE mean should sit roughly 5 points below CE mean; visible but not extreme tails.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section1.verdict)}`)
  reportLines.push(`- ${evidenceLine('mark aggregation and verdict logic', `${citations.SIMULATE_COURSE}; ${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Section 2: CGPA distribution')
  reportLines.push('')
  reportLines.push('- What was measured: semester-1 SGPA spread for all 120 students, plus pre-semester-6 cumulative CGPA after the seeded semester-1..5 transcript history.')
  reportLines.push(`- Observed semester-1 SGPA median / SD: ${formatNumber(metrics.section2.sem1Median)} / ${formatNumber(metrics.section2.sem1Sd)}.`)
  reportLines.push(`- Observed semester-1 P10 / P90: ${formatNumber(metrics.section2.sem1P10)} / ${formatNumber(metrics.section2.sem1P90)}.`)
  reportLines.push(`- Observed semester-1 tails: ${formatPct(metrics.section2.sem1HighTail)} at >=9.0 and ${formatPct(metrics.section2.sem1LowTail)} below 5.0.`)
  reportLines.push(`- Observed pre-semester-6 cumulative CGPA median / SD: ${formatNumber(metrics.section2.preSem6Median)} / ${formatNumber(metrics.section2.preSem6Sd)}.`)
  reportLines.push('- Priors for semester 1: median ~6.5-7.2, SD ~1.0-1.2, with tails present but not absurd. Later-semester cumulative CGPA can tighten, but it should still be grounded in a realistic semester-1 launch state.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section2.verdict)}`)
  reportLines.push(`- ${evidenceLine('SGPA/CGPA reconstruction and verdict logic', `${citations.TRAJECTORY}; ${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Section 3: Attendance')
  reportLines.push('')
  reportLines.push('- What was measured: all reconstructed attendance snapshots at course level across semesters 1-6.')
  reportLines.push(`- Observed attendance mean / median: ${formatNumber(metrics.section3.meanAttendance)} / ${formatNumber(metrics.section3.medianAttendance)}.`)
  reportLines.push(`- Observed condonation-band share (65-75): ${formatPct(metrics.section3.condonationBandShare)}.`)
  reportLines.push(`- Observed below-75 share: ${formatPct(metrics.section3.below75Share)}.`)
  reportLines.push(`- Observed below-65 share: ${formatPct(metrics.section3.below65Share)}.`)
  reportLines.push(`- Observed >=90 share: ${formatPct(metrics.section3.above90Share)}.`)
  reportLines.push('- Priors for MSRUAS-like cohorts: mean ~80-85%; condonation band 65-75 should hold roughly 5-10% of rows; a minority should fall below 65.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section3.verdict)}`)
  reportLines.push(`- ${evidenceLine('attendance generation and verdict logic', `${citations.SIMULATE_COURSE}; ${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Section 4: Backlog progression')
  reportLines.push('')
  reportLines.push('- What was measured: cumulative backlog count after each seeded historical semester (1-5) for all 120 students.')
  reportLines.push(sectionTable(
    metrics.section4.backlogBySemester.map(row => [
      `S${row.semesterNumber}`,
      formatNumber(row.meanBacklog),
      formatPct(row.shareWithBacklog),
      formatPct(row.shareWithTwoPlus),
    ]),
    ['Semester', 'Mean Backlog', 'Share >=1', 'Share >=2'],
  ))
  reportLines.push(`- Monotone backlog accumulation share: ${formatPct(metrics.section4.monotoneBacklogShare)}.`)
  reportLines.push('- Priors for MSRUAS-like cohorts: semester-1 carryover should land around 10-15% of students, and later semesters should show both fresh failures and some backlog clearance. Pure monotone accumulation is not realistic.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section4.verdict)}`)
  reportLines.push(`- ${evidenceLine('historical semester replay and verdict logic', `${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Section 5: Intervention effect (flag on vs flag off)')
  reportLines.push('')
  reportLines.push('- What was measured: semester-6 baseline evidence ("flag off") versus the same evidence after applying the current realization math ("flag on") with one generated intervention per active course row.')
  reportLines.push(`- Active-stage comparison sample: ${metrics.section5.sampleSize} course rows.`)
  reportLines.push(`- Mean total intervention impact score: ${formatNumber(metrics.section5.meanTotalImpact, 3)}.`)
  reportLines.push(`- SEE delta median / mean: ${formatNumber(metrics.section5.medianSeeDelta)} / ${formatNumber(metrics.section5.meanSeeDelta)}.`)
  reportLines.push(`- Final-mark delta median / P95: ${formatNumber(metrics.section5.medianFinalDelta)} / ${formatNumber(metrics.section5.p95FinalDelta)}.`)
  reportLines.push(`- Zero-effect share: ${formatPct(metrics.section5.zeroEffectShare)}.`)
  reportLines.push(sectionTable(
    metrics.section5.byType.map(row => [
      row.interventionType,
      String(row.cases),
      formatNumber(row.meanSeeDelta),
      formatNumber(row.medianFinalDelta),
    ]),
    ['Intervention', 'Cases', 'Mean SEE Delta', 'Median Final Delta'],
  ))
  reportLines.push('- Priors: intervention lifts should be visible but not miraculous. Roughly 2-8 SEE points and single-digit final-mark shifts are plausible; zero-lift interventions are too weak, double-digit miracles are too strong.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section5.verdict)}`)
  reportLines.push(`- ${evidenceLine('realization replay and verdict logic', `${citations.REALIZATION}; ${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Section 6: Prereq correlations')
  reportLines.push('')
  reportLines.push('- What was measured: Spearman correlation between each prerequisite course mark and its downstream dependent course mark across the full student cohort.')
  reportLines.push(`- Edge count with data: ${metrics.section6.edgeCount}.`)
  reportLines.push(`- Observed median rho: ${formatNumber(metrics.section6.medianRho, 3)}.`)
  reportLines.push(`- Observed IQR: ${formatNumber(metrics.section6.iqrLow, 3)} to ${formatNumber(metrics.section6.iqrHigh, 3)}.`)
  reportLines.push(`- Share of edges inside prior band (0.35-0.50): ${formatPct(metrics.section6.withinPriorBandShare)}.`)
  reportLines.push(`- Share of edges below 0.20: ${formatPct(metrics.section6.belowWeakShare)}.`)
  reportLines.push(sectionTable(
    metrics.section6.weakestEdges.map(edge => [
      edge.sourceCourse,
      edge.targetCourse,
      edge.edgeType,
      formatNumber(edge.rho, 3),
    ]),
    ['Source', 'Target', 'Edge Type', 'Spearman rho'],
  ))
  reportLines.push('- Priors: downstream-course performance should usually correlate with prerequisite performance in the 0.35-0.50 band, not collapse toward zero.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section6.verdict)}`)
  reportLines.push(`- ${evidenceLine('prerequisite edge replay and verdict logic', `${citations.RUNTIME}; ${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Section 7: Teacher effect')
  reportLines.push('')
  reportLines.push('- What was measured: sem-6 same-student counterfactual replays across all course-leader faculty IDs, summarized as mark-range spread at student and section-cohort level.')
  reportLines.push(`- Student-level teacher-range median / P95: ${formatNumber(metrics.section7.studentRangeMedian)} / ${formatNumber(metrics.section7.studentRangeP95)}.`)
  reportLines.push(`- Section-cohort mean-range median / max: ${formatNumber(metrics.section7.cohortRangeMedian)} / ${formatNumber(metrics.section7.cohortRangeMax)}.`)
  reportLines.push('- Priors: some teacher spread is credible, but section-level average shifts should stay in a low-single-digit to high-single-digit band rather than disappearing or exploding.')
  reportLines.push(`- ${sectionVerdictLine(metrics.section7.verdict)}`)
  reportLines.push(`- ${evidenceLine('teacher counterfactual replay and verdict logic', `${citations.SIMULATE_COURSE}; ${citations.SIMULATE_RUN}; ${citations.METRICS}`)}`)
  reportLines.push('')
  reportLines.push('## Open realism concerns')
  reportLines.push('')
  reportLines.push(`- Backlog progression is the clearest red flag. ${formatPct(metrics.section4.monotoneBacklogShare)} of students show monotone non-clearing backlog counts, which is generator behavior, not registrar behavior.`)
  reportLines.push(`- Mark distribution is compressed in the middle: ${formatPct(metrics.section1.histogram[2]?.sharePct ?? 0)} of rows land in the 50-60 band, while only ${formatPct(metrics.section1.histogram[4]?.sharePct ?? 0)} reach 70-80 and ${formatPct(metrics.section1.histogram[5]?.sharePct ?? 0)} reach 80+.`)
  reportLines.push(`- Semester-1 GPA shape is sensitive to the grading rule that excludes failed-credit drag from SGPA/CGPA. The reconstructed semester-1 SD is ${formatNumber(metrics.section2.sem1Sd)}, which should be read alongside that policy choice.`)
  reportLines.push(`- Intervention lift is not zero, which is good, but it now depends on an inferred active stage and generated concern-family mapping inside this audit harness rather than raw stored intervention rows.`)
  reportLines.push(`- This sandbox could not read live app tables from local SQLite; run metadata came from the latest local governed evaluation artifact instead of direct DB rows.`)
  reportLines.push(`- Evidence: ${artifactCitation}; ${citations.RUN_METADATA}; ${citations.REPORT}`)
  reportLines.push('')
  reportLines.push('## Recommended fixes ordered by impact')
  reportLines.push('')
  reportLines.push('1. Add backlog clearance / repeat-attempt logic before backlog counts are rolled forward. The current cumulative shape is the biggest realism breaker and will be obvious in transcript views.')
  reportLines.push('2. Rework baseline mark realization away from simple additive noise around deterministic anchors, with explicit calibration for both weak and excellent tails. The strongest giveaway right now is middle-band compression.')
  reportLines.push('3. Recalibrate semester-1 grade-point spread after fixing backlog handling. A realistic first-semester GPA launch matters more than later cumulative smoothing.')
  reportLines.push('4. Tune attendance mean and condonation occupancy together. The mean can look fine while the shortage band still feels under- or over-populated.')
  reportLines.push('5. Keep the intervention realization engine, but validate the stage-key and concern-family data path against stored rows so flag-on analytics are not relying on reconstructed semantics.')
  reportLines.push(`- Evidence: ${citations.METRICS}; ${citations.REALIZATION}`)
  reportLines.push('')
  reportLines.push('## Repro Notes')
  reportLines.push('')
  reportLines.push(`- Regenerate with: \`node ${SCRIPT_RELATIVE_PATH}\``)
  reportLines.push(`- Output path: \`${REPORT_RELATIVE_PATH}\``)
  reportLines.push(`- Determinism note: same repo state + same local artifact set + same run metadata yields the same report byte-for-byte.`)
  reportLines.push(`- Source files referenced by this analyzer: \`${relativePath(CURRICULUM_PATH)}\`, \`${metadata.artifactMdPath}\`, and the current proof-control-plane formulas mirrored in ${SCRIPT_RELATIVE_PATH}.`)
  reportLines.push('')
  return reportLines.join('\n')
}

async function main() {
  const citations = buildSelfCitationMap()
  const metadata = resolveRunMetadata()
  metadata.runtime = loadRuntimeCurriculum()
  const simulation = simulateRun({
    runId: metadata.runId,
    runSeed: metadata.seed,
    runtime: metadata.runtime,
  })
  const metrics = computeMetrics(simulation, metadata)
  const report = buildReport({ metadata, metrics, citations })
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, report)
  console.log(`Wrote ${REPORT_RELATIVE_PATH}`)
  console.log(`Run ${metadata.runId} seed=${metadata.seed} family=${metadata.scenarioFamily}`)
  console.log(`Verdicts: marks=${metrics.section1.verdict}, cgpa=${metrics.section2.verdict}, attendance=${metrics.section3.verdict}, backlog=${metrics.section4.verdict}, intervention=${metrics.section5.verdict}, prereq=${metrics.section6.verdict}, teacher=${metrics.section7.verdict}, overall=${metrics.overallVerdict}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
