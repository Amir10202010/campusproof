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
