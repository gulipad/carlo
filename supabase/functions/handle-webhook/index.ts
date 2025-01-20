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

const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "GET") {
      // Webhook Verification
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === verifyToken) {
        return new Response(challenge, { status: 200 });
      } else {
        return new Response("Forbidden", { status: 403 });
      }
    } else if (req.method === "POST") {
      // Webhook Event Handling
      const body = await req.json();

      console.log("Webhook received");

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field === "messages") {
            const messages = change.value.messages || [];
            for (const message of messages) {
              const phoneNumber: string = message.from;
              const text: string | undefined = message.text?.body;

              if (!phoneNumber || !text) {
                console.error("Invalid message format:", message);
                continue;
              }

              console.log(`Received message from ${phoneNumber}: ${text}`);
              await handleUserMessage(phoneNumber, text);
            }
          }
        }
      }

      return new Response("Event received", { status: 200 });
    } else {
      return new Response("Method Not Allowed", { status: 405 });
    }
  } catch (err) {
    console.error("Error handling webhook:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

async function handleUserMessage(phoneNumber: string, message: string) {
  try {
    const user = await getUserByPhoneNumber(phoneNumber);
    console.log("user");
    if (!user) {
      await registerUser(phoneNumber);
      await sendWhatsAppMessage(
        phoneNumber,
        "Hola me llamo Carlo!👋 Cada día a las 7:30 AM CET te mandaré el Evangelio del día.",
      );
      await sendWhatsAppMessage(
        phoneNumber,
        "Aquí tienes el de hoy 😊",
      );
    }

    await updateLastMessageTimestamp(phoneNumber);

    const today = new Date().toISOString().split("T")[0];
    const gospel = await fetchGospelByDate(today);
    console.log("TEST", gospel);
    if (!gospel) {
      await sendWhatsAppMessage(
        phoneNumber,
        "Lo siento, no he podido conseguir el Evangelio de hoy 😔.",
      );
      return;
    }

    const formattedDate = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "2-digit",
    });

    const messageText =
      `${formattedDate}\n\n📖 *${gospel.content.title}📖*\n\n_${gospel.content.gospel}_\n\n${gospel.content.text}`;

    await sendWhatsAppMessage(phoneNumber, messageText);
  } catch (err) {
    console.error("Error handling user message:", err);
  }
}

async function getUserByPhoneNumber(phoneNumber: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching user:", error.message);
    return null;
  }

  return data;
}

async function registerUser(phoneNumber: string) {
  const { error } = await supabase.from("users").insert({
    phone_number: phoneNumber,
    timezone: "CET",
    preferred_time: "07:30:00",
    subscribed: true,
    last_message_timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error("Error registering user:", error.message);
  }
}

async function updateLastMessageTimestamp(phoneNumber: string) {
  const { error } = await supabase
    .from("users")
    .update({ last_message_timestamp: new Date().toISOString() })
    .eq("phone_number", phoneNumber);

  if (error) {
    console.error("Error updating last message timestamp:", error.message);
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
      },
    );

    if (!response.ok) {
      console.error("Error sending WhatsApp message:", await response.text());
    }
  } catch (err) {
    console.error("Error in sendWhatsAppMessage:", err);
  }
}
