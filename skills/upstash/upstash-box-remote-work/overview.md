A box is a sandboxed Linux container in the cloud with a shell, a filesystem,
git, an optional headless Chromium, and public URLs for its ports. Everything
here goes through the remote Upstash MCP server. There is no SDK to install
and no API key in the environment (recording videos is the exception, see below): the server forwards the session's OAuth
token to the Box API, and screenshot bytes travel from the box to Blob
without passing through the server.

## When to take work into a box

- The user asks for it: remote, in a sandbox, in the cloud, in a box, not on
  my machine.
- The deliverable is a **pull request**, a **public preview URL**, or a
  **screenshot** of the running result. A box has GitHub credentials, public
  ports and a browser; the local machine often has none of the three.
- The work needs isolation: untrusted or generated code, a heavy dependency
  install, a clean checkout, branches the local tree should not carry.
- The work scales out: several independent tasks, one box each, in parallel.

Once a task is in a box, do all of it there. The box's filesystem is not the
local one, so an edit made locally and a build run in the box act on two
different checkouts, and neither side reports the mismatch.

## Connect

The plugin already registers `https://mcp.upstash.com/mcp`, and the box and
blob tools are part of its default tool set. To add the server by hand:

```bash
claude mcp add --scope user --transport http upstash "https://mcp.upstash.com/mcp"
```

On first use the client opens the Upstash consent page. Pick the account or
team the boxes and buckets should live in, and **turn the read-only switch
off**: every step below except listing is refused with 403 on a read-only
grant.

## Tools

| Tool | Actions / purpose |
|---|---|
| `box_manage` | create, list, get, delete, pause, resume, fork |
| `box_exec` | run a shell command in the box (`command` is an argv array, `folder` is the working directory) |
| `box_git` | clone, status, diff, commit, checkout, push, create_pr |
| `box_preview` | create, list, delete public URLs for ports in the box |
| `box_browser` | goto, content, screenshot, tabs, tab_new, tab_close, live_view |
| `box_snapshots` | create, list, list_all, delete, restore (a new box from a snapshot) |
| `box_logs`, `box_runs` | what happened inside a box, and its run history |
| `box_apikey` | list, create, delete Box API keys for a deployed app or CI (the key outlives the OAuth grant, so tell the user to revoke it when done) |
| `blob_bucket` | list, create (create defaults to `visibility: public`) |
| `blob_upload_url` | presigned PUT URLs for paths in a bucket, plus `public_url` on public buckets |

## The flow: one task, one box

1. **Create.** `box_manage` `create`. Set `browser: true` if you will take
   screenshots or check pages. Use `ephemeral: true` with a `ttl` for
   throwaway work (no paid plan needed); use `keep_alive: true` when a preview
   URL must outlive the session (paid plan). Note the returned `id`.
2. **Clone with `box_git` `clone`**, never with `git` in `box_exec`. The clone
   is what writes the account's GitHub credentials into the box; without it
   `push` and `create_pr` fail with a bare 500. The checkout lands at
   `/workspace/home/<repo name>`. Pass that as `folder` on every later
   `box_exec` and `box_git` call: the default is the workspace root, which is
   not a repository.
3. **Work.** `box_exec` for install, build, tests, and the app itself. Each
   call waits for the command, so detach servers:
   `["sh", "-c", "( pnpm preview --host 0.0.0.0 --port 4321 > /workspace/home/app.log 2>&1 & )"]`,
   then poll the port with `curl` in a second call. Edit files with shell
   commands or a short script in `box_exec`, not with local file tools.
4. **Preview URL.** `box_preview` `create` with the `port`. The app must
   listen on `0.0.0.0`; a server bound to `127.0.0.1` answers curl inside the
   box and still gives 502 through the preview. The URL has the shape
   `https://<box-id>-<port>.preview.box.upstash.com`. Add `basic_auth` or
   `bearer_token` when the page should not be open to anyone with the link;
   the credential is returned once. Say in the reply how long the URL lives:
   an ephemeral box takes it down at `expires_at`.
5. **Screenshots.** `box_browser` `goto` the page on `http://localhost:<port>`,
   then `screenshot`. With no `path` the PNG comes back as an image you can
   look at; with a `path` it is written inside the box and only `{saved,
   bytes}` returns. Look while you work, save the ones that count, and pass
   `full_page: true` for long pages.
6. **Publish screenshots.** GitHub's attachment endpoint rejects the box's
   token, so images go through Blob. `blob_bucket` `list`, and `create` a
   **public** one if none fits (private buckets only serve short-lived
   signed URLs). `blob_upload_url` with `bucket_id` and
   `files: [{path: "<repo>/<branch>/after.png", content_type: "image/png", size: <bytes>}]`,
   minted right before use (a URL lives at most 10 minutes). Then `box_exec`
   the `curl_example` from the result, sending the returned headers verbatim
   (they are part of the signature). Bytes go straight from the box to storage.
7. **Pull request.** `box_git` `checkout` a branch, `commit`, `push` with the
   branch name, then `create_pr` with `base`, `title`, and a `body` that
   carries the preview URL and `![after](<public_url>)` for each screenshot.
   `create_pr` pushes nothing itself. Reply with the PR URL, the preview URL,
   and the screenshot URLs.
8. **Clean up.** `box_manage` `delete` (or `pause`) unless the user wants the
   box or its preview kept. Ephemeral boxes expire on their own.

## Scaling out

- One box per independent task. Create them with a shared `labels` entry,
  drive them in parallel, and `box_manage` `list` with `label` to find and
  delete them at the end. Never run two tasks in one box at once.
- When the client has subagents, give each one its own box and run them in
  parallel; agents sharing a box overwrite each other's files and processes.
- When every task needs the same expensive setup (clone, dependency install,
  build cache), do it once, `box_snapshots` `create`, then `restore` one new
  box per task from the snapshot. `fork` does the same for an idle or paused
  non-ephemeral box.
- `size` is `small`, `medium` or `large`; pick it per task rather than
  oversizing all of them.
- A `live_view` URL lets a person watch a box's browser tab as it works
  (frames out, no input in); hand it over for long runs.

## Recording videos in a box

Recording is not an MCP tool yet, so this is the one flow that needs the SDK.
Create a key with `box_apikey` `create`, keep it in a file inside the box,
drive the box from there with `@upstash/box` (`box.browser.recordings`, and
`box.browser.cdpUrl()` for Playwright), and delete the key when done.

**What gets recorded.** The box browser: every tab, following the foreground
one, at a fixed resolution. Anything else has to be put into the browser. A
terminal program goes through `ttyd` (static binary from its GitHub
releases; Debian has no package) attached to a fixed-size `tmux` session;
send input with `tmux send-keys -l` in small chunks, since TUIs collapse
bracketed pastes; `tmux set -g status off`, or the status bar is in every
frame. Stay in one tab where you can: a newly opened tab is not reliably
followed.

**Running an agent or CLI in the box.** A CLI agent started by hand needs its
own model key; the box's managed key only reaches prompts the Box runner
starts. Get a key into the box without pasting it in chat: serve a one-shot
form from the box (`scripts/secret-form.py`), expose it with `box_preview`,
send the user the link, and it appends the value to a file and exits. A login
that waits on a localhost OAuth callback cannot be tunneled (Box SSH refuses
`-L`). If the CLI lets you set the redirect URI (OpenCode: `oauth.redirect_uri`
in `opencode.json`), point it at a Box preview URL: the callback server still
binds 127.0.0.1 on the URI's port (443 for https, allowed unprivileged), and
previews reach only 0.0.0.0, so relay the preview port to it for the duration
of the grant. Otherwise run the login in the box, let the user approve in
their own browser, and have them paste back the failed
`http://127.0.0.1:<port>/...` URL to `curl` inside the box before the CLI
stops waiting. The consent screen picks the account, so the resources the
recording relies on must exist in that account. For unattended agent runs,
workspace instructions that rule out clarifying questions keep a take from
stalling.

**Bundled scripts** (`scripts/`; generic building blocks, nothing in them
knows what is being recorded). The box needs `ffmpeg tmux fonts-jetbrains-mono
python3-pil` from apt, `ttyd`, `npm i @upstash/box playwright-core tsx`, and a
Box API key in `.env`:

- `lib/recorder.mts` — `connect()` gives a Playwright page on the box browser;
  `record(box, take, body)` starts a recording, waits a pre-roll, runs your
  steps, stops, downloads `full/<name>.mp4` and writes `full/<name>.json` with
  every `take.log()` event in wall-clock ms; `findInTerminal(page, re)` gives
  the pixel position of a line on a ttyd page.
- `render.py <spec.json>` — one ffmpeg run from a cut spec: segments with a
  speed factor (badge drawn for you), captions, a cursor with eased moves and
  clicks, a URL pill. The docstring shows the spec.
- `tty-session.sh '<command>'` — the command in a fixed-size tmux session
  served by ttyd, status bar off.
- `sprites.py` (cursor, press, ripple PNGs), `sheet.py` (contact sheet),
  `secret-form.py` (one-shot form that appends a secret to `.env`).

A take script composes them: connect, `record` around your input steps, build
a spec from the logged events plus the program's own timeline, `render.py`.
The `opencode` skill in upstash/dev-skills has a complete example for an
agent TUI.

**Limits.** A recording lasts at most 600 s and stops by itself after 3
minutes without a pixel change. A box holds one active recording; a leftover
one makes the next `start` return 409, so stop it in a crash handler and
before every start. Record everything you intend to show, including waits you
plan to speed up; a gap cannot be edited back in.

**Timing.** Cut from timestamps, not by eye. Log the wall-clock time of every
action your script takes, take the recorded program's own timeline from
structured output (a session export, logs, API responses) rather than from
the screen, and convert both to video time. Anchor on the end, not the start:
capture begins about 2 s after `startedAt`, so the first frame is
`endedAt - <file duration>` (ffprobe), and `startedAt` puts every cut early.
Text scraped from a terminal breaks at line wraps. Redirect large CLI output
to a file; pipes can truncate it.

**Editing** (ffmpeg):

- Speed up long waits instead of cutting them out; a hard cut reads as a
  glitch. Use round factors (5, 10, 20, 50x), let the segment's length follow
  from the factor, and show the factor on screen as a solid green pill with
  dark text in a corner (`box=1:boxcolor=0x00d48a`), not a translucent badge:
  it has to read at a glance over any background.
- Say what is happening in on-screen text: a short caption per step, held
  long enough to read (about 0.7 s or more), thinned out when steps come fast.
- A headless recording has no pointer and no address bar. Draw a cursor and a
  click marker where input happens, and draw the URL when the address
  matters. Take positions from Playwright bounding boxes (scroll the element
  into view first), or for a terminal from ttyd's `window.term`: cell size is
  the `.xterm-screen` rect divided by `cols` and `rows`, and the row and
  column come from searching `term.buffer.active`.
- Make the cursor look hand-moved. Use a small, thin, anti-aliased arrow
  (about 25 px tall at 1280x800) with a soft shadow. Ease each move in and
  out (smootherstep) along a slight curve (a quadratic Bezier with the control
  point pushed sideways), let it arrive a beat before the click, and add a
  faint drift while it rests. Mark a click with a short press (a slightly
  smaller sprite for about 0.15 s) and a thin ripple that grows and fades
  over about 0.4 s, not a solid ring. Hold the cursor at each segment
  boundary so it does not glide toward the next segment's position.
- Render the ripple as a PNG sequence and delay one copy per click with
  `tpad`. Put the filtergraph in `-filter_complex_script`; commas inside a
  quoted expression still need `\,` (the sketch below leaves that out).

```text
[0:v]trim=T0:T1,setpts=(PTS-STARTPTS)/20,fps=30,
  drawtext=text='20x':fontcolor=0x062b1f:box=1:boxcolor=0x00d48a:boxborderw=10:x=w-tw-30:y=26,
  drawtext=text='<step>':enable='between(t,2.0,2.8)'[fast]
[ripple]format=rgba,tpad=start_duration=<click t>:color=0x00000000[r]
[v][r]overlay=x=<cx-36>:y=<cy-36>:eof_action=pass[v2]
[v2][cursor]overlay=eval=frame:enable='between(t,A,B)':
  x='st(0,clip((t-T0)/D,0,1));st(1,ld(0)^3*(ld(0)*(6*ld(0)-15)+10));
     (1-ld(1))^2*X0+2*(1-ld(1))*ld(1)*XC+ld(1)^2*X1':y='...'
```

Review cuts on an `ffmpeg ... tile=3x3` contact sheet served with
`python3 -m http.server` and opened with `box_browser`, never while a
recording is running (it is the same browser). Publish the video with
`blob_upload_url`.

**Between takes.** An agent recorded with box tools lists what exists before
it creates anything: a box left by the previous take makes it skip the clone
and reuse that box. Delete leftovers first, or say "a fresh box" in the
prompt. Boxes the recorded agent creates live in the account it consented
to, which is not necessarily the one your own session can see.

**Several recordings.** One box per recording, driven in parallel by
subagents when the client has them. Never share a recording box between
agents: the tmux server, the browser and the recording slot are per box, and
two agents silently kill each other's sessions and overwrite each other's
files.

## Gotchas

- Read-only grant → 403 on create, exec, screenshot-to-path, git writes and
  upload URLs. Re-consent with read-only off.
- `box_git` `create_pr` fails if the account has no GitHub installation
  covering the repo; ask the user to connect GitHub in the Upstash console
  under Box settings.
- Prefer `box_git` `clone` over `clone_repo` on `box_manage` `create`: on an
  ephemeral box the option can be ignored, and on a persistent one it runs in
  the background with no completion signal beyond `box_logs`.
- Paths inside the box are relative to `/workspace/home` unless absolute.
  `ls /workspace` itself is denied (root-owned, mode 711).
- The `node` image has no corepack and boxuser cannot `npm i -g`, so a
  `packageManager`-pinned pnpm fails to self-install. Use
  `npx -y pnpm@<version>` or `export npm_config_manage_package_manager_versions=false`
  (the preinstalled pnpm); `sudo npm i -g pnpm@<version>` also works, sudo is
  passwordless.
- `blob_upload_url` headers are signed. A missing or changed `content-type`
  or `cache-control` → 403 from storage (`SignatureDoesNotMatch`). An expired
  URL → mint again.
- Bucket names are account-wide. Reuse one bucket such as `agent-proof` with
  per-repo prefixes rather than creating one per run.
- `box_browser` fails with "browser is not enabled for this box" unless the
  box was created with `browser: true`; there is no way to add it later.
- A public Blob host caches objects for an hour (`cache-control` on the
  upload). Re-uploading to the same path keeps serving the old bytes: publish
  a replacement under a new name, and add a query string when you read back
  something you just overwrote.
- A `box_exec` request times out after 60 s. Detach long jobs with
  `setsid ... &`, poll in later calls, and check the process is still alive.
- `pkill -f <pattern>` in `box_exec` also matches the calling shell's own
  command line and kills the call (exit 143). Write `pkill -f 'patter[n]'`.
- `tmux kill-server` followed at once by `tmux new-session` can fail with
  "server exited unexpectedly"; wait for the old server to exit first.
- The `node` image has no PIL or ImageMagick. `sudo apt-get install` what you
  need, or write small PNGs with Python's `zlib`.
