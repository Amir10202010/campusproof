import { isNotImplemented } from "@/lib/notImplemented";
import type { PipelineInput } from "@/lib/types";
import { TimeoutError } from "./deadline";

/**
 * Plain-Russian reasons shown to users when the visual check does not happen (source chip, /api/health).
 * Owner: P1. Technical details stay in the server logs.
 */

/** Why the visual check did not run at all (region rules, simulation, no time left). */
export function visionSkippedReason(input: PipelineInput, budgetMs: number): string {
  if (input.simulate.includes("vision_down")) return "Симуляция недоступной визуальной проверки";
  if (!input.aiAllowed) {
    return "Бесплатный ИИ недоступен посетителям из ЕЭЗ, Швейцарии и Великобритании (условия Gemini API)";
  }
  return budgetMs <= 0 ? "Не осталось времени в пределах дедлайна" : "Визуальная проверка не подключена";
}

/** Short Russian reason for a failed visual check — shown on the source chip, no technical details. */
export function visionFailureReason(error: unknown): string {
  if (isNotImplemented(error)) return "Визуальная проверка не подключена";
  if (error instanceof TimeoutError) return "Модель не ответила к дедлайну";
  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message)) return "Исчерпана бесплатная квота Gemini";
  if (/\b401\b|\b403\b|UNAUTHENTICATED|PERMISSION_DENIED|API key|credential/i.test(message)) {
    return "Gemini не принял ключ (проверьте GEMINI_API_KEY)";
  }
  if (/\b400\b|INVALID_ARGUMENT/i.test(message)) return "Gemini отклонил запрос (модель или параметры)";
  if (/location|not supported|region/i.test(message)) return "Gemini недоступен из региона этого сервера";
  return "Ошибка визуальной проверки";
}

/** Short Russian reason for a source chip: adapters already explain in Russian, HTTP codes are translated. */
export function sourceFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/[а-яё]/i.test(message)) return message.slice(0, 140);
  const status = message.match(/\b([45]\d\d)\b/)?.[1];
  if (status === "429") return "Источник ограничил частоту запросов";
  if (status === "401" || status === "403") return "Источник не принял ключ доступа";
  if (status) return `Источник ответил ошибкой HTTP ${status}`;
  return "Источник недоступен";
}
