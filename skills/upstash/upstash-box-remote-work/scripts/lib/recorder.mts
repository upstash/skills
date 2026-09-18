// Generic recording helpers for a box browser, driven from inside (or outside) the box with @upstash/box.
// connect(): Playwright page on the box's Chromium.  record(): start a recording, run your steps, stop,
// download the MP4 and write full/<name>.json with every logged event (wall-clock ms) for the editor.
import { Box } from "@upstash/box";
import { chromium, type Browser, type Page } from "playwright-core";
import fs from "node:fs";

export type Ev = { t: number; event: string; data?: unknown };
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Take {
  events: Ev[] = [];
  extra: Record<string, unknown> = {};
  constructor(public name: string) {}
  log(event: string, data?: unknown) { this.events.push({ t: Date.now(), event, data }); console.log(new Date().toISOString(), event, data ?? ""); }
  at(event: string) { return this.events.find((e) => e.event === event)?.t; }
}

export async function connect(opts: { boxId?: string; width?: number; height?: number } = {}) {
  const boxId = opts.boxId ?? process.env.BOX_ID; if (!boxId) throw new Error("BOX_ID missing");
  const box = await Box.get(boxId, { apiKey: process.env.UPSTASH_BOX_API_KEY });
  try { await box.browser.recordings.stop(); } catch {}          // a leftover recording makes start() 409
  const browser: Browser = await chromium.connectOverCDP(await box.browser.cdpUrl());
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());
  for (const p of ctx.pages()) if (p !== page) await p.close();   // the recording follows the foreground tab
  await page.setViewportSize({ width: opts.width ?? 1280, height: opts.height ?? 800 });
  return { box, browser, page };
}

/** Record `body`. Capture starts ~2 s after start() returns, so `preroll` ms of stillness are recorded first. */
export async function record(box: Awaited<ReturnType<typeof connect>>["box"], take: Take, body: () => Promise<void>,
  opts: { maxDurationSeconds?: number; preroll?: number; outDir?: string } = {}) {
  const outDir = opts.outDir ?? "full"; fs.mkdirSync(outDir, { recursive: true });
  let recording: any;
  try {
    const handle = await box.browser.recordings.start({ maxDurationSeconds: opts.maxDurationSeconds ?? 600 });
    take.log("rec_start");
    await sleep(opts.preroll ?? 3500);
    await body();
    take.log("rec_stop_request");
    recording = await handle.stop();
  } catch (e) {
    take.log("error", String(e));
    try { recording = await box.browser.recordings.stop(); } catch {}
  }
  take.log("rec_stopped", { startedAt: recording?.startedAt, endedAt: recording?.endedAt, durationMs: recording?.durationMs, reason: recording?.stoppedReason });
  const meta = { name: take.name, recording, events: take.events, ...take.extra };
  fs.writeFileSync(`${outDir}/${take.name}.json`, JSON.stringify(meta, null, 2));
  if (recording?.id) take.log("downloaded", await box.browser.recordings.download(recording.id, { path: `${outDir}/${take.name}.mp4` }));
  return meta;
}

/** Pixel position of the first terminal line matching `re` on a ttyd page (window.term), for a cursor target. */
export async function findInTerminal(page: Page, re: RegExp, maxChars = 40) {
  return page.evaluate(({ src, flags, maxChars }) => {
    const t = (window as any).term; if (!t) return null; const buf = t.buffer.active; const re = new RegExp(src, flags);
    for (let row = buf.length - 1; row >= 0; row--) {
      const line = buf.getLine(row); if (!line) continue; const text = line.translateToString(true); const m = text.match(re); if (!m) continue;
      const r = document.querySelector(".xterm-screen")!.getBoundingClientRect(); const cw = r.width / t.cols, ch = r.height / t.rows;
      const vrow = row - buf.viewportY, col = m.index!;
      return { text: m[0], row: vrow, col, x: r.left + (col + Math.min(m[0].length, maxChars) / 2) * cw, y: r.top + (vrow + 0.5) * ch };
    }
    return null;
  }, { src: re.source, flags: re.flags, maxChars });
}
