const fs = require("fs");
const path = require("path");

// Ensure the data directory exists
const dbDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const Database = require("better-sqlite3");
const db = new Database(path.join(dbDir, "data.db"));

db.pragma("journal_mode = WAL");

// Workers table
db.prepare(`
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  )
`).run();

// Timelogs table
db.prepare(`
  CREATE TABLE IF NOT EXISTS timelogs (
    id INTEGER PRIMARY KEY,
    worker_id INTEGER,
    date TEXT,
    start1 TEXT, end1 TEXT,
    start2 TEXT, end2 TEXT,
    status TEXT, -- R, C, or NULL
    UNIQUE(worker_id, date)
  )
`).run();

// Helper to check if a column exists in a table
function columnExists(table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some(col => col.name === column);
}

// Add missing columns to "workers" table
if (!columnExists("workers", "workerFrom")) {
  db.prepare(`ALTER TABLE workers ADD COLUMN workerFrom TEXT`).run();
}
if (!columnExists("workers", "isInactive")) {
  db.prepare(`ALTER TABLE workers ADD COLUMN isInactive TEXT`).run();
}

// Preload workers (only if not already present)
const names = ["Oleg", "Héléna", "Abou", "Queen", "Alex", "Ali"];
for (const name of names) {
  try {
    db.prepare("INSERT INTO workers (name) VALUES (?)").run(name);
  } catch (e) {
    // Ignore duplicate entries
  }
}

// Set workerFrom to 2025-05-01 if not already set
db.prepare(`
  UPDATE workers SET workerFrom = '2025-05-01' WHERE workerFrom IS NULL
`).run();

module.exports = db;
