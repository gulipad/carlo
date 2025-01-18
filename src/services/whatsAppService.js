const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const axios = require("axios");

// Helper to split and format the Gospel
const splitParagraphs = (text) => {
  return text.split("\n\n").map((para) => para.trim());
};

const formatGospelForWhatsApp = (gospel) => {
  const { title, gospel: reference, text } = gospel;

  // Split paragraphs
  const paragraphs = splitParagraphs(text);

  // Construct the WhatsApp message
  return `📖 *${title}*\n\n_${reference}_\n\n${paragraphs.join("\n\n")}`;
};

/**
 * Sends a WhatsApp message using the WhatsApp Cloud API.
 * @param {string} recipient - The recipient's phone number (in international format, e.g., +1234567890).
 * @param {string} message - The message text to send.
 */
async function sendWhatsAppMessage(recipient, message) {
  const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending WhatsApp message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Sends the Gospel for a given date to a recipient.
 * @param {string} recipient - The recipient's phone number.
 * @param {string} date - The date of the Gospel (YYYY-MM-DD).
 */
async function sendGospelMessage(recipient, date) {
  try {
    // Fetch the Gospel from the database
    const { data: gospel, error } = await supabase
      .from("gospels")
      .select("content")
      .eq("date", date)
      .single();

    if (error || !gospel) {
      throw new Error("Gospel not found for the given date.");
    }

    const { title, gospel: reference, text } = gospel.content;

    // Construct the message
    const message = formatGospelForWhatsApp(gospel.content);

    // Send the message
    await sendWhatsAppMessage(recipient, message);
    console.log(`Gospel for ${date} sent successfully to ${recipient}.`);
  } catch (error) {
    console.error(`Failed to send Gospel for ${date}:`, error.message);
  }
}

module.exports = { sendWhatsAppMessage, sendGospelMessage };
