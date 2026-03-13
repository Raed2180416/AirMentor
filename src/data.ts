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
  quiz1: number | null; quiz2: number | null; quiz3: number | null
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
  offerings: number; students: number; highRisk: number
  avgAtt: number; completeness: number; pendingTasks: number
}

// ───── Theme ─────
export const T = {
  bg: '#07090f', surface: '#0d1017', surface2: '#111520', surface3: '#161b28',
  border: '#1c2333', border2: '#242d40',
  text: '#e2e8f4', muted: '#8892a4', dim: '#3d4a60',
  accent: '#6366f1', accentLight: '#818cf8',
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
    { id: 'q1', text: 'Prove Big-O complexity of Merge Sort; compare with Quick Sort', maxMarks: 8, cos: ['CO1'] },
    { id: 'q2', text: 'Design a greedy solution for Activity Selection Problem', maxMarks: 8, cos: ['CO2'] },
    { id: 'q3', text: 'Apply DP to 0/1 Knapsack problem with full derivation', maxMarks: 7, cos: ['CO3'] },
    { id: 'q4', text: 'Recurrence relation for D&C; apply Master Theorem', maxMarks: 7, cos: ['CO1', 'CO2'] },
  ],
  default: [
    { id: 'q1', text: 'Answer question 1 — Unit 1 concepts', maxMarks: 8, cos: ['CO1'] },
    { id: 'q2', text: 'Answer question 2 — Unit 2 concepts', maxMarks: 8, cos: ['CO2'] },
    { id: 'q3', text: 'Answer question 3 — applied problem', maxMarks: 7, cos: ['CO3'] },
    { id: 'q4', text: 'Answer question 4 — mixed concepts', maxMarks: 7, cos: ['CO1', 'CO2'] },
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

  return Array.from({ length: count }, (_, i) => {
    const present = 28 + rand(17)
    const totalClasses = 45
    const attendancePct = Math.round(present / totalClasses * 100)
    const prevCgpa = 5.2 + Math.round(randFloat() * 40) / 10 // 5.2 - 9.2

    let tt1Score: number | null = null
    let tt2Score: number | null = null
    if (tt1Done) tt1Score = 4 + rand(totalMax - 4)
    if (tt2Done) tt2Score = 6 + rand(totalMax - 6)

    const quiz1 = tt1Done ? 2 + rand(8) : null
    const quiz2 = null
    const quiz3 = null
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
      usn: `1MS${23 + Math.floor(sem / 2)}${dept.slice(0, 2).toUpperCase()}${String(i + 1).padStart(3, '0')}`,
      name: NAMES[i % NAMES.length],
      phone: PHONES[i % PHONES.length],
      present, totalClasses,
      tt1Score, tt1Max: totalMax,
      tt2Score, tt2Max: totalMax,
      quiz1, quiz2, quiz3,
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
    if (riskProb !== null && riskProb >= 0.7 && i < 5) {
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
export const TEACHERS: TeacherInfo[] = [
  { id: 't1', name: 'Dr. Kavitha Rao', initials: 'KR', dept: 'CSE', role: 'Associate Professor', offerings: 11, students: 557, highRisk: 14, avgAtt: 79, completeness: 68, pendingTasks: 6 },
  { id: 't2', name: 'Dr. Arvind Kumar', initials: 'AK', dept: 'CSE', role: 'Professor', offerings: 6, students: 340, highRisk: 8, avgAtt: 82, completeness: 75, pendingTasks: 3 },
  { id: 't3', name: 'Prof. Sneha Nair', initials: 'SN', dept: 'CSE', role: 'Assistant Professor', offerings: 4, students: 230, highRisk: 11, avgAtt: 71, completeness: 52, pendingTasks: 9 },
  { id: 't4', name: 'Dr. Rajesh Bhat', initials: 'RB', dept: 'CSE', role: 'Associate Professor', offerings: 5, students: 280, highRisk: 5, avgAtt: 84, completeness: 88, pendingTasks: 2 },
  { id: 't5', name: 'Prof. Ananya Iyer', initials: 'AI', dept: 'CSE', role: 'Assistant Professor', offerings: 8, students: 480, highRisk: 18, avgAtt: 74, completeness: 61, pendingTasks: 12 },
  { id: 't6', name: 'Dr. Vikram Nair', initials: 'VN', dept: 'CSE', role: 'Professor', offerings: 3, students: 180, highRisk: 3, avgAtt: 87, completeness: 92, pendingTasks: 1 },
]

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
  { date: '15 Sep', label: 'Quiz 3 — CS401 all sections', type: 'quiz' as const, year: '2nd Year' },
  { date: '20 Oct', label: 'Attendance Finalisation — All Years', type: 'att' as const, year: 'All' },
  { date: '10 Nov', label: 'SEE (Finals) begin — All Years', type: 'see' as const, year: 'All' },
]
