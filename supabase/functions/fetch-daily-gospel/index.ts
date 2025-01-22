// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.0";
import { DOMParser } from "jsr:@b-fuze/deno-dom";

Deno.serve(async (req) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    const tomorrow = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    tomorrow.setDate(today.getDate() + 1);

    const dates = [
      yesterday.toISOString().split("T")[0],
      today.toISOString().split("T")[0],
      tomorrow.toISOString().split("T")[0],
    ];

    // Supabase setup
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingGospels, error } = await supabase
      .from("gospels")
      .select("date")
      .in("date", dates);

    if (error) {
      console.error("Error fetching Gospels from database:", error);
      return new Response("Failed to check Gospels", { status: 500 });
    }

    const existingDates = new Set(
      existingGospels?.map((gospel) => gospel.date)
    );
    const missingDates = dates.filter((date) => !existingDates.has(date));

    for (const date of missingDates) {
      try {
        console.log(`Fetching Gospel for ${date}`);
        const gospelData = await fetchGospelByDate(date);

        const { error: upsertError } = await supabase.from("gospels").upsert({
          date,
          content: gospelData,
        });

        if (upsertError) {
          console.error(`Failed to store Gospel for ${date}:`, upsertError);
        } else {
          console.log(`Gospel for ${date} added successfully`);
        }
      } catch (fetchError) {
        console.error(
          `Error fetching or storing Gospel for ${date}:`,
          fetchError
        );
      }
    }

    return new Response("Gospel check completed", { status: 200 });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

async function fetchGospelByDate(date: string) {
  const [year, month, day] = date.split("-");
  const url = `https://www.vaticannews.va/es/evangelio-de-hoy/${year}/${month}/${day}.html`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyGospelApp/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    const headings = document.querySelectorAll("h2");
    let targetSection: Element | null = null;

    for (const heading of headings) {
      if (heading.textContent?.includes("Evangelio del Día")) {
        targetSection = heading.closest("section");
        break;
      }
    }

    if (!targetSection) {
      throw new Error("Gospel text not found on the page.");
    }

    // Extract content
    const title = targetSection.querySelector("p")?.textContent?.trim() || "";
    const gospel =
      targetSection.querySelectorAll("p")[1]?.textContent?.trim() || "";
    const paragraphs = Array.from(targetSection.querySelectorAll("p"))
      .slice(2)
      .map((el) => el.textContent?.trim())
      .join("\n\n");

    return {
      date,
      title,
      gospel,
      text: paragraphs,
    };
  } catch (error) {
    console.error(`Error fetching Gospel for ${date}:`, error.message);
    throw error;
  }
}
