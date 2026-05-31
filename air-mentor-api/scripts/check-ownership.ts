import Database from 'better-sqlite3'
const db = new Database('./data/db/airmentor.db')
const rows = db.prepare('SELECT * FROM facultyOfferingOwnerships WHERE facultyId = ?').all('mnc_t2')
console.log(rows)
