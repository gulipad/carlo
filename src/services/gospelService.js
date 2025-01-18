const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Fetches the Gospel for a given day from Vatican News.
 * @param {string} date - The date in YYYY/MM/DD format.
 * @returns {Promise<string>} - The Gospel text for the given day.
 */
async function fetchGospelByDate(date) {
  // Format the URL for Vatican News
  const [year, month, day] = date.split("-");
  const url = `https://www.vaticannews.va/es/evangelio-de-hoy/${year}/${month}/${day}.html`;

  try {
    // Fetch the page content
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyGospelApp/1.0)",
        Accept: "text/html",
      },
      timeout: 15000,
    });

    // Load the HTML into Cheerio
    const $ = cheerio.load(response.data);

    // Locate the section with "Evangelio del Día"
    const section = $('h2:contains("Evangelio del Día")')
      .closest("section")
      .find(".section__content");

    if (!section.length) {
      throw new Error("Gospel text not found on the page.");
    }
    // Extract structured data
    const title = section.find("p").first().text().trim(); // Title
    const gospel = section.find("p").eq(1).text().trim(); // Gospel reference
    // Preserve paragraph breaks
    const paragraphs = section
      .find("p")
      .slice(2) // Remaining paragraphs
      .toArray()
      .map((el) => $(el).html().trim()) // Use HTML to preserve structure
      .join("\n\n"); // Combine paragraphs with explicit breaks

    // Replace HTML tags with clean text and preserve breaks
    const text = paragraphs
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();

    return {
      date,
      title,
      gospel,
      text,
    };
  } catch (error) {
    console.error(`Error fetching Gospel for ${date}:`, error.message);
    throw error;
  }
}

module.exports = { fetchGospelByDate };
