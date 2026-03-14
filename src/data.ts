// ══════════════════════════════════════════════════════════════
// AirMentor — Complete Mock Data & Types
// ══════════════════════════════════════════════════════════════

// ───── Types ─────
export type Role = 'Course Leader' | 'Mentor' | 'HoD'
export type Stage = 1 | 2 | 3
export type RiskBand = 'High' | 'Medium' | 'Low'
export type TaskStatus = 'New' | 'In Progress' | 'Follow-up' | 'Resolved'

export interface StageInfo { stage: Stage; label: string; desc: string; color: string }
export interface Professor { name: string; id: string; dept: string; role: string; initials: string; email: string }

export interface Course {
  id: string; code: string; title: string; year: string; dept: string; sem: number
  sections: string[]; enrolled: number[]; att: number[]
  tt1Done: boolean; tt2Done: boolean
  tt1Locked?: boolean; tt2Locked?: boolean; quizLocked?: boolean; asgnLocked?: boolean
}

export interface Offering {
  id: string; offId: string; code: string; title: string; year: string; dept: string; sem: number
  section: string; count: number; attendance: number
  stage: Stage; stageInfo: StageInfo
  tt1Done: boolean; tt2Done: boolean
  tt1Locked?: boolean; tt2Locked?: boolean; quizLocked?: boolean; asgnLocked?: boolean
  pendingAction: string | null
  sections: string[]; enrolled: number[]; att: number[]
}

export interface YearGroup { year: string; color: string; stageInfo: StageInfo; offerings: Offering[] }
export interface CODef { id: string; desc: string; bloom: string }
export interface PaperQ { id: string; text: string; maxMarks: number; cos: string[] }

export interface SHAPReason { label: string; impact: number; feature: string }
export interface COScore { coId: string; attainment: number }
export interface WhatIf { label: string; current: string; target: string; currentRisk: number; newRisk: number }
export interface Intervention { date: string; type: string; note: string }

export interface Student {
  id: string; usn: string; name: string; phone: string
  present: number; totalClasses: number
  tt1Score: number | null; tt1Max: number
  tt2Score: number | null; tt2Max: number
  quiz1: number | null; quiz2: number | null
  asgn1: number | null; asgn2: number | null
  prevCgpa: number
  riskProb: number | null; riskBand: RiskBand | null
  reasons: SHAPReason[]
  coScores: COScore[]
  whatIf: WhatIf[]
  interventions: Intervention[]
  flags: { backlog: boolean; lowAttendance: boolean; declining: boolean }
}

export interface Task {
  id: string; studentId: string; studentName: string; studentUsn: string
  offeringId: string; courseCode: string; courseName: string; year: string
  riskProb: number; riskBand: RiskBand
  title: string; due: string
  status: TaskStatus; actionHint: string; priority: number
}

export interface Mentee {
  id: string; usn: string; name: string; phone: string
  year: string; section: string; dept: string
  courseRisks: { code: string; title: string; risk: number; band: RiskBand; stage: Stage }[]
  avs: number; prevCgpa: number; interventions: Intervention[]
}

export interface TeacherInfo {
  id: string; name: string; initials: string; dept: string; role: string
  roles?: Role[]
  offerings: number; students: number; highRisk: number
  avgAtt: number; completeness: number; pendingTasks: number
}

export type SubjectRunSchemeStatus = 'Draft' | 'Submitted to HoD' | 'Changes Requested' | 'Approved & Locked' | 'Frozen'
export type RecurrencePreset = 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'custom dates'

export interface FacultyRecord {
  facultyId: string
  name: string
  initials: string
  email: string
  dept: string
  roleTitle: string
  roles: Role[]
  subjectRunIds: string[]
  sectionOfferingIds: string[]
  menteeIds: string[]
}

export interface SubjectRunScheme {
  subjectRunId: string
  status: SubjectRunSchemeStatus
  finalsMax: 50 | 100
  quizWeight: number
  assignmentWeight: number
  quizCount: 0 | 1 | 2
  assignmentCount: 0 | 1 | 2
  lastEditedByFacultyId?: string
  lastEditedAt?: number
}

export interface SubjectRun {
  subjectRunId: string
  code: string
  title: string
  year: string
  dept: string
  sem: number
  sectionOfferingIds: string[]
  courseLeaderFacultyIds: string[]
  scheme: SubjectRunScheme
}

export interface SchemeReviewEvent {
  eventId: string
  subjectRunId: string
  status: SubjectRunSchemeStatus
  actorFacultyId: string
  actorRole: Role
  note: string
  at: number
}

export interface UnlockRequest {
  requestId: string
  subjectRunId: string
  entryKind: 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'attendance' | 'finals'
  semester: number
  status: 'Pending' | 'Approved' | 'Rejected' | 'Reset Completed'
  requestedByFacultyId: string
  requestedByRole: Role
  requestNote?: string
  reviewedByFacultyId?: string
  reviewNote?: string
  requestedAt: number
  reviewedAt?: number
}

export interface TaskOccurrence {
  occurrenceId: string
  dateISO: string
  time?: string
  status: 'Pending' | 'Completed' | 'Skipped'
  completedAt?: number
}

export interface TaskSeries {
  seriesId: string
  ownerFacultyId: string
  studentId: string
  offeringId: string
  recurrence: {
    preset: RecurrencePreset
    time?: string
    customDates?: Array<{ dateISO: string; time?: string }>
  }
  status: 'Active' | 'Paused' | 'Ended'
  occurrences: TaskOccurrence[]
}

export interface TranscriptSubjectRecord {
  code: string
  title: string
  credits: number
  score: number
  gradeLabel: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F'
  gradePoint: 0 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  result: 'Passed' | 'Failed' | 'Repeated'
}

export interface TranscriptTerm {
  termId: string
  label: string
  semesterNumber: number
  academicYear: string
  sgpa: number
  registeredCredits: number
  earnedCredits: number
  backlogCount: number
  subjects: TranscriptSubjectRecord[]
}

export interface StudentHistoryRecord {
  usn: string
  studentName: string
  program: string
  dept: string
  trend: 'Improving' | 'Stable' | 'Declining'
  currentCgpa: number
  advisoryNotes: string[]
  repeatSubjects: string[]
  terms: TranscriptTerm[]
}

// ───── Theme ─────
export const T = {
  bg: '#07090f', surface: '#0d1017', surface2: '#111520', surface3: '#161b28',
  border: '#1c2333', border2: '#242d40',
  text: '#e2e8f4', muted: '#8892a4', dim: '#3d4a60',
  accent: '#006DDD', accentLight: '#2D8AF0',
  success: '#10b981', warning: '#f59e0b', danger: '#ef4444',
  pink: '#ec4899', purple: '#a855f7', orange: '#f97316', blue: '#3b82f6',
}

export const yearColor = (y: string): string =>
  ({ '1st Year': '#f59e0b', '2nd Year': '#6366f1', '3rd Year': '#10b981', '4th Year': '#ec4899' } as Record<string, string>)[y] || T.muted

export const stageColor = (s: Stage): string => s === 1 ? '#f97316' : s === 2 ? '#3b82f6' : '#a855f7'
export const CO_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

export const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
export const sora: React.CSSProperties = { fontFamily: "'Sora', sans-serif" }

// ───── Deterministic Random ─────
let _seed = 42
export function seedRand(s: number) { _seed = s }
export function rand(max: number): number {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff
  return _seed % (max + 1)
}
export function randFloat(): number {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff
  return (_seed & 0xffff) / 0xffff
}

// ───── Professor ─────
export const PROFESSOR: Professor = {
  name: 'Dr. Kavitha Rao', id: 'FET-CSE-2018-047',
  dept: 'Computer Science & Engineering', role: 'Associate Professor',
  initials: 'KR', email: 'kavitha.rao@msruas.ac.in',
}

// ───── Year Stages (per-year, not per-course) ─────
export const YEAR_STAGES: Record<string, StageInfo> = {
  '1st Year': { stage: 1, label: 'Stage 1', desc: 'Term Start → TT1', color: '#f97316' },
  '2nd Year': { stage: 2, label: 'Stage 2', desc: 'TT1 → TT2', color: '#3b82f6' },
  '3rd Year': { stage: 3, label: 'Stage 3', desc: 'TT2 → Finals', color: '#a855f7' },
  '4th Year': { stage: 2, label: 'Stage 2', desc: 'TT1 → TT2', color: '#3b82f6' },
}

// ───── Courses ─────
export const COURSES: Course[] = [
  { id: 'c1', code: 'MA101', title: 'Engineering Mathematics I', year: '1st Year', dept: 'CSE', sem: 1, sections: ['A', 'B', 'C'], enrolled: [62, 58, 60], att: [82, 79, 85], tt1Done: false, tt2Done: false, tt1Locked: false, tt2Locked: false },
  { id: 'c2', code: 'CS101', title: 'Problem Solving with C', year: '1st Year', dept: 'CSE', sem: 1, sections: ['A'], enrolled: [62], att: [88], tt1Done: false, tt2Done: false, tt1Locked: false, tt2Locked: false },
  { id: 'c3', code: 'CS401', title: 'Design & Analysis of Algorithms', year: '2nd Year', dept: 'CSE', sem: 4, sections: ['A', 'B'], enrolled: [58, 56], att: [76, 80], tt1Done: true, tt2Done: false, tt1Locked: true, tt2Locked: false },
  { id: 'c4', code: 'CS403', title: 'Operating Systems', year: '2nd Year', dept: 'CSE', sem: 4, sections: ['C'], enrolled: [54], att: [71], tt1Done: true, tt2Done: false, tt1Locked: true, tt2Locked: false },
  { id: 'c5', code: 'MA301', title: 'Engineering Mathematics III', year: '2nd Year', dept: 'ECE', sem: 3, sections: ['A'], enrolled: [60], att: [74], tt1Done: true, tt2Done: false, tt1Locked: true, tt2Locked: false },
  { id: 'c6', code: 'CS601', title: 'Compiler Design', year: '3rd Year', dept: 'CSE', sem: 6, sections: ['A'], enrolled: [52], att: [78], tt1Done: true, tt2Done: true, tt1Locked: true, tt2Locked: true },
  { id: 'c7', code: 'CS603', title: 'Information Security', year: '3rd Year', dept: 'CSE', sem: 6, sections: ['B'], enrolled: [50], att: [81], tt1Done: true, tt2Done: true, tt1Locked: true, tt2Locked: true },
  { id: 'c8', code: 'CS702', title: 'Deep Learning & Neural Networks', year: '4th Year', dept: 'CSE', sem: 7, sections: ['A'], enrolled: [45], att: [85], tt1Done: true, tt2Done: false, tt1Locked: true, tt2Locked: false },
]

// ───── Offerings (flattened) ─────
function getPending(c: Course, stage: Stage): string | null {
  if (stage === 1 && !c.tt1Done) return 'Enter TT1 Marks'
  if (stage === 1 && c.tt1Done && !c.tt1Locked) return 'Submit & Lock TT1'
  if (stage === 2 && !c.tt2Done) return 'Enter TT2 Marks'
  if (stage === 2 && c.tt2Done && !c.tt2Locked) return 'Submit & Lock TT2'
  if (stage === 3 && c.tt2Done && c.tt2Locked) return 'Finalise Grades'
  return null
}

export const OFFERINGS: Offering[] = COURSES.flatMap(c =>
  c.sections.map((sec, i) => ({
    id: c.id, offId: `${c.id}-${sec}`, code: c.code, title: c.title,
    year: c.year, dept: c.dept, sem: c.sem,
    section: sec, count: c.enrolled[i], attendance: c.att[i],
    stage: YEAR_STAGES[c.year].stage, stageInfo: YEAR_STAGES[c.year],
    tt1Done: c.tt1Done, tt2Done: c.tt2Done,
    tt1Locked: c.tt1Locked ?? false, tt2Locked: c.tt2Locked ?? false,
    pendingAction: getPending(c, YEAR_STAGES[c.year].stage),
    sections: c.sections, enrolled: c.enrolled, att: c.att,
  }))
)

export const YEAR_GROUPS: YearGroup[] = ['1st Year', '2nd Year', '3rd Year', '4th Year']
  .map(yr => ({
    year: yr, color: yearColor(yr), stageInfo: YEAR_STAGES[yr],
    offerings: OFFERINGS.filter(o => o.year === yr),
  }))
  .filter(g => g.offerings.length > 0)

// ───── CO Maps ─────
export const CO_MAP: Record<string, CODef[]> = {
  CS401: [
    { id: 'CO1', desc: 'Analyse time & space complexity using asymptotic notation', bloom: 'Analyse' },
    { id: 'CO2', desc: 'Design greedy and divide-and-conquer algorithms', bloom: 'Create' },
    { id: 'CO3', desc: 'Apply dynamic programming to optimisation problems', bloom: 'Apply' },
    { id: 'CO4', desc: 'Implement and evaluate graph algorithms', bloom: 'Evaluate' },
    { id: 'CO5', desc: 'Compare NP-hard problems and approximation strategies', bloom: 'Evaluate' },
  ],
  CS403: [
    { id: 'CO1', desc: 'Explain process scheduling and synchronisation mechanisms', bloom: 'Understand' },
    { id: 'CO2', desc: 'Analyse deadlock conditions and prevention strategies', bloom: 'Analyse' },
    { id: 'CO3', desc: 'Apply memory management and virtual memory techniques', bloom: 'Apply' },
    { id: 'CO4', desc: 'Evaluate file system design and I/O management', bloom: 'Evaluate' },
  ],
  CS601: [
    { id: 'CO1', desc: 'Design lexical analysers using regular expressions and automata', bloom: 'Create' },
    { id: 'CO2', desc: 'Construct parsers using LL and LR techniques', bloom: 'Apply' },
    { id: 'CO3', desc: 'Generate intermediate code and optimise', bloom: 'Apply' },
    { id: 'CO4', desc: 'Evaluate code generation strategies for target machines', bloom: 'Evaluate' },
  ],
  CS702: [
    { id: 'CO1', desc: 'Explain neural network architectures and training algorithms', bloom: 'Understand' },
    { id: 'CO2', desc: 'Implement CNNs for image classification tasks', bloom: 'Apply' },
    { id: 'CO3', desc: 'Apply backpropagation and gradient descent optimisation', bloom: 'Apply' },
    { id: 'CO4', desc: 'Design RNN/LSTM models for sequential data', bloom: 'Create' },
    { id: 'CO5', desc: 'Evaluate deep learning frameworks and deployment strategies', bloom: 'Evaluate' },
  ],
  MA101: [
    { id: 'CO1', desc: 'Apply differential calculus to engineering problems', bloom: 'Apply' },
    { id: 'CO2', desc: 'Solve systems of linear equations using matrices', bloom: 'Apply' },
    { id: 'CO3', desc: 'Interpret eigenvalues in engineering context', bloom: 'Analyse' },
    { id: 'CO4', desc: 'Apply integral calculus to compute areas and volumes', bloom: 'Apply' },
  ],
  default: [
    { id: 'CO1', desc: 'Understand and explain core concepts of the subject', bloom: 'Understand' },
    { id: 'CO2', desc: 'Apply theoretical principles to practical problems', bloom: 'Apply' },
    { id: 'CO3', desc: 'Analyse and evaluate solution approaches', bloom: 'Analyse' },
    { id: 'CO4', desc: 'Design solutions for complex engineering scenarios', bloom: 'Create' },
    { id: 'CO5', desc: 'Evaluate trade-offs between different methods', bloom: 'Evaluate' },
  ],
}

export const PAPER_MAP: Record<string, PaperQ[]> = {
  CS401: [
    { id: 'q1', text: 'Prove Big-O complexity of Merge Sort; compare with Quick Sort', maxMarks: 7, cos: ['CO1'] },
    { id: 'q2', text: 'Design a greedy solution for Activity Selection Problem', maxMarks: 6, cos: ['CO2'] },
    { id: 'q3', text: 'Apply DP to 0/1 Knapsack problem with full derivation', maxMarks: 6, cos: ['CO3'] },
    { id: 'q4', text: 'Recurrence relation for D&C; apply Master Theorem', maxMarks: 6, cos: ['CO1', 'CO2'] },
  ],
  default: [
    { id: 'q1', text: 'Answer question 1 — Unit 1 concepts', maxMarks: 7, cos: ['CO1'] },
    { id: 'q2', text: 'Answer question 2 — Unit 2 concepts', maxMarks: 6, cos: ['CO2'] },
    { id: 'q3', text: 'Answer question 3 — applied problem', maxMarks: 6, cos: ['CO3'] },
    { id: 'q4', text: 'Answer question 4 — mixed concepts', maxMarks: 6, cos: ['CO1', 'CO2'] },
  ],
}

// ───── Student Names ─────
export const NAMES = [
  'Aarav Sharma', 'Aditi Nair', 'Akshay Kulkarni', 'Akshitha Reddy', 'Ananya Iyer',
  'Anika Patel', 'Arjun Menon', 'Arnav Gupta', 'Bhavya Shetty', 'Chirag Joshi',
  'Deepika Rao', 'Dhruv Verma', 'Divya Krishnamurthy', 'Esha Banerjee', 'Farhan Khan',
  'Geetika Singh', 'Harsh Patel', 'Ishaan Dubey', 'Ishita Mishra', 'Jayesh Pillai',
  'Kavya Nambiar', 'Keerthana Suresh', 'Kiran Bhat', 'Kriti Agarwal', 'Lakshmi Prasad',
  'Manish Tiwari', 'Meera Sundaram', 'Mohammed Rizwan', 'Nandita Gowda', 'Nikhil Hegde',
  'Nisha Kumar', 'Omkar Patil', 'Pallavi Desai', 'Pranav Rajan', 'Priya Chandrasekaran',
  'Rahul Saxena', 'Ranjith Nair', 'Rashmi Kamath', 'Ritu Srivastava', 'Rohan Mehta',
  'Sahana Murthy', 'Sanjana Bose', 'Sanket Jain', 'Shilpa Upadhyay', 'Shivam Tripathi',
  'Sneha Pillai', 'Soumya Das', 'Srikant Venkat', 'Supriya Rao', 'Swati Naidu',
  'Tanvi Joshi', 'Tejashwini Gowda', 'Uday Shankar', 'Varun Krishnan', 'Vidya Anand',
  'Vikram Nair', 'Vinay Hiremath', 'Vishal Reddy', 'Yashaswi Kulkarni', 'Yash Patel',
  'Zara Ahmed', 'Zeeshan Siddiqui',
]

const PHONES = NAMES.map((_, i) => `+91 ${9700000000 + i * 137}`)

// ───── SHAP Reason Templates ─────
function genReasons(s: { attendancePct: number; tt1Score: number | null; tt1Max: number; prevCgpa: number; quiz1: number | null; coScores: COScore[] }): SHAPReason[] {
  const reasons: SHAPReason[] = []
  const attPct = s.attendancePct
  if (attPct < 65) reasons.push({ label: `Attendance critically low (${attPct}%)`, impact: 0.34, feature: 'attendance' })
  else if (attPct < 75) reasons.push({ label: `Attendance below threshold (${attPct}%)`, impact: 0.22, feature: 'attendance' })

  if (s.tt1Score !== null && s.tt1Max > 0) {
    const pct = Math.round(s.tt1Score / s.tt1Max * 100)
    if (pct < 40) reasons.push({ label: `Very low TT1 score (${s.tt1Score}/${s.tt1Max})`, impact: 0.31, feature: 'tt1' })
    else if (pct < 60) reasons.push({ label: `Below-average TT1 (${s.tt1Score}/${s.tt1Max})`, impact: 0.18, feature: 'tt1' })
  }

  if (s.prevCgpa < 6) reasons.push({ label: `Weak previous CGPA (${s.prevCgpa.toFixed(1)})`, impact: 0.22, feature: 'cgpa' })
  else if (s.prevCgpa < 7) reasons.push({ label: `Below-average prev CGPA (${s.prevCgpa.toFixed(1)})`, impact: 0.12, feature: 'cgpa' })

  const weakCO = s.coScores.filter(c => c.attainment < 40).sort((a, b) => a.attainment - b.attainment)[0]
  if (weakCO) reasons.push({ label: `Weak ${weakCO.coId} attainment (${weakCO.attainment}%)`, impact: 0.19, feature: 'co' })

  if (s.quiz1 !== null && s.quiz1 < 4) reasons.push({ label: `Low quiz performance (${s.quiz1}/10)`, impact: 0.09, feature: 'quiz' })

  return reasons.sort((a, b) => b.impact - a.impact).slice(0, 4)
}

function genWhatIf(risk: number, attPct: number, coScores: COScore[]): WhatIf[] {
  const scenarios: WhatIf[] = []
  if (attPct < 75) {
    const newRisk = Math.max(0.08, risk - 0.18 - randFloat() * 0.1)
    scenarios.push({ label: 'Improve attendance to 75%', current: `${attPct}%`, target: '75%', currentRisk: risk, newRisk: Math.round(newRisk * 100) / 100 })
  }
  const weak = coScores.filter(c => c.attainment < 50).sort((a, b) => a.attainment - b.attainment)[0]
  if (weak) {
    const newRisk = Math.max(0.12, risk - 0.15 - randFloat() * 0.08)
    scenarios.push({ label: `${weak.coId} attainment ≥ 50% in TT2`, current: `${weak.attainment}%`, target: '50%', currentRisk: risk, newRisk: Math.round(newRisk * 100) / 100 })
  }
  return scenarios
}

// ───── Student Generation ─────
export function makeStudents(offering: Offering): Student[] {
  const { count, dept, sem, section, stage, tt1Done, tt2Done, code } = offering
  seedRand(count * 100 + sem * 10 + section.charCodeAt(0))

  const cos = CO_MAP[code] || CO_MAP.default
  const paper = PAPER_MAP[code] || PAPER_MAP.default
  const totalMax = paper.reduce((a, q) => a + q.maxMarks, 0)
  const matchingMentees = MENTEES.filter(m => m.year === offering.year && m.section === offering.section && m.dept === offering.dept)

  return Array.from({ length: count }, (_, i) => {
    const present = 28 + rand(17)
    const totalClasses = 45
    const attendancePct = Math.round(present / totalClasses * 100)
    const menteeSeed = matchingMentees[i]
    const prevCgpa = menteeSeed?.prevCgpa && menteeSeed.prevCgpa > 0
      ? menteeSeed.prevCgpa
      : 5.2 + Math.round(randFloat() * 40) / 10 // 5.2 - 9.2

    let tt1Score: number | null = null
    let tt2Score: number | null = null
    if (tt1Done) tt1Score = 4 + rand(totalMax - 4)
    if (tt2Done) tt2Score = 6 + rand(totalMax - 6)

    const quiz1 = tt1Done ? 2 + rand(8) : null
    const quiz2 = null
    const asgn1 = tt1Done ? 5 + rand(5) : null
    const asgn2 = null

    // CO attainment (mock based on TT1 scores)
    const coScores: COScore[] = cos.map(co => ({
      coId: co.id,
      attainment: stage >= 2 && tt1Score !== null
        ? Math.max(12, Math.min(95, Math.round(tt1Score / totalMax * 100 + (randFloat() - 0.5) * 40)))
        : 0,
    }))

    // Risk computation (only for stage >= 2)
    let riskProb: number | null = null
    let riskBand: RiskBand | null = null
    if (stage >= 2 && tt1Score !== null) {
      let base = 0
      if (attendancePct < 65) base += 0.35
      else if (attendancePct < 75) base += 0.18
      const tt1Pct = tt1Score / totalMax
      if (tt1Pct < 0.4) base += 0.30
      else if (tt1Pct < 0.6) base += 0.14
      if (prevCgpa < 6) base += 0.22
      else if (prevCgpa < 7) base += 0.10
      const weakCOs = coScores.filter(c => c.attainment < 40).length
      base += weakCOs * 0.05
      riskProb = Math.max(0.05, Math.min(0.95, base + (randFloat() - 0.5) * 0.15))
      riskProb = Math.round(riskProb * 100) / 100
      riskBand = riskProb >= 0.70 ? 'High' : riskProb >= 0.35 ? 'Medium' : 'Low'
    }

    const student: Student = {
      id: `${offering.offId}-s${i}`,
      usn: menteeSeed?.usn ?? `1MS${23 + Math.floor(sem / 2)}${dept.slice(0, 2).toUpperCase()}${String(i + 1).padStart(3, '0')}`,
      name: menteeSeed?.name ?? NAMES[i % NAMES.length],
      phone: menteeSeed?.phone ?? PHONES[i % PHONES.length],
      present, totalClasses,
      tt1Score, tt1Max: totalMax,
      tt2Score, tt2Max: totalMax,
      quiz1, quiz2,
      asgn1, asgn2,
      prevCgpa,
      riskProb, riskBand,
      reasons: [],
      coScores,
      whatIf: [],
      interventions: [],
      flags: {
        backlog: prevCgpa < 5.5 && randFloat() > 0.6,
        lowAttendance: attendancePct < 75,
        declining: randFloat() > 0.7,
      },
    }

    // Generate SHAP reasons & what-if for at-risk students
    if (riskProb !== null && riskProb >= 0.35) {
      student.reasons = genReasons({ attendancePct, tt1Score, tt1Max: totalMax, prevCgpa, quiz1, coScores })
      student.whatIf = genWhatIf(riskProb, attendancePct, coScores)
    }

    // Mock interventions for high-risk students
    if (menteeSeed?.interventions?.length) {
      student.interventions = menteeSeed.interventions
    } else if (riskProb !== null && riskProb >= 0.7 && i < 5) {
      student.interventions = [
        { date: 'Feb 22', type: 'Call', note: 'Called, no response' },
      ]
    }
    if (riskProb !== null && riskProb >= 0.5 && riskProb < 0.7 && i < 3) {
      student.interventions = [
        { date: 'Mar 05', type: 'Meeting', note: 'Discussed revision strategy for weak COs' },
      ]
    }

    return student
  })
}

// ───── All students for all offerings (cached) ─────
const _studentCache: Record<string, Student[]> = {}
export function getStudents(offering: Offering): Student[] {
  if (!_studentCache[offering.offId]) _studentCache[offering.offId] = makeStudents(offering)
  return _studentCache[offering.offId]
}

// ───── High risk students across all stage 2+ offerings ─────
export function getAllAtRiskStudents(): (Student & { courseCode: string; courseName: string; year: string; section: string; offId: string })[] {
  return OFFERINGS
    .filter(o => o.stage >= 2)
    .flatMap(o => getStudents(o)
      .filter(s => s.riskBand === 'High' || s.riskBand === 'Medium')
      .map(s => ({ ...s, courseCode: o.code, courseName: o.title, year: o.year, section: o.section, offId: o.offId }))
    )
    .sort((a, b) => (b.riskProb ?? 0) - (a.riskProb ?? 0))
}

// ───── Task generation ─────
export function generateTasks(): Task[] {
  const atRisk = getAllAtRiskStudents().filter(s => s.riskBand === 'High').slice(0, 8)
  return atRisk.map((s, i) => ({
    id: `task-${i}`,
    studentId: s.id,
    studentName: s.name,
    studentUsn: s.usn,
    offeringId: s.offId,
    courseCode: s.courseCode,
    courseName: s.courseName,
    year: s.year,
    riskProb: s.riskProb!,
    riskBand: 'High' as RiskBand,
    title: i === 0 ? `Call ${s.name.split(' ')[0]} — plan remedial` : i < 3 ? `Schedule 1:1 with ${s.name.split(' ')[0]}` : `Follow up: ${s.name.split(' ')[0]} attendance`,
    due: i === 0 ? 'Today' : i < 3 ? 'This week' : 'Next week',
    status: (i === 0 ? 'New' : i < 3 ? 'New' : 'Follow-up') as TaskStatus,
    actionHint: i === 0 ? 'High risk — immediate call + schedule meeting before TT2' : i < 3 ? 'Review TT1 performance, identify weak COs' : 'Check if attendance has improved since last contact',
    priority: Math.round((s.riskProb ?? 0) * 100),
  }))
}

// ───── Mentee data for Mentor view ─────
export const MENTEES: Mentee[] = [
  { id: 'm1', usn: '1MS23CS001', name: 'Aarav Sharma', phone: '+91 9700000000', year: '2nd Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS401', title: 'Design & Analysis of Algorithms', risk: 0.82, band: 'High', stage: 2 },
      { code: 'CS201', title: 'Data Structures', risk: 0.45, band: 'Medium', stage: 2 },
      { code: 'MA201', title: 'Discrete Mathematics', risk: 0.61, band: 'Medium', stage: 2 },
    ], avs: 0.63, prevCgpa: 6.1,
    interventions: [{ date: 'Feb 22', type: 'Call', note: 'Called — no response' }, { date: 'Mar 01', type: 'Email', note: 'Sent academic warning email' }],
  },
  { id: 'm2', usn: '1MS23CS014', name: 'Meera Sundaram', phone: '+91 9700001918', year: '2nd Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS401', title: 'Design & Analysis of Algorithms', risk: 0.54, band: 'Medium', stage: 2 },
      { code: 'CS201', title: 'Data Structures', risk: 0.22, band: 'Low', stage: 2 },
    ], avs: 0.38, prevCgpa: 7.2,
    interventions: [{ date: 'Mar 05', type: 'Meeting', note: 'Discussed weak COs; assigned practice problems' }],
  },
  { id: 'm3', usn: '1MS24CS103', name: 'Rohan Mehta', phone: '+91 9700005480', year: '1st Year', section: 'B', dept: 'CSE',
    courseRisks: [
      { code: 'MA101', title: 'Engineering Mathematics I', risk: -1, band: 'Low', stage: 1 },
      { code: 'CS101', title: 'Problem Solving with C', risk: -1, band: 'Low', stage: 1 },
    ], avs: -1, prevCgpa: 0,
    interventions: [],
  },
  { id: 'm4', usn: '1MS22CS041', name: 'Sneha Pillai', phone: '+91 9700006302', year: '3rd Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS601', title: 'Compiler Design', risk: 0.45, band: 'Medium', stage: 3 },
      { code: 'CS605', title: 'Computer Graphics', risk: 0.18, band: 'Low', stage: 3 },
    ], avs: 0.32, prevCgpa: 7.8,
    interventions: [{ date: 'Mar 08', type: 'Meeting', note: 'TT2 scores improved. Monitoring.' }],
  },
  { id: 'm5', usn: '1MS21CS008', name: 'Deepika Rao', phone: '+91 9700001370', year: '4th Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS702', title: 'Deep Learning & Neural Networks', risk: 0.38, band: 'Medium', stage: 2 },
      { code: 'CS704', title: 'Cloud Computing', risk: 0.12, band: 'Low', stage: 2 },
    ], avs: 0.25, prevCgpa: 7.8,
    interventions: [],
  },
  { id: 'm6', usn: '1MS23CS019', name: 'Ishita Mishra', phone: '+91 9700002603', year: '2nd Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS401', title: 'Design & Analysis of Algorithms', risk: 0.71, band: 'High', stage: 2 },
      { code: 'CS201', title: 'Data Structures', risk: 0.55, band: 'Medium', stage: 2 },
      { code: 'MA201', title: 'Discrete Mathematics', risk: 0.48, band: 'Medium', stage: 2 },
    ], avs: 0.58, prevCgpa: 6.8,
    interventions: [{ date: 'Mar 02', type: 'Call', note: 'Advised to attend remedial sessions' }],
  },
  { id: 'm7', usn: '1MS23EC005', name: 'Farhan Khan', phone: '+91 9700002055', year: '2nd Year', section: 'A', dept: 'ECE',
    courseRisks: [
      { code: 'MA301', title: 'Engineering Mathematics III', risk: 0.67, band: 'Medium', stage: 2 },
      { code: 'EC301', title: 'Signals & Systems', risk: 0.52, band: 'Medium', stage: 2 },
    ], avs: 0.60, prevCgpa: 6.5,
    interventions: [],
  },
  { id: 'm8', usn: '1MS24CS022', name: 'Arnav Gupta', phone: '+91 9700001096', year: '1st Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'MA101', title: 'Engineering Mathematics I', risk: -1, band: 'Low', stage: 1 },
    ], avs: -1, prevCgpa: 0,
    interventions: [],
  },
  { id: 'm9', usn: '1MS22CS033', name: 'Chirag Joshi', phone: '+91 9700001233', year: '3rd Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS601', title: 'Compiler Design', risk: 0.31, band: 'Low', stage: 3 },
      { code: 'CS603', title: 'Information Security', risk: 0.14, band: 'Low', stage: 3 },
    ], avs: 0.23, prevCgpa: 8.2,
    interventions: [{ date: 'Feb 15', type: 'Meeting', note: 'Was at 72% risk pre-TT1. After remedial: TT2 improved +6 marks.' }],
  },
  { id: 'm10', usn: '1MS21CS012', name: 'Varun Krishnan', phone: '+91 9700007398', year: '4th Year', section: 'A', dept: 'CSE',
    courseRisks: [
      { code: 'CS702', title: 'Deep Learning & Neural Networks', risk: 0.22, band: 'Low', stage: 2 },
    ], avs: 0.22, prevCgpa: 8.5,
    interventions: [],
  },
  { id: 'm11', usn: '1MS23CS028', name: 'Nandita Gowda', phone: '+91 9700003836', year: '2nd Year', section: 'B', dept: 'CSE',
    courseRisks: [
      { code: 'CS401', title: 'Design & Analysis of Algorithms', risk: 0.78, band: 'High', stage: 2 },
      { code: 'MA201', title: 'Discrete Mathematics', risk: 0.44, band: 'Medium', stage: 2 },
    ], avs: 0.61, prevCgpa: 6.3,
    interventions: [{ date: 'Mar 04', type: 'Call', note: 'Discussed attendance and assignment gaps' }],
  },
  { id: 'm12', usn: '1MS24CS044', name: 'Shivam Tripathi', phone: '+91 9700006028', year: '1st Year', section: 'C', dept: 'CSE',
    courseRisks: [
      { code: 'MA101', title: 'Engineering Mathematics I', risk: -1, band: 'Low', stage: 1 },
    ], avs: -1, prevCgpa: 0,
    interventions: [],
  },
]

// ───── Teacher data for HoD view ─────

export interface FacultyRecordDir {
  id: string;
  name: string;
  initials: string;
  email: string;
  dept: string;
  roleTitle: string;
  roles: string[];
  subjectRuns: string[];
  sections: string[];
  mentees: string[];
}

export const FACULTY_DIRECTORY: FacultyRecordDir[] = [
  { id: 't1', name: 'Dr. Kavitha Rao', initials: 'KR', email: 'kavitha.rao@msruas.ac.in', dept: 'CSE', roleTitle: 'Associate Professor', roles: ['Course Leader', 'Mentor', 'HoD'], subjectRuns: ['run-CS401', 'run-CS403'], sections: ['c3-A', 'c3-B', 'c4-C'], mentees: ['m1', 'm2'] },
  { id: 't2', name: 'Dr. Arvind Kumar', initials: 'AK', email: 'arvind.k@msruas.ac.in', dept: 'CSE', roleTitle: 'Professor', roles: ['Course Leader'], subjectRuns: ['run-CS601'], sections: ['c6-A'], mentees: [] },
  { id: 't3', name: 'Prof. Sneha Nair', initials: 'SN', email: 'sneha.n@msruas.ac.in', dept: 'CSE', roleTitle: 'Assistant Professor', roles: ['Mentor'], subjectRuns: [], sections: ['c1-A'], mentees: ['m3', 'm4'] },
  { id: 't4', name: 'Dr. Rajesh Bhat', initials: 'RB', email: 'rajesh.b@msruas.ac.in', dept: 'CSE', roleTitle: 'Associate Professor', roles: ['Course Leader', 'Mentor'], subjectRuns: ['run-CS702'], sections: ['c8-A'], mentees: ['m5', 'm6'] },
  { id: 't5', name: 'Prof. Ananya Iyer', initials: 'AI', email: 'ananya.i@msruas.ac.in', dept: 'CSE', roleTitle: 'Assistant Professor', roles: ['Course Leader'], subjectRuns: ['run-CS101'], sections: ['c2-A'], mentees: [] },
  { id: 't6', name: 'Dr. Vikram Nair', initials: 'VN', email: 'vikram.n@msruas.ac.in', dept: 'CSE', roleTitle: 'Professor', roles: ['Mentor'], subjectRuns: [], sections: ['c5-A', 'c7-B'], mentees: ['m7', 'm8', 'm9', 'm10', 'm11', 'm12'] },
];

export const FACULTY: FacultyRecord[] = FACULTY_DIRECTORY.map(item => ({
  facultyId: item.id,
  name: item.name,
  initials: item.initials,
  email: item.email,
  dept: item.dept,
  roleTitle: item.roleTitle,
  roles: item.roles.filter((role): role is Role => role === 'Course Leader' || role === 'Mentor' || role === 'HoD'),
  subjectRunIds: item.subjectRuns,
  sectionOfferingIds: item.sections,
  menteeIds: item.mentees,
}))

const inferInitialSchemeStatus = (offeringIds: string[]): SubjectRunSchemeStatus => {
  const hasTtLocked = offeringIds.some(offId => {
    const offering = OFFERINGS.find(o => o.offId === offId)
    return !!offering?.tt1Locked || !!offering?.tt2Locked
  })
  if (hasTtLocked) return 'Frozen'
  return 'Draft'
}

export const SUBJECT_RUNS: SubjectRun[] = (() => {
  const byCodeYearSem: Record<string, Offering[]> = {}
  OFFERINGS.forEach(offering => {
    const key = `${offering.code}::${offering.year}::${offering.sem}`
    byCodeYearSem[key] = [...(byCodeYearSem[key] ?? []), offering]
  })

  return Object.entries(byCodeYearSem).map(([_key, grouped], index) => {
    const sample = grouped[0]
    const subjectRunId = `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`
    const sectionOfferingIds = grouped.map(item => item.offId)
    const courseLeaderFacultyIds = FACULTY
      .filter(f => f.roles.includes('Course Leader') && f.subjectRunIds.some(run => run.includes(sample.code)))
      .map(f => f.facultyId)

    return {
      subjectRunId,
      code: sample.code,
      title: sample.title,
      year: sample.year,
      dept: sample.dept,
      sem: sample.sem,
      sectionOfferingIds,
      courseLeaderFacultyIds,
      scheme: {
        subjectRunId,
        status: inferInitialSchemeStatus(sectionOfferingIds),
        finalsMax: sample.code === 'CS702' ? 100 : 50,
        quizWeight: sample.code === 'CS401' ? 20 : 10,
        assignmentWeight: sample.code === 'CS401' ? 10 : 20,
        quizCount: sample.code === 'CS401' ? 2 : 1,
        assignmentCount: sample.code === 'CS401' ? 1 : 2,
      },
    }
  })
})()

export const SCHEME_REVIEW_EVENTS: SchemeReviewEvent[] = []
export const UNLOCK_REQUESTS: UnlockRequest[] = []
export const TASK_SERIES: TaskSeries[] = []

export function getSubjectRunByOffering(offeringId: string): SubjectRun | null {
  return SUBJECT_RUNS.find(run => run.sectionOfferingIds.includes(offeringId)) ?? null
}

export function getSubjectRunSchemeByOffering(offeringId: string): SubjectRunScheme | null {
  return getSubjectRunByOffering(offeringId)?.scheme ?? null
}

export function getFacultyByRole(role: Role): FacultyRecord[] {
  return FACULTY.filter(faculty => faculty.roles.includes(role))
}

export function getTeacherCardsForDepartment(dept: string): TeacherInfo[] {
  return FACULTY
    .filter(faculty => faculty.dept === dept)
    .map(faculty => ({
      id: faculty.facultyId,
      name: faculty.name,
      initials: faculty.initials,
      dept: faculty.dept,
      role: faculty.roleTitle,
      roles: faculty.roles,
      offerings: faculty.subjectRunIds.length,
      students: faculty.sectionOfferingIds.reduce((acc, offId) => {
        const offering = OFFERINGS.find(item => item.offId === offId)
        return acc + (offering?.count ?? 0)
      }, 0),
      highRisk: faculty.sectionOfferingIds.reduce((acc, offId) => {
        const offering = OFFERINGS.find(item => item.offId === offId)
        return acc + (offering ? getStudents(offering).filter(student => student.riskBand === 'High').length : 0)
      }, 0),
      avgAtt: 0,
      completeness: 0,
      pendingTasks: 0,
    }))
}

export function getQueueScopeForUnlock(offeringId: string, entryKind: UnlockRequest['entryKind']) {
  const run = getSubjectRunByOffering(offeringId)
  if (!run) return null
  return {
    subjectRunId: run.subjectRunId,
    entryKind,
    semester: run.sem,
    sectionOfferingIds: run.sectionOfferingIds,
  }
}

export const TEACHERS: TeacherInfo[] = FACULTY_DIRECTORY.map(f => {
  const roles = f.roles.filter((role): role is Role => role === 'Course Leader' || role === 'Mentor' || role === 'HoD')
  return {
    id: f.id,
    name: f.name,
    initials: f.initials,
    dept: f.dept,
    role: f.roleTitle,
    roles,
    offerings: f.subjectRuns.length * 2, // mock metric equivalent
    students: f.subjectRuns.length * 120, // mock metric equivalent  
    highRisk: f.subjectRuns.length * 4,
    avgAtt: 75 + Math.floor(Math.random() * 15),
    completeness: 60 + Math.floor(Math.random() * 30),
    pendingTasks: f.subjectRuns.length * 2
  }
})

// ───── Prerequisite DAG (simplified) ─────
export const PREREQ_DAG: Record<string, string[]> = {
  CS401: ['CS201', 'MA101'],         // DAA needs DS and Maths I
  CS403: ['CS201'],                   // OS needs DS
  CS601: ['CS401', 'CS301'],         // Compilers needs DAA and Formal Languages
  CS702: ['CS501', 'MA301'],         // DL needs ML basics and Maths III
  MA301: ['MA101', 'MA201'],         // Maths III needs Maths I and II
}

// ───── Calendar Events ─────
export const CALENDAR_EVENTS = [
  { date: '22 Jul', label: 'Quiz 1 — CS401 Sec A/B', type: 'quiz' as const, year: '2nd Year' },
  { date: '01 Aug', label: 'Assignment 1 Due — CS401 all sections', type: 'asgn' as const, year: '2nd Year' },
  { date: '05 Aug', label: 'TT1 — All 1st Year (MA101, CS101)', type: 'tt' as const, year: '1st Year' },
  { date: '12 Aug', label: 'TT2 — All 3rd Year (CS601, CS603)', type: 'tt' as const, year: '3rd Year' },
  { date: '18 Aug', label: 'Quiz 2 — CS403 Sec C', type: 'quiz' as const, year: '2nd Year' },
  { date: '25 Aug', label: 'TT2 — 2nd Year (CS401, CS403, MA301)', type: 'tt' as const, year: '2nd Year' },
  { date: '26 Aug', label: 'TT2 — 4th Year CS702', type: 'tt' as const, year: '4th Year' },
  { date: '05 Sep', label: 'Assignment 2 Due — CS401', type: 'asgn' as const, year: '2nd Year' },
  { date: '15 Sep', label: 'Remedial quiz review — CS401 all sections', type: 'quiz' as const, year: '2nd Year' },
  { date: '20 Oct', label: 'Attendance Finalisation — All Years', type: 'att' as const, year: 'All' },
  { date: '10 Nov', label: 'SEE (Finals) begin — All Years', type: 'see' as const, year: 'All' },
]

function toGradePoint(score: number): 0 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  if (score > 90) return 10
  if (score > 74) return 9
  if (score > 60) return 8
  if (score >= 55) return 7
  if (score >= 50) return 6
  if (score > 44) return 5
  if (score >= 40) return 4
  return 0
}

function toGradeLabel(score: number): 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F' {
  const point = toGradePoint(score)
  if (point === 10) return 'O'
  if (point === 9) return 'A+'
  if (point === 8) return 'A'
  if (point === 7) return 'B+'
  if (point === 6) return 'B'
  if (point === 5) return 'C'
  if (point === 4) return 'P'
  return 'F'
}

function toTranscriptSubject(code: string, title: string, credits: number, score: number, result?: 'Passed' | 'Failed' | 'Repeated'): TranscriptSubjectRecord {
  const gradePoint = toGradePoint(score)
  return {
    code,
    title,
    credits,
    score,
    gradeLabel: toGradeLabel(score),
    gradePoint,
    result: result ?? (gradePoint === 0 ? 'Failed' : 'Passed'),
  }
}

function toTranscriptTerm(termId: string, label: string, semesterNumber: number, academicYear: string, subjects: TranscriptSubjectRecord[]): TranscriptTerm {
  const registeredCredits = subjects.reduce((acc, subject) => acc + subject.credits, 0)
  const earnedCredits = subjects.filter(subject => subject.gradePoint > 0).reduce((acc, subject) => acc + subject.credits, 0)
  const backlogCount = subjects.filter(subject => subject.gradePoint === 0).length
  const totalWeightedPoints = subjects.reduce((acc, subject) => acc + subject.credits * subject.gradePoint, 0)
  return {
    termId,
    label,
    semesterNumber,
    academicYear,
    sgpa: registeredCredits > 0 ? Math.round((totalWeightedPoints / registeredCredits) * 100) / 100 : 0,
    registeredCredits,
    earnedCredits,
    backlogCount,
    subjects,
  }
}

function toCurrentCgpa(terms: TranscriptTerm[]) {
  const allSubjects = terms.flatMap(term => term.subjects)
  const totalCredits = allSubjects.reduce((acc, subject) => acc + subject.credits, 0)
  const weighted = allSubjects.reduce((acc, subject) => acc + subject.credits * subject.gradePoint, 0)
  return totalCredits > 0 ? Math.round((weighted / totalCredits) * 100) / 100 : 0
}

function toHistoryRecord(input: Omit<StudentHistoryRecord, 'currentCgpa'>): StudentHistoryRecord {
  return {
    ...input,
    currentCgpa: toCurrentCgpa(input.terms),
  }
}

const SEEDED_HISTORY: Record<string, StudentHistoryRecord> = {
  '1MS23CS001': toHistoryRecord({
    usn: '1MS23CS001',
    studentName: 'Aarav Sharma',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Declining',
    advisoryNotes: ['Backlog recovered once already; watch workload and attendance.', 'Repeated Data Structures attempt improved, but current core subjects remain fragile.'],
    repeatSubjects: ['CS201 Data Structures'],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2023-24', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 67),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 74),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 63),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 78),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 82),
      ]),
      toTranscriptTerm('sem2', 'Semester 2', 2, '2023-24', [
        toTranscriptSubject('MA201', 'Discrete Mathematics', 4, 58),
        toTranscriptSubject('CS201', 'Data Structures', 4, 38, 'Failed'),
        toTranscriptSubject('CS202', 'Digital Logic', 3, 61),
        toTranscriptSubject('CS203L', 'Data Structures Lab', 1, 69),
        toTranscriptSubject('HS204', 'Constitutional Studies', 2, 76),
      ]),
      toTranscriptTerm('sem3', 'Semester 3', 3, '2024-25', [
        toTranscriptSubject('CS201R', 'Data Structures (Repeat)', 4, 68, 'Repeated'),
        toTranscriptSubject('CS301', 'Formal Languages', 4, 56),
        toTranscriptSubject('CS302', 'Database Systems', 4, 63),
        toTranscriptSubject('MA301', 'Engineering Mathematics III', 4, 52),
        toTranscriptSubject('CS303L', 'DBMS Lab', 1, 77),
      ]),
    ],
  }),
  '1MS23CS014': toHistoryRecord({
    usn: '1MS23CS014',
    studentName: 'Meera Sundaram',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Stable',
    advisoryNotes: ['Performance is steady; interventions are mostly preventive.', 'Watch CO2/CO3 weakness in algorithm-heavy subjects.'],
    repeatSubjects: [],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2023-24', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 79),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 81),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 72),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 88),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 91),
      ]),
      toTranscriptTerm('sem2', 'Semester 2', 2, '2023-24', [
        toTranscriptSubject('MA201', 'Discrete Mathematics', 4, 76),
        toTranscriptSubject('CS201', 'Data Structures', 4, 71),
        toTranscriptSubject('CS202', 'Digital Logic', 3, 75),
        toTranscriptSubject('CS203L', 'Data Structures Lab', 1, 86),
        toTranscriptSubject('HS204', 'Constitutional Studies', 2, 90),
      ]),
      toTranscriptTerm('sem3', 'Semester 3', 3, '2024-25', [
        toTranscriptSubject('CS301', 'Formal Languages', 4, 73),
        toTranscriptSubject('CS302', 'Database Systems', 4, 78),
        toTranscriptSubject('CS303', 'Computer Networks', 4, 69),
        toTranscriptSubject('MA301', 'Engineering Mathematics III', 4, 70),
        toTranscriptSubject('CS303L', 'DBMS Lab', 1, 88),
      ]),
    ],
  }),
  '1MS24CS103': toHistoryRecord({
    usn: '1MS24CS103',
    studentName: 'Rohan Mehta',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Stable',
    advisoryNotes: ['Current-semester only profile. Use attendance and formative assessment until TT1 is available.'],
    repeatSubjects: [],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2025-26', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 72),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 77),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 68),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 79),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 85),
      ]),
    ],
  }),
  '1MS22CS041': toHistoryRecord({
    usn: '1MS22CS041',
    studentName: 'Sneha Pillai',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Improving',
    advisoryNotes: ['Third-year performance improved after remedial support in compiler topics.', 'Recent TT2 recovery is consistent with transcript trend.'],
    repeatSubjects: [],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2022-23', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 70),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 75),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 68),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 80),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 84),
      ]),
      toTranscriptTerm('sem2', 'Semester 2', 2, '2022-23', [
        toTranscriptSubject('MA201', 'Discrete Mathematics', 4, 74),
        toTranscriptSubject('CS201', 'Data Structures', 4, 72),
        toTranscriptSubject('CS202', 'Digital Logic', 3, 76),
        toTranscriptSubject('CS203L', 'Data Structures Lab', 1, 89),
        toTranscriptSubject('HS204', 'Constitutional Studies', 2, 90),
      ]),
      toTranscriptTerm('sem3', 'Semester 3', 3, '2023-24', [
        toTranscriptSubject('CS301', 'Formal Languages', 4, 78),
        toTranscriptSubject('CS302', 'Database Systems', 4, 80),
        toTranscriptSubject('CS303', 'Computer Networks', 4, 74),
        toTranscriptSubject('MA301', 'Engineering Mathematics III', 4, 73),
        toTranscriptSubject('CS303L', 'DBMS Lab', 1, 91),
      ]),
      toTranscriptTerm('sem4', 'Semester 4', 4, '2023-24', [
        toTranscriptSubject('CS401', 'Design & Analysis of Algorithms', 4, 71),
        toTranscriptSubject('CS403', 'Operating Systems', 4, 76),
        toTranscriptSubject('CS405', 'Software Engineering', 3, 83),
        toTranscriptSubject('CS407L', 'OS Lab', 1, 92),
      ]),
    ],
  }),
  '1MS21CS008': toHistoryRecord({
    usn: '1MS21CS008',
    studentName: 'Deepika Rao',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Stable',
    advisoryNotes: ['Final-year record is strong overall; current course-level risk is localised.', 'Transcript indicates good recovery after early-semester dips.'],
    repeatSubjects: [],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2021-22', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 81),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 79),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 75),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 86),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 93),
      ]),
      toTranscriptTerm('sem2', 'Semester 2', 2, '2021-22', [
        toTranscriptSubject('MA201', 'Discrete Mathematics', 4, 77),
        toTranscriptSubject('CS201', 'Data Structures', 4, 81),
        toTranscriptSubject('CS202', 'Digital Logic', 3, 72),
        toTranscriptSubject('CS203L', 'Data Structures Lab', 1, 89),
        toTranscriptSubject('HS204', 'Constitutional Studies', 2, 88),
      ]),
      toTranscriptTerm('sem3', 'Semester 3', 3, '2022-23', [
        toTranscriptSubject('CS301', 'Formal Languages', 4, 78),
        toTranscriptSubject('CS302', 'Database Systems', 4, 80),
        toTranscriptSubject('CS303', 'Computer Networks', 4, 79),
        toTranscriptSubject('MA301', 'Engineering Mathematics III', 4, 73),
        toTranscriptSubject('CS303L', 'DBMS Lab', 1, 92),
      ]),
      toTranscriptTerm('sem4', 'Semester 4', 4, '2022-23', [
        toTranscriptSubject('CS401', 'Design & Analysis of Algorithms', 4, 82),
        toTranscriptSubject('CS403', 'Operating Systems', 4, 78),
        toTranscriptSubject('CS405', 'Software Engineering', 3, 84),
        toTranscriptSubject('CS407L', 'OS Lab', 1, 94),
      ]),
    ],
  }),
  '1MS23CS019': toHistoryRecord({
    usn: '1MS23CS019',
    studentName: 'Ishita Mishra',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Improving',
    advisoryNotes: ['Previous-semester failure in mathematics remains an active risk amplifier.', 'Current mentor plan should be checked against repeat-subject workload.'],
    repeatSubjects: ['MA201 Discrete Mathematics'],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2023-24', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 64),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 71),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 59),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 73),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 80),
      ]),
      toTranscriptTerm('sem2', 'Semester 2', 2, '2023-24', [
        toTranscriptSubject('MA201', 'Discrete Mathematics', 4, 36, 'Failed'),
        toTranscriptSubject('CS201', 'Data Structures', 4, 57),
        toTranscriptSubject('CS202', 'Digital Logic', 3, 62),
        toTranscriptSubject('CS203L', 'Data Structures Lab', 1, 74),
        toTranscriptSubject('HS204', 'Constitutional Studies', 2, 82),
      ]),
      toTranscriptTerm('sem3', 'Semester 3', 3, '2024-25', [
        toTranscriptSubject('MA201R', 'Discrete Mathematics (Repeat)', 4, 61, 'Repeated'),
        toTranscriptSubject('CS301', 'Formal Languages', 4, 58),
        toTranscriptSubject('CS302', 'Database Systems', 4, 65),
        toTranscriptSubject('MA301', 'Engineering Mathematics III', 4, 54),
        toTranscriptSubject('CS303L', 'DBMS Lab', 1, 79),
      ]),
    ],
  }),
  '1MS23CS028': toHistoryRecord({
    usn: '1MS23CS028',
    studentName: 'Nandita Gowda',
    program: 'CSE',
    dept: 'CSE',
    trend: 'Declining',
    advisoryNotes: ['Attendance and medium backlog exposure are both rising.', 'Queue handoff to mentor should stay active until TT2 closes.'],
    repeatSubjects: [],
    terms: [
      toTranscriptTerm('sem1', 'Semester 1', 1, '2023-24', [
        toTranscriptSubject('MA101', 'Engineering Mathematics I', 4, 69),
        toTranscriptSubject('CS101', 'Problem Solving with C', 4, 72),
        toTranscriptSubject('EC102', 'Basic Electronics', 3, 61),
        toTranscriptSubject('HS103', 'Technical Communication', 2, 79),
        toTranscriptSubject('CS104L', 'C Programming Lab', 1, 85),
      ]),
      toTranscriptTerm('sem2', 'Semester 2', 2, '2023-24', [
        toTranscriptSubject('MA201', 'Discrete Mathematics', 4, 48),
        toTranscriptSubject('CS201', 'Data Structures', 4, 52),
        toTranscriptSubject('CS202', 'Digital Logic', 3, 64),
        toTranscriptSubject('CS203L', 'Data Structures Lab', 1, 71),
        toTranscriptSubject('HS204', 'Constitutional Studies', 2, 75),
      ]),
      toTranscriptTerm('sem3', 'Semester 3', 3, '2024-25', [
        toTranscriptSubject('CS301', 'Formal Languages', 4, 51),
        toTranscriptSubject('CS302', 'Database Systems', 4, 56),
        toTranscriptSubject('CS303', 'Computer Networks', 4, 49, 'Failed'),
        toTranscriptSubject('MA301', 'Engineering Mathematics III', 4, 58),
        toTranscriptSubject('CS303L', 'DBMS Lab', 1, 73),
      ]),
    ],
  }),
}

function buildFallbackHistory(params: { usn: string; studentName: string; dept: string; yearLabel?: string; prevCgpa?: number }): StudentHistoryRecord {
  const { usn, studentName, dept, yearLabel, prevCgpa = 7 } = params
  const targetTerms = yearLabel === '4th Year' ? 4 : yearLabel === '3rd Year' ? 4 : yearLabel === '2nd Year' ? 3 : 1
  const terms: TranscriptTerm[] = []
  for (let semesterNumber = 1; semesterNumber <= targetTerms; semesterNumber += 1) {
    const base = Math.round(prevCgpa * 9) + semesterNumber * 2
    const subjectScores = [
      58 + ((base + 3) % 24),
      61 + ((base + 7) % 22),
      55 + ((base + 11) % 26),
      64 + ((base + 5) % 18),
    ]
    const subjects = [
      toTranscriptSubject(`CS${semesterNumber}01`, `Core Subject ${semesterNumber}.1`, 4, subjectScores[0]),
      toTranscriptSubject(`CS${semesterNumber}02`, `Core Subject ${semesterNumber}.2`, 4, subjectScores[1]),
      toTranscriptSubject(`MA${semesterNumber}01`, `Mathematics ${semesterNumber}`, 4, subjectScores[2]),
      toTranscriptSubject(`HS${semesterNumber}01`, `Humanities ${semesterNumber}`, 2, subjectScores[3]),
      toTranscriptSubject(`CS${semesterNumber}0L`, `Lab ${semesterNumber}`, 1, 72 + ((base + 9) % 18)),
    ]
    terms.push(toTranscriptTerm(
      `sem-${semesterNumber}`,
      `Semester ${semesterNumber}`,
      semesterNumber,
      semesterNumber <= 2 ? '2024-25' : '2025-26',
      subjects,
    ))
  }
  return toHistoryRecord({
    usn,
    studentName,
    program: dept,
    dept,
    trend: 'Stable',
    advisoryNotes: ['Generated fallback transcript for mock walkthrough.', 'Use this record to validate history-page empty-state handling.'],
    repeatSubjects: [],
    terms,
  })
}

export function getStudentHistoryRecord(params: { usn: string; studentName: string; dept: string; yearLabel?: string; prevCgpa?: number }): StudentHistoryRecord {
  return SEEDED_HISTORY[params.usn] ?? buildFallbackHistory(params)
}
