const express = require("express");
const router = express.Router();
const monthlyController = require("../controllers/monthlyReportController");

router.get("/monthly-report", monthlyController.renderMonthly);
router.get("/monthly-report-pdf", monthlyController.exportMonthlyPdf);

module.exports = router;
