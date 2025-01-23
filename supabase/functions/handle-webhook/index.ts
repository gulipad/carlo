// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.0";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { systemInstructionCarlo } from "./systemInstructionCarlo.ts";
import { systemInstructionBibleInterpreter } from "./systemInstructionBibleInterpreter.ts";
import { functionDeclarations } from "./functionDeclarations.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: systemInstructionCarlo,
  tools: [
    {
      functionDeclarations: functionDeclarations,
    },
  ],
  toolConfig: { functionCallingConfig: { mode: "AUTO" } },
});

const chatSessions = new Map<string, any>();

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

    if (!user) {
      await registerUser(phoneNumber);
      await sendWhatsAppMessage(
        phoneNumber,
        "Hola me llamo Carlo!👋 Cada día a las 7:30 AM CET te mandaré el Evangelio del día."
      );
      await sendWhatsAppMessage(phoneNumber, "Aquí tienes el de hoy 😊");

      const today = new Date().toISOString().split("T")[0];
      const gospel = await fetchGospelByDate(today);

      if (!gospel) {
        await sendWhatsAppMessage(
          phoneNumber,
          "Lo siento, no he podido conseguir el Evangelio de hoy 😔."
        );
        return;
      }

      const formattedDate = new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const messageText = `${formattedDate}\n\n📖 *${gospel.content.title}📖*\n\n_${gospel.content.gospel}_\n\n${gospel.content.text}`;

      await sendWhatsAppMessage(phoneNumber, messageText);
      return;
    }

    const geminiResponse = await queryGemini(phoneNumber, message);

    if (!geminiResponse || !geminiResponse.content) {
      await sendWhatsAppMessage(
        phoneNumber,
        "Lo siento, no entendí tu solicitud."
      );
      return;
    }

    // Extract response parts
    const content = geminiResponse.content;
    if (!content || !content.parts) {
      await sendWhatsAppMessage(
        phoneNumber,
        "Lo siento, no entendí tu solicitud."
      );
      return;
    }

    // Iterate over response parts
    for (const part of content.parts) {
      if (part.text && part.text.trim() !== "" && part.text.trim() !== "\n") {
        await sendWhatsAppMessage(phoneNumber, part.text);
      }

      if (part.functionCall) {
        // Handle function call
        const { name, args } = part.functionCall;

        switch (name) {
          case "fetch_gospel": {
            const today = new Date().toISOString().split("T")[0];
            const gospel = await fetchGospelByDate(today);
            if (!gospel) {
              await sendWhatsAppMessage(
                phoneNumber,
                "Lo siento, no he podido conseguir el Evangelio de hoy 😔."
              );
              return; // Stop further processing if there's an error
            }
            const formattedDate = new Date().toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            });
            const messageText = `${formattedDate}\n\n📖 *${gospel.content.title}📖*\n\n_${gospel.content.gospel}_\n\n${gospel.content.text}`;
            await sendWhatsAppMessage(phoneNumber, messageText);
            break;
          }

          case "fetch_bible_inspiration": {
            const { reason } = args;
            const bibleInspiration = await fetchBibleInspiration(reason);
            if (!bibleInspiration) {
              await sendWhatsAppMessage(
                phoneNumber,
                "Lo siento, no he podido conseguir una inspiración bíblica en este momento."
              );
              return; // Stop further processing if there's an error
            }
            const messageText = `📖 *${bibleInspiration.book} ${bibleInspiration.chapter}:${bibleInspiration.start_verse}-${bibleInspiration.end_verse}* \n\n${bibleInspiration.text}\n\n_${bibleInspiration.reason}_`;
            await sendWhatsAppMessage(phoneNumber, messageText);

            // Update the stored chat history with the bible inspiration message
            const chatSession = await getOrCreateChatSession(phoneNumber);
            const history = (await chatSession.getHistory()) || [];
            history.push({ role: "model", parts: [{ text: messageText }] }); // Append the message to history

            // Save the updated history
            await updateChatHistory(phoneNumber, history);
            break;
          }

          case "update_gospel_delivery_time": {
            const { time, timezone } = args;
            console.log("UPDATE:", time, timezone);
            const success = await updateGospelDeliveryTime(
              phoneNumber,
              time,
              timezone
            );
            if (!success) {
              await sendWhatsAppMessage(
                phoneNumber,
                "Lo siento, no he podido actualizar la hora de entrega del Evangelio."
              );
              return; // Stop further processing if there's an error
            }
            break;
          }

          default: {
            console.error(`Unknown function call: ${name}`);
            await sendWhatsAppMessage(
              phoneNumber,
              "Lo siento, no puedo realizar esa acción por el momento."
            );
            return; // Stop further processing for unknown function calls
          }
        }
      }
    }
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
    timezone: "UTC+1",
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
      }
    );

    if (!response.ok) {
      console.error("Error sending WhatsApp message:", await response.text());
      return;
    }
    await updateLastMessageTimestamp(recipient);
  } catch (err) {
    console.error("Error in sendWhatsAppMessage:", err);
  }
}

async function getOrCreateChatSession(userId: string) {
  // Fetch the chat history from Supabase
  const { data, error } = await supabase
    .from("chat_histories")
    .select("history")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No history exists, create a new session with an empty history
      const chatSession = model.startChat({
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
        },
        history: [],
      });

      // Store the new session in Supabase
      await supabase.from("chat_histories").insert({
        user_id: userId,
        history: JSON.stringify([]),
      });

      return chatSession;
    } else {
      console.error("Error fetching session:", error);
      throw error;
    }
  }

  // Restore the existing history
  const history = JSON.parse(data.history);
  return model.startChat({
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 256,
    },
    history,
  });
}

async function updateChatHistory(userId: string, history: any) {
  await supabase.from("chat_histories").upsert({
    user_id: userId,
    history: JSON.stringify(history),
    last_updated: new Date().toISOString(),
  });
}

async function queryGemini(userId: string, userMessage: string): Promise<any> {
  try {
    // Get or create the chat session
    const chatSession = await getOrCreateChatSession(userId);

    // Send the user's message to Gemini
    const response = await chatSession.sendMessage(userMessage);

    if (!response?.response?.candidates?.[0]) {
      throw new Error("Invalid response from Gemini");
    }

    // Extract history from the chat session
    const history = (await chatSession.getHistory()) || [];

    // Save the updated history
    await updateChatHistory(userId, history);

    return response.response.candidates[0];
  } catch (error) {
    console.error("Error querying Gemini:", error);
    return null;
  }
}

export async function fetchBibleInspiration(reason: string): Promise<{
  book: string;
  chapter: number;
  start_verse: number;
  end_verse: number;
  reason: string;
  text: string;
} | null> {
  try {
    // Set up the Bible interpreter model
    const bibleModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstructionBibleInterpreter,
    });

    // Call the model with the user reason
    const result = await bibleModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: reason,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    console.log("BIBLE INTERPRETER:", result?.response?.candidates?.[0]);
    // Parse the JSON string from the response
    const parsedResponse = JSON.parse(
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    );

    const {
      book,
      chapter,
      start_verse,
      end_verse,
      reason: explanation,
    } = parsedResponse;

    if (!book || !chapter || !start_verse || !end_verse || !explanation) {
      console.error(
        "Invalid response from Bible Interpreter model:",
        parsedResponse
      );
      return null;
    }

    // Query the Bible table for the verses
    const { data, error } = await supabase
      .from("bible_verses")
      .select("text, verse_annotations")
      .eq("book", book)
      .eq("chapter", chapter)
      .gte("verse", start_verse)
      .lte("verse", end_verse)
      .order("verse")
      .order("verse_annotations", { ascending: true, nullsFirst: true });

    if (error) {
      console.error("Error fetching verses from Bible table:", error.message);
      return null;
    }

    if (!data || data.length === 0) {
      console.error("No verses found in the Bible table for the given query.");
      return null;
    }

    // Filter and prioritize verses
    const filteredVerses = data.filter(
      (row: { verse_annotations?: string | null }) =>
        !row.verse_annotations || row.verse_annotations === "a"
    );
    const selectedVerse =
      filteredVerses.length > 0 ? filteredVerses[0] : data[0];

    // Combine the verses into a single string
    const verseText = selectedVerse.text;

    const prettyBookName = prettifyBookName(book);

    return {
      book: prettyBookName,
      chapter,
      start_verse,
      end_verse,
      reason: explanation,
      text: verseText,
    };
  } catch (error) {
    console.error("Error in fetchBibleInspiration:", error);
    return null;
  }
}

async function updateGospelDeliveryTime(
  phoneNumber: string,
  time: string,
  timezone: string
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ preferred_time: time, timezone })
    .eq("phone_number", phoneNumber);

  if (error) {
    console.error("Error updating delivery time:", error.message);
    return false;
  }

  return true;
}

async function resetChatSession(userId: string) {
  chatSessions.delete(userId);
}

function prettifyBookName(normalizedBook: string): string {
  return bookNameMap[normalizedBook] || normalizedBook;
}

const bookNameMap: { [key: string]: string } = {
  genesis: "Génesis",
  exodo: "Éxodo",
  levitico: "Levítico",
  numeros: "Números",
  deuteronomio: "Deuteronomio",
  josue: "Josué",
  jueces: "Jueces",
  rut: "Rut",
  "1-samuel": "1 Samuel",
  "2-samuel": "2 Samuel",
  "1-reyes": "1 Reyes",
  "2-reyes": "2 Reyes",
  "1-cronicas": "1 Crónicas",
  "2-cronicas": "2 Crónicas",
  esdras: "Esdras",
  nehemias: "Nehemías",
  tobias: "Tobías",
  judit: "Judit",
  ester: "Ester",
  "1-macabeos": "1 Macabeos",
  "2-macabeos": "2 Macabeos",
  job: "Job",
  salmos: "Salmos",
  proverbios: "Proverbios",
  eclesiastes: "Eclesiastés",
  "cantar-de-los-cantares": "Cantar de los Cantares",
  sabiduria: "Sabiduría",
  eclesiastico: "Eclesiástico",
  isaias: "Isaías",
  jeremias: "Jeremías",
  lamentaciones: "Lamentaciones",
  baruc: "Baruc",
  ezequiel: "Ezequiel",
  daniel: "Daniel",
  oseas: "Oseas",
  joel: "Joel",
  amos: "Amós",
  abdias: "Abdías",
  jonas: "Jonás",
  miqueas: "Miqueas",
  nahun: "Nahúm",
  habacuc: "Habacuc",
  sofonias: "Sofonías",
  ageo: "Ageo",
  zacarias: "Zacarías",
  malaquias: "Malaquías",
  mateo: "Mateo",
  marcos: "Marcos",
  lucas: "Lucas",
  juan: "Juan",
  "hechos-de-los-apostoles": "Hechos de los Apóstoles",
  romanos: "Romanos",
  "1-corintios": "1 Corintios",
  "2-corintios": "2 Corintios",
  galatas: "Gálatas",
  efesios: "Efesios",
  filipenses: "Filipenses",
  colosenses: "Colosenses",
  "1-tesalonicenses": "1 Tesalonicenses",
  "2-tesalonicenses": "2 Tesalonicenses",
  "1-timoteo": "1 Timoteo",
  "2-timoteo": "2 Timoteo",
  tito: "Tito",
  filemon: "Filemón",
  hebreos: "Hebreos",
  santiago: "Santiago",
  "1-pedro": "1 Pedro",
  "2-pedro": "2 Pedro",
  "juan-cartas-1": "1 Juan",
  "juan-cartas-2": "2 Juan",
  "juan-cartas-3": "3 Juan",
  judas: "Judas",
  apocalipsis: "Apocalipsis",
};
