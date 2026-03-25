# Upstash Agent Skills

A collection of skills for AI coding agents working with Upstash SDKs. Skills are packaged instructions and resources that extend agent capabilities.

This repo works as an [Agent Skills](https://agentskills.io/) repo, a [Claude Code plugin](https://code.claude.com/docs/en/plugins), and a [Cursor plugin](https://cursor.com/docs/plugins).

## Available Skills

| Skill | Description |
|-------|-------------|
| [upstash](skills/upstash/) | Combined skill covering all Upstash SDKs. |
| [upstash-box-js](skills/upstash-box-js/) | Sandboxed cloud containers with AI agents, shell, filesystem, and git. |
| [upstash-qstash-js](skills/upstash-qstash-js/) | Serverless messaging and scheduling via HTTP endpoints. |
| [upstash-ratelimit-js](skills/upstash-ratelimit-js/) | Rate limiting with the Redis Rate Limit TypeScript SDK. |
| [upstash-redis-js](skills/upstash-redis-js/) | Serverless Redis — caching, sessions, leaderboards, full-text search. |
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

```bash
# Add the marketplace
/plugin marketplace add upstash/skills

# Install the plugin
/plugin install upstash@upstash
```

### Context7 CLI

```bash
npx ctx7 skills install upstash/skills
```

### Agent Skills CLI

```bash
npx skills add upstash/skills
```

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

When making a release, bump the `version` field in both `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json`.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `npm run build` | Regenerates `skills/upstash/` from all individual skills. |
| `check` | `npm run check` | Runs the build, then fails if there is a git diff — used in CI to ensure the generated output is committed. |

## CI

The GitHub Actions workflow (`.github/workflows/check.yml`) runs `npm run check` on every push and PR. If you forget to run `npm run build` before pushing, CI will fail.
