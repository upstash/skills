# upstash-box Python SDK

Sandboxed cloud containers with built-in AI agents, shell, filesystem, git, cron schedules, and an optional headless browser.

Mirrors the `@upstash/box` TypeScript SDK (`upstash-box-js` skill) with
snake_case names; the intentional differences are listed under Gotchas.

## Install & Setup

```bash
pip install upstash-box
```

Set `UPSTASH_BOX_API_KEY` env var or pass `api_key` to constructors.

The SDK ships both a synchronous `Box` (used in the examples below) and an
asynchronous `AsyncBox` (`box = await AsyncBox.create(...)`, `await box.agent.run(...)`).
The async surface is identical with `await` and `async for`.

Anonymous telemetry headers are sent with every request; opt out with the
`UPSTASH_DISABLE_TELEMETRY` env var.

## Box Lifecycle

```python
import os
from upstash_box import Box, Agent, ClaudeCode, BoxApiKey

# Create with agent + git + env vars
box = Box.create(
    name="my-box",
    runtime="node",  # "node" | "python" | "golang" | "ruby" | "rust" (+ "-alpine" variants)
    size="small",  # "small" (2 CPU/4GB) | "medium" (4/8) | "large" (8/16)
    labels=["beta", "x-team"],  # max 5, <=20 chars each
    keep_alive=True,  # don't idle-pause the box
    init_command="npm install && npm run dev",  # keep-alive boxes only
    browser=True,  # provision headless Chromium for box.browser
    agent={
        "harness": Agent.CLAUDE_CODE,  # Agent.CODEX | Agent.OPEN_CODE | Agent.CURSOR | Agent.CUSTOM
        "model": ClaudeCode.SONNET_4_5,  # or a plain string "anthropic/claude-sonnet-4-5"
        # api_key options:
        #   omit                    → server decides which key to use
        #   BoxApiKey.UPSTASH_KEY   → use Upstash-provided LLM key
        #   BoxApiKey.STORED_KEY    → use key previously stored via Upstash Console
        #   "sk-..."                → direct API key string
        "api_key": BoxApiKey.UPSTASH_KEY,
    },
    git={  # all fields optional
        "token": os.environ["GITHUB_TOKEN"],  # or link your GitHub account via Upstash Console
        "user_name": "Bot",
        "user_email": "bot@example.com",
    },
    env={"DATABASE_URL": "..."},
    skills=["upstash/qstash-js/qstash-js"],  # owner/repo/skill-name
    timeout=600_000,  # request timeout in ms
    debug=False,
)

# Reconnect, list, delete, pause/resume
# Box.get / Box.get_by_name take api_key, base_url, git_token, timeout, debug
same = Box.get(box.id, git_token="ghp_...")  # git_token, not git={...}, when reconnecting
by_name = Box.get_by_name("my-box")
all_boxes = Box.list()
beta = Box.list(label="beta")  # filter by label
box.pause()
box.resume()
box.delete()  # irreversible
status = box.get_status()["status"]

box.id, box.size, box.keep_alive, box.cwd, box.network_policy

# Init command (keep-alive boxes only — raises otherwise)
box.set_init_command("npm run dev")
script = box.get_init_command()
box.delete_init_command()

# Bulk delete (classmethods, by ID)
Box.delete_boxes(box_ids=["box_1", "box_2"])  # JS static `delete` is `delete_boxes` here
Box.delete_snapshots(snapshot_ids=["snap_1"])  # omit ids → delete all
```

### Account-level env vars

Injected into every box you create.

```python
Box.set_env("API_TOKEN", "secret")
env = Box.list_env()  # values are masked
Box.set_all_env({"A": "1", "B": "2"})  # full replace — unlisted keys are removed
Box.delete_env("API_TOKEN")
```

## Agent Runs

```python
from pydantic import BaseModel

# Structured output with a Pydantic model (or a raw JSON-schema dict)
class Finding(BaseModel):
    severity: str  # "high" | "medium" | "low"
    file: str
    issue: str

class Review(BaseModel):
    verdict: str  # "approved" | "changes_requested"
    findings: list[Finding]

run = box.agent.run(
    prompt="Review the code for security issues",
    response_schema=Review,
    timeout=120_000,
    max_retries=2,
    options={"max_turns": 20, "max_budget_usd": 1.0, "effort": "high"},  # harness-specific
    on_tool_use=lambda tool: print(tool["name"], tool["input"]),
    on_tool_result=lambda result: print(result["tool_call_id"], result["output"]),
)

run.status   # "running" | "completed" | "failed" | "cancelled" | "detached"
run.result   # typed from schema (a Review instance)
run.cost     # RunCost(input_tokens, output_tokens, cached_input_tokens, compute_ms, total_usd)

# Attach files to a prompt (max 10 files, 10 MB each)
box.agent.run(prompt="Describe this", files=["./screenshot.png"])
box.agent.run(
    prompt="Describe this",
    files=[{"data": b64, "media_type": "image/png", "filename": "shot.png"}],
)

# Streaming — chunks are typed dataclasses discriminated on `.type`
stream = box.agent.stream(prompt="Build a REST API")
for chunk in stream:
    if chunk.type == "text-delta":
        print(chunk.text, end="")
    elif chunk.type == "reasoning":
        print(chunk.text, end="")
    elif chunk.type == "tool-call":
        print(chunk.tool_name, chunk.input)
    elif chunk.type == "tool-result":
        print(chunk.output)
    elif chunk.type == "finish":
        print(chunk.usage.input_tokens, chunk.usage.cached_input_tokens, chunk.session_id)
    # also: StartChunk(run_id) | StatsChunk(cpu_ns, memory_peak_bytes) | UnknownChunk(event, data)
    # FinishChunk also carries .output (the final text)

# stream() takes the same prompt/files/options/timeout/on_tool_use/on_tool_result as run().
# It has no response_schema, max_retries, or webhook — use run() for those.

# Fire-and-forget with webhook
box.agent.run(
    prompt="Run tests",
    webhook={"url": "https://example.com/hook", "headers": {"Authorization": "Bearer ..."}},
)
```

### Agent options (per harness)

`options` is forwarded to the harness — the accepted keys depend on which one
the box runs. Keys are snake_case in Python; the SDK converts **top-level** keys
to each harness's backend casing (Claude Code / OpenCode → camelCase, Codex →
snake_case). Keys inside nested dicts are sent verbatim.

```python
# Agent.CLAUDE_CODE → ClaudeCodeAgentOptions
{
    "max_turns": 20,
    "max_budget_usd": 1.0,
    "effort": "high",  # "low" | "medium" | "high" | "max"
    # nested dicts are forwarded verbatim — keep `budgetTokens` camelCase here
    "thinking": {"type": "adaptive"},  # or {"type": "enabled", "budgetTokens": 8000} / {"type": "disabled"}
    "disallowed_tools": ["Bash"],
    "agents": {"reviewer": {...}},  # custom subagent definitions
    "prompt_suggestions": False,
    "fallback_model": "anthropic/claude-sonnet-4-5",
    "system_prompt": "You are a release engineer.",
}

# Agent.CODEX → CodexAgentOptions
{
    "model_reasoning_effort": "high",  # "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
    "model_reasoning_summary": "concise",  # "auto" | "concise" | "detailed" | "none"
    "personality": "pragmatic",  # "friendly" | "pragmatic" | "none"
    "web_search": "live",  # or True / False
}

# Agent.OPEN_CODE → OpenCodeAgentOptions
{
    "reasoning_effort": "high",  # "low" | "medium" | "high"
    "text_verbosity": "low",  # "low" | "medium" | "high"
    "reasoning_summary": "auto",  # "auto" | "concise" | "detailed" | "none"
    "thinking": {"type": "enabled", "budgetTokens": 8000},  # Anthropic-backed models
}

# Agent.CURSOR → free-form dict
```

Unlike the JS generic `AgentOptions<TProvider>`, Python does not narrow
`options` by harness — the type is the union of all shapes plus a raw dict.

### Harness & model

`harness` is required. Model enums: `ClaudeCode`, `OpenAICodex`, `OpenCodeModel`,
`CursorModel`, `OpenRouterModel`, `VercelModel` — or any provider-prefixed string.

```python
from upstash_box import ClaudeCode, OpenAICodex, OpenCodeModel, CursorModel, OpenRouterModel, VercelModel

ClaudeCode.OPUS_5  # "anthropic/claude-opus-5"
ClaudeCode.SONNET_5  # "anthropic/claude-sonnet-5"
OpenAICodex.GPT_5_6  # "openai/gpt-5.6"
OpenCodeModel.CLAUDE_OPUS_5  # "opencode/claude-opus-5"
CursorModel.COMPOSER_2_5  # "cursor/composer-2.5"
OpenRouterModel.CLAUDE_OPUS_5  # "openrouter/anthropic/claude-opus-5"
VercelModel.GPT_5_5  # "vercel/openai/gpt-5.5"

# Read / change the box's harness + model at runtime
box.model_config  # {"harness": ..., "model": ...}
box.configure_model("anthropic/claude-opus-4-8")

# Which harness a bare model string implies (prefix-based)
from upstash_box import infer_default_provider

infer_default_provider("openai/gpt-5.6")  # Agent.CODEX
infer_default_provider("cursor/default")  # Agent.CURSOR
```

### Custom harness

Run your own agent process inside the box instead of a managed harness.

```python
import asyncio
from upstash_box import Agent, Box, CustomHarnessDone, run_custom_harness

box = Box.create(
    agent={
        "harness": Agent.CUSTOM,
        "model": "my-agent",  # label forwarded to the process
        # command: name on PATH, or an absolute path under /workspace/home or /home/boxuser
        "custom_harness": {
            "command": "python",
            "args": ["/workspace/home/agent.py"],
            "protocol": "box-sse-v1",  # default
        },
    },
)
box.configure_custom_harness({"command": "python", "args": ["/workspace/home/agent2.py"]})

# Inside the box, agent.py emits box-sse-v1 events. The backend appends
# `-p <prompt> --model <model> --stream` (+ `--session <id>` when resuming).
# ctx: CustomHarnessContext(prompt, model, stream, args, session_id)
async def handler(ctx, emit):
    emit.text("working...")
    emit.reasoning("thinking out loud")  # -> `thinking` event
    emit.tool({"tool_call_id": "1", "name": "Bash", "input": {"command": "ls"}})
    emit.tool_result({"tool_call_id": "1", "output": "file.txt"})
    emit.emit("custom-event", {"any": "payload"})  # raw escape hatch
    # emit.error("boom") to fail the run
    return CustomHarnessDone(
        output="done",
        input_tokens=10,
        output_tokens=5,
        cached_input_tokens=0,
        total_cost_usd=0.01,
        session_id=ctx.session_id,
    )  # returning a plain string is shorthand for CustomHarnessDone(output=...)

asyncio.run(run_custom_harness(handler))  # run_custom_harness is async; handler may be sync or async
```

## Run Fields

Every `run` (agent, command, or code) returns a `Run`:

```python
run = box.exec.command("npm test")
run.id         # run ID
run.status     # "completed" | "failed" | ...
run.result     # stdout on success, stderr on failure (or typed result with response_schema)
run.stdout     # raw stdout (command/code runs)
run.stderr     # raw stderr (command/code runs)
run.exit_code  # int | None (None for agent runs)
run.cost       # RunCost(input_tokens, output_tokens, cached_input_tokens, compute_ms, total_usd)

run.cancel()          # cancel a running run
logs = run.logs()     # [RunLog(timestamp, level, message)]

# Box-level history
entries = box.logs(limit=100, offset=0)  # [LogEntry(timestamp, level, source, message)]
runs = box.list_runs()         # backend run records, newest first
```

## Shell Execution

```python
# Run commands
run = box.exec.command("echo hello && ls -la")

# Run code snippets — lang: "js" | "ts" | "python"
run2 = box.exec.code(code="print(1 + 1)", lang="python", timeout=10_000)

# Streaming shell / code
stream = box.exec.stream("npm run build")
stream2 = box.exec.stream_code(code="print('hi')", lang="python")
for chunk in stream:
    # chunk: ExecOutputChunk(type="output", data) | ExecExitChunk(type="exit", exit_code, cpu_ns)
    ...
```

## Filesystem

```python
box.files.write(path="/workspace/home/app.py", content="print('hi')")
content = box.files.read("/workspace/home/app.py")
entries = box.files.list("/workspace/home")  # [FileEntry(name, path, size, is_dir, mod_time)]

# Binary files — use encoding="base64" for read and write
box.files.write(path="/workspace/home/image.png", content=base64_string, encoding="base64")
b64 = box.files.read("/workspace/home/image.png", encoding="base64")

# Upload local files
box.files.upload([{"path": "./local/file.txt", "destination": "/workspace/home/file.txt"}])

# Download — `folder` is a path INSIDE the box; files land in ./<basename>
box.files.download(folder="src")  # → ./src
box.files.download()  # whole cwd → ./workspace
```

## cd / Working Directory

The SDK tracks `cwd` client-side. All operations (exec, files, git, agent) run relative to it.

```python
box.cwd  # current working directory (starts at /workspace/home)
box.cd("my-repo")                  # relative to current cwd
box.cd("/workspace/home/other")    # absolute path
```

## Git

Clones land inside the box's isolated container, never on the caller's machine. Cloned
code is data until something runs it — treat an untrusted repo as untrusted input, and
pair it with a restrictive `network_policy` (see below) before running its build or tests.

Every git call except `clone` runs in the box's current directory, so `cd` into the
clone first. At the workspace root there is no repository, and `status` comes back
empty, which reads as a clean tree.

```python
box.git.clone(repo="github.com/org/repo", branch="main")
box.git.clone(repo="github.com/org/repo", depth=1)  # shallow clone
box.git.clone(repo="github.com/org/repo", folder="my-app")  # destination
box.cd("repo")  # the clone lands in a directory named after the repo

status = box.git.status()
diff = box.git.diff()
result = box.git.commit(  # GitCommitResult(sha, message)
    message="fix: resolve bug",
    author_name="Jane Doe",  # optional per-commit override
    author_email="jane@example.com",
)
box.git.push(branch="feature/fix")

box.git.checkout(branch="release/v2")
pr = box.git.create_pr(title="Fix bug", body="...", base="main")
# pr: PullRequest(url, number, title, base)

# Update the box-wide git identity
cfg = box.git.update_config(user_name="Bot", user_email="bot@example.com")
# cfg: GitConfigResult(git_user_name, git_user_email)

# Arbitrary git commands — returns the output string
output = box.git.exec(args=["log", "--oneline", "-5"])
```

## Schedules

Cron tasks on a box — shell commands or agent prompts. Available on `Box` and `EphemeralBox`. Cron is UTC.

```python
exec_schedule = box.schedule.exec(
    cron="* * * * *",
    command=["bash", "-c", "date >> /workspace/home/cron.log"],
    folder="/workspace/home",  # optional cwd override
    webhook_url="https://example.com/hook",
    webhook_headers={"Authorization": "Bearer ..."},
)

agent_schedule = box.schedule.agent(
    cron="0 9 * * *",
    prompt="Run the test suite and fix any failures",
    folder="/workspace/home/repo",  # optional cwd override
    model="anthropic/claude-sonnet-5",  # optional override
    options={"max_budget_usd": 1.0, "effort": "high"},
    timeout=300_000,
    webhook_url="https://example.com/hook",
    webhook_headers={"Authorization": "Bearer ..."},
)

schedules = box.schedule.list()
one = box.schedule.get(agent_schedule.id)

# Partial update — omitted args keep their value, "" / [] / {} clear a field,
# options=None clears agent options. The schedule's type cannot change.
# Updatable: cron, command, prompt, folder, model, options, timeout,
#            webhook_url, webhook_headers
box.schedule.update(agent_schedule.id, cron="0 18 * * *", webhook_url="")

box.schedule.pause(agent_schedule.id)
box.schedule.resume(agent_schedule.id)
box.schedule.delete(agent_schedule.id)
```

## Snapshots

```python
# Snapshot — checkpoint workspace state
snap = box.snapshot(name="after-setup")
# snap: Snapshot(id, name, box_id, size_bytes, status, created_at)

# from_snapshot takes the same BoxConfig kwargs as create (shared request body):
# name, labels, size, keep_alive, init_command, runtime, browser, agent, git, env,
# attach_headers, network_policy, skills, mcp_servers. Note the JS SDK's
# Box.fromSnapshot() drops browser / skills / mcpServers — Python forwards them.
restored = Box.from_snapshot(
    snap.id,
    size="medium",
    keep_alive=True,
    # the git identity is forwarded, not just the token
    git={"token": os.environ["GITHUB_TOKEN"], "user_name": "Bot", "user_email": "bot@example.com"},
    env={"DATABASE_URL": "..."},
)
snaps = box.list_snapshots()
box.delete_snapshot(snap.id)
```

## Browser

Create the box with `browser=True` to drive a headless Chromium. Tab management
lives on `box.browser`; every page operation lives on the tab handle.
`extract` / `observe` / `act(instruction)` are AI-powered and metered;
`act(action)` replays an already-resolved action with no LLM call and no tokens.

```python
from pydantic import BaseModel

box = Box.create(browser=True, agent={"harness": Agent.CLAUDE_CODE, "model": ClaudeCode.SONNET_4_5})

# Tabs
tab = box.browser.tab.create("https://example.com", wait_until="load", timeout=30_000)
tabs = box.browser.list_tabs()
again = box.browser.get_tab(tab.id)  # no network call
tab.id, tab.url, tab.title  # handle metadata, no network call

# Page operations
content = tab.goto("https://news.ycombinator.com")  # BrowserContent(title, url, text, links)
current = tab.content()
png = tab.screenshot()  # bytes
b64 = tab.screenshot(encoding="base64", full_page=True)

# AI operations (metered) — schema is a Pydantic model or a raw JSON-schema dict.
# extract / observe / act take an optional model= override, defaulting to the box's
# model (or anthropic/claude-sonnet-4-5 when it has none).
class Story(BaseModel):
    title: str
    points: int

data = tab.extract("Top story title and points", Story, model="anthropic/claude-sonnet-4-5")

# observe → actionable elements, each carrying a replayable method + arguments
elements = tab.observe("What can I click?", model="openai/gpt-5.6").elements
# elements: [BrowserObserveElement(description, selector, url, method, arguments)]

acted = tab.act("Click the first headline")
# BrowserActResult(success, message, action_description, actions, cache_status,
#                  input_tokens, output_tokens)

# Replay a pre-resolved action — no LLM call, no tokens, no model provider key.
# Pass a BrowserObserveElement or BrowserActAction instead of a string; `model` is
# ignored in this form, and an action without a `selector` raises BoxError.
tab.act(elements[0])
tab.act(acted.actions[0])

# Live view + raw CDP
live_url = tab.live_view_url()  # view-only screencast page/iframe
cdp_url = box.browser.cdp_url()  # wss://…?token=… — no extra auth wiring
tab.close()

# Drive the same browser from Playwright (pip install playwright)
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    remote = p.chromium.connect_over_cdp(cdp_url)
    context = remote.contexts[0] if remote.contexts else remote.new_context()
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://example.com")

# Session recordings (HLS playback URL + MP4 download, chapter markers).
# One active recording per box; captures all tabs and follows the foreground.
# Auto-stops after max_duration_seconds or ~3 minutes of no on-screen activity.
handle = box.browser.recordings.start(max_duration_seconds=600)  # default & max 600
recording = handle.stop()
# or stop whatever is recording on the box, without a handle:
# recording = box.browser.recordings.stop()
# BrowserRecording(id, box_id, status, started_at, ended_at, duration_ms, size_bytes,
#                  mp4_size_bytes, segment_count, markers, stopped_reason,
#                  max_duration_seconds, expires_at, playlist_url)
# markers: BrowserRecordingMarker(type="tab_switch", at_ms, end_ms, label, tab_id)
# expires_at is epoch ms (videos retained 14 days); playlist_url is API-served — fetch it
# with an `X-Box-Api-Key: <api_key>` header (hls.js / Safari / ffplay).
all_recordings = box.browser.recordings.list()
one_recording = box.browser.recordings.get(recording.id)

# Download the video to a local file — returns the path written.
# Defaults to ./box-recording-<id>.mp4 (.ts for recordings captured before MP4 support).
file = box.browser.recordings.download(recording.id)
box.browser.recordings.download(recording.id, path="./out/demo.mp4")
```

### Multi-step browser goals

`tab.run()` — the autonomous multi-step browser agent — was **removed**, along with
the `BrowserRunResult` / `BrowserRunStep` types (Stagehand v4 dropped the underlying
agent primitive). The browser now exposes `observe`, `act`, and `extract` only.
Three replacements:

**1. Drive your own loop** — resolve steps once with `observe`, then replay them
with `act(action)` so the model stays out of the hot path; `extract` is the stop check.

```python
class Product(BaseModel):
    title: str
    price: str

elements = tab.observe("the product links in the listing").elements
actions = [e for e in elements if e.selector]

for action in actions[:5]:
    tab.goto(START)   # deterministic reset, no browser-AI tokens
    tab.act(action)   # replay the resolved click: no LLM, no tokens
    item = tab.extract("title and price", Product)
```

**2. Hand the goal to the in-box agent** — `browser=True` auto-wires the
chrome-devtools MCP (Chromium already warmed on 127.0.0.1:9222) into the box's
coding agent, so `box.agent.run(prompt=...)` drives the browser itself and iterates
until done. No `tab.create()` needed first. This bills coding-agent model tokens
rather than browser-AI metering, and needs an agent harness + key.

**3. Connect over CDP** with Playwright via `box.browser.cdp_url()` when the flow is
fully deterministic.

## EphemeralBox

Lightweight, short-lived boxes (max 3 days). Supports `exec`, `files`, `schedule`,
`cd`, network policy, and snapshots. No `agent`, `git`, `skills`, `labels`
namespace, browser, or public URLs.

```python
from upstash_box import EphemeralBox

ebox = EphemeralBox.create(
    name="scratch-box",
    runtime="python",
    size="small",
    ttl=3600,  # seconds, max 259200 (3 days), default 259200
    env={"API_KEY": "..."},
    labels=["scratch"],  # settable at create time; filter via Box.list(label=...)
    network_policy={"mode": "deny-all"},
    attach_headers={"api.stripe.com": {"Authorization": "Bearer sk_live_..."}},
)

ebox.network_policy

ebox.expires_at  # unix timestamp when auto-deleted
ebox.exec.command("python -c 'print(1+1)'")
ebox.exec.code(code="print('hi')", lang="python")
ebox.files.write(path="/workspace/home/data.json", content="{}")
ebox.schedule.exec(cron="* * * * *", command=["bash", "-c", "date"])
ebox.cd("subdir")
snap = ebox.snapshot(name="checkpoint")
ebox.list_snapshots()
ebox.delete_snapshot(snap.id)
status = ebox.get_status()["status"]
ebox.delete()

# Restore from snapshot
ebox2 = EphemeralBox.from_snapshot(snap.id, ttl=7200)

# Statics: EphemeralBox.delete_boxes(box_ids=[...]) / EphemeralBox.delete_snapshots(...)
# are the Box ones. EphemeralBox.get_by_name() returns a full `Box`, not an
# `EphemeralBox` (quirk mirrored from the JS SDK).
# `AsyncEphemeralBox` is the async variant (`await AsyncEphemeralBox.create(...)`).
```

## Public URLs

Expose box ports as public URLs with optional auth.

```python
public_url = box.get_public_url(3000)
# public_url: PublicURL(url="https://{id}-3000.preview.box.upstash.com", port)

authed = box.get_public_url(3000, bearer_token=True)
# authed: PublicURL(url, port, token)

basic = box.get_public_url(3000, basic_auth=True)
# basic: PublicURL(url, port, username, password)

result = box.list_public_urls()  # {"public_urls": [PublicURL, ...]}
box.delete_public_url(3000)
```

## Skills

Install agent skills from the Context7 registry. Format: `owner/repo/skill-name`.

An installed skill becomes instructions for the box's agent, so pin skills to owners you
trust the same way you would a dependency. Skills resolve from the registry at box
creation, not from arbitrary URLs, and they only ever run inside the box's container.

```python
box = Box.create(skills=["upstash/qstash-js/qstash-js"])

box.skills.add("upstash/workflow-js/workflow-js")
enabled = box.skills.list()
box.skills.remove("upstash/workflow-js/workflow-js")
```

## Labels

```python
labels = box.labels.add("prod")  # returns the updated set
box.labels.remove("beta")
current = box.labels.list()
prod_boxes = Box.list(label="prod")
```

## Network Policy & Outbound Headers

```python
box = Box.create(
    # mode: "allow-all" (default) | "deny-all" | "custom"
    # custom takes any of allowed_domains / allowed_cidrs / denied_cidrs
    network_policy={
        "mode": "custom",
        "allowed_domains": ["api.example.com"],
        "allowed_cidrs": ["203.0.113.0/24"],
        "denied_cidrs": ["10.0.0.0/8"],
    },
    # Inject secret headers into matching outbound HTTPS requests (write-only, never read back)
    attach_headers={
        "api.stripe.com": {"Authorization": "Bearer sk_live_..."},
        "*.example.com": {"X-Custom-Token": "secret123"},
    },
)

box.network_policy
box.update_network_policy({"mode": "deny-all"})
```

## MCP Servers

Attach MCP servers to the box agent. An attached server supplies tools the agent can call,
so use servers you control or trust — and keep `network_policy` restrictive when the agent
also handles untrusted input.

```python
box = Box.create(
    agent={"harness": Agent.CLAUDE_CODE, "model": ClaudeCode.SONNET_4_5},
    mcp_servers=[
        {"name": "fs", "package": "@modelcontextprotocol/server-filesystem"},
        {"name": "custom", "url": "<your-mcp-server-url>", "headers": {"Authorization": "..."}},
    ],
)
```

## Errors & SSH

```python
from upstash_box import BoxError

try:
    box.agent.run(prompt="...")
except BoxError as e:
    print(e, e.status_code)
```

Shell into a box directly (Box API key is the SSH password):

```bash
ssh <box-id>@us-east-1.box.upstash.com
```

## Async client

The async client mirrors the sync API exactly — `await` the calls and use `async for` to stream.

```python
import asyncio
from upstash_box import AsyncBox, Agent

async def main():
    box = await AsyncBox.create(runtime="node", agent={"harness": Agent.CLAUDE_CODE})
    async with box:
        run = await box.agent.run(prompt="Set up a Next.js project")
        print(run.result)

        stream = await box.agent.stream(prompt="Build a REST API")
        async for chunk in stream:
            print(chunk)

        await box.delete()

asyncio.run(main())
```

`asyncio.gather` over many `AsyncBox.create(...)` / `box.agent.run(...)` calls runs boxes in parallel.

## Gotchas

- Public API option keys are **snake_case** in Python: `api_key`, `user_name`, `network_policy`, `response_schema`, `max_retries`, `on_tool_use`, `attach_headers`, and agent `options` like `max_turns`, `max_budget_usd`.
- Agent config takes **`harness`** (not the deprecated `provider`/`runner`) — `harness` is required.
- `response_schema` accepts a Pydantic `BaseModel` subclass (returns a typed instance) or a raw JSON-schema `dict` (returns a `dict`). Browser `schema` follows the same contract.
- Default working directory is `/workspace/home`, not `/home` or `/`.
- `box.cd()` is client-side tracking — it validates the path exists but doesn't change the box's shell cwd. All SDK methods use it automatically.
- `EphemeralBox` does NOT support `agent`, `git`, `skills`, the `labels` namespace, the browser, or public URLs — use full `Box` for those (it does support `schedule` and snapshots).
- `run.exit_code` is `None` for agent runs, only available for exec commands.
- `run.result` is stdout on success and stderr on failure — a command that exits 0 writing only to stderr yields `""`; read `run.stderr` for it.
- `files.download(folder=...)` takes a path *inside the box*; output lands in `./<basename>` locally.
- `box.browser` requires a box created with `browser=True`.
- There is **no** `tab.run()` — the autonomous browser agent was removed. Loop `observe` + `act(action)` + `extract` yourself, hand the goal to the in-box agent, or drive Playwright over `cdp_url()`.
- `tab.act(action)` (replaying an `observe()` result) costs no tokens and needs no model provider key; only `act(instruction)` with a string is metered.
- `get_init_command` / `set_init_command` / `delete_init_command` raise unless the box was created with `keep_alive=True`.
- The JS static `Box.delete({boxIds})` is `Box.delete_boxes(box_ids=...)` here, to avoid clashing with the instance `delete()`.
- `box.delete()` is irreversible — snapshot first if you need the state.
- Git operations require `git.token` in the box config for private repos and PRs.
- `Box.from_snapshot()` creates a new box — it does not modify the original. It reuses the full create body, so `browser` / `skills` / `mcp_servers` are forwarded (the JS `Box.fromSnapshot()` drops those).
- `EphemeralBox` has no `update_network_policy` — set `network_policy` at create time.
- All `timeout` values are in **milliseconds** (matching the JS SDK), default `600000`.
- When breaking out of a stream early, call `stream.close()` / `await stream.aclose()` so the run is marked `detached`.
- Close the transport when done: `box.delete()` closes it, or use `with box:` / `box.close()` (`async with` / `await box.aclose()` for `AsyncBox`).
