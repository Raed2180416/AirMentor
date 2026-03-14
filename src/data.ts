export type Role = 'Course Leader' | 'Mentor' | 'HoD'
export type ThemeMode = 'light' | 'dark'
export type ThemeFamily = 'calm-neutral' | 'frosted-focus' | 'material-utility' | 'high-contrast-minimal'
export type EntryKind = 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'attendance' | 'finals'
export type Stage = 1 | 2 | 3
export type RiskBand = 'High' | 'Medium' | 'Low'
export type SchemeStatus = 'Draft' | 'Submitted' | 'Changes Requested' | 'Approved' | 'Frozen'
export type SchemeComponentKind = 'quiz' | 'assignment'

export type StageInfo = {
  stage: Stage
  label: string
  description: string
}

export type FacultyRecord = {
  facultyId: string
  name: string
  initials: string
  title: string
  dept: string
  roles: Role[]
  subjectRunIds: string[]
  sectionOfferingIds: string[]
  menteeUsns: string[]
}

export type SchemeComponentSeed = {
  id: string
  kind: SchemeComponentKind
  label: string
  rawMax: number
  normalizedWeight: number
}

export type SubjectRun = {
  subjectRunId: string
  code: string
  title: string
  dept: string
  semester: number
  academicYear: string
  yearLabel: string
  stageInfo: StageInfo
  sectionOfferingIds: string[]
  courseLeaderFacultyIds: string[]
  seeRawMax: 50 | 100
  initialSchemeStatus: SchemeStatus
  initialLockedKinds: EntryKind[]
  componentSeeds: SchemeComponentSeed[]
}

export type OfferingSection = {
  offId: string
  subjectRunId: string
  code: string
  title: string
  dept: string
  semester: number
  academicYear: string
  yearLabel: string
  stageInfo: StageInfo
  section: string
  count: number
}

export type StudentIntervention = {
  date: string
  type: string
  note: string
}

export type Student = {
  id: string
  usn: string
  name: string
  phone: string
  yearLabel: string
  section: string
  dept: string
  prevCgpa: number
  present: number
  totalClasses: number
  tt1Score: number | null
  tt1Max: number
  tt2Score: number | null
  tt2Max: number
  quiz1: number | null
  quiz2: number | null
  assignment1: number | null
  assignment2: number | null
  riskBand: RiskBand | null
  riskProb: number | null
  interventions: StudentIntervention[]
}

export type StudentCourseRisk = {
  code: string
  title: string
  riskProb: number | null
  riskBand: RiskBand | null
  stageInfo: StageInfo
}

export type MenteeSummary = {
  usn: string
  name: string
  phone: string
  dept: string
  yearLabel: string
  section: string
  prevCgpa: number
  interventions: StudentIntervention[]
  courseRisks: StudentCourseRisk[]
}

export type StudentHistoryTerm = {
  label: string
  sgpa: number
  credits: number
  highlights: string[]
}

export type StudentHistoryRecord = {
  usn: string
  studentName: string
  dept: string
  currentCgpa: number
  trend: 'Improving' | 'Stable' | 'Declining'
  notes: string[]
  terms: StudentHistoryTerm[]
}

export type CalendarEvent = {
  date: string
  label: string
  type: 'review' | 'tt' | 'quiz' | 'assignment' | 'attendance' | 'task' | 'scheme'
}

export type BlueprintQuestionSeed = {
  id: string
  text: string
  parts: Array<{
    id: string
    label: string
    text: string
    maxMarks: number
  }>
}

export const STAGE_BY_YEAR: Record<string, StageInfo> = {
  '1st Year': { stage: 1, label: 'Stage 1', description: 'Course opening and scheme setup' },
  '2nd Year': { stage: 2, label: 'Stage 2', description: 'TT1 complete and mid-course tracking' },
  '3rd Year': { stage: 3, label: 'Stage 3', description: 'Late-course follow-up and TT2' },
  '4th Year': { stage: 2, label: 'Stage 2', description: 'TT1 complete and project-heavy review' },
}

const SUBJECT_RUN_SEEDS: Array<{
  subjectRunId: string
  code: string
  title: string
  dept: string
  semester: number
  academicYear: string
  yearLabel: string
  sections: Array<{ section: string; count: number }>
  courseLeaderFacultyIds: string[]
  seeRawMax: 50 | 100
  initialSchemeStatus: SchemeStatus
  initialLockedKinds: EntryKind[]
  componentSeeds: SchemeComponentSeed[]
}> = [
  {
    subjectRunId: 'sr-cs101-sem1-2025',
    code: 'CS101',
    title: 'Problem Solving with C',
    dept: 'CSE',
    semester: 1,
    academicYear: '2025-26',
    yearLabel: '1st Year',
    sections: [{ section: 'A', count: 12 }],
    courseLeaderFacultyIds: ['t5'],
    seeRawMax: 50,
    initialSchemeStatus: 'Draft',
    initialLockedKinds: [],
    componentSeeds: [
      { id: 'cs101-q1', kind: 'quiz', label: 'Quiz 1', rawMax: 10, normalizedWeight: 10 },
      { id: 'cs101-a1', kind: 'assignment', label: 'Assignment 1', rawMax: 20, normalizedWeight: 20 },
    ],
  },
  {
    subjectRunId: 'sr-cs305-sem5-2025',
    code: 'CS305',
    title: 'Software Engineering',
    dept: 'CSE',
    semester: 5,
    academicYear: '2025-26',
    yearLabel: '3rd Year',
    sections: [{ section: 'A', count: 10 }],
    courseLeaderFacultyIds: ['t2', 't8'],
    seeRawMax: 50,
    initialSchemeStatus: 'Approved',
    initialLockedKinds: [],
    componentSeeds: [
      { id: 'cs305-q1', kind: 'quiz', label: 'Quiz 1', rawMax: 10, normalizedWeight: 10 },
      { id: 'cs305-a1', kind: 'assignment', label: 'Sprint Review', rawMax: 20, normalizedWeight: 20 },
    ],
  },
  {
    subjectRunId: 'sr-cs401-sem4-2025',
    code: 'CS401',
    title: 'Design & Analysis of Algorithms',
    dept: 'CSE',
    semester: 4,
    academicYear: '2025-26',
    yearLabel: '2nd Year',
    sections: [{ section: 'A', count: 14 }, { section: 'B', count: 12 }],
    courseLeaderFacultyIds: ['t1', 't7'],
    seeRawMax: 50,
    initialSchemeStatus: 'Frozen',
    initialLockedKinds: ['tt1', 'quiz'],
    componentSeeds: [
      { id: 'cs401-q1', kind: 'quiz', label: 'Quiz 1', rawMax: 10, normalizedWeight: 10 },
      { id: 'cs401-q2', kind: 'quiz', label: 'Quiz 2', rawMax: 10, normalizedWeight: 10 },
      { id: 'cs401-a1', kind: 'assignment', label: 'Assignment 1', rawMax: 20, normalizedWeight: 10 },
    ],
  },
  {
    subjectRunId: 'sr-cs403-sem4-2025',
    code: 'CS403',
    title: 'Operating Systems',
    dept: 'CSE',
    semester: 4,
    academicYear: '2025-26',
    yearLabel: '2nd Year',
    sections: [{ section: 'C', count: 11 }],
    courseLeaderFacultyIds: ['t1', 't8'],
    seeRawMax: 50,
    initialSchemeStatus: 'Submitted',
    initialLockedKinds: [],
    componentSeeds: [
      { id: 'cs403-q1', kind: 'quiz', label: 'Quiz 1', rawMax: 20, normalizedWeight: 20 },
      { id: 'cs403-a1', kind: 'assignment', label: 'Assignment 1', rawMax: 15, normalizedWeight: 10 },
    ],
  },
  {
    subjectRunId: 'sr-cs601-sem6-2025',
    code: 'CS601',
    title: 'Compiler Design',
    dept: 'CSE',
    semester: 6,
    academicYear: '2025-26',
    yearLabel: '3rd Year',
    sections: [{ section: 'B', count: 10 }],
    courseLeaderFacultyIds: ['t2', 't7'],
    seeRawMax: 50,
    initialSchemeStatus: 'Changes Requested',
    initialLockedKinds: [],
    componentSeeds: [
      { id: 'cs601-a1', kind: 'assignment', label: 'Parser Exercise', rawMax: 15, normalizedWeight: 15 },
      { id: 'cs601-a2', kind: 'assignment', label: 'Codegen Lab', rawMax: 15, normalizedWeight: 15 },
    ],
  },
  {
    subjectRunId: 'sr-cs702-sem7-2025',
    code: 'CS702',
    title: 'Deep Learning & Neural Networks',
    dept: 'CSE',
    semester: 7,
    academicYear: '2025-26',
    yearLabel: '4th Year',
    sections: [{ section: 'A', count: 9 }],
    courseLeaderFacultyIds: ['t4'],
    seeRawMax: 100,
    initialSchemeStatus: 'Frozen',
    initialLockedKinds: ['tt1', 'tt2', 'quiz', 'assignment'],
    componentSeeds: [
      { id: 'cs702-q1', kind: 'quiz', label: 'Reading Quiz', rawMax: 10, normalizedWeight: 10 },
      { id: 'cs702-a1', kind: 'assignment', label: 'Model Notebook', rawMax: 20, normalizedWeight: 20 },
    ],
  },
]

export const SUBJECT_RUNS: SubjectRun[] = SUBJECT_RUN_SEEDS.map((seed) => ({
  subjectRunId: seed.subjectRunId,
  code: seed.code,
  title: seed.title,
  dept: seed.dept,
  semester: seed.semester,
  academicYear: seed.academicYear,
  yearLabel: seed.yearLabel,
  stageInfo: STAGE_BY_YEAR[seed.yearLabel],
  sectionOfferingIds: seed.sections.map((item) => `${seed.subjectRunId}-${item.section}`),
  courseLeaderFacultyIds: seed.courseLeaderFacultyIds,
  seeRawMax: seed.seeRawMax,
  initialSchemeStatus: seed.initialSchemeStatus,
  initialLockedKinds: seed.initialLockedKinds,
  componentSeeds: seed.componentSeeds,
}))

export const OFFERINGS: OfferingSection[] = SUBJECT_RUN_SEEDS.flatMap((seed) =>
  seed.sections.map((item) => ({
    offId: `${seed.subjectRunId}-${item.section}`,
    subjectRunId: seed.subjectRunId,
    code: seed.code,
    title: seed.title,
    dept: seed.dept,
    semester: seed.semester,
    academicYear: seed.academicYear,
    yearLabel: seed.yearLabel,
    stageInfo: STAGE_BY_YEAR[seed.yearLabel],
    section: item.section,
    count: item.count,
  })),
)

const FACULTY_SEEDS: Array<Omit<FacultyRecord, 'sectionOfferingIds'>> = [
  {
    facultyId: 't1',
    name: 'Dr. Kavitha Rao',
    initials: 'KR',
    title: 'Professor & HoD',
    dept: 'CSE',
    roles: ['Course Leader', 'Mentor', 'HoD'],
    subjectRunIds: ['sr-cs401-sem4-2025', 'sr-cs403-sem4-2025'],
    menteeUsns: ['1MS23CS001', '1MS23CS019', '1MS23CS028'],
  },
  {
    facultyId: 't2',
    name: 'Dr. Arvind Kumar',
    initials: 'AK',
    title: 'Professor',
    dept: 'CSE',
    roles: ['Course Leader'],
    subjectRunIds: ['sr-cs305-sem5-2025', 'sr-cs601-sem6-2025'],
    menteeUsns: [],
  },
  {
    facultyId: 't3',
    name: 'Prof. Sneha Nair',
    initials: 'SN',
    title: 'Assistant Professor',
    dept: 'CSE',
    roles: ['Mentor'],
    subjectRunIds: [],
    menteeUsns: ['1MS24CS103', '1MS24CS044', '1MS24CS022'],
  },
  {
    facultyId: 't4',
    name: 'Dr. Rajesh Bhat',
    initials: 'RB',
    title: 'Associate Professor',
    dept: 'CSE',
    roles: ['Course Leader', 'Mentor'],
    subjectRunIds: ['sr-cs702-sem7-2025'],
    menteeUsns: ['1MS21CS008', '1MS21CS012'],
  },
  {
    facultyId: 't5',
    name: 'Prof. Ananya Iyer',
    initials: 'AI',
    title: 'Assistant Professor',
    dept: 'CSE',
    roles: ['Course Leader'],
    subjectRunIds: ['sr-cs101-sem1-2025'],
    menteeUsns: [],
  },
  {
    facultyId: 't6',
    name: 'Dr. Vikram Nair',
    initials: 'VN',
    title: 'Professor',
    dept: 'CSE',
    roles: ['Mentor'],
    subjectRunIds: [],
    menteeUsns: ['1MS22CS041', '1MS22CS033'],
  },
  {
    facultyId: 't7',
    name: 'Dr. Meera Kulkarni',
    initials: 'MK',
    title: 'Associate Professor',
    dept: 'CSE',
    roles: ['Course Leader'],
    subjectRunIds: ['sr-cs401-sem4-2025', 'sr-cs601-sem6-2025'],
    menteeUsns: [],
  },
  {
    facultyId: 't8',
    name: 'Prof. Devika Menon',
    initials: 'DM',
    title: 'Assistant Professor',
    dept: 'CSE',
    roles: ['Course Leader', 'Mentor'],
    subjectRunIds: ['sr-cs305-sem5-2025', 'sr-cs403-sem4-2025'],
    menteeUsns: ['1MS23CS014', '1MS23CS041'],
  },
]

export const FACULTY: FacultyRecord[] = FACULTY_SEEDS.map((faculty) => ({
  ...faculty,
  sectionOfferingIds: SUBJECT_RUNS.filter((subjectRun) => faculty.subjectRunIds.includes(subjectRun.subjectRunId))
    .flatMap((subjectRun) => subjectRun.sectionOfferingIds),
}))

export const ENTRY_KIND_LABELS: Record<EntryKind, string> = {
  tt1: 'TT1',
  tt2: 'TT2',
  quiz: 'Quiz',
  assignment: 'Assignment',
  attendance: 'Attendance',
  finals: 'SEE',
}

export const THEME_FAMILIES: Array<{
  id: ThemeFamily
  label: string
  description: string
}> = [
  { id: 'calm-neutral', label: 'Calm Neutral', description: 'Atlassian and Primer inspired muted surfaces with restrained blue accents.' },
  { id: 'frosted-focus', label: 'Frosted Focus', description: 'Linear-inspired layered chrome with cool highlights and softer depth.' },
  { id: 'material-utility', label: 'Material Utility', description: 'Clear hierarchy and straightforward functional surfaces with balanced contrast.' },
  { id: 'high-contrast-minimal', label: 'High Contrast Minimal', description: 'Sharper lines, stronger contrast, and reduced decorative color noise.' },
]

export const CALENDAR_EVENTS: CalendarEvent[] = [
  { date: '14 Mar', label: 'HoD scheme review for CS403 subject-run', type: 'review' },
  { date: '16 Mar', label: 'TT1 blueprint publish window for CS305', type: 'tt' },
  { date: '18 Mar', label: 'CS101 scheme draft workshop', type: 'scheme' },
  { date: '19 Mar', label: 'Quiz 1 freeze already completed for CS401', type: 'quiz' },
  { date: '22 Mar', label: 'Assignment evidence review for CS702', type: 'assignment' },
  { date: '24 Mar', label: 'Attendance checkpoint for 2nd Year CSE', type: 'attendance' },
  { date: '26 Mar', label: 'Mentor recurring follow-up batch', type: 'task' },
]

const PAPER_BANK: Record<string, BlueprintQuestionSeed[]> = {
  CS101: [
    {
      id: 'q1',
      text: 'Trace loops and conditionals for control-flow reasoning.',
      parts: [
        { id: 'q1a', label: 'Q1a', text: 'Loop trace', maxMarks: 4 },
        { id: 'q1b', label: 'Q1b', text: 'Conditional reasoning', maxMarks: 3 },
      ],
    },
    {
      id: 'q2',
      text: 'Write a function using arrays and pointers.',
      parts: [
        { id: 'q2a', label: 'Q2a', text: 'Array handling', maxMarks: 4 },
        { id: 'q2b', label: 'Q2b', text: 'Pointer reasoning', maxMarks: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Explain structured programming trade-offs.',
      parts: [
        { id: 'q3a', label: 'Q3a', text: 'Concept note', maxMarks: 5 },
        { id: 'q3b', label: 'Q3b', text: 'Applied example', maxMarks: 5 },
      ],
    },
  ],
  CS305: [
    {
      id: 'q1',
      text: 'Compare agile ceremonies and documentation outputs.',
      parts: [
        { id: 'q1a', label: 'Q1a', text: 'Ceremony map', maxMarks: 4 },
        { id: 'q1b', label: 'Q1b', text: 'Artefact alignment', maxMarks: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Model risks in a sprint planning scenario.',
      parts: [
        { id: 'q2a', label: 'Q2a', text: 'Risk discovery', maxMarks: 5 },
        { id: 'q2b', label: 'Q2b', text: 'Mitigation plan', maxMarks: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Evaluate test strategy coverage.',
      parts: [
        { id: 'q3a', label: 'Q3a', text: 'Coverage critique', maxMarks: 4 },
        { id: 'q3b', label: 'Q3b', text: 'Improvement proposal', maxMarks: 4 },
      ],
    },
  ],
  CS401: [
    {
      id: 'q1',
      text: 'Analyse divide-and-conquer recurrence relations.',
      parts: [
        { id: 'q1a', label: 'Q1a', text: 'Recurrence setup', maxMarks: 4 },
        { id: 'q1b', label: 'Q1b', text: 'Master theorem', maxMarks: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Design a greedy algorithm and justify optimality.',
      parts: [
        { id: 'q2a', label: 'Q2a', text: 'Algorithm design', maxMarks: 4 },
        { id: 'q2b', label: 'Q2b', text: 'Optimality proof', maxMarks: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Apply dynamic programming to a bounded-choice problem.',
      parts: [
        { id: 'q3a', label: 'Q3a', text: 'State design', maxMarks: 5 },
        { id: 'q3b', label: 'Q3b', text: 'Transition reasoning', maxMarks: 4 },
      ],
    },
  ],
  CS403: [
    {
      id: 'q1',
      text: 'Explain process scheduling trade-offs.',
      parts: [
        { id: 'q1a', label: 'Q1a', text: 'Scheduling map', maxMarks: 4 },
        { id: 'q1b', label: 'Q1b', text: 'Trade-off analysis', maxMarks: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Work through synchronization pitfalls.',
      parts: [
        { id: 'q2a', label: 'Q2a', text: 'Race condition', maxMarks: 4 },
        { id: 'q2b', label: 'Q2b', text: 'Semaphore fix', maxMarks: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Design a paging and memory management response.',
      parts: [
        { id: 'q3a', label: 'Q3a', text: 'Page flow', maxMarks: 5 },
        { id: 'q3b', label: 'Q3b', text: 'Replacement reasoning', maxMarks: 4 },
      ],
    },
  ],
  CS601: [
    {
      id: 'q1',
      text: 'Build a lexical analysis pipeline.',
      parts: [
        { id: 'q1a', label: 'Q1a', text: 'Token design', maxMarks: 4 },
        { id: 'q1b', label: 'Q1b', text: 'Finite automata', maxMarks: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Compare top-down and bottom-up parsing.',
      parts: [
        { id: 'q2a', label: 'Q2a', text: 'Parser flow', maxMarks: 4 },
        { id: 'q2b', label: 'Q2b', text: 'Conflict reasoning', maxMarks: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Propose an optimization pass.',
      parts: [
        { id: 'q3a', label: 'Q3a', text: 'Intermediate code', maxMarks: 5 },
        { id: 'q3b', label: 'Q3b', text: 'Optimization argument', maxMarks: 4 },
      ],
    },
  ],
  CS702: [
    {
      id: 'q1',
      text: 'Reason about neural network architecture choices.',
      parts: [
        { id: 'q1a', label: 'Q1a', text: 'Architecture map', maxMarks: 4 },
        { id: 'q1b', label: 'Q1b', text: 'Trade-off note', maxMarks: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Explain backpropagation and optimization behavior.',
      parts: [
        { id: 'q2a', label: 'Q2a', text: 'Gradient flow', maxMarks: 4 },
        { id: 'q2b', label: 'Q2b', text: 'Optimizer choice', maxMarks: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'Design an experiment for model evaluation.',
      parts: [
        { id: 'q3a', label: 'Q3a', text: 'Evaluation setup', maxMarks: 5 },
        { id: 'q3b', label: 'Q3b', text: 'Failure analysis', maxMarks: 4 },
      ],
    },
  ],
}

export function getDefaultBlueprintQuestions(code: string): BlueprintQuestionSeed[] {
  return PAPER_BANK[code] ?? PAPER_BANK.CS101
}

type StudentProfileSeed = {
  usn: string
  name: string
  phone: string
  prevCgpa: number
  interventions?: StudentIntervention[]
}

const SECTION_ROSTERS: Record<string, StudentProfileSeed[]> = {
  '1st Year|A|CSE': [
    { usn: '1MS25CS001', name: 'Aditi Nair', phone: '+91 9700000001', prevCgpa: 0 },
    { usn: '1MS25CS002', name: 'Rahul Saxena', phone: '+91 9700000002', prevCgpa: 0 },
    { usn: '1MS25CS003', name: 'Kavya Nambiar', phone: '+91 9700000003', prevCgpa: 0 },
    { usn: '1MS25CS004', name: 'Pranav Rajan', phone: '+91 9700000004', prevCgpa: 0 },
  ],
  '2nd Year|A|CSE': [
    { usn: '1MS23CS001', name: 'Aarav Sharma', phone: '+91 9700000101', prevCgpa: 6.1, interventions: [{ date: 'Mar 02', type: 'Call', note: 'Remedial support was discussed after weak TT1 performance.' }] },
    { usn: '1MS23CS014', name: 'Meera Sundaram', phone: '+91 9700000102', prevCgpa: 7.2, interventions: [{ date: 'Mar 05', type: 'Meeting', note: 'Followed up on algorithm practice and pacing.' }] },
    { usn: '1MS23CS019', name: 'Ishita Mishra', phone: '+91 9700000103', prevCgpa: 6.8, interventions: [{ date: 'Mar 07', type: 'Email', note: 'Shared repeat-subject workload plan.' }] },
    { usn: '1MS23CS041', name: 'Ritika Dutta', phone: '+91 9700000104', prevCgpa: 7.4 },
  ],
  '2nd Year|B|CSE': [
    { usn: '1MS23CS028', name: 'Nandita Gowda', phone: '+91 9700000111', prevCgpa: 6.3, interventions: [{ date: 'Mar 04', type: 'Call', note: 'Attendance and assignment gaps were reviewed.' }] },
    { usn: '1MS23CS033', name: 'Yash Patel', phone: '+91 9700000112', prevCgpa: 6.9 },
    { usn: '1MS23CS044', name: 'Pallavi Desai', phone: '+91 9700000113', prevCgpa: 7.1 },
    { usn: '1MS23CS052', name: 'Dhruv Verma', phone: '+91 9700000114', prevCgpa: 5.9 },
  ],
  '2nd Year|C|CSE': [
    { usn: '1MS23CS061', name: 'Akshay Kulkarni', phone: '+91 9700000121', prevCgpa: 6.4 },
    { usn: '1MS23CS062', name: 'Soumya Das', phone: '+91 9700000122', prevCgpa: 7.0 },
    { usn: '1MS23CS063', name: 'Anika Patel', phone: '+91 9700000123', prevCgpa: 6.7 },
    { usn: '1MS23CS064', name: 'Jayesh Pillai', phone: '+91 9700000124', prevCgpa: 6.0 },
  ],
  '3rd Year|A|CSE': [
    { usn: '1MS22CS041', name: 'Sneha Pillai', phone: '+91 9700000201', prevCgpa: 7.8, interventions: [{ date: 'Mar 08', type: 'Meeting', note: 'Recent TT2 recovery was reviewed with the mentor.' }] },
    { usn: '1MS22CS033', name: 'Chirag Joshi', phone: '+91 9700000202', prevCgpa: 8.2 },
    { usn: '1MS22CS045', name: 'Farhan Khan', phone: '+91 9700000203', prevCgpa: 6.7 },
    { usn: '1MS22CS053', name: 'Sanjana Bose', phone: '+91 9700000204', prevCgpa: 7.4 },
  ],
  '3rd Year|B|CSE': [
    { usn: '1MS22CS071', name: 'Rohan Mehta', phone: '+91 9700000211', prevCgpa: 7.0 },
    { usn: '1MS22CS072', name: 'Varun Krishnan', phone: '+91 9700000212', prevCgpa: 7.9 },
    { usn: '1MS22CS073', name: 'Supriya Rao', phone: '+91 9700000213', prevCgpa: 6.8 },
    { usn: '1MS22CS074', name: 'Uday Shankar', phone: '+91 9700000214', prevCgpa: 6.2 },
  ],
  '4th Year|A|CSE': [
    { usn: '1MS21CS008', name: 'Deepika Rao', phone: '+91 9700000301', prevCgpa: 7.8 },
    { usn: '1MS21CS012', name: 'Varun Krishnan', phone: '+91 9700000302', prevCgpa: 8.5 },
    { usn: '1MS21CS018', name: 'Ishaan Dubey', phone: '+91 9700000303', prevCgpa: 7.3 },
    { usn: '1MS21CS021', name: 'Sahana Murthy', phone: '+91 9700000304', prevCgpa: 7.9 },
  ],
}

const FALLBACK_NAMES = [
  'Ananya Iyer',
  'Arjun Menon',
  'Bhavya Shetty',
  'Chirag Patil',
  'Deepika Nair',
  'Esha Banerjee',
  'Harsh Patel',
  'Keerthana Suresh',
  'Lakshmi Prasad',
  'Nisha Kumar',
  'Omkar Patil',
  'Priya Chandrasekaran',
  'Rashmi Kamath',
  'Shilpa Upadhyay',
  'Tejashwini Gowda',
  'Vishal Reddy',
]

function hashSeed(value: string) {
  return value.split('').reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 3), 0)
}

function range(seed: number, min: number, max: number) {
  const width = max - min + 1
  return min + (seed % width)
}

function getRiskBand(probability: number): RiskBand {
  if (probability >= 0.7) return 'High'
  if (probability >= 0.4) return 'Medium'
  return 'Low'
}

function rosterKey(offering: OfferingSection) {
  return `${offering.yearLabel}|${offering.section}|${offering.dept}`
}

function buildRoster(offering: OfferingSection): StudentProfileSeed[] {
  const base = [...(SECTION_ROSTERS[rosterKey(offering)] ?? [])]
  while (base.length < offering.count) {
    const index = base.length
    base.push({
      usn: `1MS${20 + offering.semester}${offering.dept.slice(0, 2).toUpperCase()}${String(index + 1).padStart(3, '0')}`,
      name: FALLBACK_NAMES[index % FALLBACK_NAMES.length],
      phone: `+91 ${9700001000 + index * 17}`,
      prevCgpa: Number((6 + ((index % 7) * 0.3)).toFixed(1)),
    })
  }
  return base.slice(0, offering.count)
}

const STUDENT_CACHE = new Map<string, Student[]>()

export function getStudents(offering: OfferingSection): Student[] {
  const cached = STUDENT_CACHE.get(offering.offId)
  if (cached) return cached

  const subjectRun = getSubjectRunById(offering.subjectRunId)
  const hasEvaluationActivity = subjectRun?.initialSchemeStatus === 'Approved' || subjectRun?.initialSchemeStatus === 'Frozen'

  const students = buildRoster(offering).map((profile, index) => {
    const seed = hashSeed(`${offering.offId}-${profile.usn}-${index}`)
    const totalClasses = 45
    const present = range(seed, 27, 43)
    const tt1Score = hasEvaluationActivity && offering.stageInfo.stage >= 2 ? range(seed + 13, 9, 24) : null
    const tt2Score = hasEvaluationActivity && offering.stageInfo.stage >= 3 ? range(seed + 17, 10, 24) : null
    const quiz1 = hasEvaluationActivity && offering.stageInfo.stage >= 2 ? range(seed + 19, 4, 10) : null
    const quiz2 = hasEvaluationActivity && offering.stageInfo.stage >= 3 ? range(seed + 23, 4, 10) : null
    const assignment1 = hasEvaluationActivity && offering.stageInfo.stage >= 2 ? range(seed + 29, 8, 20) : null
    const assignment2 = hasEvaluationActivity && offering.stageInfo.stage >= 3 ? range(seed + 31, 8, 20) : null
    const attendancePenalty = present < 30 ? 0.22 : present < 34 ? 0.14 : 0.05
    const ttPenalty = tt1Score === null ? 0 : tt1Score < 12 ? 0.28 : tt1Score < 16 ? 0.16 : 0.06
    const cgpaPenalty = profile.prevCgpa > 0 ? (profile.prevCgpa < 6 ? 0.2 : profile.prevCgpa < 7 ? 0.12 : 0.04) : 0.06
    const riskProb = hasEvaluationActivity && offering.stageInfo.stage >= 2
      ? Number(Math.min(0.92, attendancePenalty + ttPenalty + cgpaPenalty + ((seed % 7) * 0.02)).toFixed(2))
      : null
    return {
      id: `${offering.offId}-${profile.usn}`,
      usn: profile.usn,
      name: profile.name,
      phone: profile.phone,
      yearLabel: offering.yearLabel,
      section: offering.section,
      dept: offering.dept,
      prevCgpa: profile.prevCgpa,
      present,
      totalClasses,
      tt1Score,
      tt1Max: 25,
      tt2Score,
      tt2Max: 25,
      quiz1,
      quiz2,
      assignment1,
      assignment2,
      riskProb,
      riskBand: riskProb === null ? null : getRiskBand(riskProb),
      interventions: profile.interventions ?? [],
    }
  })

  STUDENT_CACHE.set(offering.offId, students)
  return students
}

export function getSubjectRunById(subjectRunId: string) {
  return SUBJECT_RUNS.find((item) => item.subjectRunId === subjectRunId) ?? null
}

export function getOfferingById(offId: string) {
  return OFFERINGS.find((item) => item.offId === offId) ?? null
}

export function getFacultyById(facultyId: string) {
  return FACULTY.find((item) => item.facultyId === facultyId) ?? null
}

export function getOfferingsForSubjectRun(subjectRunId: string) {
  return OFFERINGS.filter((offering) => offering.subjectRunId === subjectRunId)
}

export function getStudentsForSubjectRun(subjectRunId: string) {
  return getOfferingsForSubjectRun(subjectRunId).flatMap((offering) => getStudents(offering))
}

export function getMenteesForFaculty(facultyId: string): MenteeSummary[] {
  const faculty = getFacultyById(facultyId)
  if (!faculty) return []
  return faculty.menteeUsns.map((usn) => {
    const matches = OFFERINGS
      .map((offering) => ({ offering, student: getStudents(offering).find((item) => item.usn === usn) ?? null }))
      .filter((item) => !!item.student)

    const firstMatch = matches[0]
    const student = firstMatch?.student
    return {
      usn,
      name: student?.name ?? usn,
      phone: student?.phone ?? '',
      dept: student?.dept ?? 'CSE',
      yearLabel: student?.yearLabel ?? '2nd Year',
      section: student?.section ?? 'A',
      prevCgpa: student?.prevCgpa ?? 0,
      interventions: student?.interventions ?? [],
      courseRisks: matches.map(({ offering, student: matchStudent }) => ({
        code: offering.code,
        title: offering.title,
        riskProb: matchStudent?.riskProb ?? null,
        riskBand: matchStudent?.riskBand ?? null,
        stageInfo: offering.stageInfo,
      })),
    }
  })
}

const HISTORY_SEEDS: Record<string, StudentHistoryRecord> = {
  '1MS23CS001': {
    usn: '1MS23CS001',
    studentName: 'Aarav Sharma',
    dept: 'CSE',
    currentCgpa: 6.1,
    trend: 'Declining',
    notes: ['Backlog recovered once already; current core load still needs monitoring.', 'Attendance recovery should stay tied to mentor follow-up.'],
    terms: [
      { label: 'Semester 1', sgpa: 7.31, credits: 20, highlights: ['Strong lab performance', 'Maths dipped late in the term'] },
      { label: 'Semester 2', sgpa: 5.82, credits: 20, highlights: ['Failed one core subject', 'Needed follow-up on attendance'] },
      { label: 'Semester 3', sgpa: 6.12, credits: 21, highlights: ['Repeat subject cleared', 'Trend remains fragile'] },
    ],
  },
  '1MS23CS014': {
    usn: '1MS23CS014',
    studentName: 'Meera Sundaram',
    dept: 'CSE',
    currentCgpa: 7.2,
    trend: 'Stable',
    notes: ['Consistent performer with isolated weak COs in algorithm-heavy courses.'],
    terms: [
      { label: 'Semester 1', sgpa: 7.84, credits: 20, highlights: ['Strong foundation courses'] },
      { label: 'Semester 2', sgpa: 7.12, credits: 20, highlights: ['Steady across core subjects'] },
      { label: 'Semester 3', sgpa: 6.98, credits: 21, highlights: ['Needs faster recovery after TT1 dips'] },
    ],
  },
  '1MS22CS041': {
    usn: '1MS22CS041',
    studentName: 'Sneha Pillai',
    dept: 'CSE',
    currentCgpa: 7.8,
    trend: 'Improving',
    notes: ['Recent remedial support helped compiler-related performance.'],
    terms: [
      { label: 'Semester 1', sgpa: 7.41, credits: 20, highlights: ['Steady start'] },
      { label: 'Semester 2', sgpa: 7.63, credits: 20, highlights: ['Better core consistency'] },
      { label: 'Semester 3', sgpa: 7.94, credits: 21, highlights: ['Improvement after targeted support'] },
      { label: 'Semester 4', sgpa: 8.12, credits: 21, highlights: ['Recovery trend held through TT2'] },
    ],
  },
}

function buildFallbackHistory(student: Student): StudentHistoryRecord {
  const terms: StudentHistoryTerm[] = Array.from({ length: student.yearLabel === '4th Year' ? 4 : student.yearLabel === '3rd Year' ? 3 : student.yearLabel === '2nd Year' ? 2 : 1 }, (_, index) => ({
    label: `Semester ${index + 1}`,
    sgpa: Number((Math.max(6, student.prevCgpa || 6.8) - 0.25 + (index * 0.12)).toFixed(2)),
    credits: 20 + (index % 2),
    highlights: ['Generated fallback transcript for mock review.'],
  }))
  return {
    usn: student.usn,
    studentName: student.name,
    dept: student.dept,
    currentCgpa: Number((student.prevCgpa || terms[terms.length - 1]?.sgpa || 6.8).toFixed(2)),
    trend: 'Stable',
    notes: ['Fallback history keeps the profile walkthrough usable in the mock.'],
    terms,
  }
}

export function getStudentHistory(usn: string) {
  if (HISTORY_SEEDS[usn]) return HISTORY_SEEDS[usn]
  for (const offering of OFFERINGS) {
    const student = getStudents(offering).find((item) => item.usn === usn)
    if (student) return buildFallbackHistory(student)
  }
  return null
}
