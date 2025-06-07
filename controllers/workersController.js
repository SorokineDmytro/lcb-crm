const {
  getAllWorkersWithStatus,
  addWorker,
  fireWorker,
} = require("../models/workers");

exports.renderWorkers = (req, res) => {
  const workers = getAllWorkersWithStatus();
  res.render("workers", { workers });
};

exports.addWorker = (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    try {
      addWorker(name);
    } catch (err) {
      console.error("Error adding worker:", err.message);
    }
  }
  res.redirect("/workers");
};

exports.fireWorker = (req, res) => {
  fireWorker(parseInt(req.params.id));
  res.redirect("/workers");
};
