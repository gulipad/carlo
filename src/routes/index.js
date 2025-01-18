const express = require("express");
const router = express.Router();

// Example user route (extend as needed)
router.post("/onboard", async (req, res) => {
  const { phone_number, timezone, preferred_time } = req.body;
  // Add user logic will go here
  res.json({ message: "User onboarded successfully!" });
});

function registerRoutes(app) {
  app.use("/api", router);
}

module.exports = { registerRoutes };
