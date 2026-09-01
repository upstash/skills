`box` operates on a **remote container**, not this machine. Your own file and shell
tools act locally; anything that must happen inside the box goes through `box`.

## Install

```bash
npm i -g @upstash/box-cli
```

## Authentication

Every command needs an API key, or it fails with "API token required". Set it once,
or pass `--token` on any single command. Create one at
https://console.upstash.com/box.

```bash
export UPSTASH_BOX_API_KEY=box_...
```

## Selecting a box

Resolution order is `--box <id>`, then `$BOX_ID`, then the nearest `.box` file
(searched upward). Create one and pin it to the working directory:

```bash
box create --no-repl --runtime node                    # prints the id, writes .box
box create --no-repl --runtime node --clone-repo https://github.com/org/repo
box status                                             # id, where it came from, state
```

`paused` is not an error; the next command resumes the box.

Clean up when the work is done. Boxes cost money while they exist:

```bash
box pause                   # keeps the workspace, resumes on the next command
box delete --yes            # irreversible; --yes is required without a terminal
```

Never run `box create` without `--no-repl`, or `box connect` / `box from-snapshot`:
they open an interactive REPL and will hang.

## Running commands

Put the remote command after `--`, or its flags are parsed as `box`'s own.

```bash
box exec -- npm install
box exec -C repo -- npm test
box exec --json -- node -e 'console.log(1)'   # {stdout, stderr, exit_code}
```

One argument is a shell expression, sent as written, so pipes and redirection work.
Several arguments are argv and are quoted individually, so an argument containing
spaces stays one argument.

The remote command's exit code is passed through, so `box exec -- npm test && ...`
chains normally. Exit code **125** means the CLI itself failed (bad box, bad flags),
never a status the remote command returned.

A background server dies with the command that started it. Detach it:

```bash
box exec -- '( npm run dev > dev.log 2>&1 & )'
box public-url 3000                               # prints the public URL
```

## Building something and handing back a link

"Make me a snake game, use Upstash Box" is a request to build it in a box, run it
there, and reply with a URL the user can open. Do the whole thing; do not stop at
writing the file.

```bash
box create --no-repl --runtime node          # writes .box, so later commands need no --box

box files write index.html - <<'HTML'
<!doctype html><meta charset="utf-8"><title>Snake</title>
<canvas id="c" width="400" height="400"></canvas>
<script>/* the game */</script>
HTML

box files write server.js - <<'JS'
const http = require("http"), fs = require("fs");
http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync("index.html"));
}).listen(3000);
JS

box exec -- '( node server.js > server.log 2>&1 & )'          # detached, or it dies
box exec -- 'sleep 1; curl -sf localhost:3000 >/dev/null && echo up'
box public-url 3000                                           # the link to reply with
```

Node's own `http` module rather than a package: no install, no network fetch, and it
works on a bare `node` runtime.

Check the port answers before publishing it. A public URL for a port nothing is
listening on returns 502, which reads as a broken game rather than as a race with a
server that had not finished starting.

Reply with the URL itself, not just "it is running". Say that the box keeps costing
money until `box delete --yes`, and that the URL is public to anyone who has it —
`box public-url 3000 --basic-auth` puts credentials in front of it.

## Files

Paths are relative to `/workspace/home`.

```bash
box files list src
box files read src/index.ts
box files write src/app.ts -    < local.ts    # - reads stdin: use this for code
box files write notes.txt "short text"
box files stat src/index.ts
box files mkdir -p a/b/c
box files rename old.ts new.ts
box files remove build -r                      # a directory needs -r
box files upload ./local.zip /workspace/home/local.zip
box files download repo
```

Write code with `-` and stdin. Passing source as an argument mangles it in the shell.

To search, use the box's own tools: `box exec -- grep -rn TODO src`.

## Git

A clone lands in a directory named after the repo, and every git verb except `clone`
needs that directory via `-C`. Without it git runs at the workspace root, which is not
a repository.

```bash
box git clone https://github.com/org/repo
box git clone https://github.com/org/repo -C my-app   # -C is the destination here
box git status -C repo
box git diff -C repo
box git config -C repo --name "Bot" --email bot@example.com
box git checkout -C repo feature/x             # creates the branch if missing
box git exec -C repo -- add -A
box git commit -C repo -m "message"
box git push -C repo
box git create-pr -C repo --title "Fix the thing" --base main
```

`box git exec` takes git's arguments without the leading `git`, and passes git's exit
code through.

Private repos and PRs need a token at creation: `box create --no-repl --git-token $GITHUB_TOKEN`.

## Agent

If the box was created with an agent, hand it a task:

```bash
box create --no-repl --agent-harness claude-code --agent-model anthropic/claude-sonnet-5
box run "Fix the failing test in src/auth.test.ts"
box run - < prompt.txt
```

Text goes to stdout, tool calls to stderr. Prefer doing the work yourself with the
commands above; `box run` is for delegating a whole task to the box's own agent.

## Output

Data goes to stdout, diagnostics to stderr, so piping is safe. `--json` prints the
result as JSON with no wrapper, on every command that returns data. The ones that
open a REPL or print a shell script (`connect`, `from-snapshot`, `init-demo`,
`completion`) reject it rather than answering an automation caller with a prompt:

```bash
box files list --json | jq -r '.[].name'
box get "$(cat .box)" --json
```
