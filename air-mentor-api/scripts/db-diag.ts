import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { facultyOfferingOwnerships, sectionOfferings } from '../src/db/schema.js'
import fs from 'fs'

const possiblePaths = [
  './.eval-db-coverage24/data.db',
  './data.db',
  process.env.DATABASE_URL?.replace('file:', ''),
]

for (const p of possiblePaths) {
  if (p && fs.existsSync(p)) {
    console.log('Found DB at:', p)
    const db = drizzle(new Database(p))
    const ownerships = db.select().from(facultyOfferingOwnerships).all()
    const offerings = db.select().from(sectionOfferings).all()
    console.log('Total ownerships:', ownerships.length)
    console.log('Active ownerships:', ownerships.filter((o: any) => o.status === 'active').length)
    console.log('Total offerings:', offerings.length)
    console.log('Active offerings:', offerings.filter((o: any) => o.status === 'active').length)
    const activeByFaculty = new Map<string, number>()
    for (const o of ownerships.filter((o: any) => o.status === 'active')) {
      activeByFaculty.set(o.facultyId, (activeByFaculty.get(o.facultyId) ?? 0) + 1)
    }
    console.log('Active ownerships by faculty:', Object.fromEntries(activeByFaculty))
    break
  }
}
