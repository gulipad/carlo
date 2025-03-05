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
    // Get the current UTC time and today's date string (YYYY-MM-DD)
    const nowUTC = new Date();
    const todayUTC = nowUTC.toISOString().split("T")[0];

    // Fetch users who have messaged in the last 24 hours
    const { data: users, error } = await supabase
      .from("users")
      .select(
        "phone_number, preferred_time, timezone, last_message_timestamp, last_reminder_sent",
      )
      .gte(
        "last_message_timestamp",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );

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

      // Convert the user's `preferred_time` (assumed to be a time string) to a Date in the given timezone
      const userGospelSentTimeUTC = new Date(
        new Date(`${todayUTC}T${preferred_time}`).toLocaleString("en-US", {
          timeZone: timezone,
        }),
      );

      // 1. Ensure the user has already received today's Gospel.
      if (userGospelSentTimeUTC > nowUTC) {
        console.log("Skipped reminder, gospel not sent");
        continue; // Skip if the Gospel hasn't been sent yet.
      }

      // 2. Ensure at least 8 hours have passed since the Gospel was sent.
      const eightHoursAfterGospel = new Date(
        userGospelSentTimeUTC.getTime() + 8 * 60 * 60 * 1000,
      );
      if (nowUTC < eightHoursAfterGospel) {
        console.log("Skipped reminder, less than 8 hours since gospel sent");
        continue; // Skip if 8 hours haven't passed.
      }

      // 3. Ensure the user hasn't replied after receiving the Gospel.
      const userLastMessageTime = new Date(last_message_timestamp);
      if (userLastMessageTime > userGospelSentTimeUTC) {
        console.log("Skipped reminder, user replied");
        continue; // Skip if the user already replied.
      }

      // 4. Ensure they haven't already received a reminder today.
      if (last_reminder_sent) {
        const lastReminderTime = new Date(last_reminder_sent);
        // Optionally, add a small buffer (e.g., 5 minutes) to avoid precision issues.
        const twentyFourHoursAgoWithBuffer = new Date(
          Date.now() - (24 * 60 * 60 * 1000) - (5 * 60 * 1000),
        );
        if (lastReminderTime > twentyFourHoursAgoWithBuffer) {
          console.log("Skipped reminder, already reminded");
          continue; // Skip if a reminder was sent in the last 24 hours.
        }
      }

      // If all conditions pass, add the user to the list for reminders.
      usersToRemind.push(phone_number);
    }

    if (usersToRemind.length === 0) {
      return new Response("No reminders needed", { status: 200 });
    }

    const reminderMessage =
      "¿Te gustaría recibir el Evangelio de mañana? Recuerda que por limitaciones de WhatsApp, solo te puedo mandar mensajes si me has escrito en las últimas 24 horas 🙏";

    // Send reminders and update the last_reminder_sent timestamp
    for (const phoneNumber of usersToRemind) {
      try {
        await sendWhatsAppMessage(phoneNumber, reminderMessage);
        await supabase
          .from("users")
          .update({ last_reminder_sent: new Date().toISOString() })
          .eq("phone_number", phoneNumber);
      } catch (err) {
        console.error(`Failed to send reminder to ${phoneNumber}:`, err);
        // Do not update last_reminder_sent if sending fails
      }
    }

    return new Response("Reminders processed successfully", { status: 200 });
  } catch (err) {
    console.error("Error sending reminders:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

async function sendWhatsAppMessage(recipient: string, message: string) {
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
    const errorText = await response.text();
    console.error("Error sending WhatsApp message:", errorText);
    throw new Error(`Failed to send message: ${errorText}`);
  }
}
