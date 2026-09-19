#!/usr/bin/env node
/**
 * P4 · #107 · slide assets without dependencies: Node 24 and a Chrome or Edge that is already installed.
 *
 *   node scripts/qa/slides.mjs shots [--base https://campusproof.vercel.app]
 *     → docs/slides/img/*. Every shot is a real prod run: no fixtures, no replay, nothing sped up.
 *   node scripts/qa/slides.mjs pdf
 *     → docs/slides/CampusProof.pdf, printed from docs/slides/index.html.
 *   node scripts/qa/slides.mjs preview [--out <folder>]
 *     → one PNG per slide (default: a temp folder), to check the layout without a PDF viewer.
 *
 * The browser runs headless with a throwaway profile; the DevTools protocol listens on 127.0.0.1 only.
 * Browser: --browser <path>, else $BROWSER_PATH, else the usual Chrome and Edge install paths.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLIDES = join(ROOT, "docs", "slides");

/** Two decks share this script: the Russian one (docs/slides) and the English pitch deck (docs/slides/en). */
const DECKS = {
  ru: { html: join(SLIDES, "index.html"), pdf: join(SLIDES, "CampusProof.pdf") },
  en: { html: join(SLIDES, "en", "index.html"), pdf: join(SLIDES, "en", "CampusProof-pitch-EN.pdf") },
};

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── DevTools protocol ─────────────────────────────────────────────────────────

class Cdp {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
}

export async function launch(browserPath) {
  const profile = mkdtempSync(join(tmpdir(), "cp-slides-"));
  const child = spawn(
    browserPath,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--lang=ru-RU",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("the browser did not start in 20 s")), 20_000);
    child.stderr.on("data", (chunk) => {
      output += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) => reject(new Error(`the browser exited with code ${code}`)));
  });
  const cdp = await Cdp.connect(url);
  const close = async () => {
    await cdp.send("Browser.close").catch(() => {});
    child.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  };
  return { cdp, close };
}

/** Helpers injected into every page: element boxes in page coordinates (what Page.captureScreenshot's clip expects). */
export const PAGE_HELPERS = `
  window.__box = (elements, pad = 16) => {
    const rects = elements.filter(Boolean).map((element) => element.getBoundingClientRect());
    if (rects.length === 0) throw new Error("nothing to capture");
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      x: Math.max(0, left + scrollX - pad),
      y: Math.max(0, top + scrollY - pad),
      width: Math.min(document.documentElement.scrollWidth, right - left + 2 * pad),
      height: bottom - top + 2 * pad,
    };
  };
  window.__section = (title) =>
    [...document.querySelectorAll("main section")].find((section) =>
      (section.querySelector("h2, h3")?.textContent ?? "").trim().startsWith(title),
    );
  window.__imagesReady = () =>
    [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight).every((img) => img.complete);
  window.__tilesReady = () => {
    const tiles = [...document.querySelectorAll(".leaflet-tile")];
    return tiles.length > 0 && tiles.every((tile) => tile.classList.contains("leaflet-tile-loaded"));
  };
`;

export async function openPage(cdp, { width, height, scale = 2, mobile = false }) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send("Page.enable");
  const viewport = (w, h) =>
    send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: scale, mobile });
  await viewport(width, height);
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const waitFor = async (expression, timeout = 45_000) => {
    const started = Date.now();
    for (;;) {
      if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
      if (Date.now() - started > timeout) throw new Error(`timed out waiting for: ${expression}`);
      await sleep(250);
    }
  };

  return {
    send,
    evaluate,
    waitFor,
    viewport,
    async goto(url) {
      // The old document is "complete" too: mark it and wait for a document without the mark.
      await evaluate("window.__leaving = true");
      await send("Page.navigate", { url });
      await waitFor(`!window.__leaving && document.readyState === "complete"`, 30_000);
      await evaluate(PAGE_HELPERS);
    },
    /** A screenshot of the viewport, or of `clip` (page coordinates, CSS pixels); `.jpg` → JPEG. */
    async shot(file, clip) {
      // Photos compress far better as JPEG; UI-only shots stay PNG for crisp text.
      const jpeg = file.endsWith(".jpg");
      const { data } = await send("Page.captureScreenshot", {
        format: jpeg ? "jpeg" : "png",
        ...(jpeg ? { quality: 82 } : {}),
        // No captureBeyondViewport: it re-composites fixed layers and lets the page show through dialogs.
        ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
      });
      writeFileSync(file, Buffer.from(data, "base64"));
      console.error(`  ${file.startsWith(ROOT) ? file.slice(ROOT.length + 1) : file}`);
    },
    close: () => cdp.send("Target.closeTarget", { targetId }),
  };
}

// ─── Shots ─────────────────────────────────────────────────────────────────────

/** A finished live run, or a saved profile once profiles are cached again. */
const DONE = `/Завершено за|Собрано за|Сохранённый профиль/.test(document.body.innerText)`;

/** The whole page fits the viewport, so every clip is inside it: sticky bars stay at the top, lazy images load. */
async function growToContent(page, width) {
  const height = await page.evaluate("document.documentElement.scrollHeight");
  await page.viewport(width, Math.min(height, 16_000));
  await page.evaluate("scrollTo(0, 0)");
  await sleep(1500);
  await page.waitFor("window.__imagesReady()", 15_000).catch(() => console.error("  (some images did not load)"));
}

async function shots({ base, browser }) {
  const out = join(SLIDES, "img");
  mkdirSync(out, { recursive: true });
  const { cdp, close } = await launch(browser);
  try {
    const page = await openPage(cdp, { width: 1440, height: 900 });

    console.error("home");
    await page.goto(`${base}/`);
    await sleep(1000);
    await page.shot(join(out, "home.png"));

    console.error("КБТУ: live run, photos, evidence dialog");
    await page.goto(`${base}/search?q=${encodeURIComponent("КБТУ")}`);
    await page.waitFor(DONE);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "profile-top.png"),
      await page.evaluate(`window.__box([
        document.querySelector("main header"),
        document.querySelector('[aria-label="Ход проверки"]'),
        document.querySelector('main [role="alert"]')?.parentElement,
      ])`),
    );
    await growToContent(page, 1440);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "photos.jpg"),
      await page.evaluate(`(() => {
        const section = window.__section("Кампус");
        const cards = [...section.querySelectorAll("li")].filter((li) => li.querySelector("img")).slice(0, 4);
        return window.__box([section.querySelector("h2, h3"), ...cards], 10);
      })()`),
    );
    // A tall viewport shows the whole dialog: evidence, source, date and license.
    await page.viewport(1440, 1700);
    await page.evaluate("scrollTo(0, 0)");
    const opened = await page.evaluate(`(() => {
      const card = [...document.querySelectorAll("main li")].find(
        (li) => li.querySelector("img") && li.textContent.includes("Проверено"),
      );
      const button = card?.querySelector("button");
      button?.click();
      return Boolean(button);
    })()`);
    if (!opened) throw new Error("no «Проверено» photo to open on КБТУ");
    await page.waitFor(`document.querySelector('[role="dialog"]')`);
    await sleep(1500);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "evidence.jpg"),
      await page.evaluate(`window.__box([document.querySelector('[role="dialog"]')], 0)`),
    );

    console.error("Korkyt Ata: empty sections, map");
    await page.viewport(1440, 900);
    await page.goto(`${base}/search?q=${encodeURIComponent("Korkyt Ata Kyzylorda University")}`);
    await page.waitFor(DONE);
    await growToContent(page, 1440);
    await page.evaluate(PAGE_HELPERS);
    await page.waitFor("window.__tilesReady()", 20_000).catch(() => console.error("  (map tiles still loading)"));
    await page.shot(
      join(out, "gaps.png"),
      await page.evaluate(`window.__box([window.__section("Аудитории"), window.__section("Библиотеки")])`),
    );
    await page.shot(join(out, "map.jpg"), await page.evaluate(`window.__box([window.__section("Карта")])`));

    console.error("simulated outage");
    await page.viewport(1440, 900);
    await page.goto(`${base}/search?q=KBTU&simulate=web_search_down`);
    await page.waitFor(DONE);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "degraded.png"),
      await page.evaluate(`window.__box([
        document.querySelector('[aria-label="Ход проверки"]'),
        document.querySelector('main [role="alert"]')?.parentElement,
      ])`),
    );
    await page.close();
  } finally {
    await close();
  }
}

/** Screens for the English pitch deck (docs/slides/en/img): the current prod UI, real runs, nothing staged. */
async function shotsEn({ base, browser }) {
  const out = join(SLIDES, "en", "img");
  mkdirSync(out, { recursive: true });
  const { cdp, close } = await launch(browser);
  try {
    const page = await openPage(cdp, { width: 1440, height: 900 });

    console.error("home");
    await page.goto(`${base}/`);
    await sleep(1500);
    await page.shot(join(out, "home.png"));

    console.error("MSU: ambiguous query");
    await page.goto(`${base}/search?q=MSU`);
    await page.waitFor(`/Какой университет/.test(document.body.innerText)`);
    await sleep(1500);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "picklist.png"),
      await page.evaluate(`window.__box([document.querySelector("main section")])`),
    );

    console.error("КБТУ: fresh run");
    await page.goto(`${base}/u/Q1734762?refresh=1`);
    await page.waitFor(DONE);
    // A finished run folds the stages into <details>: open it, the counts are the point of the shot.
    await page.evaluate(
      `document.querySelectorAll('details[aria-label="Ход проверки"]').forEach((d) => (d.open = true))`,
    );
    await sleep(1000);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "profile-top.png"),
      await page.evaluate(`window.__box([
        document.querySelector("main header"),
        document.querySelector('[aria-label="Ход проверки"]'),
      ])`),
    );
    await growToContent(page, 1440);
    await page.evaluate(PAGE_HELPERS);
    const cards = (id) => `(() => {
      const section = document.getElementById("${id}");
      const cards = [...section.querySelectorAll("li")].filter((li) => li.querySelector("img")).slice(0, 4);
      return window.__box([section.querySelector("h2"), ...cards], 10);
    })()`;
    await page.shot(join(out, "dorms.jpg"), await page.evaluate(cards("category-dormitory")));
    await page.shot(join(out, "campus.jpg"), await page.evaluate(cards("category-campus")));
    await page.waitFor("window.__tilesReady()", 20_000).catch(() => console.error("  (map tiles still loading)"));
    await page.shot(join(out, "map.jpg"), await page.evaluate(`window.__box([window.__section("Карта")])`));
    await page.evaluate(
      `[...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Отфильтровано"))?.click()`,
    );
    await sleep(2500);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "filtered.jpg"),
      await page.evaluate(`(() => {
        const button = [...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Отфильтровано"));
        return window.__box([button.closest("section")], 8);
      })()`),
    );

    console.error("КБТУ: evidence dialog");
    await page.viewport(1440, 1700);
    await page.evaluate("scrollTo(0, 0)");
    const opened = await page.evaluate(`(() => {
      const card = [...document.querySelectorAll("#category-campus li")].find(
        (li) => li.querySelector("img") && li.textContent.includes("Проверено"),
      );
      const button = card?.querySelector("button");
      button?.click();
      return Boolean(button);
    })()`);
    if (!opened) throw new Error("no «Проверено» campus photo to open on КБТУ");
    await page.waitFor(`document.querySelector('[role="dialog"]')`);
    await sleep(2000);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "evidence.jpg"),
      await page.evaluate(`window.__box([document.querySelector('[role="dialog"]')], 0)`),
    );

    console.error("simulated outage");
    await page.viewport(1440, 900);
    await page.goto(`${base}/search?q=KBTU&simulate=web_search_down`);
    await page.waitFor(DONE);
    await sleep(1000);
    await page.evaluate(PAGE_HELPERS);
    await page.shot(
      join(out, "degraded.png"),
      await page.evaluate(`window.__box([
        document.querySelector('[aria-label="Ход проверки"]'),
        document.querySelector('main [role="alert"]')?.parentElement,
      ])`),
    );

    await page.close();
  } finally {
    await close();
  }
}

// ─── PDF ───────────────────────────────────────────────────────────────────────

async function pdf({ browser, deck }) {
  const { html: source, pdf: target } = DECKS[deck];
  const { cdp, close } = await launch(browser);
  try {
    const page = await openPage(cdp, { width: 1280, height: 720, scale: 1 });
    await page.goto(pathToFileURL(source).href);
    await page.waitFor("document.fonts.status === 'loaded'", 20_000);
    await page.waitFor("[...document.images].every((img) => img.complete)", 20_000);
    const { data } = await page.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
    });
    writeFileSync(target, Buffer.from(data, "base64"));
    const megabytes = statSync(target).size / 1024 / 1024;
    console.error(`${target.slice(ROOT.length + 1)} — ${megabytes.toFixed(1)} MB`);
    await page.close();
  } finally {
    await close();
  }
}

/** One PNG per slide, to eyeball the deck without a PDF viewer. */
async function preview({ browser, out, deck }) {
  const target = out ?? join(tmpdir(), "campusproof-slides");
  mkdirSync(target, { recursive: true });
  const { cdp, close } = await launch(browser);
  try {
    const page = await openPage(cdp, { width: 1330, height: 800, scale: 1 });
    await page.goto(pathToFileURL(DECKS[deck].html).href);
    await page.waitFor("document.fonts.status === 'loaded'", 20_000);
    await growToContent(page, 1330);
    await page.evaluate(PAGE_HELPERS);
    const count = await page.evaluate("document.querySelectorAll('.slide').length");
    for (let i = 0; i < count; i++) {
      const clip = await page.evaluate(`window.__box([document.querySelectorAll(".slide")[${i}]], 0)`);
      await page.shot(join(target, `slide-${i + 1}.png`), clip);
    }
  } finally {
    await close();
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    command: argv[0],
    base: "https://campusproof.vercel.app",
    browser: process.env.BROWSER_PATH,
    out: undefined,
    deck: "ru",
  };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--base") args.base = argv[++i].replace(/\/+$/, "");
    else if (argv[i] === "--browser") args.browser = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--deck") args.deck = argv[++i];
    else throw new Error(`Неизвестный аргумент: ${argv[i]}`);
  }
  if (!DECKS[args.deck]) throw new Error(`Неизвестная презентация: ${args.deck} (ru | en)`);
  args.browser ??= BROWSERS.find((path) => existsSync(path));
  if (!args.browser) throw new Error("Не нашли Chrome или Edge: укажите путь через --browser");
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const run = { shots, "shots-en": shotsEn, pdf, preview }[args.command];
  if (!run) {
    console.error(
      "Использование: node scripts/qa/slides.mjs shots | shots-en [--base URL] | pdf [--deck ru|en] | preview [--deck ru|en] [--out папка]",
    );
    process.exit(2);
  }
  run(args).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
