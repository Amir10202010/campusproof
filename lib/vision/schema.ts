import { z } from "zod";
import type { VisionObservation } from "@/lib/types";

/**
 * P2 · issue #18 · zod schema mirroring VISION_OUTPUT_JSON_SCHEMA; maps "" → null for
 * watermark_text, other_institution_name, near_duplicate_of. Throws on invalid output (caller retries).
 */
export type ParseVisionObservations = (raw: unknown) => VisionObservation[];

const CATEGORIES = ["campus", "dormitory", "classroom", "library", "lab", "sports", "student_life", "city"] as const;

/** The model may answer "", null or leave the field out — all three mean "nothing". */
const nullableText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value ?? "").trim().slice(0, 120) || null)
  .catch(null);

/**
 * Single fields are forgiving (`.catch`) so one odd value does not cost a whole batch,
 * but a missing `id` or a body without observations throws: then the caller retries.
 */
const OBSERVATION = z.object({
  id: z.string().min(1),
  image_type: z
    .enum([
      "photo",
      "render_or_illustration",
      "logo_or_emblem",
      "map_or_plan",
      "document_or_screenshot",
      "collage",
      "other",
    ])
    .catch("other"),
  stock_like: z.boolean().catch(false),
  watermark_text: nullableText,
  primary_category: z.enum([...CATEGORIES, "other"]).catch("other"),
  secondary_categories: z
    .array(z.string())
    .catch([])
    .transform((list) => list.filter((id): id is (typeof CATEGORIES)[number] => CATEGORIES.includes(id as never))),
  visible_text: z
    .string()
    .catch("")
    .transform((value) => value.trim().slice(0, 120)),
  names_institution: z.enum(["this", "other", "none", "unclear"]).catch("unclear"),
  other_institution_name: nullableText,
  scene_consistent_with_context: z.enum(["consistent", "inconsistent", "unclear"]).catch("unclear"),
  close_up_portrait: z.boolean().catch(false),
  near_duplicate_of: nullableText,
  quality: z.coerce
    .number()
    .transform((value) => Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5)
    .catch(3),
  reason: z
    .string()
    .catch("")
    .transform((value) => value.trim().slice(0, 200)),
});

/** Models sometimes answer with a bare array instead of { images: [...] }. */
const BODY = z.union([
  z.object({ images: z.array(OBSERVATION) }),
  z.array(OBSERVATION).transform((images) => ({ images })),
]);

export const parseVisionObservations: ParseVisionObservations = (raw) => {
  const payload = typeof raw === "string" ? JSON.parse(stripCodeFence(raw)) : raw;
  return BODY.parse(payload).images;
};

/** Some models wrap JSON in ```json fences even when asked for raw JSON. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/, "")
    .trim();
}
