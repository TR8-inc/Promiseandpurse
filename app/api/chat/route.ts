import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { tools } from "../../../pipelines/07_agent/tools";
import { SYSTEM_PROMPT } from "../../../pipelines/07_agent/system_prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT || "agency2026ot-tr8-0429",
  location: process.env.GOOGLE_VERTEX_LOCATION || "us-central1",
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro";

  const result = streamText({
    model: vertex(modelName),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(6),
    temperature: 0.2,
  });

  return result.toUIMessageStreamResponse();
}
