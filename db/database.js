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

// Workers
db.prepare(`
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
)`).run();

// Time logs
db.prepare(`
  CREATE TABLE IF NOT EXISTS timelogs (
    id INTEGER PRIMARY KEY,
    worker_id INTEGER,
    date TEXT,
    start1 TEXT, end1 TEXT,
    start2 TEXT, end2 TEXT,
    status TEXT, -- R, C, or NULL
    UNIQUE(worker_id, date)
)`).run();

// Preload workers
const names = ["Oleg", "Héléna", "Abou", "Queen", "Alex", "Ali"];
for (const name of names) {
  try {
    db.prepare("INSERT INTO workers (name) VALUES (?)").run(name);
  } catch (e) {}
}

module.exports = db;
