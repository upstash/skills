---
name: upstash-box-py
description: Work with the upstash-box Python SDK for sandboxed cloud containers with AI agents, shell, filesystem, and git. Use when building with Upstash Box in Python, creating sandboxed environments, running AI agents in containers, or orchestrating parallel boxes.
---

# upstash-box Python SDK

Sandboxed cloud containers with built-in AI agents, shell, filesystem, and git.

## Install & Setup

```bash
pip install upstash-box
```

Set `UPSTASH_BOX_API_KEY` env var or pass `api_key` to constructors.

The SDK ships both a synchronous `Box` (used in the examples below) and an
asynchronous `AsyncBox` (`box = await AsyncBox.create(...)`, `await box.agent.run(...)`).
The async surface is identical with `await` and `async for`.

## Box Lifecycle

```python
import os
from upstash_box import Box, Agent, ClaudeCode, BoxApiKey

# Create with agent + git + env vars
box = Box.create(
    runtime="node",  # "node" | "python" | "golang" | "ruby" | "rust"
    agent={
        "harness": Agent.CLAUDE_CODE,  # Agent.CODEX | Agent.OPEN_CODE
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
    skills=["upstash/qstash-js"],  # GitHub repos as agent skills
)

# Reconnect, list, delete, pause/resume
same = Box.get(box.id)
all_boxes = Box.list()
box.pause()
box.resume()
box.delete()  # irreversible
status = box.get_status()["status"]
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
    on_tool_use=lambda tool: print(tool["name"], tool["input"]),
)

run.status   # "running" | "completed" | "failed" | "cancelled" | "detached"
run.result   # typed from schema (a Review instance)
run.cost     # RunCost(input_tokens, output_tokens, compute_ms, total_usd)

# Streaming
stream = box.agent.stream(prompt="Build a REST API")
for chunk in stream:
    print(chunk)

# Fire-and-forget with webhook
box.agent.run(
    prompt="Run tests",
    webhook={"url": "https://example.com/hook", "headers": {"Authorization": "Bearer ..."}},
)
```

## Run Fields

Every `run` (agent, command, or code) returns a `Run`:

```python
run = box.exec.command("npm test")
run.id         # run ID
run.status     # "completed" | "failed" | ...
run.result     # string output (or typed result with response_schema)
run.exit_code  # int | None (None for agent runs)
run.cost       # RunCost(input_tokens, output_tokens, compute_ms, total_usd)

run.cancel()          # cancel a running run
logs = run.logs()     # [RunLog(timestamp, level, message)]
```

## Shell Execution

```python
# Run commands
run = box.exec.command("echo hello && ls -la")

# Run code snippets — lang: "js" | "ts" | "python"
run2 = box.exec.code(code="print(1 + 1)", lang="python", timeout=10_000)

# Streaming shell
stream = box.exec.stream("npm run build")
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

# Upload local files, download box files
box.files.upload([{"path": "./local/file.txt", "destination": "/workspace/home/file.txt"}])
box.files.download(folder="./output")
```

## cd / Working Directory

The SDK tracks `cwd` client-side. All operations (exec, files, git, agent) run relative to it.

```python
box.cwd  # current working directory (starts at /workspace/home)
box.cd("my-repo")                  # relative to current cwd
box.cd("/workspace/home/other")    # absolute path
```

## Git

```python
box.git.clone(repo="github.com/org/repo", branch="main")
box.cd("repo")  # cd into cloned repo

status = box.git.status()
diff = box.git.diff()
result = box.git.commit(message="fix: resolve bug")  # GitCommitResult(sha, message)
box.git.push(branch="feature/fix")

box.git.checkout(branch="release/v2")
pr = box.git.create_pr(title="Fix bug", body="...", base="main")
# pr: PullRequest(url, number, title, base)

# Arbitrary git commands
output = box.git.exec(args=["log", "--oneline", "-5"])
```

## Snapshots

```python
# Snapshot — checkpoint workspace state
snap = box.snapshot(name="after-setup")
# snap: Snapshot(id, name, box_id, size_bytes, status, created_at)

restored = Box.from_snapshot(snap.id)
snaps = box.list_snapshots()
box.delete_snapshot(snap.id)
```

## EphemeralBox

Lightweight, short-lived boxes (max 3 days). No agent or git. Supports exec, files,
schedule, cd, network policy, and snapshots only.

```python
from upstash_box import EphemeralBox

ebox = EphemeralBox.create(
    runtime="python",
    ttl=3600,  # seconds, max 259200 (3 days)
    env={"API_KEY": "..."},
)

ebox.expires_at  # unix timestamp when auto-deleted
ebox.exec.command("python -c 'print(1+1)'")
ebox.exec.code(code="print('hi')", lang="python")
ebox.files.write(path="/workspace/home/data.json", content="{}")
ebox.cd("subdir")
ebox.delete()

# Restore from snapshot
ebox2 = EphemeralBox.from_snapshot(snap.id, ttl=7200)
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

## MCP Servers

Attach MCP servers to the box agent.

```python
box = Box.create(
    agent={"harness": Agent.CLAUDE_CODE, "model": ClaudeCode.SONNET_4_5},
    mcp_servers=[
        {"name": "fs", "package": "@modelcontextprotocol/server-filesystem"},
        {"name": "custom", "url": "https://mcp.example.com/sse", "headers": {"Authorization": "..."}},
    ],
)
```

## Async client

The async client mirrors the sync API exactly — `await` the calls and use `async for` to stream.

```python
import asyncio
from upstash_box import AsyncBox, Agent

async def main():
    box = await AsyncBox.create(runtime="node", agent={"harness": Agent.CLAUDE_CODE})
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

- Public API option keys are **snake_case** in Python: `api_key`, `user_name`, `network_policy`, `response_schema`, `max_retries`, `on_tool_use`, and agent `options` like `max_turns`, `max_budget_usd`.
- Agent config takes **`harness`** (not the deprecated `provider`/`runner`) — `harness` is required.
- `response_schema` accepts a Pydantic `BaseModel` subclass (returns a typed instance) or a raw JSON-schema `dict` (returns a `dict`).
- Default working directory is `/workspace/home`, not `/home` or `/`.
- `box.cd()` is client-side tracking — it validates the path exists but doesn't change the box's shell cwd. All SDK methods use it automatically.
- `EphemeralBox` does NOT support `agent` or `git` — use full `Box` for those.
- `run.exit_code` is `None` for agent runs, only available for exec commands.
- `box.delete()` is irreversible — snapshot first if you need the state.
- Git operations require `git.token` in the box config for private repos and PRs.
- `Box.from_snapshot()` creates a new box — it does not modify the original.
- Close the transport when done: `box.delete()` closes it, or use `with box:` / `box.close()` (`async with` / `await box.aclose()` for `AsyncBox`).
