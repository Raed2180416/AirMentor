import { createTestApp, loginAs } from '../tests/helpers/test-app.js';
import * as schema from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function main() {
    const { app, db, embeddedPostgres } = await createTestApp();
    await loginAs(app, 'devika.shetty', 'faculty1234');
    const result = await db.execute(sql`SELECT count(*) FROM risk_assessments`);
    console.log(`Total risk assessments in DB:`, result.rows[0].count);
    await embeddedPostgres.stop();
    process.exit(0);
}

main().catch(console.error);
