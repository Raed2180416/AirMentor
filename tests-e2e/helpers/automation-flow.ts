/**
 * Automation Flow Helpers for the Massive 6-Semester E2E Evaluation
 *
 * Uses API-driven approach for bulk data entry (proven by demo-reality-realism-hardening.spec.ts)
 * and UI interactions only for scheme setup, question configuration, and HoD approval.
 */
import type { Page } from '@playwright/test'
import { apiPath } from './api-url'
import { csrfHeaders, readJson } from './proof-run-api'

// ─── Types ───────────────────────────────────────────────────────

type RequestContext = {
  get(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
  post(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
  put(url: string, options?: Record<string, unknown>): Promise<{ text(): Promise<string>; ok(): boolean; status(): number }>
}

type EntryKind = 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'finals'

interface MarkComponent {
  componentCode: string
  score: number
  maxScore: number
}

interface StudentEntry {
  studentId: string
  components: MarkComponent[]
}

interface AttendanceEntry {
  studentId: string
  presentClasses: number
  totalClasses: number
}

export interface TrajectoryCase {
  label: string
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
  attendancePct: number
  seePct: number
}

export interface IssueLog {
  phase: string
  semester: number
  severity: 'bug' | 'ux-friction' | 'visual' | 'missing-feature' | 'performance'
  description: string
  screenshot?: string
}

// ─── Constants ───────────────────────────────────────────────────

const SCRATCH = '/home/raed/.gemini/antigravity/scratch'

/** The 4 trajectory archetypes for special-case students */
export const TRAJECTORY_CASES: TrajectoryCase[] = [
  { label: 'Case 1: Mediocre all-round', tt1Pct: 0.50, tt2Pct: 0.50, quizPct: 0.50, assignmentPct: 0.50, attendancePct: 0.70, seePct: 0.50 },
  { label: 'Case 2: Fluctuating (good→mid→good)', tt1Pct: 0.90, tt2Pct: 0.50, quizPct: 0.80, assignmentPct: 0.80, attendancePct: 0.85, seePct: 0.80 },
  { label: 'Case 3: Declining (good→bad→mid)', tt1Pct: 0.90, tt2Pct: 0.30, quizPct: 0.50, assignmentPct: 0.50, attendancePct: 0.75, seePct: 0.50 },
  { label: 'Case 4: Late bloomer (bad→good, bad attendance)', tt1Pct: 0.20, tt2Pct: 0.85, quizPct: 0.60, assignmentPct: 0.50, attendancePct: 0.40, seePct: 0.80 },
]

/** Scheme configurations to experiment with across semesters. */
export const SCHEME_CONFIGS = [
  { sem: 1, assignments: 2, quizzes: 2, label: 'Baseline: 2A/2Q' },
  { sem: 2, assignments: 3, quizzes: 0, label: 'Assignment-only: 3A/0Q' },
  { sem: 3, assignments: 0, quizzes: 2, label: 'Quiz-only: 0A/2Q' },
  { sem: 4, assignments: 2, quizzes: 1, label: 'Unbalanced: 2A/1Q' },
  { sem: 5, assignments: 1, quizzes: 2, label: 'Quiz-heavy: 1A/2Q' },
  { sem: 6, assignments: 2, quizzes: 2, label: 'Return to baseline: 2A/2Q' },
]

// ─── Mark Generation ─────────────────────────────────────────────

/**
 * Generate a deterministic score for a student based on their tier.
 * Uses a hash-like function for reproducibility.
 */
function deterministicScore(studentIndex: number, kind: string, maxScore: number, pct: number): number {
  // Add slight per-student variation (±10% of target) for realism
  const hash = ((studentIndex * 7 + kind.charCodeAt(0) * 13) % 21) - 10 // -10 to +10
  const variation = (hash / 100) * maxScore
  const raw = Math.round(pct * maxScore + variation)
  return Math.max(0, Math.min(maxScore, raw))
}

/**
 * Generate marks payload for all students in a course offering.
 *
 * @param kind - Assessment type (tt1, tt2, quiz, assignment, see)
 * @param studentIds - All student IDs in the course
 * @param specialStudentIds - Student IDs with special trajectories (first 10)
 * @param trajectoryMap - Map of studentId → TrajectoryCase
 * @param questionCount - Number of questions (default 5)
 * @param maxPerQuestion - Max marks per question (default 5)
 */
export function generateMarksPayload(
  kind: EntryKind,
  studentIds: string[],
  specialStudentIds: Set<string>,
  trajectoryMap: Map<string, TrajectoryCase>,
  components: { id: string, maxScore: number }[],
): StudentEntry[] {
  const entries: StudentEntry[] = []

  for (let i = 0; i < studentIds.length; i++) {
    const studentId = studentIds[i]
    let pct: number

    if (specialStudentIds.has(studentId)) {
      // Use trajectory case
      const trajectory = trajectoryMap.get(studentId)!
      // Map 'finals' kind → 'seePct' in the trajectory data
      const trajectoryKey = kind === 'finals' ? 'seePct' : `${kind}Pct`
      pct = trajectory[trajectoryKey as keyof TrajectoryCase] as number
    } else {
      // Normal distribution: average (56-80%), top (80-100%), bottom (0-52%)
      const normalIndex = i - [...specialStudentIds].length
      if (normalIndex < 0) {
        pct = 0.65 // fallback
      } else if (normalIndex < 77) {
        // Average tier: ~67% of normal students -> 56-80% marks
        pct = 0.56 + ((normalIndex * 7 + 13) % 25) / 100
      } else if (normalIndex < 96) {
        // Top tier: ~17% of normal students -> 80-100% marks
        pct = 0.80 + ((normalIndex * 3 + 7) % 21) / 100
      } else {
        // Bottom tier: ~17% of normal students -> 0-52% marks
        pct = ((normalIndex * 11 + 3) % 53) / 100
      }
    }

    const marks: MarkComponent[] = []
    for (const comp of components) {
      const score = deterministicScore(i, comp.id, comp.maxScore, pct)
      marks.push({
        componentCode: comp.id,
        score,
        maxScore: comp.maxScore,
      })
    }

    entries.push({ studentId, components: marks })
  }

  return entries
}

/**
 * Generate attendance payload for all students.
 */
export function generateAttendancePayload(
  studentIds: string[],
  specialStudentIds: Set<string>,
  trajectoryMap: Map<string, TrajectoryCase>,
  totalClasses = 40,
): AttendanceEntry[] {
  return studentIds.map((studentId, i) => {
    const trajectory = trajectoryMap.get(studentId)
    if (!trajectory) throw new Error(`Trajectory missing for student ${studentId}`)
    const pct = trajectory.attendancePct as number

    const present = Math.round(pct * totalClasses)
    return { studentId, presentClasses: present, totalClasses }
  })
}

// ─── Scheme Discovery ────────────────────────────────────────────

interface ComponentDef {
  id: string
  maxScore: number
}

/**
 * Fetch the assessment scheme for an offering to discover quiz/assignment component IDs.
 */
export async function getOfferingScheme(
  request: RequestContext,
  offeringId: string,
  csrfToken: string,
): Promise<Record<string, unknown>> {
  const response = await request.get(
    apiPath(`/api/academic/offerings/${offeringId}/scheme`),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, `Read scheme for ${offeringId}`)
}

/**
 * Fetch the question paper blueprint for an offering+kind to discover leaf component IDs.
 */
export async function getQuestionPaper(
  request: RequestContext,
  offeringId: string,
  kind: 'tt1' | 'tt2',
  csrfToken: string,
): Promise<Record<string, unknown>> {
  const response = await request.get(
    apiPath(`/api/academic/offerings/${offeringId}/question-papers/${kind}`),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, `Read question paper ${kind} for ${offeringId}`)
}

/**
 * Discover allowed component codes for a given eval kind from the scheme/blueprint.
 * Falls back to generic component codes if API calls fail.
 */
export async function discoverComponents(
  request: RequestContext,
  offeringId: string,
  kind: EntryKind,
  csrfToken: string,
): Promise<ComponentDef[]> {
  try {
    if (kind === 'tt1' || kind === 'tt2') {
      // TT1/TT2: Component IDs come from the question paper blueprint leaf nodes
      const paper = await getQuestionPaper(request, offeringId, kind, csrfToken)
      const blueprint = paper.blueprint as Record<string, unknown> | undefined
      if (blueprint) {
        const nodes = Array.isArray(blueprint.nodes) ? blueprint.nodes : []
        const leaves: ComponentDef[] = []
        function extractLeaves(nodeList: unknown[]) {
          for (const node of nodeList) {
            const n = node as Record<string, unknown>
            if (Array.isArray(n.children) && n.children.length > 0) {
              extractLeaves(n.children)
            } else {
              // Leaf node
              leaves.push({ id: String(n.id), maxScore: Number(n.maxMarks ?? 5) })
            }
          }
        }
        extractLeaves(nodes)
        if (leaves.length > 0) return leaves
      }
      // Fall back to default 5 questions × 5 marks
      return Array.from({ length: 5 }, (_, i) => ({ id: `${kind}-q${i + 1}-p1`, maxScore: 5 }))
    }

    if (kind === 'quiz' || kind === 'assignment') {
      const schemeData = await getOfferingScheme(request, offeringId, csrfToken)
      const scheme = schemeData.scheme as Record<string, unknown> | undefined
      if (scheme) {
        const components = kind === 'quiz'
          ? (Array.isArray(scheme.quizComponents) ? scheme.quizComponents : [])
          : (Array.isArray(scheme.assignmentComponents) ? scheme.assignmentComponents : [])
        if (components.length > 0) {
          return components.map((c: Record<string, unknown>) => ({
            id: String(c.id),
            maxScore: Number(c.rawMax ?? 10),
          }))
        }
      }
      // Fall back to 2 components × 10 marks
      return Array.from({ length: 2 }, (_, i) => ({ id: `${kind}-${i + 1}`, maxScore: 10 }))
    }

    if (kind === 'finals') {
      const schemeData = await getOfferingScheme(request, offeringId, csrfToken)
      const scheme = schemeData.scheme as Record<string, unknown> | undefined
      const finalsMax = Number(scheme?.finalsMax ?? 100)
      return [{ id: 'see', maxScore: finalsMax }]
    }
  } catch (err) {
    console.log(`    Component discovery failed for ${kind}: ${err}`)
  }

  // Ultimate fallback
  if (kind === 'finals') return [{ id: 'see', maxScore: 100 }]
  return Array.from({ length: 5 }, (_, i) => ({ id: `${kind}-q${i + 1}-p1`, maxScore: 5 }))
}

/**
 * Generate marks payload using discovered component definitions.
 */
export function generateMarksPayloadWithComponents(
  kind: EntryKind,
  studentIds: string[],
  specialStudentIds: Set<string>,
  trajectoryMap: Map<string, TrajectoryCase>,
  components: ComponentDef[],
): StudentEntry[] {
  const entries: StudentEntry[] = []

  for (let i = 0; i < studentIds.length; i++) {
    const studentId = studentIds[i]

    const trajectory = trajectoryMap.get(studentId)
    if (!trajectory) throw new Error(`Trajectory missing for student ${studentId}`)
    const trajectoryKey = kind === 'finals' ? 'seePct' : `${kind}Pct`
    const pct = trajectory[trajectoryKey as keyof TrajectoryCase] as number

    const markComponents: MarkComponent[] = components.map((comp, q) => {
      const score = deterministicScore(i, kind + q, comp.maxScore, pct)
      return {
        componentCode: comp.id,
        score,
        maxScore: comp.maxScore,
      }
    })

    entries.push({ studentId, components: markComponents })
  }

  return entries
}

/**
 * Enter marks for a course offering via API.
 */
export async function enterMarksViaApi(
  request: RequestContext,
  offeringId: string,
  kind: EntryKind,
  entries: StudentEntry[],
  csrfToken: string,
  options: { lock?: boolean; evaluatedAt?: string } = {},
) {
  const response = await request.put(
    apiPath(`/api/academic/offerings/${offeringId}/assessment-entries/${kind}`),
    {
      headers: csrfHeaders(csrfToken),
      data: {
        evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
        entries,
        lock: options.lock ?? false,
      },
    },
  )
  return readJson(response, `Enter ${kind} marks for ${offeringId}`)
}

/**
 * Enter attendance for a course offering via API.
 */
export async function enterAttendanceViaApi(
  request: RequestContext,
  offeringId: string,
  entries: AttendanceEntry[],
  csrfToken: string,
  options: { lock?: boolean; capturedAt?: string } = {},
) {
  const response = await request.put(
    apiPath(`/api/academic/offerings/${offeringId}/attendance`),
    {
      headers: csrfHeaders(csrfToken),
      data: {
        capturedAt: options.capturedAt ?? new Date().toISOString(),
        entries,
        lock: options.lock ?? false,
      },
    },
  )
  return readJson(response, `Enter attendance for ${offeringId}`)
}

/**
 * Unlock (clear lock) for a specific assessment kind.
 */
export async function clearAssessmentLock(
  request: RequestContext,
  offeringId: string,
  kind: EntryKind,
  csrfToken: string,
) {
  const response = await request.post(
    apiPath(`/api/academic/offerings/${offeringId}/assessment-entries/${kind}/clear-lock`),
    {
      headers: csrfHeaders(csrfToken),
      data: {},
    },
  )
  return readJson(response, `Clear ${kind} lock for ${offeringId}`)
}

/**
 * Get the academic bootstrap (course offerings, faculty info).
 */
export async function getAcademicBootstrap(
  request: RequestContext,
  csrfToken: string,
  checkpointId?: string,
) {
  const params = checkpointId ? `?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}` : ''
  const response = await request.get(
    apiPath(`/api/academic/bootstrap${params}`),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, 'Read academic bootstrap')
}

/**
 * Get the HoD proof bundle.
 */
export async function getHodBundle(
  request: RequestContext,
  csrfToken: string,
  checkpointId?: string,
) {
  const params = checkpointId ? `?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}` : ''
  const response = await request.get(
    apiPath(`/api/academic/hod/proof-bundle${params}`),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, 'Read HoD proof bundle')
}

/**
 * Get risk explorer for a student.
 */
export async function getRiskExplorer(
  request: RequestContext,
  csrfToken: string,
  studentId: string,
  runId: string | null,
  checkpointId: string,
) {
  const params = new URLSearchParams()
  if (runId) params.set('simulationRunId', runId)
  params.set('simulationStageCheckpointId', checkpointId)
  const response = await request.get(
    apiPath(`/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer?${params.toString()}`),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, `Read risk explorer for ${studentId}`)
}

/**
 * Get faculty profile (including past course offerings).
 */
export async function getFacultyProfile(
  request: RequestContext,
  csrfToken: string,
  facultyId: string,
) {
  const response = await request.get(
    apiPath(`/api/academic/faculty-profile/${encodeURIComponent(facultyId)}`),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, `Read faculty profile ${facultyId}`)
}

/**
 * Get list of all students.
 */
export async function getStudentList(
  request: RequestContext,
  csrfToken: string,
) {
  const response = await request.get(
    apiPath('/api/admin/students'),
    { headers: csrfHeaders(csrfToken) },
  )
  return readJson(response, 'Read student list')
}

/**
 * Create a student intervention.
 */
export async function createIntervention(
  request: RequestContext,
  csrfToken: string,
  payload: { studentId: string; interventionType: string; note: string; occurredAt: string },
) {
  const response = await request.post(
    apiPath('/api/admin/student-interventions'),
    {
      headers: csrfHeaders(csrfToken),
      data: payload,
    },
  )
  return readJson(response, `Create intervention for ${payload.studentId}`)
}

// ─── UI Helpers ──────────────────────────────────────────────────

/**
 * Take a systematic phase screenshot.
 */
export async function takePhaseScreenshot(page: Page, semester: number, phase: string, suffix = '') {
  const filename = `sem${semester}-${phase}${suffix ? '-' + suffix : ''}.png`
  await page.screenshot({ path: `${SCRATCH}/${filename}` })
  return filename
}

/**
 * Click the shared proof control button to advance stage.
 */
export async function advanceStageViaUI(page: Page): Promise<boolean> {
  const proofPanel = page.locator('[data-proof-surface="demo-reality-loop"]').first()
  if (await proofPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const advanceBtn = proofPanel.locator('[data-proof-action="demo-loop-load-next-stage"]')
    if (await advanceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advanceBtn.click()
      await page.waitForTimeout(3000) // Wait for stage transition
      return true
    }
  }
  return false
}

// ─── Analysis Helpers ────────────────────────────────────────────

/**
 * Analyze risk distribution realism.
 * Returns an assessment object with distribution stats and realism verdict.
 */
export function analyzeRiskDistribution(
  students: Array<Record<string, unknown>>,
  context: string,
): Record<string, unknown> {
  const bands = { high: 0, medium: 0, low: 0, unknown: 0 }
  for (const student of students) {
    const band = String(student.currentRiskBand ?? student.riskBand ?? '').toLowerCase()
    if (band === 'high') bands.high++
    else if (band === 'medium') bands.medium++
    else if (band === 'low') bands.low++
    else bands.unknown++
  }

  const total = students.length
  const highPct = total > 0 ? (bands.high / total) * 100 : 0
  const medPct = total > 0 ? (bands.medium / total) * 100 : 0
  const lowPct = total > 0 ? (bands.low / total) * 100 : 0

  // A realistic distribution should have: low > medium > high (roughly)
  const realistic = total > 0 && bands.high <= total * 0.3 && bands.low >= total * 0.3

  return {
    context,
    total,
    bands,
    highPct: Math.round(highPct * 10) / 10,
    medPct: Math.round(medPct * 10) / 10,
    lowPct: Math.round(lowPct * 10) / 10,
    realistic,
  }
}

/**
 * Verify SHAP drivers exist and are meaningful.
 */
export function verifySHAPDrivers(
  riskExplorer: Record<string, unknown>,
  studentId: string,
): { valid: boolean; driverCount: number; issues: string[] } {
  const issues: string[] = []
  const topDrivers = Array.isArray(riskExplorer.topDrivers) ? riskExplorer.topDrivers : []

  if (topDrivers.length === 0) {
    issues.push(`No SHAP topDrivers for ${studentId}`)
  }

  for (const driver of topDrivers) {
    if (!driver.feature) issues.push(`SHAP driver missing feature name for ${studentId}`)
    if (!driver.label) issues.push(`SHAP driver missing label for ${studentId}`)
    if (driver.impact === undefined || driver.impact === null) {
      issues.push(`SHAP driver missing impact value for ${studentId}`)
    }
  }

  return {
    valid: issues.length === 0,
    driverCount: topDrivers.length,
    issues,
  }
}

/**
 * Extract component definitions from the bootstrap response instead of
 * calling non-existent GET routes for /scheme and /question-papers.
 * The bootstrap response contains:
 * - assessmentSchemesByOffering[offId].quizComponents / .assignmentComponents / .finalsMax
 * - questionPapersByOffering[offId].tt1.nodes / .tt2.nodes (leaf nodes)
 */
export function discoverComponentsFromBootstrap(
  bootstrap: Record<string, unknown>,
  offId: string,
  kind: EntryKind,
): ComponentDef[] {
  try {
    if (kind === 'tt1' || kind === 'tt2') {
      const qpByOffering = bootstrap.questionPapersByOffering as Record<string, Record<string, { nodes: unknown[] }>> | undefined
      const paper = qpByOffering?.[offId]?.[kind]
      if (paper?.nodes) {
        const leaves: ComponentDef[] = []
        function extractLeaves(nodeList: unknown[]) {
          for (const node of nodeList) {
            const n = node as Record<string, unknown>
            if (Array.isArray(n.children) && n.children.length > 0) {
              extractLeaves(n.children)
            } else {
              leaves.push({ id: String(n.id), maxScore: Number(n.maxMarks ?? 5) })
            }
          }
        }
        extractLeaves(paper.nodes)
        if (leaves.length > 0) return leaves
      }
      // Fallback: The UI renders exactly these leaves for TT1/TT2 based on PAPER_MAP.default
      return [
        { id: `${kind}-q1-p1`, maxScore: 4 },
        { id: `${kind}-q1-p2`, maxScore: 1 },
        { id: `${kind}-q2-p1`, maxScore: 5 },
        { id: `${kind}-q3-p1`, maxScore: 5 },
        { id: `${kind}-q4-p1`, maxScore: 5 },
        { id: `${kind}-q5-p1`, maxScore: 5 },
      ]
    }

    const schemeByOffering = bootstrap.assessmentSchemesByOffering as Record<string, Record<string, unknown>> | undefined
    const scheme = schemeByOffering?.[offId]

    if (kind === 'quiz') {
      if (scheme) {
        const components = Array.isArray(scheme.quizComponents) ? scheme.quizComponents : []
        return components.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          maxScore: Number(c.rawMax ?? 10),
        }))
      }
      return Array.from({ length: 2 }, (_, i) => ({ id: `quiz-${i + 1}`, maxScore: 10 }))
    }

    if (kind === 'assignment') {
      if (scheme) {
        const components = Array.isArray(scheme.assignmentComponents) ? scheme.assignmentComponents : []
        return components.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          maxScore: Number(c.rawMax ?? 10),
        }))
      }
      return Array.from({ length: 2 }, (_, i) => ({ id: `asgn-${i + 1}`, maxScore: 10 }))
    }

    if (kind === 'finals') {
      const finalsMax = Number(scheme?.finalsMax ?? 50)
      return [{ id: 'see', maxScore: finalsMax }]
    }
  } catch (err) {
    console.log(`    discoverComponentsFromBootstrap failed for ${kind}: ${err}`)
  }

  // Ultimate fallback
  if (kind === 'finals') return [{ id: 'see', maxScore: 50 }]
  return Array.from({ length: 5 }, (_, i) => ({ id: `${kind}-q${i + 1}-p1`, maxScore: 5 }))
}

export async function setOfferingScheme(
  request: RequestContext,
  offeringId: string,
  csrfToken: string,
  semConfig: typeof SCHEME_CONFIGS[0]
) {
  // Policy defaults — CE=60, SEE=40 is the standard MSRUAS proof sandbox policy
  const ceTotal = 60
  const seeTotal = 40

  const quizCount = Math.max(0, Math.round(semConfig.quizzes))
  const assignmentCount = Math.max(0, Math.round(semConfig.assignments))
  const componentWeightage = (totalWeight: number, count: number, index: number) => {
    if (count <= 0) return 0
    const baseWeight = Math.floor(totalWeight / count)
    return index === 0 ? totalWeight - baseWeight * (count - 1) : baseWeight
  }

  let ttWeight = ceTotal
  let qWeight = 0
  let aWeight = 0

  if (quizCount > 0 && assignmentCount > 0) {
    qWeight = Math.floor(ceTotal * 0.25)
    aWeight = Math.floor(ceTotal * 0.25)
    ttWeight = ceTotal - qWeight - aWeight
  } else if (quizCount > 0) {
    qWeight = Math.floor(ceTotal * 0.33)
    ttWeight = ceTotal - qWeight
  } else if (assignmentCount > 0) {
    aWeight = Math.floor(ceTotal * 0.33)
    ttWeight = ceTotal - aWeight
  }

  const tt1 = Math.floor(ttWeight / 2)
  const tt2 = ttWeight - tt1

  const payload = {
    scheme: {
      finalsMax: seeTotal > 50 ? 100 : 50,
      quizCount,
      assignmentCount,
      quizComponents: Array.from({ length: quizCount }, (_, i) => ({
        id: `quiz-${i + 1}`,
        label: `Quiz ${i + 1}`,
        rawMax: 10,
        weightage: componentWeightage(qWeight, quizCount, i)
      })),
      assignmentComponents: Array.from({ length: assignmentCount }, (_, i) => ({
        id: `assignment-${i + 1}`,
        label: `Assignment ${i + 1}`,
        rawMax: 10,
        weightage: componentWeightage(aWeight, assignmentCount, i)
      })),
      termTestWeights: { tt1, tt2 },
      quizWeight: qWeight,
      assignmentWeight: aWeight,
      status: 'active',
      configuredAt: Date.now(),
    },
  }
  const response = await request.put(
    apiPath(`/api/academic/offerings/${offeringId}/scheme`),
    { headers: csrfHeaders(csrfToken), data: payload },
  )
  return readJson(response, `Update scheme for ${offeringId}`)
}

/**
 * Enter marks for a course offering via UI (deterministic DOM manipulation)
 */
export async function enterMarksViaUI(
  page: Page,
  entries: StudentEntry[],
) {
  await page.evaluate(({ entries }) => {
    entries.forEach(entry => {
      entry.components.forEach(comp => {
        const input = document.querySelector(`input[data-student-id="${entry.studentId}"][data-leaf-id="${comp.componentCode}"]`) as HTMLInputElement | null;
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(input, comp.score);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }, { entries });
}

/**
 * Enter attendance for a course offering via UI (deterministic DOM manipulation)
 */
export async function enterAttendanceViaUI(
  page: Page,
  entries: AttendanceEntry[],
) {
  await page.evaluate(({ entries }) => {
    entries.forEach(entry => {
      const presentInput = document.querySelector(`input[data-student-id="${entry.studentId}"][data-leaf-id="present"]`) as HTMLInputElement | null;
      if (presentInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(presentInput, entry.presentClasses);
        presentInput.dispatchEvent(new Event('input', { bubbles: true }));
        presentInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      const totalInput = document.querySelector(`input[data-student-id="${entry.studentId}"][data-leaf-id="total"]`) as HTMLInputElement | null;
      if (totalInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(totalInput, entry.totalClasses);
        totalInput.dispatchEvent(new Event('input', { bubbles: true }));
        totalInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }, { entries });
}
