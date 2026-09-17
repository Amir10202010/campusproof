/**
 * Gemini API Additional Terms: "You may use only Paid Services when making API Clients available to users in the
 * European Economic Area, Switzerland, or the United Kingdom." We use the free tier, so for visitors from these
 * countries the pipeline runs without AI (honest degraded mode). Country comes from Vercel's `x-vercel-ip-country`.
 */
const FREE_AI_RESTRICTED_COUNTRIES = new Set([
  // EU
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // rest of the EEA
  "IS",
  "LI",
  "NO",
  // Switzerland, United Kingdom
  "CH",
  "GB",
]);

/** Unknown country (local dev, no header) → allowed. */
export function freeAiAllowedFor(countryCode: string | null | undefined): boolean {
  if (!countryCode) return true;
  return !FREE_AI_RESTRICTED_COUNTRIES.has(countryCode.trim().toUpperCase());
}
