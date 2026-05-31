import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createDb, createPool } from '../src/db/client.js';
import { runSqlMigrations } from '../src/db/migrate.js';
import { seedIntoDatabase } from '../src/db/seed.js';
import * as schema from '../src/db/schema.js';
import { sql } from 'drizzle-orm';
import net from 'node:net';
import * as fs from 'fs';

function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free port')))
        return
      }
      const port = address.port
      server.close(error => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

async function run() {
  const postgresPort = await findFreePort();
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-postgres-eval-'));
  const embeddedPostgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: postgresPort,
    persistent: false,
    onLog: () => {},
    onError: message => {
      if (message) console.error(message)
    },
  });

  try {
    await embeddedPostgres.initialise();
    await embeddedPostgres.start();
    const connectionString = `postgres://postgres:postgres@127.0.0.1:${postgresPort}/postgres`;
    const pool = createPool(connectionString);
    const db = createDb(pool);
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
    await runSqlMigrations(pool, migrationsDir);
    
    const baseNow = process.env.AIRMENTOR_SEED_NOW ?? '2026-03-16T00:00:00.000Z';
    console.log(`Starting seeding at base time: ${baseNow}`);
    await seedIntoDatabase(db as any, pool, baseNow, { profile: 'full' });
    console.log('Seeding completed. Extracting deep evaluation metrics...');

    let mdContent = `# Air Mentor Deep Evaluation Report\n\n`;

    // 1. Course Leader Aspect: Granular breakdown of class average performance
    mdContent += `## 1. Course Leader Aspect\n`;
    mdContent += `**Granular breakdown of class average performance at every stage (TT1, TT2, Assignment, Quiz, SEE) for every course, every semester.**\n\n`;
    
    const courseLeaderData = await db.execute(sql`
      SELECT 
        c.course_code,
        c.title,
        t.semester_number,
        sas.component_type,
        AVG(sas.score) as avg_score,
        AVG(sas.max_score) as avg_max_score,
        COUNT(sas.student_id) as student_count
      FROM student_assessment_scores sas
      JOIN section_offerings so ON sas.offering_id = so.offering_id
      JOIN courses c ON so.course_id = c.course_id
      JOIN academic_terms t ON so.term_id = t.term_id
      GROUP BY c.course_code, c.title, t.semester_number, sas.component_type
      ORDER BY t.semester_number, c.course_code, sas.component_type
    `);

    mdContent += `| Semester | Course Code | Course Title | Component | Avg Score | Avg Max Score | Students |\n`;
    mdContent += `|---|---|---|---|---|---|---|\n`;
    for (const row of courseLeaderData.rows) {
      const avgScore = Number(row.avg_score).toFixed(2);
      const avgMaxScore = Number(row.avg_max_score).toFixed(2);
      mdContent += `| ${row.semester_number} | ${row.course_code} | ${row.title} | ${row.component_type} | ${avgScore} | ${avgMaxScore} | ${row.student_count} |\n`;
    }
    mdContent += `\n`;

    // 2. Mentor Aspect: Cross-course aggregation of student risk trajectories
    mdContent += `## 2. Mentor Aspect\n`;
    mdContent += `**Cross-course aggregation of student risk trajectories across all 6 semesters at each stage checkpoint.**\n\n`;
    
    const mentorData = await db.execute(sql`
      SELECT 
        t.semester_number,
        ra.assessment_scope,
        ra.evidence_window,
        ra.risk_band,
        COUNT(ra.risk_assessment_id) as assessment_count
      FROM risk_assessments ra
      LEFT JOIN academic_terms t ON ra.term_id = t.term_id
      GROUP BY t.semester_number, ra.assessment_scope, ra.evidence_window, ra.risk_band
      ORDER BY t.semester_number, ra.assessment_scope, ra.evidence_window, ra.risk_band
    `);

    mdContent += `| Semester | Assessment Scope | Stage Checkpoint | Risk Band | Assessment Count |\n`;
    mdContent += `|---|---|---|---|---|\n`;
    for (const row of mentorData.rows) {
      mdContent += `| ${row.semester_number || 'N/A'} | ${row.assessment_scope} | ${row.evidence_window} | ${row.risk_band} | ${row.assessment_count} |\n`;
    }
    mdContent += `\n`;

    // 3. HOD Aspect: Macro-level timeline of cohort's overall risk distribution
    mdContent += `## 3. HOD Aspect\n`;
    mdContent += `**Macro-level timeline of cohort's overall risk distribution (Count of High/Medium/Low Risk) per stage, per semester.**\n\n`;
    
    const hodData = await db.execute(sql`
      SELECT 
        t.semester_number,
        ra.evidence_window,
        SUM(CASE WHEN ra.risk_band = 'High' THEN 1 ELSE 0 END) as high_risk,
        SUM(CASE WHEN ra.risk_band = 'Medium' THEN 1 ELSE 0 END) as medium_risk,
        SUM(CASE WHEN ra.risk_band = 'Low' THEN 1 ELSE 0 END) as low_risk,
        COUNT(*) as total
      FROM risk_assessments ra
      JOIN academic_terms t ON ra.term_id = t.term_id
      GROUP BY t.semester_number, ra.evidence_window
      ORDER BY t.semester_number, ra.evidence_window
    `);

    mdContent += `| Semester | Stage Checkpoint | High Risk | Medium Risk | Low Risk | Total |\n`;
    mdContent += `|---|---|---|---|---|---|\n`;
    for (const row of hodData.rows) {
      mdContent += `| ${row.semester_number} | ${row.evidence_window} | ${row.high_risk} | ${row.medium_risk} | ${row.low_risk} | ${row.total} |\n`;
    }

    const reportPath = path.resolve(process.cwd(), 'deep-evaluation-results.md');
    fs.writeFileSync(reportPath, mdContent);
    console.log(`Report generated successfully at: ${reportPath}`);

    await pool.end();
  } finally {
    await embeddedPostgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch(console.error);
