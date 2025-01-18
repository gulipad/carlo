const { fetchGospelByDate } = require("../services/gospelService");

(async () => {
  try {
    const testDate = "2025-01-18"; // Replace with the desired test date
    console.log(`Fetching Gospel for ${testDate}...`);

    const gospel = await fetchGospelByDate(testDate);

    console.log("Gospel fetched successfully:");
    console.log(JSON.stringify(gospel, null, 2)); // Pretty print the output
  } catch (error) {
    console.error("Error fetching Gospel:", error.message);
  }
})();
