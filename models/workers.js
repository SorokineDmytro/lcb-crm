const db = require("../db/database");

function getAllWorkers() {
  return db.prepare("SELECT * FROM workers ORDER BY id").all();
}

module.exports = { getAllWorkers };
