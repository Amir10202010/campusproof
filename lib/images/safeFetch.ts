import { lookup } from "node:dns/promises";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
}

/**
 * P2 · issue #15 · SSRF-safe image download (docs/architecture.md §5.3, §9):
 * http/https only; reject IP literals, localhost and private ranges; ≤ LIMITS.IMAGE_FETCH_MAX_REDIRECTS
 * redirects (follow manually and re-check each hop); abort above LIMITS.IMAGE_FETCH_MAX_BYTES;
 * timeout LIMITS.IMAGE_FETCH_TIMEOUT_MS; content-type must be image/*.
 */
export type SafeFetchImage = (url: string, signal: AbortSignal) => Promise<SafeFetchResult>;

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/** Hostnames that never point at a public image server. */
const BLOCKED_HOSTNAME =
  /^(?:localhost|.*\.(?:local|localhost|internal|intranet|lan|home|corp|test|example|invalid))$/i;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Loopback, private, link-local (incl. the cloud metadata address), CGNAT, multicast and reserved ranges. */
export function isPrivateAddress(address: string): boolean {
  const ip = address
    .trim()
    .toLowerCase()
    .replace(/^\[|]$/g, "");

  const v4 = IPV4.exec(ip);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return true; // malformed → refuse
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 and 192.0.2.0/24
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (!ip.includes(":")) return false; // not an IP literal
  if (ip === "::" || ip === "::1") return true;
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (mapped) return isPrivateAddress(mapped[1]);
  return /^(?:f[cd]|fe[89ab])/.test(ip); // unique-local fc00::/7, link-local fe80::/10
}

/** Parses the URL and refuses anything that is not a public http(s) image host. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError(`invalid url: ${raw.slice(0, 80)}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError(`blocked protocol: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|]$/g, "");
  if (!host || BLOCKED_HOSTNAME.test(host) || !host.includes(".")) {
    throw new SafeFetchError(`blocked host: ${url.hostname}`);
  }
  if (isPrivateAddress(host)) throw new SafeFetchError(`blocked address: ${url.hostname}`);
  return url;
}

/**
 * Resolves the hostname and refuses private targets (DNS rebinding). A failing lookup is not fatal:
 * the request below fails on its own, and we don't want a flaky resolver to drop a whole profile.
 */
async function assertPublicTarget(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|]$/g, "");
  if (IPV4.test(host) || host.includes(":")) return; // literal already checked in assertPublicUrl
  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new SafeFetchError(`host resolves to a private address: ${host}`);
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
  }
}

/** Reads the body but stops as soon as it exceeds `maxBytes` — a huge file must not fill the function's memory. */
export async function readCappedBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) throw new SafeFetchError("empty response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError(`image larger than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export const safeFetchImage: SafeFetchImage = async (url, signal) => {
  const timeout = AbortSignal.timeout(LIMITS.IMAGE_FETCH_TIMEOUT_MS);
  const bounded = AbortSignal.any([signal, timeout]);
  let current = assertPublicUrl(url);

  for (let hop = 0; hop <= LIMITS.IMAGE_FETCH_MAX_REDIRECTS; hop++) {
    await assertPublicTarget(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: bounded,
      headers: { accept: "image/*,*/*;q=0.8", "user-agent": env.wikimediaUserAgent },
    });

    if (REDIRECT_STATUS.has(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new SafeFetchError(`redirect without location from ${current.hostname}`);
      current = assertPublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new SafeFetchError(`HTTP ${response.status} from ${current.hostname}`);
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    // SVG can carry scripts and GIFs are almost never campus photos (docs/architecture.md §5.3).
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml" || contentType === "image/gif") {
      await response.body?.cancel();
      throw new SafeFetchError(`unsupported content-type: ${contentType || "unknown"}`);
    }

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > LIMITS.IMAGE_FETCH_MAX_BYTES) {
      await response.body?.cancel();
      throw new SafeFetchError(`image larger than ${LIMITS.IMAGE_FETCH_MAX_BYTES} bytes`);
    }

    const buffer = await readCappedBody(response, LIMITS.IMAGE_FETCH_MAX_BYTES);
    return { buffer, contentType, finalUrl: current.toString() };
  }

  throw new SafeFetchError(`more than ${LIMITS.IMAGE_FETCH_MAX_REDIRECTS} redirects`);
};
