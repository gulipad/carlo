const { fetchNextDayGospel } = require("../jobs/fetchGospel");

(async () => {
  try {
    console.log("Manually triggering Gospel fetch...");
    await fetchNextDayGospel();
  } catch (error) {
    console.error("Error fetching Gospel:", error.message);
  }
})();
