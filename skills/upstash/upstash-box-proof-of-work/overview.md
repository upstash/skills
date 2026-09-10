Everything here runs through the remote Upstash MCP server. There is no SDK to
install and no API key in the environment: the server forwards the session's
OAuth token to api.upstash.com and to the Box API, and the bytes of every
screenshot travel from the box to Blob without passing through the server.

## Connect

The plugin already registers `https://mcp.upstash.com/mcp`, and the box and
blob tool groups are part of the default set. To add the server by hand, or to
scope a connection to just these tools:

```bash
claude mcp add --scope user --transport http upstash "https://mcp.upstash.com/mcp?features=box,blob"
```

On first use the client opens the Upstash consent page. Pick the account or
team the boxes and buckets should live in, and **turn the read-only switch
off**: every step below except listing is refused with 403 on a read-only
grant.

## Tools

| Tool | Actions / purpose |
|---|---|
| `box_manage` | create, list, get, delete, pause, resume, fork |
| `box_exec` | run a shell command in the box (`command` is an argv array, `folder` optional) |
| `box_browser` | goto, content, screenshot, tabs, tab_new, tab_close, live_view |
| `box_git` | clone, status, diff, commit, checkout, push, create_pr |
| `box_preview` | create, list, delete public URLs for ports in the box |
| `box_logs`, `box_runs`, `box_snapshots` | debugging, history, state save/restore |
| `box_apikey` | list, create, delete Box API keys for a deployed app or CI (the key outlives the OAuth grant, so tell the user to revoke it when done) |
| `blob_bucket` | list, create (create defaults to `visibility: public`) |
| `blob_upload_url` | presigned PUT URLs for paths in a bucket, plus `public_url` on public buckets |

`box_browser` `screenshot` with no `path` returns the image to you as an MCP
image block, so you can look at it. With `path`, the PNG is written **inside
the box** at that path and only `{saved, bytes}` comes back. Use both: look
while you work, save the ones that count.

`live_view` returns a watch-only page. Hand the URL to a human to follow
along; no clicks or typing go in. If the human must interact, put the app
behind `box_preview` and send that URL instead.

## The flow

1. **Box.** `box_manage` `create` with `browser: true` (the browser tools fail
   without it), then `box_git` `clone` the repository. Note the returned `id`.
2. **Work.** `box_browser` `goto` the URL, `content` to read it, `screenshot`
   (no path) to see it. `box_exec` for anything shell-shaped: install, build,
   run tests, start the app.
3. **Proof.** At each milestone take a screenshot **with a path**, e.g.
   `proof/01-before.png`, `proof/02-after.png`. Keep the returned `bytes`;
   passing it as `size` when minting upload URLs pins each URL to that exact file.
4. **Bucket.** `blob_bucket` `list`. If there is no suitable **public** bucket,
   `blob_bucket` `create` with `visibility: public`. Links in a PR must keep
   working; private buckets only serve short-lived signed URLs.
5. **Upload URLs.** `blob_upload_url` with `bucket_id` and `files` as
   `[{path: "proof/<repo>/<branch>/01-before.png", content_type: "image/png", size: <bytes>}, ...]`.
   Mint these **right before uploading**: a URL lives at most 10 minutes.
6. **Upload from the box.** For each file, `box_exec` a curl PUT that sends
   the returned `headers` verbatim, since they are part of the signature:

   ```bash
   curl -sS -f -X PUT -H "content-type: image/png" -H "cache-control: <as returned>" \
     --upload-file proof/01-before.png "<upload_url>"
   ```

   The tool result includes a `curl_example` built from the first file's real
   headers; copy its shape.
7. **PR.** `box_git` `checkout` a branch, `commit`, `push`, then `create_pr`
   with a body that embeds the `public_url` of each screenshot:

   ```markdown
   ## Proof of work
   ![before](https://<hash>.blob.upstash.io/proof/.../01-before.png)
   ![after](https://<hash>.blob.upstash.io/proof/.../02-after.png)
   ```

   `create_pr` uses the GitHub installation linked to the Upstash account;
   it does not push for you.
8. **Clean up.** `box_manage` `delete` (or `pause`) the box unless the user
   wants to keep it. Ephemeral boxes expire on their own.

## Gotchas

- Read-only grant → 403 on create, exec, screenshot-to-path, git writes and
  upload URLs. Re-consent with read-only off.
- `blob_upload_url` headers are signed. A missing or changed `content-type`
  or `cache-control` → 403 from storage (`SignatureDoesNotMatch`).
- Expired upload URL → mint again; nothing else is needed.
- Prefer `box_git` `clone` over `clone_repo` on `box_manage` `create`: on an
  ephemeral box the option can be ignored, and on a persistent one it runs in
  the background with no completion signal beyond `box_logs`.
- `box_git` `create_pr` fails if the account has no GitHub installation
  covering the repo; ask the user to connect GitHub in the Upstash console
  under Box settings.
- Paths inside the box are relative to the workspace root (`/workspace/home`)
  unless absolute. `ls /workspace` itself is denied (root-owned, mode 711).
- `box_exec` runs the command to completion. Detach long-running processes
  yourself: `["sh", "-c", "( cmd > log 2>&1 & )"]`.
- The `node` image has no corepack and boxuser cannot `npm i -g`, so a
  `packageManager`-pinned pnpm fails to self-install. Use
  `export npm_config_manage_package_manager_versions=false` (the preinstalled
  pnpm) or `sudo npm i -g pnpm@<ver>` (sudo is passwordless).
- `gh --attach` does not work from a box: GitHub rejects the box's App token
  on the attachment endpoint. Blob is the way to get images into a PR body.
- Bucket names are account-wide. Reuse one bucket such as `agent-proof` with
  per-repo prefixes rather than creating one per run.
- Screenshots are PNG; pass `full_page: true` for long pages.
