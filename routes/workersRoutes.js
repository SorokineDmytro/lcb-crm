const express = require("express");
const router = express.Router();
const workers = require("../controllers/workersController");

router.get("/workers", workers.renderWorkers);
router.post("/workers/add", workers.addWorker);
router.post("/workers/fire/:id", workers.fireWorker);

module.exports = router;
