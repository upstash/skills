## Prefer the MCP server when it is available

If Upstash MCP tools are in the session, call them instead of shelling out to the CLI. They are
already authenticated and cover the same ground — creating, branching and inspecting Redis databases,
running Redis commands, usage stats and insights, backups, plans and budgets, Vector and Search
indexes, Blob buckets and objects, QStash schedules and messages, the DLQ, logs, and Box. Installing
the Upstash plugin registers the hosted server at `https://mcp.upstash.com/mcp`.

Use the CLI when there is no MCP in the session, or when the work is inherently shell work — a CI
step, a provisioning script, or piping JSON into other commands.

The Upstash CLI (`upstash`) manages Upstash services via the Upstash Developer API. All commands are non-interactive and emit JSON on stdout. Errors go to stderr as `{ "error": "..." }` with exit code `1`.

## Install

```bash
npm i -g upstash
```

Or run a single command without installing: `npx upstash <command>`.

## Connect coding agents to Upstash

`upstash setup` connects coding agents to Upstash in one step. Claude Code, Codex, Cursor, and Gemini CLI get the Upstash plugin (the Upstash skills plus the remote MCP server). VS Code, GitHub Copilot CLI, and OpenCode get the remote MCP server (`https://mcp.upstash.com/mcp`) in their config plus the `upstash` skill. The MCP server signs in with OAuth on first use, so setup never writes an API key into an agent's config.

A person at a terminal can run `npx upstash`: with no arguments in a terminal it starts `upstash setup` and asks which agents to set up. Outside a terminal a bare `upstash` only prints the help, so from an agent or a script call `upstash setup` with `--yes` and the agent flags:

```bash
npx -y upstash setup --yes --claude             # or --codex, --cursor, --gemini, --vscode, --copilot, --opencode
npx -y upstash setup --yes --cursor --mode mcp  # remote MCP server + skill instead of the plugin
npx -y upstash setup --yes --claude --project   # this project instead of the user config
npx -y upstash setup --yes --dry-run            # show what would change; without agent flags, --yes covers every detected agent
```

With `--project`, Claude Code installs the plugin at project scope; Codex, Cursor, and Gemini CLI plugins install per user only, so they get project-level MCP config plus the skill instead. Rerunning `setup` updates what it installed. Afterwards the agent needs a restart or reload (in Claude Code, `/reload-plugins`; in Cursor, Developer: Reload Window).

## Authentication

Recommended: run `upstash login` once per machine. Prompts for email and a Developer API key (create one at https://console.upstash.com/account/api), verifies them, and saves to `~/.config/upstash/config.json`.

```bash
upstash login
```

Alternatives — env vars (also auto-loaded from a `.env` in cwd), or `--email` / `--api-key` inline, or `--env-path <path>` to point at a specific `.env`:

```bash
export UPSTASH_EMAIL=you@example.com
export UPSTASH_API_KEY=your_api_key
```

Precedence: flags > env vars > `.env` > saved config. Prefer a **read-only** API key for agents when possible — mutations fail at the API, the same way they would in the console.

## Resource ID flags

| Flag | Products |
|------|----------|
| `--db-id <id>` | Redis |
| `--index-id <id>` | Vector, Search |
| `--qstash-id <id>` | QStash |
| `<bucket>` (positional, name or id) | Blob |
| `--team-id <id>` | Team |

## Redis

```bash
upstash redis list
upstash redis get --db-id <id> [--hide-credentials]
upstash redis create --name <name> --region <region> [--read-regions <r1> <r2>]
upstash redis create-branch --db-id <id> --name <branch-name>
upstash redis delete --db-id <id> [--dry-run]
upstash redis rename --db-id <id> --name <new-name>
upstash redis reset-password --db-id <id>
upstash redis stats --db-id <id>

upstash redis enable-tls --db-id <id>
upstash redis {enable,disable}-eviction --db-id <id>
upstash redis {enable,disable}-autoupgrade --db-id <id>
upstash redis change-plan --db-id <id> --plan <free|payg|pro|paid>
upstash redis update-budget --db-id <id> --budget <cents>
upstash redis update-regions --db-id <id> --read-regions <r1> <r2>
upstash redis move-to-team --db-id <id> --team-id <id>
```

Regions — AWS: `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `sa-east-1`, `ap-south-1`, `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`, `af-south-1`. GCP: `us-central1`, `us-east4`, `europe-west1`, `asia-northeast1`.

`create-branch` makes a branch: a point-in-time copy of a database (or of another branch) with its own endpoint and password, billed as pay-as-you-go. It returns in state `creating`; poll `upstash redis get --db-id <database_id of the branch>` until `state` is `active`. The other `redis` commands take a branch's id like any database's. A branch cannot be merged back. To use it from application code, write its credentials to the env file as shown under [Redis credentials](#redis-credentials); the CLI does not write them itself.

### Redis backups

```bash
upstash redis backup list --db-id <id>
upstash redis backup create --db-id <id> --name <name>
upstash redis backup delete --db-id <id> --backup-id <id> [--dry-run]
upstash redis backup restore --db-id <id> --backup-id <id>
upstash redis backup {enable,disable}-daily --db-id <id>
```

### Redis exec (REST, not the Developer API key)

```bash
upstash redis exec --db-url <url> --db-token <token> SET key value
upstash redis exec --db-url <url> --db-token <token> --json '["SET","key","value"]'
```

`--db-url` / `--db-token` fall back to `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, so set those (below) rather than passing the token on the command line.

### Redis credentials

`redis get` prints the database password and `rest_token`, which are bearer secrets for the whole database. Don't read them into the conversation: use `--hide-credentials` whenever you only need metadata, and when the app needs them, pipe the output straight into its env file:

Before writing, check that `.env.local` is git-ignored (`git check-ignore .env.local` prints the name) and doesn't already define these names. The `jq` output starts with a newline, so the append never joins the last line of a file that lacks a trailing newline:

```bash
upstash redis get --db-id <id> \
  | jq -r '"\nUPSTASH_REDIS_REST_URL=https://\(.endpoint)\nUPSTASH_REDIS_REST_TOKEN=\(.rest_token)"' \
  >> .env.local
```

To run `redis exec` against it, load the file into the shell first (`set -a; . ./.env.local; set +a`).

## Team

```bash
upstash team list
upstash team create --name <name> [--copy-cc]
upstash team delete --team-id <id> [--dry-run]
upstash team members --team-id <id>
upstash team add-member --team-id <id> --member-email <email> --role <admin|dev|finance>
upstash team remove-member --team-id <id> --member-email <email> [--dry-run]
```

## Vector

```bash
upstash vector list
upstash vector get --index-id <id>
upstash vector create --name <name> --region <region> --similarity-function <fn> --dimension-count <n> [--type payg] [--index-type <type>] [--embedding-model <m>] [--sparse-embedding-model <m>]
upstash vector delete --index-id <id> [--dry-run]
upstash vector rename --index-id <id> --name <new-name>
upstash vector reset-password --index-id <id>
upstash vector set-plan --index-id <id> --plan <free|payg|fixed>
upstash vector transfer --index-id <id> --target-account <id>
upstash vector stats                             # aggregate across all indexes
upstash vector index-stats --index-id <id> [--period <1h|3h|12h|1d|3d|7d|30d>]
```

Regions: `eu-west-1`, `us-east-1`, `us-central1`. Similarity: `COSINE`, `EUCLIDEAN`, `DOT_PRODUCT`. Index types: `DENSE`, `SPARSE`, `HYBRID`. Dense models: `BGE_SMALL_EN_V1_5`, `BGE_BASE_EN_V1_5`, `BGE_LARGE_EN_V1_5`, `BGE_M3`. Sparse models: `BM25`, `BGE_M3`. For `HYBRID` with managed embeddings, set `--dimension-count 0`.

## Search

```bash
upstash search list
upstash search get --index-id <id>
upstash search create --name <name> --region <region> --type <free|payg|fixed>
upstash search delete --index-id <id> [--dry-run]
upstash search rename --index-id <id> --name <new-name>
upstash search reset-password --index-id <id>
upstash search transfer --index-id <id> --target-account <id>
upstash search stats
upstash search index-stats --index-id <id> [--period <1h|3h|12h|1d|3d|7d|30d>]
```

Regions: `eu-west-1`, `us-central1`.

## QStash

```bash
upstash qstash list                              # run first; maps region → id
upstash qstash get --qstash-id <id>
upstash qstash rotate-token --qstash-id <id>
upstash qstash set-plan --qstash-id <id> --plan <paid|qstash_fixed_1m|qstash_fixed_10m|qstash_fixed_100m>
upstash qstash stats --qstash-id <id> [--period <1h|3h|12h|1d|3d|7d|30d>]
upstash qstash ipv4                              # CIDR blocks for allowlisting
upstash qstash move-to-team --qstash-id <id> --target-team-id <id>
upstash qstash update-budget --qstash-id <id> --budget <dollars>    # 0 = no limit
upstash qstash {enable,disable}-prodpack --qstash-id <id>
```

## Blob

The object commands, bucket names in place of ids, and `--write-env` need a recent CLI. If `upstash blob cp --help` fails, run the command with `npx -y upstash@latest`.

```bash
upstash blob ls                                  # buckets; `blob list` is the same
upstash blob get <bucket> [--hide-credentials] [--write-env <path>]
upstash blob create --name <name> [--visibility <private|public>] [--cors <origin> <origin>] [--write-env <path>]
upstash blob delete <bucket> [--dry-run]         # empty buckets only
upstash blob rb <bucket> --force                 # delete every object, then the bucket
upstash blob credentials [<bucket>] [--token <token>]
```

`<bucket>` is a bucket name or id. Buckets are `private` by default. `blob get` returns the bucket token, which is a bearer secret for the whole bucket: pass `--hide-credentials` when you only need the metadata, or `--write-env .env.local` to put it where `@upstash/blob` reads it. `--write-env` writes the token to that file as `UPSTASH_BLOB_TOKEN` (file created if missing, other lines kept, mode 600) and prints the bucket without its tokens. It is not the global `--env-path`, which reads credentials.

Each `--cors` origin is `http(s)://host[:port]` with no path or trailing slash (`https://*.example.com` works), passed as its own argument; anything else is rejected. Omit `--cors` to allow all origins.

`blob credentials` exchanges a bucket token for temporary, bucket-scoped S3 credentials to use with the AWS CLI, rclone, or any S3 SDK. With a bucket it reads the token through the Developer API (and waits for a bucket that was just created to finish provisioning); with `--token`, or with neither and `UPSTASH_BLOB_TOKEN` set, it needs no account auth at all. `expiresAt` is the expiry as a **unix timestamp in seconds** (multiply by 1000 before comparing with `Date.now()`) — re-mint before it passes rather than caching.

```bash
CREDS=$(upstash blob credentials <bucket>)
export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r .accessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r .secretAccessKey)
export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r .sessionToken)

aws s3 cp image.png "s3://$(echo "$CREDS" | jq -r .bucket)/image.png" \
  --endpoint-url "$(echo "$CREDS" | jq -r .endpoint)" --region auto
```

### Blob objects

The object commands mirror `aws s3`, with `blob://<bucket>/<key>` in place of `s3://`. For application code use the `upstash-blob-js` skill.

```bash
upstash blob ls <bucket>/images/ [-r] [--summarize]
upstash blob cp ./photo.png blob://<bucket>/images/
upstash blob cp ./assets blob://<bucket>/assets -r [--exclude "*.tmp"]
upstash blob cp blob://<bucket>/images ./images -r          # download
upstash blob cp blob://<bucket>/config.json - | jq .        # to stdout
upstash blob mv blob://<bucket>/a.txt blob://<other-bucket>/a.txt
upstash blob sync ./site blob://<bucket>/site [-d] [--size-only]
upstash blob rm <bucket>/tmp -r [-n]
upstash blob presign <bucket>/report.pdf [--expires-in <seconds>]   # download URL, at most 600 s (the default)
```

`cp`, `mv` and `sync` need `blob://` to tell bucket paths from local ones; `ls`, `rm` and `presign` take `<bucket>/<key>` without it. Shared flags: `-r/--recursive`, `--exclude` / `--include` (the last match wins), `-n/--dryrun`, `-q/--quiet`, `--concurrency <1-16>`, and for written objects `--content-type`, `--cache-control` and `--metadata key=value`. `sync -d` deletes destination files that are not in the source. Local symlinks are followed unless `--no-follow-symlinks` is given. Progress goes to stderr and a JSON summary to stdout; a failed file does not stop the transfer but makes the command exit with an error.

With a bucket token (`--token`, or `UPSTASH_BLOB_TOKEN`) these commands need no login, but only reach that token's bucket, addressed by id: `upstash blob cp ./assets blob://<bucket-id>/assets -r --token "$BLOB_TOKEN"`.

## Conventions

- Pipe any output to `jq` for field extraction, e.g. `upstash redis list | jq '.[].database_id'`.
- Use `--dry-run` first on any `delete` or `remove-member`.
- Use `--hide-credentials` on `redis get` and `blob get` unless you are writing the secret to an env file; never print a token to read it.
- Run destructive commands (`redis delete`, `team delete`, `blob rb --force`, `reset-password`) only on resources the user named, after confirming the id with them.
- The CLI sends three `Upstash-Telemetry-*` headers (CLI version, runtime, platform). `upstash telemetry disable` or `UPSTASH_DISABLE_TELEMETRY=1` turns them off; `upstash telemetry status` shows the setting.
