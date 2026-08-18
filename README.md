# Upstash Agent Skills

A collection of skills for AI coding agents working with Upstash SDKs. Skills are packaged instructions and resources that extend agent capabilities.

This repo works as an [Agent Skills](https://agentskills.io/) repo, a [Claude Code plugin](https://code.claude.com/docs/en/plugins), a [Cursor plugin](https://cursor.com/docs/plugins), an [OpenAI Codex plugin](https://developers.openai.com/codex/plugins/build), and a [DeepSeek Harness bundle](https://github.com/deepseek-ai/deepseek-harness).

## Available Skills

| Skill | Description |
|-------|-------------|
| [upstash](skills/upstash/) | Combined skill covering all Upstash SDKs. |
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

## Installation

### Claude Code Plugin

```bash
# Add the marketplace
/plugin marketplace add upstash/skills

# Install the plugin
/plugin install upstash@upstash
```

### Cursor Plugin

We are waiting for this plugin to be accepted to the official
[Cursor Marketplace](https://cursor.com/marketplace). Once listed, it can be installed
from **Customize** in the Cursor sidebar.

### OpenAI Codex Plugin

```bash
# Add the marketplace
codex plugin marketplace add upstash/skills

# Install the plugin
codex plugin add upstash@upstash
```

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
servers — it has no channel for skills — so there is no Zed extension to install.

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

For full access to Upstash APIs (create databases, publish messages, query vectors, etc.), you can also set up the [`@upstash/mcp-server`](https://www.npmjs.com/package/@upstash/mcp-server):

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
<summary>Zed</summary>

Add to your Zed settings (`zed: open settings file`), or use **Settings → AI → MCP Servers →
Add Server → Add Local Server**:

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

<details>
<summary>DeepSeek Harness</summary>

Already included in the bundle — see [DeepSeek Harness](#deepseek-harness) above.
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

When making a release, bump the `version` field in every manifest that carries one: `plugin.json` (the portable [Agent Plugins](https://agent-plugins.org) manifest), `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, and `.codex-plugin/plugin.json`.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `npm run build` | Regenerates `skills/upstash/` from all individual skills. |
| `check` | `npm run check` | Runs the build, then fails if there is a git diff — used in CI to ensure the generated output is committed. |

## CI

The GitHub Actions workflow (`.github/workflows/check.yml`) runs `npm run check` on every push and PR. If you forget to run `npm run build` before pushing, CI will fail.
