A box is a sandboxed Linux container in the cloud with a shell, a filesystem,
git, an optional headless Chromium, and public URLs for its ports. Everything
here goes through the remote Upstash MCP server. There is no SDK to install
and no API key in the environment (recording demo videos is the exception, see below): the server forwards the session's OAuth
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

## Demo videos of an agent at work

Recording is not an MCP tool yet, so this is the one flow that needs the SDK.
Create a key with `box_apikey` `create`, keep it in a file inside the
recorder box, drive the box from there with `@upstash/box`
(`box.browser.recordings`, and `box.browser.cdpUrl()` for Playwright), and
delete the key when done.

**Stage.** One recorder box per clip, `browser: true`. Run the agent's TUI in
a fixed-size `tmux` session, serve it with
`ttyd -i 127.0.0.1 -p 7681 tmux attach -t demo` (static binary from the ttyd
GitHub releases; Debian has no package), and open `http://127.0.0.1:7681` in
the box browser at 1280x800, the recording's resolution. Type prompts with
`tmux send-keys -l` in small chunks: TUIs collapse bracketed pastes. Put an
`AGENTS.md` in the agent's workspace: no clarifying questions, verify links
before sharing them, short final reply with each link on its own line.

**Agent credentials.** A CLI agent started by hand in the box needs its own
model key; the box's managed key only reaches prompts the Box runner starts.
The box tools need an OAuth grant. Box SSH refuses `-L` forwarding, so a
localhost OAuth callback cannot be tunneled: start the agent's MCP auth
command in the box, let the user approve in their own browser, have them
paste back the failed `http://127.0.0.1:<port>/...callback?code=...` URL, and
`curl` it inside the box before the agent stops waiting (often 5 minutes).
Consent picks the account, so create buckets in that account (free plans
allow one).

**Record the whole run.** Start the recording before typing and stop it after
the final answer; a timelapse needs the middle. A recording lasts at most 600
s, stops by itself after 3 minutes without a pixel change, and a box holds
one at a time (a leftover one makes the next `start` return 409, so stop it
in a crash handler and before every start). Take the timeline from the
agent's own session export (tool-call start and end times, final text, links)
against the recording's `startedAt`; text scraped from the terminal breaks
URLs at line wraps. Redirect large CLI output to a file, pipes can truncate
it. Shoot the outcome (page, preview, PR) as a second short recording in the
same tab, since a new tab is not reliably followed, and log cursor positions
and click times from Playwright bounding boxes (scroll the element into view
first).

**Edit to under 20 s** with ffmpeg, in four beats:

1. The prompt at real speed, plus about 2 s to read it.
2. The run as a timelapse. A hard cut from prompt to answer reads as a
   glitch. Round the factor to 10, 20, 30, 40 or 50x (5x for short runs) and
   let the beat's length flex around 6-7 s. Show the factor as a badge and
   caption the MCP tool running at that moment
   (`Upstash MCP > blob_upload_url`), at least 0.7 s each; drop generic
   `box_exec` captions when there are many.
3. The final answer at real speed (about 2.5 s), with a cursor that moves onto
   the link and clicks it. ttyd exposes `window.term`: cell size is the
   `.xterm-screen` rect divided by `cols` and `rows`, and the row and column
   come from searching `term.buffer.active`.
4. The outcome, 2.5-4 s, with the URL drawn on top (a headless recording has
   no address bar or pointer). Keep it short when the outcome is not the
   point, as with a hosted page.

```text
[0:v]trim=B0:B1,setpts=(PTS-STARTPTS)/40,fps=30,
  drawtext=text='40x':x=w-tw-28:y=24,
  drawtext=text='Upstash MCP > box_preview':enable='between(t,2.0,2.8)'[b]
[v][cursor]overlay=x='<piecewise-linear in t>':y='...':eval=frame:enable='between(t,T0,T1)'
```

Give the cursor a hold keyframe at the end of each beat, or it drifts toward
the next beat's first position. Check cuts on an `ffmpeg ... tile=3x3`
contact sheet served with `python3 -m http.server` and opened with
`box_browser`, never while a take is recording (it is the same browser).
Upload the MP4 with `blob_upload_url`.

**Several clips.** One recorder box per clip, driven in parallel by
subagents when the client has them. Never share a recorder box between
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
- A `box_exec` request times out after 60 s. Detach long jobs with
  `setsid ... &`, poll in later calls, and check the process is still alive.
- `pkill -f <pattern>` in `box_exec` also matches the calling shell's own
  command line and kills the call (exit 143). Write `pkill -f 'patter[n]'`.
- `tmux kill-server` followed at once by `tmux new-session` can fail with
  "server exited unexpectedly"; wait for the old server to exit first.
- The `node` image has no PIL or ImageMagick. `sudo apt-get install` what you
  need, or write small PNGs with Python's `zlib`.
