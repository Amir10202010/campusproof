import { notFound } from "next/navigation";
import { devFeaturesEnabled } from "@/lib/devOnly";

/** DEV/PREVIEW ONLY — throws on purpose to preview app/error.tsx. 404 in production. */
export default function ThrowingPage() {
  if (!devFeaturesEnabled) notFound();
  throw new Error("Намеренная ошибка для проверки страницы ошибки (/dev/error)");
}
