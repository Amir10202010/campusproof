import { notImplemented } from "@/lib/notImplemented";
import type { VisionProvider } from "./provider";

/**
 * P2 · issue #18 · FREE tier Google Gemini via the official SDK `@google/genai` (already installed):
 *   new GoogleGenAI({ apiKey: env.geminiApiKey }).models.generateContent({
 *     model: env.visionModel,
 *     contents: [{ role: "user", parts: [...for each item: { text: "Image <id>: <meta>" }, { inlineData: { mimeType: "image/jpeg", data: <base64> } }, { text: <context> }] }],
 *     config: { systemInstruction: VISION_SYSTEM_PROMPT, responseMimeType: "application/json",
 *               responseJsonSchema: JSON.parse(VISION_OUTPUT_JSON_SCHEMA), mediaResolution: <low/medium>, abortSignal },
 *   }) → response.text → parseVisionObservations (lib/vision/schema.ts).
 * Verify field names against node_modules/@google/genai/dist/genai.d.ts. No key → throw (orchestrator degrades).
 * Free quota is small: cache observations per `vision:{model}:{qid}:{dHash}` (lib/cache/kv.ts), handle 429 as "unavailable".
 */
export function createGeminiVisionProvider(): VisionProvider {
  return {
    observe: async () => notImplemented("geminiVisionProvider.observe", "P2", 18),
  };
}
