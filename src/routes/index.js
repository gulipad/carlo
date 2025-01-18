const express = require("express");
const { fetchGospelByDate } = require("../services/gospelService");
const webhookRoutes = require("./webhook");
const router = express.Router();

router.get("/gospel/:date", async (req, res) => {
  const { date } = req.params;

  try {
    const gospel = await fetchGospelByDate(date);
    res.json({ date, data: gospel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function registerRoutes(app) {
  app.use("/api", router);
  app.use("/", webhookRoutes);
}

module.exports = { registerRoutes };
