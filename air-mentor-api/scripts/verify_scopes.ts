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
import { sql, eq } from 'drizzle-orm';
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
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-postgres-verify-'));
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

    // 1. Mentors
    const mentorCountQuery = await db.execute(sql`
      SELECT f.display_name, count(m.student_id) as mentees
      FROM faculty_profiles f
      JOIN mentor_assignments m ON f.faculty_id = m.faculty_id
      GROUP BY f.display_name
      ORDER BY mentees DESC
    `);
    console.log("Mentors:");
    console.log(mentorCountQuery.rows);

    // 2. Course Leaders (owning offerings)
    const clCountQuery = await db.execute(sql`
      SELECT f.display_name, count(distinct e.student_id) as students_in_course
      FROM faculty_profiles f
      JOIN faculty_offering_ownerships o ON f.faculty_id = o.faculty_id
      JOIN student_enrollments e ON o.offering_id = e.section_code 
           OR o.offering_id = (SELECT offering_id FROM section_offerings so WHERE so.section_code = e.section_code LIMIT 1)
           OR e.term_id = (SELECT term_id FROM section_offerings so WHERE so.offering_id = o.offering_id LIMIT 1)
      WHERE o.ownership_role = 'COURSE_LEADER'
      GROUP BY f.display_name
    `);
    // Alternatively, let's just count offerings per CL:
    const clOfferings = await db.execute(sql`
      SELECT f.display_name, o.offering_id
      FROM faculty_profiles f
      JOIN faculty_offering_ownerships o ON f.faculty_id = o.faculty_id
      WHERE o.ownership_role = 'COURSE_LEADER'
    `);
    console.log("Course Leaders:");
    console.log(clOfferings.rows);

    // 3. HOD (Role grants)
    const hodQuery = await db.execute(sql`
      SELECT f.display_name, r.scope_type, r.scope_id
      FROM faculty_profiles f
      JOIN role_grants r ON f.faculty_id = r.faculty_id
      WHERE r.role_code = 'HOD'
    `);
    console.log("HODs:");
    console.log(hodQuery.rows);

    await pool.end();
  } finally {
    await embeddedPostgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch(console.error);
