# Upstash Agent Skills

Connect your AI coding agent to Upstash. This repo ships **skills** (per-SDK instruction packs your agent loads on demand) and the **plugin manifests** that install them — and now the **Upstash MCP server** — into Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Zed, and any Agent Skills–compatible client.

## The Upstash agent surface

- **Skills** — packaged instructions and CLI references for each Upstash SDK (Redis, QStash, Workflow, Vector, Search, Box, Ratelimit). No credentials needed. → [docs](https://upstash.com/docs/agent-resources/skills)
- **MCP server** — live tools to query, debug, and manage your account. Two ways to run it:
  - **Remote (hosted)** — `https://mcp.upstash.com/mcp`, streamable HTTP, authenticated with OAuth (browser consent, on first use) or a developer API key header. Nothing to install.
  - **Local (stdio)** — [`@upstash/mcp-server`](https://www.npmjs.com/package/@upstash/mcp-server) run with `npx`, authenticated with your account email + a developer API key.

  → [docs](https://upstash.com/docs/agent-resources/mcp)
- New here? Start with the [AI Tools overview](https://upstash.com/docs/agent-resources/overview), and see [Install by agent](https://upstash.com/docs/agent-resources/clients) for full per-client setup.

## What's in this repo

- **`skills/upstash-*/`** — the per-SDK skill sources (each has a `SKILL.md`). Edit these.
- **`skills/upstash/`** — the combined skill, **generated** from all the sources by `npm run build`. Never hand-edit it (see [`AGENTS.md`](AGENTS.md)).
- **Plugin manifests** — `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `gemini-extension.json`, and the portable [Agent Plugins](https://agent-plugins.org) `plugin.json` + `mcp.json`. They make the repo installable as a plugin/extension. **These plugins now bundle the remote Upstash MCP server (OAuth), so installing the plugin sets up the skills *and* the MCP in one step** — no separate MCP configuration for Claude Code, Codex, Cursor, or Gemini CLI.
- **`zed-extension/`** — a Zed MCP server extension (Rust → Wasm).
- **`assets/`** — branding used on the plugin card, read by Codex (`interface.logo` / `interface.composerIcon`) and Cursor (`logo`). Claude Code, Gemini CLI and the Agent Plugins schema have no icon field.

## Available Skills

| Skill | Description |
|-------|-------------|
| [upstash](skills/upstash/) | Combined skill covering all Upstash SDKs and CLIs. |
| [upstash-box-cli](skills/upstash-box-cli/) | Drive a sandboxed cloud container from the terminal with the `box` CLI. |
| [upstash-box-js](skills/upstash-box-js/) | Sandboxed cloud containers with AI agents, shell, filesystem, and git. |
| [upstash-box-py](skills/upstash-box-py/) | The same sandboxed cloud containers, from the Python SDK. |
| [upstash-cli](skills/upstash-cli/) | Drive the Upstash Developer API from the terminal with the `upstash` CLI. |
| [upstash-qstash-js](skills/upstash-qstash-js/) | Serverless messaging and scheduling via HTTP endpoints. |
| [upstash-ratelimit-js](skills/upstash-ratelimit-js/) | Rate limiting with the Redis Rate Limit TypeScript SDK. |
| [upstash-redis-js](skills/upstash-redis-js/) | Serverless Redis — caching, sessions, leaderboards, full-text search. |
| [upstash-redis-start](skills/upstash-redis-start/) | Provision a zero-config, no-signup scratch Redis database for an agent. |
| [upstash-search-js](skills/upstash-search-js/) | Full-text search quick starts, core concepts, and TypeScript SDK. |
| [upstash-vector-js](skills/upstash-vector-js/) | Vector database features, SDK usage, and framework integrations. |
| [upstash-workflow-js](skills/upstash-workflow-js/) | Durable workflows — define, trigger, and manage multi-step processes. |

## Install

Installing through a **plugin** (Claude Code, Codex, Cursor, Gemini CLI) sets up both the skills and the remote MCP server — approve the MCP's OAuth consent on first use. The skills-only installers (Agent Skills CLI, OpenCode, Zed) install skills; add the [MCP server](#mcp-server) separately if you want live account access.

For the full, up-to-date per-client instructions, see [Install by agent](https://upstash.com/docs/agent-resources/clients).

### Claude Code (skills + MCP)

```bash
# Add the marketplace
/plugin marketplace add upstash/skills

# Install the plugin
/plugin install upstash@upstash
```

### OpenAI Codex (skills + MCP)

```bash
# Add the marketplace
codex plugin marketplace add upstash/skills

# Install the plugin
codex plugin add upstash@upstash
```

### Cursor (skills + MCP)

We are waiting for this plugin to be accepted to the official
[Cursor Marketplace](https://cursor.com/marketplace). Once listed, it can be installed
from **Customize** in the Cursor sidebar, and it brings both the skills and the MCP server.

### Gemini CLI (skills + MCP)

Gemini CLI loads this repo as an [extension](https://geminicli.com/docs/extensions/) — the manifest is `gemini-extension.json` at the repo root; every skill under `skills/` and the remote MCP server are picked up automatically:

```bash
gemini extensions install https://github.com/upstash/skills
```

### OpenCode

OpenCode loads [Agent Skills](https://opencode.ai/docs/skills) from `.agents/skills/` in a project
and `~/.config/opencode/skills/` globally, which is where the Agent Skills CLI writes them for
OpenCode:

```bash
# Available in every project
npx skills add upstash/skills --agent opencode --global

# Or just this project
npx skills add upstash/skills --agent opencode
```

OpenCode exposes the installed skills to the agent through its native `skill` tool, so the
agent loads only the sub-skill relevant to the task at hand. For live access to your account
(create databases, inspect QStash logs, and so on), add the [MCP server](#mcp-server) as well.

### Zed

Zed loads [Agent Skills](https://zed.dev/docs/ai/skills) from `.agents/skills/` in a project
and `~/.agents/skills/` globally, which is exactly where the Agent Skills CLI writes them:

```bash
# Available in every project
npx skills add upstash/skills --agent zed --global

# Or just this project
npx skills add upstash/skills --agent zed
```

The skills then show up in Zed's Agent Panel, and the agent can load them on its own or via
`/upstash`. Zed's extension marketplace carries languages, themes, debuggers, snippets, and MCP
servers, but has no channel for skills, so the CLI is the only way to install them. The Zed
extension in `zed-extension/` covers the [MCP server](#mcp-server) instead.

### Context7 CLI

```bash
npx ctx7 skills install upstash/skills
```

### Agent Skills CLI

```bash
npx skills add upstash/skills
```

### DeepSeek Harness

Installs the skills **and** the [Upstash MCP server](#mcp-server) in one step. Requires
`pnpm` on your `PATH`.

```bash
# Install into a profile (`web` is the one `dsh web` boots)
dsh plugin --profile web add github:upstash/skills

# Start the harness
dsh web
```

Then store your Upstash credentials from inside a session:

```
/upstash-login YOUR_EMAIL YOUR_API_KEY
```

Credentials are stored in `~/.dsh/.credentials.yaml` and the MCP server connects as
soon as both are set. The skills work without them.

## MCP Server

Installing a plugin above already wires up the remote MCP server. Set it up on its own when you
use a skills-only installer (OpenCode, Zed) or a client without a plugin.

**Remote (recommended)** — no install; OAuth on first use, or pass a developer API key header
(`email:API_KEY`) for headless/CI. Create a key at
[Console → Account → API Keys](https://console.upstash.com/account/api).

<details>
<summary>Claude Code</summary>

```bash
# OAuth (browser consent on first /mcp use)
claude mcp add --transport http upstash https://mcp.upstash.com/mcp

# Or a developer API key, no browser
claude mcp add --transport http upstash https://mcp.upstash.com/mcp \
  --header "Authorization: Bearer you@example.com:YOUR_API_KEY"
```

</details>

<details>
<summary>Cursor</summary>

Add to `~/.cursor/mcp.json` (add `headers` with the `Authorization` line for the API-key path):

```json
{
  "mcpServers": {
    "upstash": { "url": "https://mcp.upstash.com/mcp" }
  }
}
```

</details>

<details>
<summary>OpenCode</summary>

Add to `opencode.json`, or `~/.config/opencode/opencode.json` to make it available everywhere.
See the [OpenCode MCP docs](https://opencode.ai/docs/mcp-servers).

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "upstash": {
      "type": "remote",
      "url": "https://mcp.upstash.com/mcp",
      "enabled": true
    }
  }
}
```

</details>

Scope which product tools the agent sees by appending `?features=` to the URL — comma-separated
from `redis`, `qstash_workflow`, `vector`, `search` (omitted means all), e.g.
`https://mcp.upstash.com/mcp?features=redis,qstash_workflow`.

**Local (stdio)** — run [`@upstash/mcp-server`](https://www.npmjs.com/package/@upstash/mcp-server)
yourself, authenticated with your email + API key. Read-only keys are supported (the server then
disables every state-changing tool).

<details>
<summary>Claude Code</summary>

```bash
claude mcp add upstash -- npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

</details>

<details>
<summary>Cursor</summary>

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": ["-y", "@upstash/mcp-server@latest", "--email", "YOUR_EMAIL", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

</details>

<details>
<summary>OpenCode</summary>

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "upstash": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/mcp-server@latest", "--email", "YOUR_EMAIL", "--api-key", "YOUR_API_KEY"],
      "enabled": true
    }
  }
}
```

</details>

<details>
<summary>Zed</summary>

This repo ships a Zed MCP extension in [`zed-extension/`](zed-extension/). Once it is accepted
into the [Zed extension registry](https://github.com/zed-industries/extensions), install
**Upstash Redis MCP Server** from **Settings → AI → MCP Servers → Add Server → Install from
Extensions**, and Zed will prompt for `upstash_email` and `upstash_api_key`. Until then, install
it as a dev extension (`zed: install dev extension`, then pick the `zed-extension/` directory).

To skip the extension entirely, add the server to your Zed settings by hand
(`zed: open settings file`):

```json
{
  "context_servers": {
    "upstash": {
      "command": "npx",
      "args": ["-y", "@upstash/mcp-server@latest", "--email", "YOUR_EMAIL", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

</details>

## Making changes

### Updating an existing skill

1. Edit the files in the individual skill folder (e.g. `skills/upstash-qstash-js/`).
2. Run `npm run build` to regenerate `skills/upstash/`.
3. Commit both the source changes and the regenerated output.

### Adding a new skill

1. Create a new folder under `skills/` (e.g. `skills/upstash-redis-js/`).
2. Add a `SKILL.md` with the standard frontmatter (`name` and `description`) and any supporting files.
3. Run `npm run build` — the new skill will be picked up automatically.
4. Commit everything.

### Changing the combined skill header

The frontmatter and introductory text for `skills/upstash/SKILL.md` comes from `scripts/header.md`. Edit that file, then run `npm run build`.

### Updating the plugin version

When making a release, bump the `version` field in every manifest that carries one: `plugin.json` (the portable [Agent Plugins](https://agent-plugins.org) manifest), `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`, and `gemini-extension.json`.

### The Zed extension

`zed-extension/` is a Zed MCP server extension that runs [`@upstash/mcp-server`](#mcp-server).
It is a Rust crate compiled to WebAssembly, and it is only about the MCP server — Zed extensions
cannot carry skills.

```bash
cd zed-extension
rustup target add wasm32-wasip2   # once
cargo build --release --target wasm32-wasip2
```

Test a local build with `zed: install dev extension` and point Zed at `zed-extension/`.
Open Zed on a folder while testing — context servers are project-scoped, so with no project
open (or one whose worktree fails to open) the server never starts and the panel sits on
"Connecting Server..." until Zed's 60s timeout.

To publish or update it, open a PR against
[`zed-industries/extensions`](https://github.com/zed-industries/extensions) that adds this repo
as a submodule under `extensions/mcp-server-upstash` and an entry in `extensions.toml`:

```toml
[mcp-server-upstash]
submodule = "extensions/mcp-server-upstash"
path = "zed-extension"
version = "0.1.0"
```

The `version` there has to match `version` in `zed-extension/extension.toml`, so bump both
together. `zed-extension/LICENSE` is a symlink to the repo's MIT license — Zed requires a
license at the extension path, not just at the repo root, and rejects the PR in CI without one.

> Zed [plans to deprecate MCP server extensions](https://zed.dev/docs/extensions/mcp-extensions)
> in favor of the official MCP registry. If that lands, publishing `@upstash/mcp-server` to
> [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/) replaces this
> extension.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `npm run build` | Regenerates `skills/upstash/` from all individual skills. |
| `check` | `npm run check` | Runs the build, then fails if there is a git diff — used in CI to ensure the generated output is committed. |

## CI

The GitHub Actions workflow (`.github/workflows/check.yml`) runs `npm run check` on every push and PR. If you forget to run `npm run build` before pushing, CI will fail.
