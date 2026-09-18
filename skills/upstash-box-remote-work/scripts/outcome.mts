// Record the outcome: open the URL the agent produced in the box browser and record a few seconds.
// Usage: npx tsx outcome.mts <name> [url]   (url defaults to full/<name>.json linkXY.url)
import { Box } from "@upstash/box";
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const name = process.argv[2]; if (!name) throw new Error("usage: outcome.mts <name> [url]");
const BOX_ID = process.env.BOX_ID ?? "comic-griffon-46342";
const meta = fs.existsSync(`full/${name}.json`) ? JSON.parse(fs.readFileSync(`full/${name}.json`, "utf8")) : {};
const url: string | undefined = process.argv[3] ?? meta.linkXY?.url; if (!url) throw new Error("no url");
const events: { t: number; event: string; data?: unknown }[] = [];
const log = (event: string, data?: unknown) => { events.push({ t: Date.now(), event, data }); console.log(new Date().toISOString(), event, data ?? ""); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Warm the page first so the recorded load is quick (a dev server compiles on first request).
try { execFileSync("curl", ["-s", "-o", "/dev/null", "-m", "150", url]); log("warmed"); } catch (e) { log("warm_failed", String(e)); }
const box = await Box.get(BOX_ID, { apiKey: process.env.UPSTASH_BOX_API_KEY });
try { await box.browser.recordings.stop(); } catch {}
const browser = await chromium.connectOverCDP(await box.browser.cdpUrl());
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = ctx.pages()[0] ?? (await ctx.newPage());
for (const p of ctx.pages()) if (p !== page) await p.close();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("about:blank");
await sleep(800);
let recording: any;
try {
  const handle = await box.browser.recordings.start({ maxDurationSeconds: 180 });
  log("rec_start");
  await sleep(800);
  log("goto", url);
  await page.goto(url, { waitUntil: "load", timeout: 120000 }).catch((e) => log("goto_error", String(e)));
  log("loaded");
  await sleep(2500);
  await page.mouse.wheel(0, 400); log("scroll");
  await sleep(3500);
  recording = await handle.stop();
} catch (e) { log("error", String(e)); try { recording = await box.browser.recordings.stop(); } catch {} }
log("rec_stopped", { startedAt: recording?.startedAt, durationMs: recording?.durationMs });
fs.writeFileSync(`full/${name}-outcome.json`, JSON.stringify({ name, url, recording, events }, null, 2));
if (recording?.id) log("downloaded", await box.browser.recordings.download(recording.id, { path: `full/${name}-outcome.mp4` }));
await browser.close();
