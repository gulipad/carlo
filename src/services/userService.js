const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Updates the last_message_timestamp for a user.
 * @param {string} phoneNumber - The user's phone number.
 */
async function updateLastMessageTimestamp(phoneNumber) {
  const { error } = await supabase
    .from("users")
    .update({ last_message_timestamp: new Date().toISOString() })
    .eq("phone_number", phoneNumber);

  if (error) {
    console.error("Error updating last message timestamp:", error.message);
    throw error;
  }
  console.log(`Updated last_message_timestamp for ${phoneNumber}`);
}

/**
 * Other user-related operations (examples)
 */
async function registerUser(phoneNumber) {
  const { error } = await supabase.from("users").insert({
    phone_number: phoneNumber,
    timezone: "CET",
    preferred_time: "07:30:00",
    subscribed: true,
    last_message_timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error("Error registering user:", error.message);
    throw error;
  }
  console.log(`User ${phoneNumber} registered successfully.`);
}

async function getUserByPhoneNumber(phoneNumber) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    // Ignore error if no rows are found
    console.error("Error fetching user:", error.message);
    throw error;
  }
  return data || null; // Return null if no user is found
}

module.exports = {
  updateLastMessageTimestamp,
  registerUser,
  getUserByPhoneNumber,
};
