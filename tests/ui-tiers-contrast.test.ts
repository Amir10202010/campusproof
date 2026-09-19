import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Trust-tier badges must stay readable: WCAG AA contrast ≥ 4.5:1 between each --tier-X-foreground and --tier-X,
 * in both the light (:root) and dark (.dark) themes of app/globals.css.
 */
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function oklchVar(source: string, name: string): [number, number, number] {
  const match = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(source);
  expect(match, `--${name}`).not.toBeNull();
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

/** OKLCH → linear sRGB (Björn Ottosson's OKLab matrices), clamped to the sRGB gamut. */
function relativeLuminance([l, c, hue]: [number, number, number]): number {
  const h = (hue * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const [r, g, bl] = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(one: [number, number, number], two: [number, number, number]): number {
  const [light, dark] = [relativeLuminance(one), relativeLuminance(two)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("tier colors", () => {
  it("sanity: white on black is 21:1", () => {
    expect(contrast([1, 0, 0], [0, 0, 0])).toBeCloseTo(21, 0);
  });

  for (const theme of [":root", ".dark"]) {
    for (const tier of ["verified", "likely", "unconfirmed"]) {
      it(`${theme} ${tier}: text contrast ≥ 4.5`, () => {
        const source = block(theme);
        const ratio = contrast(oklchVar(source, `tier-${tier}-foreground`), oklchVar(source, `tier-${tier}`));
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

/**
 * Status tones carry text too: source chips, degraded banners, coverage rows, the warning chips on a
 * photo card. They are held to the same 4.5:1 as the tier badges, on their own surface and on the page.
 */
describe("status tones", () => {
  for (const theme of [":root", ".dark"]) {
    for (const [tone, surface] of [
      ["ok", "ok-surface"],
      ["warn", "warn-surface"],
      ["destructive-foreground", "destructive-surface"],
    ] as const) {
      it(`${theme} ${tone}: text contrast ≥ 4.5 on ${surface} and on the page`, () => {
        const source = block(theme);
        const text = oklchVar(source, tone);
        expect(contrast(text, oklchVar(source, surface))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(text, oklchVar(source, "background"))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("theme tokens (P4 · #40)", () => {
  const root = () => block(":root");

  it("secondary text stays ≥ 4.5:1 on white and on the muted background", () => {
    const text = oklchVar(root(), "muted-foreground");
    expect(contrast(text, oklchVar(root(), "background"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, oklchVar(root(), "muted"))).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring at 50% opacity keeps ≥ 3:1 against white", () => {
    // Browsers blend ring-ring/50 with the page in gamma-encoded sRGB; the ring is neutral, so one channel is enough.
    const ringLinear = relativeLuminance(oklchVar(root(), "ring"));
    const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
    const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const blended = decode(0.5 * encode(ringLinear) + 0.5);
    expect((1 + 0.05) / (blended + 0.05)).toBeGreaterThanOrEqual(3);
  });
});
