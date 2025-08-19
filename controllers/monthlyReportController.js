const dayjs = require("dayjs");
const puppeteer = require("puppeteer");
const { getAllWorkers } = require("../models/workers");
const { getMonthlyLogs } = require("../models/timelogs");

function prepareMonthlyData(year, month) {
  const start = dayjs(`${year}-${month}-01`);
  const days = Array.from({ length: start.daysInMonth() }, (_, i) =>
    start.date(i + 1).format("YYYY-MM-DD")
  );

  const workers = getAllWorkers();
  const logs = getMonthlyLogs(year, month);

  const fullLogs = {}, totals = {}, workedDays = {};

  for (const date of days) {
    fullLogs[date] = {};

    for (const w of workers) {
      const log = logs[w.id]?.[date] || {};
      let h = 0;

      // Safely parse time values
      const s1 = Number(log.start1);
      const e1 = Number(log.end1);
      const s2 = Number(log.start2);
      const e2 = Number(log.end2);

      if (!isNaN(s1) && !isNaN(e1) && e1 > s1) h += e1 - s1;
      if (!isNaN(s2) && !isNaN(e2) && e2 > s2) h += e2 - s2;

      if (h > 0) workedDays[w.id] = (workedDays[w.id] || 0) + 1;
      totals[w.id] = (totals[w.id] || 0) + h;

      fullLogs[date][w.id] = log;
    }
  }

  return { workers, days, fullLogs, totals, workedDays };
}

exports.renderMonthly = (req, res) => {
  const year = +req.query.year || dayjs().year();
  const month = +req.query.month || dayjs().month() + 1;
  const { workers, days, fullLogs, totals, workedDays } = prepareMonthlyData(year, month);

  res.render("monthly-report", {
    workers,
    days,
    fullLogs,
    year,
    month,
    hoursTotals: totals,
    daysWorked: workedDays,
    dayjs
  });
};

exports.exportMonthlyPdf = async (req, res) => {
  const year = +req.query.year || dayjs().year();
  const month = +req.query.month || dayjs().month() + 1;
  const { workers, days, fullLogs, totals, workedDays } = prepareMonthlyData(year, month);

  const html = await new Promise((resolve, reject) => {
    res.render(
      "monthly-report-pdf",
      {
        workers,
        days,
        fullLogs,
        year,
        month,
        hoursTotals: totals,
        daysWorked: workedDays,
        dayjs
      },
      (err, html) => (err ? reject(err) : resolve(html))
    );
  });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: {
      top: "20mm",
      right: "20mm",
      bottom: "20mm",
      left: "20mm"
    }
  });

  await browser.close();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="Rapport-${month}-${year}.pdf"`);
  res.send(pdf);
};
