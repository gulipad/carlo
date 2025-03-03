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
    const { data: users, error } = await supabase
      .from("users")
      .select("phone_number, last_message_timestamp, reminder_sent")
      .eq("reminder_sent", false);

    console.log("HERE: ", users);

    if (error) {
      console.error("Error fetching users:", error.message);
      return new Response("Error fetching users", { status: 500 });
    }

    const now = new Date();
    const reminderThresholdHours = 8;
    const maxAllowedHours = 24;

    for (const user of users) {
      const lastMessageTime = new Date(user.last_message_timestamp);
      const hoursSinceLastMessage =
        (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

      if (
        hoursSinceLastMessage >= reminderThresholdHours &&
        hoursSinceLastMessage < maxAllowedHours
      ) {
        await sendWhatsAppMessage(
          user.phone_number,
          "Te gustaría recibir el Evangelio de mañana? Recuerda que por limitaciones de WhatsApp, sólo te puedo mandar mensajes si me has escrito en las útlimas 24 horas 🙏",
        );
        await supabase
          .from("users")
          .update({ reminder_sent: true })
          .eq("phone_number", user.phone_number);
      }
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
