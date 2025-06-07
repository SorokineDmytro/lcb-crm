const express = require("express");
const path = require("path");
const dayjs = require("dayjs");
require("dayjs/locale/fr");
dayjs.locale("fr");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);
const qs = require("qs");
const db = require("./db/database");
const puppeteer = require("puppeteer");

const {
  getAllWorkers,
  getAllWorkersWithStatus,
  addWorker,
  fireWorker,
} = require("./models/workers");

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
      const s1 = log.start1,
        e1 = log.end1;
      const s2 = log.start2,
        e2 = log.end2;

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

app.get("/workers", (req, res) => {
  const workers = getAllWorkersWithStatus();
  res.render("workers", { workers });
});

app.post("/workers/add", (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    try {
      addWorker(name);
    } catch (err) {
      console.error("Error adding worker:", err.message);
    }
  }
  res.redirect("/workers");
});

app.post("/workers/fire/:id", (req, res) => {
  const id = parseInt(req.params.id);
  fireWorker(id);
  res.redirect("/workers");
});

app.get("/calendar-pdf", async (req, res) => {
  const monday = getMondayOfWeek(req.query.week);
  const weekStartRaw = monday.format("YYYY-MM-DD");
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = monday.add(i, "day");
    return {
      label: date.format("ddd"),
      display: date.format("DD-MM-YYYY"),
      iso: date.format("YYYY-MM-DD"),
    };
  });

  const html = await new Promise((resolve, reject) => {
    res.render("calendar-pdf", {
      workers: getAllWorkers(),
      logs: getWeekLogs(weekStartRaw),
      totals: getWorkerWeeklyTotals(weekStartRaw),
      weekStart: monday.format("DD-MM-YYYY"),
      weekEnd: monday.add(6, "day").format("DD-MM-YYYY"),
      weekDays,
      weekNumber: monday.isoWeek(),
    }, (err, html) => {
      if (err) reject(err);
      else resolve(html);
    });
  });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });

  await browser.close();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=Planning-semaine-${weekStartRaw}.pdf`);
  res.send(pdfBuffer);
});

app.get("/monthly-report-pdf", async (req, res) => {
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

  // Render the HTML from EJS
  const html = await new Promise((resolve, reject) => {
    res.render(
      "monthly-report-pdf",
      {
        workers,
        days,
        fullLogs,
        year,
        month,
        hoursTotals,
        daysWorked,
        dayjs,
      },
      (err, html) => {
        if (err) reject(err);
        else resolve(html);
      }
    );
  });

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
  });

  await browser.close();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="Rapport-${month}-${year}.pdf"`);
  res.send(pdfBuffer);
});


app.listen(3000, () => console.log("CRM running at http://localhost:3000"));
