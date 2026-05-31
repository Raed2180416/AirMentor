import fs from 'node:fs/promises'
import { eq, inArray, and } from 'drizzle-orm'
import { createTestApp } from '../tests/helpers/test-app.js'
import { startProofSimulationRun } from '../src/lib/msruas-proof-control-plane.js'
import { MSRUAS_PROOF_BATCH_ID, MSRUAS_PROOF_CURRICULUM_IMPORT_ID } from '../src/lib/msruas-proof-sandbox.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'
import { simulationStageStudentProjections, students } from '../src/db/schema.js'

async function run() {
  const outputPath = process.argv[2]
  if (!outputPath) throw new Error('Missing output path argument')

  console.log('Starting Test App Database...')
  const app = await createTestApp()

  console.log('Running massive proof simulation up to Semester 4...')
  const runData = await startProofSimulationRun(app.db, {
    batchId: MSRUAS_PROOF_BATCH_ID,
    curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
    policy: DEFAULT_POLICY,
    now: new Date().toISOString(),
    runLabel: 'Deep Cohort Analysis',
    stopAtStage: 'post-see',
    stopAtSemester: 6,
  })

  console.log('Simulation complete. Extracting 120 students from a section...')
  
  console.log('Fetching all stage projections for the run...')
  
  const allProjections = await app.db.select().from(simulationStageStudentProjections)
    .where(eq(simulationStageStudentProjections.simulationRunId, runData.simulationRunId))

  console.log(`Loaded ${allProjections.length} total projection rows. Extracting 120 students...`)

  // Pick exactly 120 unique student IDs from the projections
  const uniqueStudentIds = Array.from(new Set(allProjections.map(p => p.studentId))).slice(0, 120)
  
  const allStudents = await app.db.select().from(students).where(inArray(students.studentId, uniqueStudentIds))

  const stageProjections = allProjections.filter(p => uniqueStudentIds.includes(p.studentId))
  
  let md = '# Deep Cohort Analysis: Student-by-Student Micro View\n\n'
  md += '> [!NOTE]\n> This artifact was generated via the massive simulation run script for exactly 120 students, detailing their stage-wise, sem-wise, and course-wise risk vectors, demonstrating the differential view between a broad Mentor perspective vs specific Course Leader insights.\n\n'
  
  // Global stats
  md += '## Global Cohort View (All 120 Students)\n'
  const postSeeSem6 = stageProjections.filter(p => p.evidenceWindow === 'post-see' && p.semesterNumber === 6)
  const globalHigh = postSeeSem6.filter(p => p.riskBand === 'High').length
  const globalMed = postSeeSem6.filter(p => p.riskBand === 'Medium').length
  const globalLow = postSeeSem6.filter(p => p.riskBand === 'Low').length
  
  md += `- **High Risk Course States (End of Sem 6)**: ${globalHigh}\n`
  md += `- **Medium Risk Course States (End of Sem 6)**: ${globalMed}\n`
  md += `- **Low Risk Course States (End of Sem 6)**: ${globalLow}\n\n`
  
  md += '## Student-by-Student Analysis\n\n'
  
  for (const student of allStudents) {
     const proj = stageProjections.filter(p => p.studentId === student.studentId)
     const latent = typeof student.latentBase === 'string' ? JSON.parse(student.latentBase) : student.latentBase
     
     md += `### Student: ${student.studentId}\n`
     md += `- **Academic Potential**: ${latent?.academicPotential?.toFixed(2) ?? 'N/A'}\n`
     md += `- **Attendance Discipline**: ${latent?.attendanceDiscipline?.toFixed(2) ?? 'N/A'}\n`
     md += `- **Self Regulation**: ${latent?.selfRegulation?.toFixed(2) ?? 'N/A'}\n`
     md += `- **Support Responsiveness**: ${latent?.supportResponsiveness?.toFixed(2) ?? 'N/A'}\n\n`
     
     const sems = [1, 2, 3, 4, 5, 6]
     for (const sem of sems) {
       const semProj = proj.filter(p => p.semesterNumber === sem)
       if (semProj.length === 0) continue
       
       md += `#### Semester ${sem}\n`
       
       const stages = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see']
       
       for (const stage of stages) {
         const stageRows = semProj.filter(p => p.evidenceWindow.endsWith(stage))
         if (stageRows.length === 0) continue
         
         md += `##### Stage: ${stage}\n`
         
         // Mentor view
         md += `**Mentor's Global View (All Courses):**\n`
         const highCourses = stageRows.filter(r => r.riskBand === 'High')
         const mediumCourses = stageRows.filter(r => r.riskBand === 'Medium')
         md += `- High Risk Flags: ${highCourses.length} | Medium Risk Flags: ${mediumCourses.length}\n`
         md += `- Action Required: ${highCourses.length > 0 ? 'Critical mentor outreach and meeting required' : mediumCourses.length > 0 ? 'Active monitoring & light check-in' : 'None (Routine)'}\n\n`
         
         // Course Leader view
         md += `**Course Leaders' Views (Subject Specific):**\n`
         for (const row of stageRows) {
            let json = {} as any
            try { json = typeof row.projectionJson === 'string' ? JSON.parse(row.projectionJson) : row.projectionJson } catch {}
            md += `- **${row.courseCode} (${row.courseTitle})**: \`${row.riskBand}\` Risk (Prob: ${(row.riskProbScaled / 100).toFixed(2)})\n`
            if (json.observableDrivers?.length) {
              md += `  - *Drivers*: ${json.observableDrivers.map((d: any) => d.label).join(' | ')}\n`
            }
            if (row.recommendedAction) {
              md += `  - *Leader Action Suggested*: ${row.recommendedAction}\n`
            }
            
            // Explain how it carries downstream
            if (stage === 'post-see' && row.riskBand === 'High') {
              md += `  - *Downstream Impact*: High likelihood of triggering \`prerequisitePressure\` for dependent subjects in Semester ${sem + 1} and adding to \`backlogCount\`.\n`
            }
         }
         md += '\n'
       }
     }
     md += '---\n\n'
  }

  console.log('Writing artifact to disk...')
  await fs.writeFile(outputPath, md, 'utf-8')

  console.log('Done! Exiting.')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
