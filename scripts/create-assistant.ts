import "dotenv/config";
import { VapiClient } from "@vapi-ai/server-sdk";

const apiKey = process.env.VAPI_API_KEY;
if (!apiKey) {
  console.error("Error: VAPI_API_KEY environment variable is not set.");
  console.error("Copy .env.example to .env and fill in your key.");
  process.exit(1);
}

if (!process.env.VAPI_SERVER_SECRET) {
  console.warn("Warning: VAPI_SERVER_SECRET is not set. Webhook will be unauthenticated.");
}

const client = new VapiClient({ token: apiKey });

const config = {
  name: "Door Agent",
  firstMessage: "Hello. What is the word of the day?",
  model: {
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a door access agent for 2389 AI's office. " +
          "When the caller provides a word, call verify_identity with it. " +
          "Only call verify_identity when the caller gives you a word — not for greetings or other conversation. " +
          "If access is granted, call the dtmf tool with digits '1' and say 'Come on in.' then end the call. " +
          "If access is denied, say 'That word was not recognized. Please try again.' and wait for another response. " +
          "If the result says 'Too many failed attempts', read the time remaining to the caller exactly as given, then end the call. " +
          "If the caller asks how long they have to wait, tell them the time remaining from the last verify_identity result. " +
          "Keep all responses brief.",
      },
    ],
    tools: [
      { type: "dtmf" },
      {
        type: "function",
        function: {
          name: "verify_identity",
          description:
            "Verify the caller's identity using the word of the day.",
          parameters: {
            type: "object",
            properties: {
              input: {
                type: "string",
                description: "The word of the day the caller provided.",
              },
            },
            required: ["input"],
          },
        },
        server: {
          url: `${process.env.WEBHOOK_URL}/webhook`,
          secret: process.env.VAPI_SERVER_SECRET,
        },
      },
    ],
  },
  voice: {
    provider: "11labs",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
  },
};

const existingId = process.env.ASSISTANT_ID;

if (existingId) {
  await client.assistants.update({ id: existingId, ...config });
  console.log(`Updated assistant: ${existingId}`);
} else {
  const assistant = await client.assistants.create(config);
  console.log(`Created assistant: ${assistant.id}`);
  console.log(`Add this to your .env: ASSISTANT_ID=${assistant.id}`);
}
