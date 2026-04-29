/**
 * CLI canary test — runs the full agent loop with the iZEV / Tesla 2024 prompt
 * and prints the answer + tool-call trace. End-to-end smoke test before UI.
 *
 * Run: npm run canary  (or)  npx tsx pipelines/07_agent/test-canary.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv(); // also load default .env if present

import { generateText, stepCountIs } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { tools } from "./tools";
import { SYSTEM_PROMPT } from "./system_prompt";

async function main() {
  const vertex = createVertex({
    project: process.env.GOOGLE_CLOUD_PROJECT || "agency2026ot-tr8-0429",
    location: process.env.GOOGLE_VERTEX_LOCATION || "us-central1",
  });

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro";
  const PROMPT = "Why did Tesla receive $232M from Transport Canada in 2024?";

  console.log(`\n--- canary prompt (${modelName}) ---`);
  console.log(PROMPT);

  const result = await generateText({
    model: vertex(modelName),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: PROMPT }],
    tools,
    stopWhen: stepCountIs(8),
    temperature: 0.2,
  });

  console.log("\n--- tool calls ---");
  for (const step of result.steps) {
    for (const tc of step.toolCalls ?? []) {
      console.log(`> ${tc.toolName}(${JSON.stringify(tc.input ?? (tc as { args?: unknown }).args)})`);
    }
    for (const tr of step.toolResults ?? []) {
      const rec = tr as { output?: unknown; result?: unknown };
      const value = rec.output ?? rec.result;
      const preview = JSON.stringify(value).slice(0, 600);
      console.log(`  ↳ ${preview}…`);
    }
  }

  console.log("\n--- agent answer ---");
  console.log(result.text);
  console.log(`\n(${result.usage.totalTokens ?? "?"} tokens, ${result.steps.length} steps)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
