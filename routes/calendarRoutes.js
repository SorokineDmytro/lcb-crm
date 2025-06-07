const express = require("express");
const router = express.Router();
const calendar = require("../controllers/calendarController");

router.get("/", calendar.renderCalendar);
router.post("/save", calendar.saveCalendar);
router.get("/calendar-pdf", calendar.exportCalendarPdf);

module.exports = router;
