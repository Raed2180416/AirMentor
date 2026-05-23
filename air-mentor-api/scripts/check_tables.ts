import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createDb, createPool } from '../src/db/client.js';
import { runSqlMigrations } from '../src/db/migrate.js';
import { seedIntoDatabase } from '../src/db/seed.js';
import { eq, count } from 'drizzle-orm';
import * as schema from '../src/db/schema.js';
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
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-postgres-check-'));
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

    const q1 = await db.select({ value: count() }).from(schema.studentObservedSemesterStates);
    const q2 = await db.select({ value: count() }).from(schema.studentInterventions);
    const q3 = await db.select({ value: count() }).from(schema.studentAssessmentScores);
    const q4 = await db.select({ value: count() }).from(schema.studentAgentCards);
    const q5 = await db.select({ value: count() }).from(schema.mentorAssignments);
    const q6 = await db.select({ value: count() }).from(schema.riskAssessments);
    
    console.log({
      studentObservedSemesterStates: q1[0].value,
      studentInterventions: q2[0].value,
      studentAssessmentScores: q3[0].value,
      studentAgentCards: q4[0].value,
      mentorAssignments: q5[0].value,
      riskAssessments: q6[0].value,
    });

    // Output sample from riskAssessments
    const sample = await db.query.riskAssessments.findMany({ limit: 1 });
    console.log("Sample risk assessment:", sample[0]);

    await pool.end();
  } finally {
    await embeddedPostgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch(console.error);
