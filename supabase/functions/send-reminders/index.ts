// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "POST") {
    return await sendReminders();
  } else {
    return new Response("Method Not Allowed", { status: 405 });
  }
});

async function sendReminders() {
  try {
    // Get the current UTC time
    const nowUTC = new Date();
    const todayUTC = nowUTC.toISOString().split("T")[0]; // YYYY-MM-DD

    // Query only users who need a reminder (filtered in Supabase)
    const { data: users, error } = await supabase
      .from("users")
      .select(
        "phone_number, preferred_time, timezone, last_message_timestamp, last_reminder_sent",
      )
      .lte( // less than or equal to
        "last_message_timestamp",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      ) // User has NOT messaged in last 24 hours
      .filter("last_reminder_sent", "is", null)
      .or("last_reminder_sent.lt.NOW() - INTERVAL '23 hours 55 minutes'");

    if (error) {
      console.error("Error fetching users:", error.message);
      return new Response("Error fetching users", { status: 500 });
    }

    console.log("Users fetched:", users.length);

    const usersToRemind = [];

    for (const user of users) {
      const {
        phone_number,
        preferred_time,
        timezone,
        last_message_timestamp,
        last_reminder_sent,
      } = user;

      // Convert the user's `preferred_time` to UTC
      const userGospelSentTimeUTC = new Date(
        new Date(`${todayUTC}T${preferred_time}`).toLocaleString("en-US", {
          timeZone: timezone,
        }),
      );

      // Ensure they received their Gospel today
      if (userGospelSentTimeUTC > nowUTC) {
        continue; // Skip if Gospel has not yet been sent today
      }

      // Ensure at least 8 hours have passed since the Gospel was sent
      const eightHoursAfterGospel = new Date(
        userGospelSentTimeUTC.getTime() + 8 * 60 * 60 * 1000,
      );
      if (nowUTC < eightHoursAfterGospel) {
        continue; // Skip if 8 hours have not passed since Gospel was sent
      }

      // Ensure they haven't replied after receiving the Gospel
      const userLastMessageTime = new Date(last_message_timestamp);
      if (userLastMessageTime > userGospelSentTimeUTC) {
        continue; // Skip if user already replied after Gospel
      }

      // Ensure they haven't received a reminder today
      if (last_reminder_sent) {
        const lastReminderTime = new Date(last_reminder_sent);
        const twentyFourHoursAgo = new Date(
          Date.now() - (24 * 60 * 60 * 1000) - (5 * 60 * 1000),
        ); // Subtract an extra 5 minutes for buffer

        if (lastReminderTime > twentyFourHoursAgo) {
          continue; // Skip if reminded in the last 24 hours
        }
      }

      usersToRemind.push(phone_number);
    }

    if (usersToRemind.length === 0) {
      return new Response("No reminders needed", { status: 200 });
    }

    const reminderMessage =
      "¿Te gustaría recibir el Evangelio de mañana? Recuerda que por limitaciones de WhatsApp, solo te puedo mandar mensajes si me has escrito en las últimas 24 horas 🙏";

    for (const phoneNumber of usersToRemind) {
      await sendWhatsAppMessage(phoneNumber, reminderMessage);

      // Update last_reminder_sent timestamp
      await supabase
        .from("users")
        .update({ last_reminder_sent: new Date().toISOString() })
        .eq("phone_number", phoneNumber);
    }

    return new Response("Reminders processed successfully", { status: 200 });
  } catch (err) {
    console.error("Error sending reminders:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

async function sendWhatsAppMessage(recipient: string, message: string) {
  console.log("HEREEEE");
  try {
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: message },
        }),
      },
    );

    if (!response.ok) {
      console.error("Error sending WhatsApp message:", await response.text());
    }
  } catch (err) {
    console.error("Error in sendWhatsAppMessage:", err);
    throw err;
  }
}
