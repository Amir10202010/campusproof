import { notFound } from "next/navigation";
import { connection } from "next/server";
import { devFeaturesEnabled } from "@/lib/devOnly";

/**
 * DEV/PREVIEW ONLY — throws on purpose to preview app/error.tsx. 404 in production.
 * The throw happens at request time only: thrown during prerendering it would fail every preview build.
 */
export default async function ThrowingPage() {
  if (!devFeaturesEnabled) notFound();
  await connection();
  throw new Error("Намеренная ошибка для проверки страницы ошибки (/dev/error)");
}
