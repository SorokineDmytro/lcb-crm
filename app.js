const express = require("express");
const path = require("path");
const dayjs = require("dayjs");
require("dayjs/locale/fr");
dayjs.locale("fr");
dayjs.extend(require("dayjs/plugin/isoWeek"));

const qs = require("qs");
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

app.use(express.urlencoded({
  extended: true,
  verify: (req, res, buf) => req.rawBody = buf.toString()
}));
app.use((req, res, next) => {
  if (req.rawBody) {
    req.body = qs.parse(req.rawBody, { allowSparse: true, arrayLimit: 0, plainObjects: true });
  }
  next();
});

// Route imports
const calendarRoutes = require("./routes/calendarRoutes");
const monthlyReportRoutes = require("./routes/monthlyReportRoutes");
const workersRoutes = require("./routes/workersRoutes");

// Mount routes
app.use("/", calendarRoutes);
app.use("/", monthlyReportRoutes);
app.use("/", workersRoutes);

app.listen(3000, () => {
  console.log("CRM running at http://localhost:3000");
  exec("start http://localhost:3000");
});
