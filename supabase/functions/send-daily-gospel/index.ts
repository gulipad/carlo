// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.0";
import { DateTime } from "npm:luxon@3.5.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(sendGospelsToUsers);

// Rate limiter utility
async function rateLimit(
  items: any[],
  limit: number,
  callback: (item: any) => Promise<void>
) {
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    await Promise.all(batch.map(callback));
    if (i + limit < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    }
  }
}

async function sendGospelsToUsers() {
  try {
    // Current timestamp
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const gospel = await fetchGospelByDate(today);

    if (!gospel) {
      console.error("Error fetching today's Gospel:", gospelError);
      return new Response("Failed to fetch Gospel", { status: 500 });
    }

    const formattedDate = now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const messageText = `${formattedDate}\n\n📖 *${gospel.content.title}📖*\n\n_${gospel.content.gospel}_\n\n${gospel.content.text}`;

    // Fetch all subscribed users who sent a message in the last 24 hours
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("subscribed", true)
      .gt(
        "last_message_timestamp",
        new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      );

    if (userError) {
      console.error("Error fetching users:", userError);
      return new Response("Failed to fetch users", { status: 500 });
    }

    const usersToNotify = [];

    for (const user of users) {
      const { preferred_time, timezone } = user;

      const now = DateTime.now().setZone(timezone); // Current time in the user's timezone
      const currentTimeInMinutes = now.hour * 60 + now.minute; // Convert current time to minutes

      // Parse the user's preferred time (HH:mm:ss) and convert it to minutes
      const [hours, minutes] = preferred_time.split(":").map(Number);
      const preferredTimeInMinutes = hours * 60 + minutes;

      // Calculate the difference
      const timeDiff = preferredTimeInMinutes - currentTimeInMinutes;

      console.log(timeDiff);

      if (timeDiff >= 0 && timeDiff <= 5) {
        usersToNotify.push(user);
      }
    }

    if (usersToNotify.length === 0) {
      console.log("No users to notify at this time.");
      return new Response("No users to notify", { status: 200 });
    }

    // Rate-limited sending of Gospel to users
    await rateLimit(usersToNotify, 60, async (user) => {
      // Simulate sending a message (replace this with your actual sending logic)
      console.log(`Sending Gospel to ${user.id}:`);

      await sendWhatsAppMessage(
        user.phone_number,
        "Buenos días! Aquí tienes el Evangelio de hoy 😊"
      );
      await sendWhatsAppMessage(user.phone_number, messageText);
    });

    console.log(`Gospel sent to ${usersToNotify.length} users.`);
    return new Response("Gospel sent successfully", { status: 200 });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function fetchGospelByDate(date: string) {
  const { data, error } = await supabase
    .from("gospels")
    .select("date, content")
    .eq("date", date)
    .single();

  if (error) {
    console.error("Error fetching Gospel for date:", error.message);
    return null;
  }

  return data;
}

async function sendWhatsAppMessage(recipient: string, message: string) {
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
      }
    );

    if (!response.ok) {
      console.error("Error sending WhatsApp message:", await response.text());
    }
  } catch (err) {
    console.error("Error in sendWhatsAppMessage:", err);
  }
}
