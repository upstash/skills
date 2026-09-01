---
name: upstash-box-js
description: Work with the @upstash/box TypeScript/JavaScript SDK for sandboxed cloud containers with AI agents, shell, filesystem, git, cron schedules, snapshots, and a headless browser. Use when building with Upstash Box, creating a sandbox or isolated environment to run untrusted or agent-generated code, running AI coding agents in containers, giving an agent a cloud dev environment with a shell and repository, browser automation from a box, scheduling recurring jobs inside a box, saving and restoring snapshots, or orchestrating parallel boxes.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

# @upstash/box SDK

Sandboxed cloud containers with built-in AI agents, shell, filesystem, git, cron schedules, and an optional headless browser.

The Python SDK (`upstash-box`) mirrors this API with snake_case names — see the
`upstash-box-py` skill for the Python spelling of everything below.

## Install & Setup

```bash
npm install @upstash/box
npm install zod   # peer dependency, only needed for responseSchema / browser schemas
```

Set `UPSTASH_BOX_API_KEY` env var or pass `apiKey` to constructors.

Anonymous telemetry headers are sent by default. Opt out with the
`UPSTASH_DISABLE_TELEMETRY` env var, or `enableTelemetry: false` in the config
(the only option on runtimes without `process.env`, e.g. Cloudflare Workers).

## Box Lifecycle

```ts
import { Box, Agent, ClaudeCode, BoxApiKey } from "@upstash/box"

// Create with agent + git + env vars
const box = await Box.create({
  name: "my-box",
  runtime: "node", // "node" | "python" | "golang" | "ruby" | "rust" (+ "-alpine" variants)
  size: "small",   // "small" (2 CPU/4GB) | "medium" (4/8) | "large" (8/16)
  labels: ["beta", "x-team"], // max 5, ≤20 chars each
  keepAlive: true,            // don't idle-pause the box
  initCommand: "npm install && npm run dev", // keep-alive boxes only
  browser: true,              // provision headless Chromium for box.browser
  agent: {
    harness: Agent.ClaudeCode, // Agent.Codex | Agent.OpenCode | Agent.Cursor | Agent.Custom
    model: ClaudeCode.Sonnet_4_5,
    // apiKey options:
    //   omit          → server decides which key to use
    //   BoxApiKey.UpstashKey  → use Upstash-provided LLM key
    //   BoxApiKey.StoredKey   → use key previously stored via Upstash Console
    //   "sk-..."      → direct API key string
    apiKey: BoxApiKey.UpstashKey,
  },
  git: { // all fields optional
    token: process.env.GITHUB_TOKEN, // alternatively link your GitHub account via Upstash Console
    userName: "Bot",
    userEmail: "bot@example.com",
  },
  env: { DATABASE_URL: "..." },
  skills: ["upstash/qstash-js/qstash-js"], // owner/repo/skill-name
  timeout: 600_000, // request timeout in ms
  debug: false,
})

// Reconnect, list, delete, pause/resume
// Box.get / Box.getByName take { apiKey, baseUrl, gitToken, timeout, debug }
const same = await Box.get(box.id, { gitToken: process.env.GITHUB_TOKEN })
const byName = await Box.getByName("my-box")
const all = await Box.list()
const beta = await Box.list({ label: "beta" }) // filter by label
await box.pause()
await box.resume()
await box.delete()  // irreversible
const { status } = await box.getStatus()

box.id; box.size; box.keepAlive; box.cwd; box.networkPolicy

// Init command (keep-alive boxes only — throws otherwise)
await box.setInitCommand("npm run dev")
const script = await box.getInitCommand()
await box.deleteInitCommand()

// Bulk delete (static, by ID)
await Box.delete({ boxIds: ["box_1", "box_2"] })
const { deleted } = await Box.deleteSnapshots({ snapshotIds: ["snap_1"] }) // omit ids → delete all
```

### Account-level env vars

Injected into every box you create.

```ts
await Box.setEnv("API_TOKEN", "secret")
const env = await Box.listEnv()          // values are masked
await Box.setAllEnv({ A: "1", B: "2" })  // full replace — unlisted keys are removed
await Box.deleteEnv("API_TOKEN")
```

## Agent Runs

```ts
import { z } from "zod"

// Structured output with Zod schema
const run = await box.agent.run({
  prompt: "Review the code for security issues",
  responseSchema: z.object({
    verdict: z.enum(["approved", "changes_requested"]),
    findings: z.array(z.object({
      severity: z.enum(["high", "medium", "low"]),
      file: z.string(),
      issue: z.string(),
    })),
  }),
  timeout: 120_000,
  maxRetries: 2,
  options: { maxTurns: 20, maxBudgetUsd: 1.0, effort: "high" }, // harness-specific
  onToolUse: (tool) => console.log(tool.name, tool.input),
  onToolResult: (result) => console.log(result.toolCallId, result.output),
})

run.status  // "running" | "completed" | "failed" | "cancelled" | "detached"
run.result  // typed from schema
run.cost    // { inputTokens, outputTokens, cachedInputTokens, computeMs, totalUsd }

// Attach files to a prompt (max 10 files, 10 MB each)
await box.agent.run({ prompt: "Describe this", files: ["./screenshot.png"] })
await box.agent.run({
  prompt: "Describe this",
  files: [{ data: base64, mediaType: "image/png", filename: "shot.png" }],
})

// Streaming — chunk is a discriminated union
const stream = await box.agent.stream({ prompt: "Build a REST API" })
for await (const chunk of stream) {
  if (chunk.type === "text-delta") process.stdout.write(chunk.text)
  if (chunk.type === "reasoning") process.stdout.write(chunk.text)
  if (chunk.type === "tool-call") console.log(chunk.toolName, chunk.input)
  if (chunk.type === "tool-result") console.log(chunk.output)
  if (chunk.type === "finish") console.log(chunk.output, chunk.usage, chunk.sessionId)
  // also: { type: "start", runId } | { type: "stats", cpuNs, memoryPeakBytes } | { type: "unknown" }
}
stream.status // "completed" after iteration finishes
stream.result // final output

// stream() takes the same prompt/files/options/timeout/onToolUse/onToolResult as run().
// It has no responseSchema, maxRetries, or webhook — use run() for those.

// Fire-and-forget with webhook
await box.agent.run({
  prompt: "Run tests",
  webhook: { url: "https://example.com/hook", headers: { Authorization: "Bearer ..." } },
})
```

### Agent options (per harness)

`options` is forwarded to the harness — the accepted keys depend on which one
the box runs. Typing the box (`Box.create<Agent.ClaudeCode>({...})`) narrows
`options` to that harness's shape.

```ts
// Agent.ClaudeCode → ClaudeCodeAgentOptions
{
  maxTurns: 20,
  maxBudgetUsd: 1.0,
  effort: "high",                 // "low" | "medium" | "high" | "max"
  thinking: { type: "adaptive" }, // | { type: "enabled", budgetTokens: 8000 } | { type: "disabled" }
  disallowedTools: ["Bash"],
  agents: { reviewer: { /* custom subagent definition */ } },
  promptSuggestions: false,
  fallbackModel: "anthropic/claude-sonnet-4-5",
  systemPrompt: "You are a release engineer.",
}

// Agent.Codex → CodexAgentOptions
{
  modelReasoningEffort: "high",   // "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
  modelReasoningSummary: "concise", // "auto" | "concise" | "detailed" | "none"
  personality: "pragmatic",       // "friendly" | "pragmatic" | "none"
  webSearch: "live",              // or true / false
}

// Agent.OpenCode → OpenCodeAgentOptions
{
  reasoningEffort: "high",        // "low" | "medium" | "high"
  textVerbosity: "low",           // "low" | "medium" | "high"
  reasoningSummary: "auto",       // "auto" | "concise" | "detailed" | "none"
  thinking: { type: "enabled", budgetTokens: 8000 }, // Anthropic-backed models
}

// Agent.Cursor → free-form Record<string, unknown>
```

Codex keys are converted to the backend's snake_case for you — always write them camelCase.

### Harness & model

`harness` is required (`provider` / `runner` are deprecated aliases). Model
enums: `ClaudeCode`, `OpenAICodex`, `OpenCodeModel`, `CursorModel`,
`OpenRouterModel`, `VercelModel` — or any plain provider-prefixed string.

```ts
import { ClaudeCode, OpenAICodex, OpenCodeModel, CursorModel, OpenRouterModel, VercelModel } from "@upstash/box"

ClaudeCode.Opus_5        // "anthropic/claude-opus-5"
ClaudeCode.Sonnet_5      // "anthropic/claude-sonnet-5"
OpenAICodex.GPT_5_6      // "openai/gpt-5.6"
OpenCodeModel.Claude_Opus_5   // "opencode/claude-opus-5"
CursorModel.Composer_2_5 // "cursor/composer-2.5"
OpenRouterModel.Claude_Opus_5 // "openrouter/anthropic/claude-opus-5"
VercelModel.GPT_5_5      // "vercel/openai/gpt-5.5"

// Read / change the box's harness + model at runtime
const { harness, model } = box.modelConfig
await box.configureModel("anthropic/claude-opus-4-8")

// Which harness a bare model string implies (prefix-based)
import { inferDefaultProvider } from "@upstash/box"
inferDefaultProvider("openai/gpt-5.6")   // Agent.Codex
inferDefaultProvider("cursor/default")   // Agent.Cursor
```

### Custom harness

Run your own agent binary inside the box instead of a managed harness.

```ts
import { Box, Agent, runCustomHarness } from "@upstash/box"

const box = await Box.create({
  agent: {
    harness: Agent.Custom,
    model: "my-agent",                                  // label forwarded to the process
    // command: name on PATH, or an absolute path under /workspace/home or /home/boxuser
    customHarness: { command: "node", args: ["/workspace/home/agent.js"], protocol: "box-sse-v1" },
  },
})
await box.configureCustomHarness({ command: "node", args: ["/workspace/home/agent2.js"] })

// Inside the box, agent.js emits box-sse-v1 events. The backend appends
// `-p <prompt> --model <model> --stream` (+ `--session <id>` when resuming).
await runCustomHarness(async ({ prompt, model, sessionId, stream, args }, emit) => {
  emit.text("working...")
  emit.reasoning("thinking out loud")            // -> `thinking` event
  emit.tool({ toolCallId: "1", name: "Bash", input: { command: "ls" } })
  emit.toolResult({ toolCallId: "1", output: "file.txt" })
  emit.emit("custom-event", { any: "payload" })  // raw escape hatch
  // emit.error(new Error("boom")) to fail the run
  return {
    output: "done",
    inputTokens: 10,
    outputTokens: 5,
    cachedInputTokens: 0,
    totalCostUsd: 0.01,
    sessionId,
  } // returning a plain string is shorthand for { output }
})
```

## Run Fields

Every `run` (agent, command, or code) returns a `Run<T>`:

```ts
const run = await box.exec.command("npm test")
run.id        // run ID
run.status    // "completed" | "failed" | ...
run.result    // stdout on success, stderr on failure (or typed T with responseSchema)
run.stdout    // raw stdout (command/code runs)
run.stderr    // raw stderr (command/code runs)
run.exitCode  // number | null (null for agent runs)
run.cost      // { inputTokens, outputTokens, cachedInputTokens, computeMs, totalUsd }

await run.cancel()          // cancel a running run
const logs = await run.logs() // [{ timestamp, level, message }]

// Box-level history
const entries = await box.logs({ limit: 100, offset: 0 }) // [{ timestamp, level, source, message }]
const runs = await box.listRuns()              // backend run records, newest first
```

## Shell Execution

```ts
// Run commands
const run = await box.exec.command("echo hello && ls -la")

// Run code snippets — lang: "js" | "ts" | "python"
const run2 = await box.exec.code({ code: "console.log(1+1)", lang: "js", timeout: 10_000 })

// Streaming shell / code
const stream = await box.exec.stream("npm run build")
const stream2 = await box.exec.streamCode({ code: "print('hi')", lang: "python" })
for await (const chunk of stream) {
  // chunk: { type: "output", data } | { type: "exit", exitCode, cpuNs }
}
```

## Filesystem

```ts
await box.files.write({ path: "/workspace/home/app.js", content: "console.log('hi')" })
const content = await box.files.read("/workspace/home/app.js")
const entries = await box.files.list("/workspace/home") // [{ name, path, size, is_dir, mod_time }]

// Binary files — use encoding: "base64" for read and write
await box.files.write({ path: "/workspace/home/image.png", content: base64String, encoding: "base64" })
const b64 = await box.files.read("/workspace/home/image.png", { encoding: "base64" })

// Upload local files
await box.files.upload([{ path: "./local/file.txt", destination: "/workspace/home/file.txt" }])

// Download — `folder` is a path INSIDE the box; files land in ./<basename>
await box.files.download({ folder: "src" }) // → ./src
await box.files.download()                  // whole cwd → ./workspace
```

## cd / Working Directory

The SDK tracks `cwd` client-side. All operations (exec, files, git, agent) run relative to it.

```ts
box.cwd // current working directory (starts at /workspace/home)
await box.cd("my-repo")     // relative to current cwd
await box.cd("/workspace/home/other") // absolute path
```

## Git

Clones land inside the box's isolated container, never on the caller's machine. Cloned
code is data until something runs it — treat an untrusted repo as untrusted input, and
pair it with a restrictive `networkPolicy` (see below) before running its build or tests.

Every git call except `clone` runs in the box's current directory, so `cd` into the
clone first. At the workspace root there is no repository, and `status` comes back
empty, which reads as a clean tree.

```ts
await box.git.clone({ repo: "github.com/org/repo", branch: "main" })
await box.git.clone({ repo: "github.com/org/repo", depth: 1 }) // shallow clone
await box.git.clone({ repo: "github.com/org/repo", folder: "my-app" }) // destination
await box.cd("repo") // the clone lands in a directory named after the repo

const status = await box.git.status()
const diff = await box.git.diff()
const { sha } = await box.git.commit({
  message: "fix: resolve bug",
  authorName: "Jane Doe",      // optional per-commit override
  authorEmail: "jane@example.com",
})
await box.git.push({ branch: "feature/fix" })

await box.git.checkout({ branch: "release/v2" })
const pr = await box.git.createPR({ title: "Fix bug", body: "...", base: "main" })
// pr: { url, number, title, base }

// Update the box-wide git identity
const cfg = await box.git.updateConfig({ userName: "Bot", userEmail: "bot@example.com" })
// cfg: { git_user_name, git_user_email }

// Arbitrary git commands. Check exit_code: 128 means the cwd is not a repository.
const { output, exit_code } = await box.git.exec({ args: ["log", "--oneline", "-5"] })
```

## Schedules

Cron tasks on a box — shell commands or agent prompts. Available on `Box` and `EphemeralBox`. Cron is UTC.

```ts
const execSchedule = await box.schedule.exec({
  cron: "* * * * *",
  command: ["bash", "-c", "date >> /workspace/home/cron.log"],
  folder: "/workspace/home",            // optional cwd override
  webhookUrl: "https://example.com/hook",
  webhookHeaders: { Authorization: "Bearer ..." },
})

const agentSchedule = await box.schedule.agent({
  cron: "0 9 * * *",
  prompt: "Run the test suite and fix any failures",
  folder: "/workspace/home/repo",       // optional cwd override
  model: "anthropic/claude-sonnet-5",   // optional override
  options: { maxBudgetUsd: 1.0, effort: "high" },
  timeout: 300_000,
  webhookUrl: "https://example.com/hook",
  webhookHeaders: { Authorization: "Bearer ..." },
})

const schedules = await box.schedule.list()
const one = await box.schedule.get(agentSchedule.id)

// Partial update — omitted fields keep their value, "" / [] / {} clear a field,
// `options: null` clears agent options. The schedule's type cannot change.
// Updatable: cron, command, prompt, folder, model, options, timeout, webhookUrl, webhookHeaders
await box.schedule.update(agentSchedule.id, { cron: "0 18 * * *", webhookUrl: "" })

await box.schedule.pause(agentSchedule.id)
await box.schedule.resume(agentSchedule.id)
await box.schedule.delete(agentSchedule.id)
```

## Snapshots

```ts
// Snapshot — checkpoint workspace state
const snap = await box.snapshot({ name: "after-setup" })
// snap: { id, name, box_id, size_bytes, status, created_at }

// fromSnapshot takes a BoxConfig: name, labels, size, keepAlive, initCommand, runtime,
// agent, git, env, attachHeaders, networkPolicy. It does NOT send `browser`, `skills`,
// or `mcpServers` (the Python SDK does) — add skills with box.skills.add() afterwards,
// and use Box.create({ browser: true }) when you need Chromium.
const restored = await Box.fromSnapshot(snap.id, {
  size: "medium",
  keepAlive: true,
  // git identity is forwarded, not just the token
  git: { token: process.env.GITHUB_TOKEN, userName: "Bot", userEmail: "bot@example.com" },
  env: { DATABASE_URL: "..." },
})
const snaps = await box.listSnapshots()
await box.deleteSnapshot(snap.id)
```

## Browser

Create the box with `browser: true` to drive a headless Chromium. Tab management
lives on `box.browser`; every page operation lives on the `Tab` handle.
`extract` / `observe` / `act(instruction)` are AI-powered and metered;
`act(action)` replays an already-resolved action with no LLM call and no tokens.

```ts
import { z } from "zod"

const box = await Box.create({
  browser: true,
  agent: { harness: Agent.ClaudeCode, model: ClaudeCode.Sonnet_4_5 },
})

// Tabs
const tab = await box.browser.tab.create("https://example.com", { waitUntil: "load", timeout: 30_000 })
const tabs = await box.browser.listTabs()
const again = box.browser.getTab(tab.id) // no network call
tab.id; tab.url; tab.title                // handle metadata, no network call

// Page operations
const content = await tab.goto("https://news.ycombinator.com") // { title, url, text, links }
const current = await tab.content()
const png = await tab.screenshot()                                  // Uint8Array
const b64 = await tab.screenshot({ type: "base64", fullPage: true })

// AI operations (metered) — extract/observe/act take an optional { model } override,
// defaulting to the box's model (or anthropic/claude-sonnet-4-5 when it has none)
const data = await tab.extract(
  "Top story title and points",
  z.object({ title: z.string(), points: z.number() }),
  { model: "anthropic/claude-sonnet-4-5" },
)
// observe → actionable elements, each carrying a replayable method + arguments
const { elements } = await tab.observe("What can I click?", { model: "openai/gpt-5.6" })
// elements: [{ description, selector?, url?, method?, arguments? }]

const acted = await tab.act("Click the first headline")
// acted: { success, message, actionDescription, actions, cacheStatus?, inputTokens, outputTokens }

// Replay a pre-resolved action — no LLM call, no tokens, no model provider key.
// Takes a BrowserAction (= BrowserObserveElement | BrowserActAction); `model` is
// ignored in this form, and an action without a `selector` throws.
await tab.act(elements[0])
await tab.act(acted.actions[0])

// Live view + raw CDP
const liveUrl = await tab.liveViewUrl()      // view-only screencast page/iframe
const cdpUrl = await box.browser.cdpUrl()    // wss://…?token=… — no extra auth wiring
await tab.close()

// Drive the same browser from Playwright / Puppeteer / Stagehand
import { chromium } from "playwright-core"
const remote = await chromium.connectOverCDP(cdpUrl)
const context = remote.contexts()[0] ?? (await remote.newContext())
const page = context.pages()[0] ?? (await context.newPage())
await page.goto("https://example.com")
// Stagehand: new Stagehand({ env: "LOCAL", localBrowserLaunchOptions: { cdpUrl } })

// Session recordings (HLS playback URL + MP4 download, chapter markers).
// One active recording per box; captures all tabs and follows the foreground.
// Auto-stops after maxDurationSeconds or ~3 minutes of no on-screen activity.
const handle = await box.browser.recordings.start({ maxDurationSeconds: 600 }) // default & max 600
const recording = await handle.stop()
// or stop whatever is recording on the box, without a handle:
// const recording = await box.browser.recordings.stop()
// recording: { id, boxId, status, startedAt, endedAt, durationMs, sizeBytes, mp4SizeBytes,
//              segmentCount, markers, stoppedReason, maxDurationSeconds, expiresAt, playlistUrl }
// markers: { type: "tab_switch", atMs, endMs?, label?, tabId? }
// expiresAt is epoch ms (videos retained 14 days); playlistUrl is API-served — fetch it
// with an `X-Box-Api-Key: <apiKey>` header (hls.js / Safari / ffplay).
const all = await box.browser.recordings.list()
const one = await box.browser.recordings.get(recording.id)

// Download the video to a local file — returns the path written.
// Defaults to ./box-recording-<id>.mp4 (.ts for recordings captured before MP4 support).
const file = await box.browser.recordings.download(recording.id)
await box.browser.recordings.download(recording.id, { path: "./out/demo.mp4" })
```

### Multi-step browser goals

`tab.run()` — the autonomous multi-step browser agent — was **removed in 0.7.0**,
along with the `BrowserRunOptions` / `BrowserRunResult` / `BrowserRunStep` types
(Stagehand v4 dropped the underlying agent primitive). The DOM-aware browser now
exposes `observe`, `act`, and `extract` only. Three replacements:

**1. Drive your own loop** — resolve steps once with `observe`, then replay them
with `act(action)` so the model stays out of the hot path; `extract` is the stop check.

```ts
const { elements } = await tab.observe("the product links in the listing")
const actions = elements.filter((e) => e.selector)

for (const action of actions.slice(0, 5)) {
  await tab.goto(START) // deterministic reset, no browser-AI tokens
  await tab.act(action) // replay the resolved click: no LLM, no tokens
  const item = await tab.extract("title and price", z.object({ title: z.string() }))
}
```

**2. Hand the goal to the in-box agent** — `browser: true` auto-wires the
chrome-devtools MCP (Chromium already warmed on 127.0.0.1:9222) into the box's
coding agent, so `box.agent.run({ prompt })` drives the browser itself and iterates
until done. No `tab.create()` needed first. This bills coding-agent model tokens
rather than browser-AI metering, and needs an agent harness + key.

**3. Connect over CDP** with Playwright / Puppeteer via `box.browser.cdpUrl()` when
the flow is fully deterministic.

## EphemeralBox

Lightweight, short-lived boxes (max 3 days). Supports `exec`, `files`, `schedule`, `cd`, network policy, and snapshots. No agent, git, skills, labels namespace, browser, or public URLs.

```ts
import { EphemeralBox } from "@upstash/box"

const ebox = await EphemeralBox.create({
  name: "scratch-box",
  runtime: "python",
  size: "small",
  ttl: 3600,  // seconds, max 259200 (3 days), default 259200
  env: { API_KEY: "..." },
  labels: ["scratch"], // settable at create time; filter via Box.list({ label })
  networkPolicy: { mode: "deny-all" },
  attachHeaders: { "api.stripe.com": { Authorization: "Bearer sk_live_..." } },
})

ebox.networkPolicy

ebox.expiresAt // unix timestamp when auto-deleted
await ebox.exec.command("python -c 'print(1+1)'")
await ebox.exec.code({ code: "print('hi')", lang: "python" })
await ebox.files.write({ path: "/workspace/home/data.json", content: "{}" })
await ebox.schedule.exec({ cron: "* * * * *", command: ["bash", "-c", "date"] })
await ebox.cd("subdir")
const snap = await ebox.snapshot({ name: "checkpoint" })
await ebox.listSnapshots()
await ebox.deleteSnapshot(snap.id)
const { status } = await ebox.getStatus()
await ebox.delete()

// Restore from snapshot
const ebox2 = await EphemeralBox.fromSnapshot(snap.id, { ttl: 7200 })

// Statics: EphemeralBox.delete({ boxIds }) and EphemeralBox.deleteSnapshots() are the
// Box ones. EphemeralBox.getByName() is Box.get — it returns a full `Box`, not an
// `EphemeralBox` (quirk mirrored in the Python SDK).
```

## Public URLs

Expose box ports as public URLs with optional auth.

```ts
const publicURL = await box.getPublicURL(3000)
// publicURL: { url: "https://{id}-3000.preview.box.upstash.com", port }

const authed = await box.getPublicURL(3000, { bearerToken: true })
// authed: { url, port, token }

const basic = await box.getPublicURL(3000, { basicAuth: true })
// basic: { url, port, username, password }

const { publicURLs } = await box.listPublicURLs()
await box.deletePublicURL(3000)
```

## Skills

Install agent skills from the Context7 registry. Format: `owner/repo/skill-name`.

An installed skill becomes instructions for the box's agent, so pin skills to owners you
trust the same way you would a dependency. Skills resolve from the registry at box
creation, not from arbitrary URLs, and they only ever run inside the box's container.

```ts
const box = await Box.create({ skills: ["upstash/qstash-js/qstash-js"] })

await box.skills.add("upstash/workflow-js/workflow-js")
const enabled = await box.skills.list()
await box.skills.remove("upstash/workflow-js/workflow-js")
```

## Labels

```ts
const labels = await box.labels.add("prod")     // returns the updated set
await box.labels.remove("beta")
const current = await box.labels.list()
const prodBoxes = await Box.list({ label: "prod" })
```

## Network Policy & Outbound Headers

```ts
const box = await Box.create({
  // mode: "allow-all" (default) | "deny-all" | "custom"
  // custom takes any of allowedDomains / allowedCidrs / deniedCidrs
  networkPolicy: {
    mode: "custom",
    allowedDomains: ["api.example.com"],
    allowedCidrs: ["203.0.113.0/24"],
    deniedCidrs: ["10.0.0.0/8"],
  },

  // Inject secret headers into matching outbound HTTPS requests (write-only, never read back)
  attachHeaders: {
    "api.stripe.com": { Authorization: "Bearer sk_live_..." },
    "*.example.com": { "X-Custom-Token": "secret123" },
  },
})

box.networkPolicy
await box.updateNetworkPolicy({ mode: "deny-all" })
```

## MCP Servers

Attach MCP servers to the box agent. An attached server supplies tools the agent can call,
so use servers you control or trust — and keep `networkPolicy` restrictive when the agent
also handles untrusted input.

```ts
const box = await Box.create({
  agent: { harness: Agent.ClaudeCode, model: ClaudeCode.Sonnet_4_5 },
  mcpServers: [
    { name: "fs", package: "@modelcontextprotocol/server-filesystem", args: [] },
    { name: "custom", url: "<your-mcp-server-url>", headers: { Authorization: "..." } },
  ],
})
```

## Errors & SSH

```ts
import { BoxError } from "@upstash/box"

try {
  await box.agent.run({ prompt: "..." })
} catch (e) {
  if (e instanceof BoxError) console.error(e.message, e.statusCode)
}
```

Shell into a box directly (Box API key is the SSH password):

```bash
ssh <box-id>@us-east-1.box.upstash.com
```

## Gotchas

- Default working directory is `/workspace/home`, not `/home` or `/`
- `box.cd()` is client-side tracking — it validates the path exists but doesn't change the box's shell cwd. All SDK methods use it automatically.
- `agent.harness` is required; `provider` / `runner` still work but are deprecated
- There is **no** `box.fork()` — it was removed from the SDK. Snapshot the box and use `Box.fromSnapshot()` instead.
- `EphemeralBox` does NOT support `agent`, `git`, `skills`, `browser`, or public URLs — use full `Box` for those (it does support `schedule` and snapshots)
- `run.exitCode` is `null` for agent runs, only available for exec commands
- `run.result` is stdout on success and stderr on failure — a command that exits 0 writing only to stderr yields `""`; read `run.stderr` for it
- `files.download({ folder })` takes a path *inside the box*; output lands in `./<basename>` locally
- `box.browser` requires a box created with `browser: true`
- There is **no** `tab.run()` — the autonomous browser agent was removed in 0.7.0. Loop `observe` + `act(action)` + `extract` yourself, hand the goal to the in-box agent, or drive Playwright over `cdpUrl()`
- `tab.act(action)` (replaying an `observe()` result) costs no tokens and needs no model provider key; only `act(instruction)` with a string is metered
- `getInitCommand` / `setInitCommand` / `deleteInitCommand` throw unless the box was created with `keepAlive: true`
- `box.delete()` is irreversible — snapshot first if you need the state
- Git operations require `git.token` in `BoxConfig` for private repos and PRs
- `Box.fromSnapshot()` creates a new box — it does not modify the original, and it does not forward `browser`, `skills`, or `mcpServers` from the config you pass
- `EphemeralBox` has no `updateNetworkPolicy` — set `networkPolicy` at create time
- `responseSchema` and browser `schema` need `zod` installed (peer dependency, v3 or v4)
- All `timeout` values are milliseconds
