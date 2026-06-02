import fs from 'node:fs/promises'
import path from 'node:path'
import curriculumSeedJson from '../src/db/seeds/msruas-mnc-curriculum.json' assert { type: 'json' }
import { stableAnchoredBeta, applyTemporalBurnout } from '../src/lib/proof-world-realism-engine.js'
import { clamp, roundToTwo, stableBetween } from '../src/lib/proof-sandbox-utils.js' // Assuming these exist, if not I will re-implement

const curriculumSeed = curriculumSeedJson as any

function _clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function _roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

// Edge Case Profiles to test
const ARCHETYPES = [
  {
    name: "Standard Average (Baseline)",
    ability: 0.5,
    discipline: 0.5,
    expectedBehavior: "Median SGPA ~6-7, stable passing but prone to slip if math-heavy."
  },
  {
    name: "High Potential + Zero Discipline (The Slacker Genius)",
    ability: 0.95,
    discipline: 0.1,
    expectedBehavior: "High variance. Aces exams if they show up, but massive fail risk due to <75% attendance constraint."
  },
  {
    name: "Low Potential + Max Discipline (The Hard Worker)",
    ability: 0.15,
    discipline: 0.95,
    expectedBehavior: "Passes purely through CE and attendance persistence, rarely scores > 7 SGPA."
  },
  {
    name: "Extreme Exam Anxiety (High Ability + High Pressure)",
    ability: 0.8,
    discipline: 0.8,
    pressureOverride: 0.9,
    expectedBehavior: "High CE marks, but SEE marks consistently crash relative to CE."
  }
]

function buildEdgeCaseStudent(archetype: any, index: number) {
  return {
    studentId: `edge_${index}`,
    latentBase: {
      academicPotential: archetype.ability,
      mathematicsFoundation: archetype.ability,
      computingFoundation: archetype.ability,
      selfRegulation: archetype.discipline,
      attendanceDiscipline: archetype.discipline,
      supportResponsiveness: archetype.discipline,
      fatigueRate: 0.15,
      helpSeekingTendency: archetype.discipline,
      examPressure: archetype.pressureOverride || 0.5
    }
  }
}

function courseEmphasis(course: any) {
  const lower = course.title.toLowerCase()
  const mathHeavy = ['mathematics', 'algebra', 'probability'].some(token => lower.includes(token))
  const computingHeavy = ['programming', 'computer', 'database'].some(token => lower.includes(token))
  return {
    mathWeight: mathHeavy ? 0.7 : computingHeavy ? 0.35 : 0.5,
    computingWeight: computingHeavy ? 0.72 : mathHeavy ? 0.34 : 0.5,
  }
}

function simulateCourse(student: any, course: any, semesterNumber: number) {
  const emphasis = courseEmphasis(course)
  const prereq = 0.6 // Mock steady prereq state for pure course simulation testing
  const difficulty = 0.28 + (semesterNumber * 0.075)

  const mastery = _clamp(
    (student.latentBase.academicPotential * 0.32)
      + (student.latentBase.mathematicsFoundation * emphasis.mathWeight * 0.24)
      + (student.latentBase.computingFoundation * emphasis.computingWeight * 0.24)
      + (student.latentBase.selfRegulation * 0.12)
      + (student.latentBase.supportResponsiveness * 0.08)
      + (prereq * 0.18)
      - (difficulty * 0.22),
    0.18,
    0.96,
  )

  const volatility = _clamp(1.0 - student.latentBase.selfRegulation, 0.04, 0.62)
  const concentration = _clamp(35 * (1 - volatility), 6, 50)

  const anchorAtt = _clamp(0.70 + (student.latentBase.attendanceDiscipline * 0.25) - (difficulty * 0.05), 0.65, 0.98)
  const attendancePct = Math.round(stableAnchoredBeta({ seed: `${student.studentId}-att`, anchor: anchorAtt, concentration }) * 100)

  const anchorCe = _clamp(0.38 + (mastery * 0.5) + (prereq * 0.1) - (difficulty * 0.08), 0.1, 0.97)
  const ceBasePct = stableAnchoredBeta({ seed: `${student.studentId}-ce`, anchor: anchorCe, concentration }) * 100
  
  const tt1Pct = _clamp(stableAnchoredBeta({ seed: `${student.studentId}-tt1`, anchor: Math.max(0.1, ceBasePct/100), concentration }) * 100, 8, 98)
  const tt2Pct = _clamp(stableAnchoredBeta({ seed: `${student.studentId}-tt2`, anchor: Math.max(0.1, (tt1Pct + 2)/100), concentration }) * 100, 8, 99)
  const quizPct = _clamp(stableAnchoredBeta({ seed: `${student.studentId}-quiz`, anchor: Math.max(0.1, ceBasePct/100), concentration }) * 100, 8, 99)
  const assignmentPct = _clamp(stableAnchoredBeta({ seed: `${student.studentId}-assign`, anchor: Math.max(0.1, (ceBasePct + 2)/100), concentration }) * 100, 10, 99)
  
  const cePct = _clamp((tt1Pct * 0.28) + (tt2Pct * 0.27) + (quizPct * 0.2) + (assignmentPct * 0.25), 10, 97)

  const anchorSee = _clamp(0.36 + (mastery * 0.5) + (prereq * 0.1) - (difficulty * 0.1) - (student.latentBase.examPressure * 0.05), 0.1, 0.98)
  const seePct = _clamp(stableAnchoredBeta({ seed: `${student.studentId}-see`, anchor: anchorSee, concentration }) * 100, 8, 98)

  const passed = (cePct/2 + seePct/2) >= 40 && seePct >= 40 && attendancePct >= 75
  const sgpaRaw = Math.floor((cePct/2 + seePct/2) / 10) + 1

  return { attendancePct, cePct: _roundToTwo(cePct), seePct: _roundToTwo(seePct), passed, gradePoint: passed ? sgpaRaw : 0 }
}

async function runEdgeCaseMatrix() {
  const courses = curriculumSeed.courses.filter((c: any) => c.semester === 1 || c.semester === 3)
  
  const results: any = {}
  
  for (const arc of ARCHETYPES) {
    results[arc.name] = {
      expected: arc.expectedBehavior,
      simulations: []
    }
    
    // Run 5 iterations of this archetype
    for (let i = 0; i < 5; i++) {
      const student = buildEdgeCaseStudent(arc, i)
      const sem1course = courses.find((c: any) => c.semester === 1) // e.g. Math 1
      const sem3course = courses.find((c: any) => c.semester === 3 && c.title.toLowerCase().includes('math')) // Higher difficulty
      
      const s1Res = simulateCourse(student, sem1course, 1)
      const s3Res = simulateCourse(student, sem3course, 3)
      
      results[arc.name].simulations.push({
        iteration: i + 1,
        sem1_Math: { att: s1Res.attendancePct, ce: s1Res.cePct, see: s1Res.seePct, pass: s1Res.passed },
        sem3_Math: { att: s3Res.attendancePct, ce: s3Res.cePct, see: s3Res.seePct, pass: s3Res.passed }
      })
    }
  }

  const report = `# Edge Case & Archetype Robustness Evaluation\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``
  await fs.writeFile('/home/raed/.gemini/antigravity/brain/443f7244-eaea-48d9-a3f4-93263513d7b5/archetype_edge_case_analysis.md', report)
  console.log('Archetype analysis complete. Written to archetype_edge_case_analysis.md')
}

runEdgeCaseMatrix().catch(console.error)
