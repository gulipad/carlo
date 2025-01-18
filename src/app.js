const express = require("express");
const dotenv = require("dotenv");
const { registerRoutes } = require("./routes");
// const { scheduleJobs } = require("./jobs");

dotenv.config();
const app = express();

app.use(express.json());

// Register routes
registerRoutes(app);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: "Something went wrong!" });
});

// Start scheduled jobs
// scheduleJobs();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
