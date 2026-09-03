---
name: upstash-mcp
description: Connect an AI agent to the Upstash MCP server to manage and debug Upstash resources — Redis, QStash, Workflow, Vector, Search, and Upstash Box — from an MCP client. Covers the hosted remote server at mcp.upstash.com (OAuth browser consent or a developer API key, nothing to install) and the local @upstash/mcp-server npx package (stdio, email + API key). Use when the user wants to add the Upstash MCP, connect their agent or IDE (Claude Code, Cursor, VS Code, Codex, Windsurf) to Upstash, or drive Upstash from an MCP client.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

The Upstash MCP server lets an agent manage and debug Upstash resources — creating databases, running commands, inspecting QStash logs and DLQs, querying Vector/Search indexes, and more. There are two ways to run it. Prefer the **remote** server: nothing to install, and it covers Redis, QStash, Workflow, Vector, and Search.

## Remote server (hosted, recommended)

URL: `https://mcp.upstash.com/mcp` (streamable HTTP).

**OAuth (default, browser consent):**

```bash
claude mcp add --scope user --transport http upstash https://mcp.upstash.com/mcp
```

Then run `/mcp` → Authenticate. On the consent page you pick the account scope (personal or a team) and whether the grant is read-only. Grants are per client and revocable from the Upstash console (Account → OAuth Clients).

**Developer API key (headless / CI, no browser):** create a key at [Console → Account → Management API](https://console.upstash.com/account/api) and pass it as a header. Use `email:API_KEY` (a **read-only** key keeps the agent from mutating anything).

```bash
claude mcp add --scope user --transport http upstash https://mcp.upstash.com/mcp \
  --header "Authorization: Bearer you@example.com:YOUR_API_KEY"
```

JSON config for other clients (Cursor, VS Code, Windsurf, Antigravity — `type: "http"`, add the `Authorization` header for the API-key path):

```json
{
  "mcpServers": {
    "upstash": { "type": "http", "url": "https://mcp.upstash.com/mcp" }
  }
}
```

**Feature groups:** append `?features=` to scope which product tools the agent sees, comma-separated from `redis`, `qstash_workflow`, `vector`, `search` (omitted = all): `https://mcp.upstash.com/mcp?features=redis,qstash_workflow`.

Tokens never reach the agent: data-plane tools resolve REST credentials server-side. On a read-only connection, credential fields are omitted from results.

## Local package (`@upstash/mcp-server`)

A stdio server you run with `npx`, authenticated with your account email + a Developer API key. Covers Redis, QStash, Workflow, and [Upstash Box](https://upstash.com/docs/box). Base command:

```bash
npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

Add to a client, e.g. Claude Code:

```bash
claude mcp add --transport stdio upstash -- npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

JSON config (Cursor, VS Code, Windsurf, Claude Desktop):

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

Read-only API keys are supported and disable every mutating tool. For Upstash Box, add `--box-api-key YOUR_BOX_API_KEY` (or set `UPSTASH_BOX_API_KEY`). Repo: https://github.com/upstash/mcp-server.

## Example prompts

* "Create a new Redis database in us-east-1 and show me its REST URL"
* "List my databases sorted by memory usage"
* "Check the QStash logs and figure out why my webhook keeps failing"
* "Summarize what's in the DLQ right now, grouped by error type"
* "Query my Vector index for the 5 nearest neighbours of this text"
