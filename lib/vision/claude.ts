import { notImplemented } from "@/lib/notImplemented";
import type { VisionProvider } from "./provider";

/**
 * P2 · issue #18 · @anthropic-ai/sdk messages.create:
 * system = VISION_SYSTEM_PROMPT (lib/vision/prompt.ts); content = for each item "Image <id>:" + base64 JPEG
 * + a final context text; output_config.format = JSON Schema from VISION_OUTPUT_JSON_SCHEMA;
 * model = env.visionModel (+ effort/thinking settings chosen in spike S4). Parse with lib/vision/schema.ts.
 */
export function createClaudeVisionProvider(): VisionProvider {
  return {
    observe: async () => notImplemented("claudeVisionProvider.observe", "P2", 18),
  };
}
