const nodeCron = require("node-cron");
const { fetchNextDayGospel } = require("./fetchGospel");

function scheduleJobs() {
  // Schedule daily Gospel fetch
  nodeCron.schedule("0 18 * * *", async () => {
    console.log("Running daily Gospel fetch job...");
    await fetchNextDayGospel();
  });

  console.log("Scheduled daily Gospel fetch at 18:00 UTC.");
}

module.exports = { scheduleJobs };
