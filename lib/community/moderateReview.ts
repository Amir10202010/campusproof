import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { ModerationLabel } from "./types";

/**
 * Text moderation for community reviews (owner: P1 · community feature).
 * This is a FILTER, not an evaluation of the university: Gemini only classifies the text into one label
 * and returns nothing else. Everything except "ok" is held, never published. Model unavailable → held.
 */
const REPORT_THRESHOLD = 3;
export const MIN_REVIEW_LENGTH = 30;
export const MAX_REVIEW_LENGTH = 1000;

/** Phone numbers, e-mails and @handles are cut BEFORE the text ever reaches Gemini. */
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const HANDLE_RE = /(?<=^|[\s(])@[\w.]{2,}/g;

export function stripPersonalData(text: string): string {
  return text.replace(EMAIL_RE, "[удалено]").replace(PHONE_RE, "[удалено]").replace(HANDLE_RE, "[удалено]");
}

const MODERATION_SCHEMA = {
  type: "object",
  properties: { label: { type: "string", enum: ["ok", "insult", "personal_data", "spam", "unverifiable_accusation"] } },
  required: ["label"],
};

const modelOutput = z.object({
  label: z.enum(["ok", "insult", "personal_data", "spam", "unverifiable_accusation"]),
});

const SYSTEM_PROMPT = `Ты — фильтр модерации отзывов студентов об университете. Классифицируй текст ровно в одну метку:
- ok — обычный отзыв без оскорблений, личных данных, спама и непроверяемых обвинений;
- insult — оскорбления, брань, разжигание ненависти;
- personal_data — содержит личные данные (телефон, e-mail, адрес, ФИО третьих лиц);
- spam — реклама, ссылки, не по теме;
- unverifiable_accusation — серьёзное обвинение (коррупция, преступление и т.п.) без проверяемых фактов.
Ты НЕ оцениваешь сам университет и не решаешь, правда ли отзыв — только тип текста. Верни только JSON по схеме.`;

/** One Gemini call → a label, nothing else. Unavailable/quota/error → null (caller must hold the review). */
export async function classifyReviewText(text: string, signal: AbortSignal): Promise<ModerationLabel | null> {
  if (!env.geminiApiKey) return null;
  try {
    const response = await new GoogleGenAI({ apiKey: env.geminiApiKey }).models.generateContent({
      model: env.descriptionModel,
      contents: text,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: MODERATION_SCHEMA,
        temperature: 0,
        maxOutputTokens: 64,
        abortSignal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.DESCRIPTION_TIMEOUT_MS)]),
      },
    });
    return modelOutput.parse(JSON.parse(response.text ?? "")).label;
  } catch {
    return null;
  }
}

/** The CODE decides publish/hold from the label — never the model, and never on a missing label. */
export function statusFromLabel(label: ModerationLabel | null): "published" | "held" {
  return label === "ok" ? "published" : "held";
}

/** Three reports auto-hold a published review pending human review. */
export function statusAfterReport(currentStatus: "published" | "held", reportCount: number): "published" | "held" {
  return reportCount >= REPORT_THRESHOLD ? "held" : currentStatus;
}
