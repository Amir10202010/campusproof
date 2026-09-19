import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * P1 · #111 · lib/env.ts reads process.env once at import, so every case needs a fresh module.
 * Only names are asserted here — never a real value.
 */
async function envWith(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return (await import("@/lib/env")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Openverse credentials", () => {
  it("reads the prefixed names", async () => {
    const env = await envWith({ OPENVERSE_CLIENT_ID: "prefixed-id", OPENVERSE_CLIENT_SECRET: "prefixed-secret" });
    expect(env.openverseClientId).toBe("prefixed-id");
    expect(env.openverseClientSecret).toBe("prefixed-secret");
  });

  it("falls back to the bare names Openverse itself hands out", async () => {
    const env = await envWith({
      OPENVERSE_CLIENT_ID: "",
      OPENVERSE_CLIENT_SECRET: "",
      client_id: "bare-id",
      client_secret: "bare-secret",
    });
    expect(env.openverseClientId).toBe("bare-id");
    expect(env.openverseClientSecret).toBe("bare-secret");
  });

  it("prefers the prefixed name when both are set", async () => {
    const env = await envWith({ OPENVERSE_CLIENT_ID: "prefixed-id", client_id: "bare-id" });
    expect(env.openverseClientId).toBe("prefixed-id");
  });

  it("counts the source as configured only when both halves are present", async () => {
    vi.resetModules();
    vi.stubEnv("OPENVERSE_CLIENT_ID", "");
    vi.stubEnv("OPENVERSE_CLIENT_SECRET", "");
    vi.stubEnv("client_id", "bare-id");
    vi.stubEnv("client_secret", "");
    const { configuredServices } = await import("@/lib/env");
    expect(configuredServices().openverse).toBe(false);
  });
});
