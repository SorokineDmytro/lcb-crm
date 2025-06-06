const db = require("../db/database");
const dayjs = require("dayjs");

function parseHour(val) {
  const num = parseInt(val);
  return !isNaN(num) && num >= 0 && num <= 23 ? num : null;
}

function getWeekLogs(weekStart) {
  const workers = db.prepare("SELECT * FROM workers").all();
  const days = Array.from({ length: 7 }, (_, i) =>
    dayjs(weekStart).add(i, "day").format("YYYY-MM-DD")
  );

  const data = {};
  for (const w of workers) {
    data[w.id] = {};
    for (const d of days) {
      const log = db
        .prepare("SELECT * FROM timelogs WHERE worker_id = ? AND date = ?")
        .get(w.id, d);
      data[w.id][d] = log || {};
    }
  }
  return data;
}

function saveWeekLogs(weekStart, entries) {
  const insertOrUpdate = db.prepare(`
    INSERT INTO timelogs (worker_id, date, start1, end1, start2, end2, status)
    VALUES (@worker_id, @date, @start1, @end1, @start2, @end2, @status)
    ON CONFLICT(worker_id, date)
    DO UPDATE SET
      start1 = excluded.start1,
      end1 = excluded.end1,
      start2 = excluded.start2,
      end2 = excluded.end2,
      status = excluded.status
  `);

  const transaction = db.transaction(() => {
    for (const [workerIdRaw, days] of Object.entries(entries)) {
      const workerId = parseInt(workerIdRaw);
      for (const [date, log] of Object.entries(days)) {
        const payload = {
          worker_id: workerId,
          date,
          start1: parseHour(log.start1),
          end1: parseHour(log.end1),
          start2: parseHour(log.start2),
          end2: parseHour(log.end2),
          status: typeof log.status === "string" ? log.status.trim() : null,
        };
        insertOrUpdate.run(payload);
      }
    }
  });

  transaction();
}

function getTimeDiff(start, end) {
  const s = parseInt(start);
  const e = parseInt(end);
  return !isNaN(s) && !isNaN(e) && e > s ? e - s : 0;
}

function getWorkerWeeklyTotals(weekStart) {
  const workers = db.prepare("SELECT * FROM workers").all();
  const days = Array.from({ length: 7 }, (_, i) =>
    dayjs(weekStart).add(i, "day").format("YYYY-MM-DD")
  );

  const totals = {};

  for (const w of workers) {
    let total = 0;
    for (const d of days) {
      const log = db
        .prepare("SELECT * FROM timelogs WHERE worker_id = ? AND date = ?")
        .get(w.id, d);
      if (!log || log.status === "R" || log.status === "C") continue;

      total += getTimeDiff(log.start1, log.end1);
      total += getTimeDiff(log.start2, log.end2);
    }
    totals[w.id] = total;
  }

  return totals;
}

function getMonthlyLogs(year, month) {
  const start = dayjs(`${year}-${month}-01`).format("YYYY-MM-DD");
  const end = dayjs(start).endOf("month").format("YYYY-MM-DD");

  const rows = db
    .prepare(
      `SELECT * FROM timelogs WHERE date BETWEEN ? AND ?`
    )
    .all(start, end);

  const data = {};
  for (const row of rows) {
    if (!data[row.worker_id]) {
      data[row.worker_id] = {};
    }
    data[row.worker_id][row.date] = row;
  }
  return data;
}

module.exports = {
  getWeekLogs,
  saveWeekLogs,
  getWorkerWeeklyTotals,
  getMonthlyLogs,
};
