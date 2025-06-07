const dayjs = require("dayjs");
const puppeteer = require("puppeteer");
const { getAllWorkers } = require("../models/workers");
const { getWeekLogs, saveWeekLogs, getWorkerWeeklyTotals } = require("../models/timelogs");

function getMonday(dateStr) {
  return !dateStr || dateStr === "today" ? dayjs().startOf("week") : dayjs(dateStr).startOf("week");
}

exports.renderCalendar = (req, res) => {
  const monday = getMonday(req.query.week);
  const weekStartRaw = monday.format("YYYY-MM-DD");

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
    weekStart: monday.format("DD-MM-YYYY"),
    weekEnd: monday.add(6, "day").format("DD-MM-YYYY"),
    weekStartRaw,
    weekDays,
    prevWeek: monday.subtract(7, "day").format("YYYY-MM-DD"),
    nextWeek: monday.add(7, "day").format("YYYY-MM-DD"),
    weekNumber: monday.isoWeek(),
  });
};

exports.saveCalendar = (req, res) => {
  const { weekStart, entries } = req.body;
  saveWeekLogs(weekStart, entries);
  res.redirect(`/?week=${weekStart}`);
};

exports.exportCalendarPdf = async (req, res) => {
  const monday = getMonday(req.query.week);
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
    }, (err, html) => err ? reject(err) : resolve(html));
  });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
  });

  await browser.close();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=Planning-semaine-${weekStartRaw}.pdf`);
  res.send(pdf);
};
