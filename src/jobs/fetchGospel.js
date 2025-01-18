const { createClient } = require("@supabase/supabase-js");
const { fetchGospelByDate } = require("../services/gospelService");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Fetches and stores the Gospel for the next day.
 */
async function fetchNextDayGospel() {
  try {
    const today = new Date();
    const nextDay = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
    const formattedDate = nextDay.toISOString().split("T")[0]; // YYYY-MM-DD

    // Check if the Gospel already exists
    const { data: existingGospel, error: fetchError } = await supabase
      .from("gospels")
      .select("id")
      .eq("date", formattedDate)
      .single();

    if (existingGospel) {
      console.log(
        `Gospel for ${formattedDate} already exists. Skipping fetch.`
      );
      return;
    }

    // Fetch Gospel
    console.log(`Fetching Gospel for ${formattedDate}...`);
    const gospel = await fetchGospelByDate(formattedDate);
    console.log(gospel);

    // Store Gospel
    const { data, error } = await supabase.from("gospels").insert({
      date: gospel.date,
      content: gospel,
    });

    if (error) throw error;

    console.log(`Gospel for ${formattedDate} stored successfully.`);
  } catch (error) {
    console.error("Error fetching and storing Gospel:", error.message);
  }
}

module.exports = { fetchNextDayGospel };
