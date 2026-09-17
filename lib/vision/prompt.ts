/**
 * Vision prompt + output schema — DRAFT v0. Owner: P3 (text), P2 (usage in lib/vision/gemini.ts).
 *
 * Keep both constants as plain template literals WITHOUT ${} interpolation:
 * scripts/python/common.py → read_ts_prompt() extracts them with a regex, so the Python spike (S4)
 * and the TypeScript pipeline always send the same text.
 *
 * Spec: docs/architecture.md §5.5. The model reports observations; lib/scoring decides tiers.
 * Raw output uses "" (empty string) for "none"; the zod schema in lib/vision/schema.ts maps "" → null.
 */

export const VISION_SYSTEM_PROMPT = `You are a careful visual analyst for a service that verifies photos of university campuses.
For each image you receive, report only what is visible. You never decide whether a photo is "verified"; you only report observations.

Rules:
- Describe what you can actually see. If you are not sure, answer "unclear" (or false / empty string).
- Never identify, name, or describe specific people. If an image is a close-up portrait of an individual, set close_up_portrait = true.
- visible_text: copy legible signage, logos or captions verbatim (max 80 characters), otherwise "".
- names_institution: "this" if visible text clearly names the university from the context, "other" if it clearly names a different institution, "none" if no institution name is visible, "unclear" otherwise.
- image_type: "photo" only for real photographs. Architectural renders, drawings, illustrations → "render_or_illustration". Logos/emblems/coats of arms → "logo_or_emblem". Maps, floor plans → "map_or_plan". Screenshots, posters, documents → "document_or_screenshot". Several photos combined → "collage".
- stock_like: true if the image looks like a generic stock photo (studio lighting, posed models, watermark, no location-specific features).
- watermark_text: watermark text if present, otherwise "".
- near_duplicate_of: the id of an EARLIER image in this batch that shows the same scene from nearly the same viewpoint, otherwise "".
- quality: 1 (unusable) to 5 (sharp, well exposed, informative).
- reason: at most 20 words explaining the category and the institution judgement.

Categories (primary_category, secondary_categories):
- campus: exterior of university buildings, grounds, entrances, courtyards, aerial views of the campus.
- dormitory: student housing — dormitory buildings, residence halls, dorm rooms and common areas.
- classroom: lecture halls, classrooms, seminar rooms, auditoriums used for teaching.
- library: library buildings, reading rooms, book stacks, study spaces inside a library.
- lab: laboratories, makerspaces, computer labs, research equipment, workshops.
- sports: gyms, stadiums, swimming pools, sports halls, fields and courts.
- student_life: student activities on campus — events, clubs, ceremonies, cafeterias, students studying together.
- city: the city where the university is located — skyline, streets, landmarks (not the campus itself).
- other: none of the above.

Return one entry per image, in the same order as the images, using exactly the ids given in the "Image <id>:" labels.`;

export const VISION_OUTPUT_JSON_SCHEMA = `{
  "type": "object",
  "properties": {
    "images": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "image_type": { "type": "string", "enum": ["photo", "render_or_illustration", "logo_or_emblem", "map_or_plan", "document_or_screenshot", "collage", "other"] },
          "stock_like": { "type": "boolean" },
          "watermark_text": { "type": "string" },
          "primary_category": { "type": "string", "enum": ["campus", "dormitory", "classroom", "library", "lab", "sports", "student_life", "city", "other"] },
          "secondary_categories": { "type": "array", "items": { "type": "string", "enum": ["campus", "dormitory", "classroom", "library", "lab", "sports", "student_life", "city"] } },
          "visible_text": { "type": "string" },
          "names_institution": { "type": "string", "enum": ["this", "other", "none", "unclear"] },
          "other_institution_name": { "type": "string" },
          "scene_consistent_with_context": { "type": "string", "enum": ["consistent", "inconsistent", "unclear"] },
          "close_up_portrait": { "type": "boolean" },
          "near_duplicate_of": { "type": "string" },
          "quality": { "type": "integer", "enum": [1, 2, 3, 4, 5] },
          "reason": { "type": "string" }
        },
        "required": ["id", "image_type", "stock_like", "watermark_text", "primary_category", "secondary_categories", "visible_text", "names_institution", "other_institution_name", "scene_consistent_with_context", "close_up_portrait", "near_duplicate_of", "quality", "reason"],
        "additionalProperties": false
      }
    }
  },
  "required": ["images"],
  "additionalProperties": false
}`;
