# upstash/skills vs. upstash/context7 — plugin & manifest catalog

[**upstash/skills**](https://github.com/upstash/skills) (this repository) is a collection of
[Agent Skills](https://agentskills.io/) for Upstash SDKs — Redis, Vector, QStash, Workflow,
Ratelimit, Search, Box and the Upstash CLI. Each sub-skill is a `skills/upstash-*/SKILL.md`
source file, and `scripts/build.mjs` merges them into the combined `skills/upstash/` skill.
It ships as a Claude Code plugin, an OpenAI Codex plugin and a Cursor plugin, and carries no
runtime code.

[**upstash/context7**](https://github.com/upstash/context7) is the Context7 MCP server and its
surrounding ecosystem — an actual service (plus `ctx7` CLI, SDK, AI SDK tools and hosted
endpoint at `https://mcp.context7.com/mcp`) that pulls version-specific library documentation
into an agent's context. Because it has to be *installed into* many different AI coding tools,
it ships far more integration manifests than a skills-only repository does.

This document catalogs every plugin / integration file type found across the two repositories,
what format it uses, where that format is documented, and which marketplace (if any) it is
published to. The point of the comparison is to make it obvious which distribution channels
upstash/skills already covers and which ones context7 covers that upstash/skills does not.

**Sources.** `upstash/skills` was read at commit `f750edd` (branch `main`).
`upstash/context7` was read from a fresh `git clone` of the default `master` branch at commit
`895c5c3`. Paths below are relative to each repository root. Every URL in the tables was either
found referenced inside one of the two repositories or verified as the canonical public
documentation for that format; anything that could not be verified is marked as such rather
than guessed.

## Catalog

| Plugin / file | In upstash/skills? | In upstash/context7? | Format | Format documentation link | Marketplace | Marketplace link |
|---|---|---|---|---|---|---|
| Agent Skill — `SKILL.md` | **Yes** — `skills/upstash-*/SKILL.md` (sources) and `skills/upstash/**/overview.md` (generated combined skill) | **Yes** — `skills/context7-mcp/SKILL.md`, `skills/context7-cli/SKILL.md`, `skills/find-docs/SKILL.md`, plus per-client copies under `plugins/*/context7/skills/context7-mcp/SKILL.md` | Markdown with YAML frontmatter (`name`, `description`; optional `license`, `compatibility`, `metadata`, `allowed-tools`) | https://agentskills.io/specification | No central registry — Agent Skills are installed from a Git repo (`npx skills add upstash/skills`). agentskills.io is the spec + client showcase, not a package registry. | https://agentskills.io/ |
| Claude Code plugin manifest — `.claude-plugin/plugin.json` | **Yes** — `.claude-plugin/plugin.json` (repo root is the plugin) | **Yes** — `plugins/claude/context7/.claude-plugin/plugin.json` | JSON manifest (`name`, `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`) | https://code.claude.com/docs/en/plugins | Claude Code plugin marketplace — self-hosted from the repo (`/plugin marketplace add upstash/skills`, `claude plugin marketplace add upstash/context7`). Neither plugin is listed in Anthropic's community catalog. | https://code.claude.com/docs/en/plugin-marketplaces (community catalog: https://github.com/anthropics/claude-plugins-community) |
| Claude Code marketplace manifest — `.claude-plugin/marketplace.json` | **Yes** — `.claude-plugin/marketplace.json` (marketplace `upstash`, one plugin `upstash` sourced from `./`) | **Yes** — `.claude-plugin/marketplace.json` (marketplace `context7-marketplace`, plugin `context7` sourced from `./plugins/claude/context7`) | JSON manifest (`name`, `owner`, `metadata`, `plugins[]` with `name`/`source`/`description`/`version`) | https://code.claude.com/docs/en/plugin-marketplaces | Claude Code plugin marketplace (this file *is* the marketplace; users add the GitHub repo directly) | https://code.claude.com/docs/en/discover-plugins |
| Codex plugin manifest — `.codex-plugin/plugin.json` | **Yes** — `.codex-plugin/plugin.json` (adds `skills: "./skills/"` and an `interface` block) | **Yes** — `plugins/codex/context7/.codex-plugin/plugin.json` (adds `skills`, `mcpServers: "./.mcp.json"` and a richer `interface` block) | JSON manifest (Claude-style fields plus `skills`, `mcpServers`, and a Codex `interface` block: `displayName`, `shortDescription`, `category`, `capabilities`, `defaultPrompt`, `brandColor`, …) | https://developers.openai.com/codex/plugins/build | Codex plugin marketplace — self-hosted from the repo (`codex plugin marketplace add upstash/skills` / `… upstash/context7`) | https://developers.openai.com/codex/plugins/ |
| Codex marketplace manifest — `.agents/plugins/marketplace.json` | **Yes** — `.agents/plugins/marketplace.json` (plugin source is a `url` source pointing at `https://github.com/upstash/skills.git`, ref `main`) | **Yes** — `.agents/plugins/marketplace.json` (plugin source is a `local` source pointing at `./plugins/codex/context7`) | JSON manifest (`name`, `interface.displayName`, `plugins[]` with a typed `source` object, `policy.installation`, `policy.authentication`, `category`) | https://developers.openai.com/codex/plugins/build | Codex plugin marketplace (this file *is* the marketplace) | https://developers.openai.com/codex/plugins/ |
| Cursor plugin manifest — `plugin.json` | **Yes** — `.cursor-plugin/plugin.json` (matches the path Cursor documents) | **Yes, but at a different path** — `plugins/cursor/context7/.cursor/plugin.json` (`.cursor/`, not the documented `.cursor-plugin/`; adds `logo` and `primaryColor`) | JSON manifest (`name`, `version`, `description`, `author`, `keywords`, optional `logo`/`primaryColor`) | https://cursor.com/docs/reference/plugins | Cursor plugin marketplace / team marketplaces (imported from a GitHub repo). Note: upstash/skills' README no longer documents Cursor install (commit `3fb5cc4` removed those instructions), so this manifest is present but not advertised. | https://cursor.com/docs/plugins |
| Cursor marketplace manifest — `.cursor-plugin/marketplace.json` | **Yes** — `.cursor-plugin/marketplace.json` | **No** — context7 has no Cursor marketplace manifest; its Cursor plugin directory is not exposed through a Cursor marketplace file | JSON manifest (`name`, `owner`, `metadata`, `plugins[]`) | https://cursor.com/docs/reference/plugins | Cursor plugin marketplace (this file *is* the marketplace) | https://cursor.com/docs/plugins |
| Cursor rule — `rules/*.mdc` | **No** | **Yes** — `plugins/cursor/context7/rules/use-context7.mdc` (`alwaysApply: true`) | Markdown with YAML frontmatter (`description`, `alwaysApply`, optional `globs`), `.mdc` extension | https://cursor.com/docs/context/rules | None — rules ship inside the Cursor plugin; they are not separately published. (context7's `docs/clients/cursor.mdx` also documents a hand-written `.cursorrules` file, which is not committed to the repo.) | n/a |
| GitHub Copilot CLI plugin manifest — `plugin.json` | **No** | **Yes** — `plugins/copilot/context7/plugin.json` (declares `agents/`, `skills/`, `commands/`, `.mcp.json`) | JSON manifest (`name` required; optional `description`, `version`, and path fields `agents`, `skills`, `commands`, `mcpServers`) | https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference | GitHub Copilot CLI plugin marketplace — self-hosted (`copilot plugin marketplace add upstash/context7`) | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace |
| Copilot CLI marketplace manifest — `.github/plugin/marketplace.json` | **No** | **Yes** — `.github/plugin/marketplace.json` | JSON manifest (`name`, `owner`, `metadata`, `plugins[]` with `name`/`source`/`description`/`version`) | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace | GitHub Copilot CLI plugin marketplace (this file *is* the marketplace) | https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins |
| Agent Plugins portable manifest — `plugin.json` (`$schema: agent-plugins.org/schemas/1.0.0/plugin.schema.json`) | **No** | **Yes** — `plugins/agent-plugins/context7/plugin.json` | JSON manifest against the Agent Plugins 1.0.0 schema (`$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`) | https://agent-plugins.org/specification | None — the Agent Plugins spec defines only the portable package format; it does not define a registry or marketplace. Installed per-client from a directory or Git URL. | n/a (spec site: https://agent-plugins.org) |
| Agent Plugins MCP config — `mcp.json` (`$schema: agent-plugins.org/schemas/1.0.0/mcp.schema.json`) | **No** | **Yes** — `plugins/agent-plugins/context7/mcp.json` (`streamable-http` to `https://mcp.context7.com/mcp/oauth`) | JSON, `mcpServers` map; transport `stdio`, `streamable-http`, or legacy HTTP+SSE. The spec requires MCP config to live in `mcp.json`, never inline in `plugin.json`. | https://agent-plugins.org/specification | None — bundled inside the plugin | n/a |
| Client-specific MCP server config — `.mcp.json` / `mcp.json` | **No file shipped.** The README documents `claude mcp add upstash …` and a `.cursor/mcp.json` snippet for [`@upstash/mcp-server`](https://www.npmjs.com/package/@upstash/mcp-server), but nothing is committed. | **Yes** — `plugins/claude/context7/.mcp.json`, `plugins/codex/context7/.mcp.json`, `plugins/copilot/context7/.mcp.json` (HTTP + `Authorization: ${CONTEXT7_API_KEY:-}`), `plugins/cursor/context7/mcp.json` (OAuth URL), `plugins/context7-power/mcp.json` | JSON, `mcpServers` map keyed by server name, with `type`/`url`/`headers` or `command`/`args` | https://modelcontextprotocol.io/ (Claude Code specifics: https://code.claude.com/docs/en/mcp) | None — bundled inside each plugin | n/a |
| MCP Registry server manifest — `server.json` | **No** | **Yes** — `server.json` (published by `.github/workflows/mcp-registry.yml` via `mcp-publisher`) | JSON against the official MCP server schema (`$schema`, reverse-DNS `name`, `packages[]` for npm/mcpb, `remotes[]` for streamable-http, `environmentVariables`) | https://github.com/modelcontextprotocol/registry/tree/main/docs (schema: `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`) | Official MCP Registry | https://registry.modelcontextprotocol.io |
| Gemini CLI extension manifest — `gemini-extension.json` | **No** | **Yes** — `gemini-extension.json` at the repo root | JSON manifest (`name`, `version`, `description`, `mcpServers`, `settings[]` with `envVar` for secrets like `CONTEXT7_API_KEY`) | https://geminicli.com/docs/extensions/reference/ | Gemini CLI extensions directory | https://geminicli.com/extensions |
| Power manifest — `POWER.md` (+ sibling `mcp.json`) | **No** | **Yes** — `plugins/context7-power/POWER.md` and `plugins/context7-power/mcp.json` | Markdown with YAML frontmatter (`name`, `displayName`, `description`, `keywords`, `author`) | https://kiro.dev/docs/powers/ — *inferred*: the repo never names the target client, but the file name and frontmatter shape match the Kiro "Powers" format. Treat this attribution as unconfirmed. | Kiro Powers (attribution inferred, see previous column) | https://kiro.dev/powers |
| Subagent definition — `agents/*.md` | **No** | **Yes** — `plugins/claude/context7/agents/docs-researcher.md`, `plugins/cursor/context7/agents/docs-researcher.md`, `plugins/copilot/context7/agents/docs-researcher.agent.md` | Markdown with YAML frontmatter (`name`, `description`, optional `model`). Copilot CLI uses the `*.agent.md` suffix. | https://code.claude.com/docs/en/sub-agents | None — bundled inside each plugin | n/a |
| Slash command — `commands/*.md` | **No** | **Yes** — `plugins/claude/context7/commands/docs.md`, `plugins/copilot/context7/commands/docs.md` (both expose `/context7:docs`) | Markdown with YAML frontmatter (`description`, `argument-hint`) | https://code.claude.com/docs/en/plugins-reference | None — bundled inside each plugin | n/a |
| Plain agent rule snippets — `rules/*.md` | **No** | **Yes** — `rules/context7-cli.md`, `rules/context7-mcp.md` | Plain Markdown, no frontmatter — client-agnostic text meant to be pasted into `AGENTS.md`/`CLAUDE.md`/Cursor rules or written out by `ctx7 setup` | No format spec — this is free-form prose, not a defined format | None | n/a |
| VS Code extension (`package.json` with `contributes`, VSIX) | **No** | **No** — context7 only *documents* the extension in `docs/clients/vscode.mdx`; the source lives in the separate repo [upstash/context7-vscode-extension](https://github.com/upstash/context7-vscode-extension) | VS Code extension manifest (`package.json` + VSIX package) | https://code.visualstudio.com/api/references/extension-manifest | VS Code Marketplace (published as `Upstash.context7-mcp`) | https://marketplace.visualstudio.com/items?itemName=Upstash.context7-mcp |

## Not found in either repository

Checked for and **not present** in either `upstash/skills` or `upstash/context7`:

- **JetBrains plugin** (`plugin.xml` / Gradle IntelliJ plugin) — no such files; nothing published to the JetBrains Marketplace from either repo.
- **Open VSX** — no `ovsx` publish step or manifest in either repo. (The Context7 VS Code extension is published to the Visual Studio Marketplace from its own separate repository; whether it is also on Open VSX could not be verified from these repos.)
- **Windsurf rules** (`.windsurfrules` / `.windsurf/rules/`) — not present in either repo.
- **Committed `.cursorrules`** — context7's `docs/clients/cursor.mdx` shows an example `.cursorrules` file for users to create, but no `.cursorrules` is committed in either repo.
- **`AGENTS.md` as a shipped artifact** — both repos have an `AGENTS.md`, but in each case it is a contributor guide for the repo itself, not a distributed plugin file.

## Notes and asymmetries worth calling out

1. **Same two "skill + marketplace" channels in both.** Claude Code and Codex are the only
   channels both repositories ship: `.claude-plugin/{plugin,marketplace}.json` and
   `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json`. Both use the same
   self-hosted pattern — the marketplace manifest lives in the repo and users add the GitHub
   repo directly, so neither project depends on a third-party registry for these.

2. **Cursor is where the two diverge most.** upstash/skills uses the documented
   `.cursor-plugin/` layout and ships both a plugin and a marketplace manifest, but its README
   no longer advertises Cursor installation. context7 ships a Cursor plugin at the
   non-standard `.cursor/plugin.json` path with no marketplace manifest, but adds a `.mdc`
   rule and a subagent that upstash/skills has no equivalent of.

3. **context7 covers four channels upstash/skills does not touch at all**: GitHub Copilot CLI,
   the portable Agent Plugins spec, Gemini CLI extensions, and the official MCP Registry — plus
   a `POWER.md` package and a VS Code Marketplace extension maintained in a sibling repo.
   Every one of these exists because context7 needs to register an *MCP server*; a skills-only
   repository has nothing to register.

4. **Layout difference.** upstash/skills is a single plugin: the repository root *is* the
   plugin, and the per-client manifest directories (`.claude-plugin/`, `.codex-plugin/`,
   `.cursor-plugin/`, `.agents/`) sit side by side at the root, all pointing at the same
   `skills/` tree. context7 keeps one self-contained plugin directory per client under
   `plugins/<client>/context7/`, with the root-level marketplace manifests pointing into them.
   The cost of context7's approach is duplication: `skills/context7-mcp/SKILL.md` is copied
   into five different plugin directories.

5. **Build/versioning difference.** upstash/skills generates `skills/upstash/` from the
   individual `skills/upstash-*/SKILL.md` sources with `scripts/build.mjs`, and CI
   (`npm run check`) fails if the generated output is stale. Its plugin version is a manually
   bumped `1.0.0` duplicated across three manifests. context7 uses Changesets and release
   workflows, and its versions are spread across `server.json`, `gemini-extension.json` and
   each per-client `plugin.json` — which is why the same plugin appears as `1.0.0`, `1.0.1`
   and `1.0.2` in different manifests in the tree read for this comparison.

6. **Only context7 has runtime code.** context7 is a pnpm workspace with published npm
   packages (`@upstash/context7-mcp`, `ctx7`, `@upstash/context7-sdk`,
   `@upstash/context7-tools-ai-sdk`, `@upstash/context7-pi`) and a full Mintlify docs site
   under `docs/`. upstash/skills has no runtime code and no published npm package — its
   `package.json` is `private: true` and exists only to run the build/check scripts.
