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
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-postgres-extract-'));
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
    await seedIntoDatabase(db as any, pool, baseNow, { profile: 'full' });

    // Grouping to see what riskAssessments we have
    const riskCounts = await db.execute(sql`
      SELECT term_id, assessment_scope, evidence_window, count(distinct student_id) as students, count(*) as records
      FROM risk_assessments
      GROUP BY term_id, assessment_scope, evidence_window
      ORDER BY term_id, assessment_scope, evidence_window
    `);
    console.log("Risk Assessments:");
    console.log(riskCounts.rows);

    // Grouping for observed states
    const stateCounts = await db.execute(sql`
      SELECT semester_number, count(distinct student_id) as students, count(*) as records
      FROM student_observed_semester_states
      GROUP BY semester_number
      ORDER BY semester_number
    `);
    console.log("Observed States:");
    console.log(stateCounts.rows);

    // Actually extract trajectories
    // A trajectory could be cgpa tracking or just whatever observed states are available.
    // The prompt says "risk trajectories". Since riskAssessments has data, I'll extract it.
    const studentRows = await db.query.students.findMany();
    const studentsMap = new Map();
    for (const s of studentRows) {
      studentsMap.set(s.studentId, {
        id: s.studentId,
        usn: s.usn,
        name: s.name,
        trajectories: []
      });
    }

    const risks = await db.query.riskAssessments.findMany({
      orderBy: (risk, { asc }) => [asc(risk.assessedAt)]
    });

    for (const r of risks) {
      if (studentsMap.has(r.studentId)) {
        studentsMap.get(r.studentId).trajectories.push({
          termId: r.termId,
          evidenceWindow: r.evidenceWindow,
          riskBand: r.riskBand,
          riskProb: r.riskProbScaled / 1000.0,
          actionRecommended: r.recommendedAction,
        });
      }
    }

    const outputData = Array.from(studentsMap.values()).filter(s => s.trajectories.length > 0);
    fs.writeFileSync('student_risk_trajectories.json', JSON.stringify(outputData, null, 2));

    const csvHeaders = ['studentId', 'usn', 'name', 'termId', 'evidenceWindow', 'riskBand', 'riskProb', 'actionRecommended'];
    let csvContent = csvHeaders.join(',') + '\n';
    
    for (const s of outputData) {
      for (const t of s.trajectories) {
        const row = [
          s.id,
          s.usn,
          `"${s.name}"`,
          t.termId,
          t.evidenceWindow,
          t.riskBand,
          t.riskProb,
          `"${t.actionRecommended || ''}"`
        ];
        csvContent += row.join(',') + '\n';
      }
    }

    fs.writeFileSync('student_risk_trajectories.csv', csvContent);

    // Let's identify the Normal, Stressed, and Crisis scenarios.
    // We can categorise students by their max risk band or trajectory shape.
    let normalCount = 0;
    let stressedCount = 0;
    let crisisCount = 0;

    for (const s of outputData) {
      let isCrisis = false;
      let isStressed = false;
      for (const t of s.trajectories) {
        if (t.riskBand === 'High') isCrisis = true;
        if (t.riskBand === 'Medium') isStressed = true;
      }
      if (isCrisis) crisisCount++;
      else if (isStressed) stressedCount++;
      else normalCount++;
    }

    console.log(`Normal: ${normalCount}, Stressed: ${stressedCount}, Crisis: ${crisisCount}`);
    
    await pool.end();
  } finally {
    await embeddedPostgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch(console.error);
