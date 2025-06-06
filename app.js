const express = require("express");
const path = require("path");
const dayjs = require("dayjs");
require("dayjs/locale/fr");
dayjs.locale("fr");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

const qs = require("qs");

const db = require("./db/database");
const { getAllWorkers } = require("./models/workers");
const {
  getWeekLogs,
  saveWeekLogs,
  getWorkerWeeklyTotals,
  getMonthlyLogs,
} = require("./models/timelogs");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

// Middleware for raw body parsing
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use((req, res, next) => {
  if (req.rawBody) {
    req.body = qs.parse(req.rawBody, {
      allowSparse: true,
      arrayLimit: 0,
      plainObjects: true,
    });
  }
  next();
});

function getMondayOfWeek(dateStr) {
  return !dateStr || dateStr === "today"
    ? dayjs().startOf("week")
    : dayjs(dateStr).startOf("week");
}

// Weekly view
app.get("/", (req, res) => {
  const monday = getMondayOfWeek(req.query.week);

  const weekStartRaw = monday.format("YYYY-MM-DD");
  const weekStart = monday.format("DD-MM-YYYY");
  const weekEnd = monday.add(6, "day").format("DD-MM-YYYY");

  const prevWeek = monday.subtract(7, "day").format("YYYY-MM-DD");
  const nextWeek = monday.add(7, "day").format("YYYY-MM-DD");

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = monday.add(i, "day");
    return {
      label: date.format("ddd"),
      display: date.format("DD-MM-YYYY"),
      iso: date.format("YYYY-MM-DD"),
    };
  });

  res.render("calendar", {
    workers: getAllWorkers(),
    logs: getWeekLogs(weekStartRaw),
    totals: getWorkerWeeklyTotals(weekStartRaw),
    weekStart,
    weekEnd,
    weekStartRaw,
    weekDays,
    prevWeek,
    nextWeek,
    weekNumber: monday.isoWeek(),
  });
});

// Save weekly data
app.post("/save", (req, res) => {
  const { weekStart, entries } = req.body;
  saveWeekLogs(weekStart, entries);
  res.redirect(`/?week=${weekStart}`);
});

// Monthly report
app.get("/monthly-report", (req, res) => {
  const year = parseInt(req.query.year) || dayjs().year();
  const month = parseInt(req.query.month) || dayjs().month() + 1;

  const start = dayjs(`${year}-${month}-01`);
  const daysInMonth = start.daysInMonth();

  const days = Array.from({ length: daysInMonth }, (_, i) =>
    start.date(i + 1).format("YYYY-MM-DD")
  );

  const workers = getAllWorkers();
  const logs = getMonthlyLogs(year, month);

  const fullLogs = {};
  const hoursTotals = {};
  const daysWorked = {};

  for (const date of days) {
    fullLogs[date] = {};
    for (const worker of workers) {
      const workerId = worker.id;
      const log = logs[workerId]?.[date] || {};
      const s1 = log.start1, e1 = log.end1;
      const s2 = log.start2, e2 = log.end2;

      let hours = 0;
      if (s1 != null && e1 != null && e1 > s1) hours += e1 - s1;
      if (s2 != null && e2 != null && e2 > s2) hours += e2 - s2;

      if (hours > 0) {
        daysWorked[workerId] = (daysWorked[workerId] || 0) + 1;
      }

      hoursTotals[workerId] = (hoursTotals[workerId] || 0) + hours;
      fullLogs[date][workerId] = log;
    }
  }

  res.render("monthly-report", {
    workers,
    days,
    fullLogs,
    year,
    month,
    hoursTotals,
    daysWorked,
    dayjs,
  });
});

app.listen(3000, () => console.log("CRM running at http://localhost:3000"));
