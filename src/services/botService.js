const { createClient } = require("@supabase/supabase-js");
const { sendWhatsAppMessage } = require("./whatsAppService");
const {
  updateLastMessageTimestamp,
  registerUser,
  getUserByPhoneNumber,
} = require("../services/userService");

const { fetchGospelByDate } = require("./gospelService");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Handles user messages and sends appropriate responses.
 * @param {string} phoneNumber - The user's WhatsApp number.
 * @param {string} message - The user's message.
 */
async function handleUserMessage(phoneNumber, message) {
  try {
    // Check if the user exists in the database
    const user = await getUserByPhoneNumber(phoneNumber);

    if (!user) {
      console.log("User does not exist, proceeding to register.");
      // Register the user using userService
      await registerUser(phoneNumber);
      const welcomeMessage = `¡Hola, encantado 😊! Siempre que quieras, puedes escribir _evangelio_ y te envío el Evangelio del Día.`;
      await sendWhatsAppMessage(phoneNumber, welcomeMessage);
      await sendWhatsAppMessage(phoneNumber, `Aquí va el de hoy:`);
    }

    // If user exists, send today's Gospel
    await updateLastMessageTimestamp(phoneNumber);
    const today = new Date().toISOString().split("T")[0];
    const { data: gospelData, error: gospelError } = await supabase
      .from("gospels")
      .select("content")
      .eq("date", today)
      .single();

    if (gospelError || !gospelData) {
      console.error("Gospel for today not found:", gospelError?.message);
      await sendWhatsAppMessage(
        phoneNumber,
        "Lo sentimos, no encontramos el Evangelio de hoy."
      );
      return;
    }

    const { title, gospel, text } = gospelData.content;
    const gospelMessage = `📖 *${title}*\n\n_${gospel}_\n\n${text}`;
    await sendWhatsAppMessage(phoneNumber, gospelMessage);
    console.log(`Gospel for today sent to ${phoneNumber}`);
  } catch (error) {
    console.error("Error handling user message:", error.message);
    await sendWhatsAppMessage(
      phoneNumber,
      "Hubo un error al procesar tu mensaje. Por favor, inténtalo más tarde."
    );
  }
}

module.exports = { handleUserMessage };
