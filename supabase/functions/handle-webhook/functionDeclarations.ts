import { FunctionDeclaration } from "npm:@google/generative-ai";

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "fetch_gospel",
    description: "Fetch the daily gospel and send it back to the user.",
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
            "The new delivery time converted to HH:MM:SS 24h format. It is imperative it is in time should be in the HH:MM:SS format",
        },
        timezone: {
          type: "string",
          description:
            "The timezone of the user converted to UTC. It is imperative that timezone is in UTC+X or UTC-X format.",
        },
      },
      required: ["time", "timezone"],
    },
  },
];
