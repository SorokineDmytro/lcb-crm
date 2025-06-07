const db = require("../db/database");
const dayjs = require("dayjs");

// Only active workers (used in calendar views)
function getAllWorkers() {
  return db.prepare("SELECT * FROM workers WHERE isInactive IS NULL ORDER BY id").all();
}

// All workers (for management)
function getAllWorkersWithStatus() {
  return db.prepare("SELECT * FROM workers ORDER BY id").all();
}

// Add a new worker with today's date as workerFrom
function addWorker(name) {
  const today = dayjs().format("YYYY-MM-DD");
  return db.prepare("INSERT INTO workers (name, workerFrom) VALUES (?, ?)").run(name, today);
}

// Fire worker by setting isInactive to today
function fireWorker(id) {
  const today = dayjs().format("YYYY-MM-DD");
  return db.prepare("UPDATE workers SET isInactive = ? WHERE id = ?").run(today, id);
}

module.exports = {
  getAllWorkers,
  getAllWorkersWithStatus,
  addWorker,
  fireWorker,
};
