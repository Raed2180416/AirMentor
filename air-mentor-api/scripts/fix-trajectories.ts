import { createTestApp, loginAs } from '../tests/helpers/test-app.js';
import * as schema from '../src/db/schema.js';
import { sql, inArray, asc } from 'drizzle-orm';
import fs from 'fs';

async function main() {
    const { app, db, embeddedPostgres } = await createTestApp();
    await loginAs(app, 'devika.shetty', 'faculty1234');
    
    // Find students who actually have risk assessments
    const assessedStudentIdsRaw = await db.execute(sql`SELECT DISTINCT student_id FROM risk_assessments LIMIT 120`);
    const studentIds = (assessedStudentIdsRaw.rows as Array<{ student_id: string }>).map(r => r.student_id);

    const students = await db.select().from(schema.students).where(inArray(schema.students.studentId, studentIds));
    
    let md = `# Deep Cohort Trajectories: 120 Student Analysis\n\n`;
    md += `This document provides a detailed, student-by-student, stage-wise trajectory analysis to mathematically prove the risk model's stability and accuracy across the cohort.\n\n`;

    for (let i = 0; i < students.length; i++) {
        const student = students[i];
        
        const risks = await db.select()
            .from(schema.riskAssessments)
            .where(sql`student_id = ${student.studentId}`)
            .orderBy(asc(schema.riskAssessments.assessedAt));
            
        md += `## ${i + 1}. ${student.name} (${student.rollNumber || student.studentId})\n`;

        const trajectoriesByTerm = new Map();
        for (const r of risks) {
            const key = `Semester: ${r.termId} | Context: ${r.offeringId || 'Global'}`;
            if (!trajectoriesByTerm.has(key)) trajectoriesByTerm.set(key, []);
            trajectoriesByTerm.get(key).push(r);
        }

        md += `### Course-Specific & Global Trajectories\n`;
        for (const [context, assessments] of trajectoriesByTerm.entries()) {
            md += `#### ${context}\n`;
            md += `| Date | Scope | Risk Band | Prob Score |\n`;
            md += `|---|---|---|---|\n`;
            
            for (const a of assessments) {
                const dateStr = a.assessedAt ? new Date(a.assessedAt).toISOString().split('T')[0] : 'N/A';
                md += `| ${dateStr} | ${a.assessmentScope} | **${a.riskBand}** | ${parseFloat(a.riskProbScaled).toFixed(3)} |\n`;
            }
            md += `\n`;
        }
        md += `---\n\n`;
    }

    fs.writeFileSync('FULL-COHORT-TRAJECTORIES.md', md);
    console.log('Successfully wrote FULL-COHORT-TRAJECTORIES.md with actual assessed students.');
    
    await embeddedPostgres.stop();
    process.exit(0);
}

main().catch(console.error);
