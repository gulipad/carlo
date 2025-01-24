import { FunctionDeclaration } from "npm:@google/generative-ai";

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "fetch_gospel",
    description: "Fetch the daily gospel and send it back to the user.",
  },
  {
    name: "fetch_saints",
    description: "Fetch the daily saints and send them back to the user.",
  },
  {
    name: "update_gospel_delivery_time",
    description:
      "Updates the time the user will receive their daily gospel once time and timezone are provided.",
    parameters: {
      type: "object",
      properties: {
        time: {
          type: "string",
          description:
            "The new delivery time. Take the user input and convert it to HH:MM:SS 24h format.",
        },
        timezone: {
          type: "string",
          description:
            "The timezone of the user. Take the user input and convert it to a timezone format that will be correctly interpreted in JavaScript.",
        },
      },
      required: ["time", "timezone"],
    },
  },
  {
    name: "fetch_bible_inspiration",
    description:
      "Thinks about the ideal Bible excerpt from, and fetches it from the Bible database.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "The reason that the user is asking for Bible inspiration. It could be just random.",
        },
      },
      required: ["reason"],
    },
  },
];
