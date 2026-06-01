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
          "You guard the door at 2389 AI's office. That's the whole job. " +
          "When someone calls, wait for them to give you a word. Don't call verify_identity for greetings or small talk — only when they actually give you a word. " +
          "Every time the caller gives you a word, you MUST call verify_identity — never skip it, never reuse a previous result. " +
          "If it checks out, press dtmf with digits '1', say 'Come on in.' and end the call. " +
          "If it doesn't, say 'That word wasn't right — try again.' and wait. Give them another shot. " +
          "If verify_identity comes back saying too many failed attempts, read the wait time back to them exactly as it was given, then end the call. " +
          "Keep everything short. This isn't a conversation — it's a door.",
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
