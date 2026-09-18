// Record one take: type the prompt into the OpenCode TUI (via tmux) shown in ttyd, wait for the
// agent to finish, locate the preview link in the terminal, stop the recording and save it.
// Usage: npx tsx rec.mts <name>   (reads prompts/<name>.txt, writes full/<name>.mp4 + .json)
import { Box } from "@upstash/box";
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const name = process.argv[2]; if (!name) throw new Error("usage: rec.mts <name>");
const BOX_ID = process.env.BOX_ID ?? "comic-griffon-46342";
const prompt = fs.readFileSync(`prompts/${name}.txt`, "utf8").trim();
const events: { t: number; event: string; data?: unknown }[] = [];
const log = (event: string, data?: unknown) => { events.push({ t: Date.now(), event, data }); console.log(new Date().toISOString(), event, data ?? ""); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tmux = (...args: string[]) => execFileSync("tmux", args, { encoding: "utf8" });
const sh = (cmd: string) => execFileSync("bash", ["-c", cmd], { encoding: "utf8", maxBuffer: 64e6 });

const box = await Box.get(BOX_ID, { apiKey: process.env.UPSTASH_BOX_API_KEY });
try { await box.browser.recordings.stop(); log("stopped_stale_recording"); } catch {}
const cdp = await box.browser.cdpUrl();
const browser = await chromium.connectOverCDP(cdp);
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = ctx.pages()[0] ?? (await ctx.newPage());
for (const p of ctx.pages()) if (p !== page) await p.close();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:7681", { waitUntil: "load" });
await page.waitForFunction(() => (window as any).term && document.querySelector(".xterm-screen"), null, { timeout: 20000 });
await sleep(2500);
const geom = await page.evaluate(() => { const t = (window as any).term; const r = document.querySelector(".xterm-screen")!.getBoundingClientRect(); return { cols: t.cols, rows: t.rows, left: r.left, top: r.top, width: r.width, height: r.height }; });
log("geometry", geom);

const sessionsBefore = sh("cd /workspace/home/demo && opencode session list 2>/dev/null | grep -oE 'ses_[A-Za-z0-9]+' || true").split(/\s+/).filter(Boolean);

let handle: any;
let recording: any;
try {
  handle = await box.browser.recordings.start({ maxDurationSeconds: 600 });
  log("rec_start");
  await sleep(3500); // capture starts ~2 s after start() returns
  log("type_start");
  for (let i = 0; i < prompt.length; i += 6) { tmux("send-keys", "-t", "demo", "-l", prompt.slice(i, i + 6)); await sleep(24); }
  log("type_end");
  await sleep(2200);
  tmux("send-keys", "-t", "demo", "Enter");
  log("submit");

  // Wait for the agent: find the new session, then poll its export until the last assistant
  // message is completed and the export has been stable for a while.
  let sessionId = "";
  for (let i = 0; i < 30 && !sessionId; i++) {
    await sleep(2000);
    const now = sh("cd /workspace/home/demo && opencode session list 2>/dev/null | grep -oE 'ses_[A-Za-z0-9]+' || true").split(/\s+/).filter(Boolean);
    sessionId = now.find((s) => !sessionsBefore.includes(s)) ?? "";
  }
  log("session", sessionId);
  const exportPath = `full/${name}-export.json`;
  let lastSig = ""; let stableSince = 0; const deadline = Date.now() + 560_000;
  while (Date.now() < deadline) {
    await sleep(4000);
    if (!sessionId) continue;
    try { sh(`cd /workspace/home/demo && opencode export ${sessionId} > ${process.cwd()}/${exportPath} 2>/dev/null`); } catch { continue; }
    let d: any; try { d = JSON.parse(fs.readFileSync(exportPath, "utf8")); } catch { continue; }
    const msgs = d.messages ?? [];
    const last = msgs[msgs.length - 1];
    const sig = JSON.stringify(msgs.map((m: any) => [m.info?.id, m.info?.time?.completed, (m.parts ?? []).length]));
    if (sig !== lastSig) { lastSig = sig; stableSince = Date.now(); }
    const done = last?.info?.role === "assistant" && !!last.info.time?.completed;
    const pending = msgs.some((m: any) => (m.parts ?? []).some((p: any) => p.type === "tool" && p.state?.status && p.state.status !== "completed" && p.state.status !== "error"));
    if (done && !pending && Date.now() - stableSince > 9000) break;
  }
  log("agent_done");
  await sleep(1500);
  const link = await page.evaluate(() => {
    const t = (window as any).term; const buf = t.buffer.active; const re = /https?:\/\/[^\s│┃]+preview\.box\.upstash\.com[^\s│┃]*/;
    for (let row = buf.length - 1; row >= 0; row--) {
      const line = buf.getLine(row); if (!line) continue; const text = line.translateToString(true); const m = text.match(re);
      if (m) { const r = document.querySelector(".xterm-screen")!.getBoundingClientRect(); const cw = r.width / t.cols, ch = r.height / t.rows; const vrow = row - buf.viewportY; const col = m.index!;
        return { url: m[0], row: vrow, col, len: m[0].length, x: r.left + (col + Math.min(m[0].length, 40) / 2) * cw, y: r.top + (vrow + 0.5) * ch, cw, ch }; }
    }
    return null;
  });
  log("link", link);
  await sleep(2500);
  log("rec_stop_request");
  recording = await handle.stop();
} catch (e) {
  log("error", String(e));
  try { recording = await box.browser.recordings.stop(); } catch {}
}
log("rec_stopped", { startedAt: recording?.startedAt, durationMs: recording?.durationMs, reason: recording?.stoppedReason });
fs.mkdirSync("full", { recursive: true });
fs.writeFileSync(`full/${name}.json`, JSON.stringify({ name, boxId: BOX_ID, recording, events, geom, linkXY: events.find((e) => e.event === "link")?.data ?? null }, null, 2));
if (recording?.id) { const file = await box.browser.recordings.download(recording.id, { path: `full/${name}.mp4` }); log("downloaded", file); }
await browser.close();
