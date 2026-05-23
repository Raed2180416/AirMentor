import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createDb, createPool } from '../src/db/client.js';
import { runSqlMigrations } from '../src/db/migrate.js';
import { seedIntoDatabase } from '../src/db/seed.js';
import { eq, asc } from 'drizzle-orm';
import * as schema from '../src/db/schema.js';
import * as fs from 'fs';
import net from 'node:net';

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
    console.log("Starting embedded postgres...");
    await embeddedPostgres.initialise();
    await embeddedPostgres.start();

    const connectionString = `postgres://postgres:postgres@127.0.0.1:${postgresPort}/postgres`;
    const pool = createPool(connectionString);
    const db = createDb(pool);

    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
    console.log("Running migrations...");
    await runSqlMigrations(pool, migrationsDir);

    console.log("Seeding database...");
    const baseNow = process.env.AIRMENTOR_SEED_NOW ?? '2026-03-16T00:00:00.000Z';
    await seedIntoDatabase(db as any, pool, baseNow, { profile: 'full' });

    console.log("Querying simulation runs...");
    const activeRuns = await db.query.simulationRuns.findMany({
      where: eq(schema.simulationRuns.activeFlag, 1),
      limit: 1,
    });

    if (activeRuns.length === 0) {
      console.error("No active simulation run found.");
      process.exit(1);
    }

    const runId = activeRuns[0].simulationRunId;
    console.log(`Found active simulation run: ${runId}`);

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

    console.log("Fetching projections...");
    const projections = await db.select({
      studentId: schema.simulationStageStudentProjections.studentId,
      semesterNumber: schema.simulationStageStudentProjections.semesterNumber,
      courseCode: schema.simulationStageStudentProjections.courseCode,
      courseTitle: schema.simulationStageStudentProjections.courseTitle,
      riskProbScaled: schema.simulationStageStudentProjections.riskProbScaled,
      riskBand: schema.simulationStageStudentProjections.riskBand,
      recommendedAction: schema.simulationStageStudentProjections.recommendedAction,
      simulatedActionTaken: schema.simulationStageStudentProjections.simulatedActionTaken,
      stageKey: schema.simulationStageCheckpoints.stageKey,
      stageOrder: schema.simulationStageCheckpoints.stageOrder
    })
    .from(schema.simulationStageStudentProjections)
    .leftJoin(schema.simulationStageCheckpoints, eq(schema.simulationStageStudentProjections.simulationStageCheckpointId, schema.simulationStageCheckpoints.simulationStageCheckpointId))
    .where(eq(schema.simulationStageStudentProjections.simulationRunId, runId))
    .orderBy(
      asc(schema.simulationStageStudentProjections.semesterNumber),
      asc(schema.simulationStageCheckpoints.stageOrder)
    );

    for (const p of projections) {
      if (studentsMap.has(p.studentId)) {
        studentsMap.get(p.studentId).trajectories.push({
          semester: p.semesterNumber,
          stageKey: p.stageKey,
          stageOrder: p.stageOrder,
          courseCode: p.courseCode,
          courseTitle: p.courseTitle,
          riskBand: p.riskBand,
          riskProb: p.riskProbScaled / 1000.0,
          actionRecommended: p.recommendedAction,
          actionTaken: p.simulatedActionTaken
        });
      }
    }

    const outputData = Array.from(studentsMap.values()).filter(s => s.trajectories.length > 0);
    console.log(`Exporting data for ${outputData.length} students.`);

    fs.writeFileSync('student_trajectories.json', JSON.stringify(outputData, null, 2));

    const csvHeaders = ['studentId', 'usn', 'name', 'semester', 'stageKey', 'courseCode', 'riskBand', 'riskProb', 'actionRecommended', 'actionTaken'];
    let csvContent = csvHeaders.join(',') + '\n';
    
    for (const s of outputData) {
      for (const t of s.trajectories) {
        const row = [
          s.id,
          s.usn,
          `"${s.name}"`,
          t.semester,
          t.stageKey,
          t.courseCode,
          t.riskBand,
          t.riskProb,
          `"${t.actionRecommended || ''}"`,
          `"${t.actionTaken || ''}"`
        ];
        csvContent += row.join(',') + '\n';
      }
    }

    fs.writeFileSync('student_trajectories.csv', csvContent);
    console.log("Exported to student_trajectories.json and student_trajectories.csv");
    
    await pool.end();
  } finally {
    await embeddedPostgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch(console.error);
