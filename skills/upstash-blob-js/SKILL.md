---
name: upstash-blob-js
description: Work with the @upstash/blob TypeScript/JavaScript SDK for S3-compatible object storage with direct browser uploads, presigned URLs, multipart, and signed reads. Use when storing files or blobs, uploading avatars, images, videos, attachments or user documents, letting a browser upload straight to storage without proxying bytes through a server, generating public or time-limited signed URLs, serving private files, streaming large files with pause and resume, setting cache headers on stored objects, or reaching an S3-compatible bucket from the AWS SDK.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

# @upstash/blob SDK

S3-compatible object storage. `Bucket` runs on your server; `uploadHandler` plus React hooks upload from the browser straight to storage so the bytes never pass through your app.

## Bundled docs and source

The `@upstash/blob` npm package includes docs in `node_modules/@upstash/blob/docs/` and readable TypeScript source in `node_modules/@upstash/blob/src/`. Before writing or debugging SDK code, read and search the relevant docs and source.

## Install & Setup

```bash
npm install @upstash/blob
```

Create a bucket in the console and set `UPSTASH_BLOB_TOKEN`. The token is a bearer secret for the whole bucket — keep it server side, never in `NEXT_PUBLIC_` or any bundler-inlined variable.

A bucket is **public** (every object has a URL) or **private** (no URL; reads go through `signedReadUrl`). That is a console setting, not a client option — the SDK learns it from the backend.

```ts
import { Bucket } from "@upstash/blob"

export const bucket = Bucket.fromEnv()                          // reads UPSTASH_BLOB_TOKEN
Bucket.fromEnv({ cache: "immutable" })                        // default variable, plus options
Bucket.fromEnv("MEDIA_TOKEN", { cache: "immutable" })           // another variable, plus options
new Bucket({ token: env.UPSTASH_BLOB_TOKEN })                   // Workers: no process.env
Bucket.fromEnv({ retry: { retries: 4, backoff: (n) => 250 * 2 ** n } })   // or retry: false
```

Failed requests (5xx, 429, dropped connection) are retried twice by default with jittered backoff. `retry` changes the count and the wait in ms (`n` counts from 0; a `Retry-After` from the service wins), and `retry: false` sends each request once.

## Writing

```ts
const blob = await bucket.put("reports/q3.pdf", pdf, { contentType: "application/pdf" })
blob.url            // public URL, undefined on a private bucket
blob.versionedUrl   // url + ?v=<etag>, changes whenever the bytes do
blob.etag           // what ifUnchanged takes
```

Bodies: `Request`, `Blob`/`File`, `ArrayBuffer`, typed array, `string`, `ReadableStream`. A stream carries no length — pass `size` (exact, streams through) or `maxSize` (buffers up to the cap), or `put` throws `length_required`.

| Option | Default | What it does |
|--------|---------|--------------|
| `contentType` | the body's, else `application/octet-stream` | What the object is stored as |
| `contentTypes` | any | Allow list, e.g. `["image/*", "application/pdf"]` |
| `maxSize` | none | Refuse a bigger body with `too_large` |
| `cache` | bucket default | `Cache-Control` stored with the object |
| `metadata` | none | `x-amz-meta-*`; printable ASCII values, keys are read back lowercased |
| `allowOverwrite` | `true` | `false` refuses if something is there (`already_exists`) |
| `ifUnchanged` | none | An etag; fails with `conflict` if it changed |
| `multipart` | `'16mb'` | Threshold for going up in parts; `true`/`false` force it |

Sizes are **decimal**: `'20mb'` is 20,000,000 bytes, too small for a 20 MiB file. Binary units are explicit: `'20mib'` is 20 * 1024 * 1024. Unit names ignore case.

```ts
import { uniquePath } from "@upstash/blob"

uniquePath(`${user.id}/${file.name}`)   // 'u7/Holiday Pic-3xK9mBqR.png'
```

`uniquePath` adds a random suffix to the final filename, before its extension, so two uploads of `photo.png` never collide. Everything else is kept as given (case, spaces, Unicode, slashes), so a value can add directories. Nothing is validated here: a path with `.` or `..` segments is refused by the call that uses it (`invalid_input` from an upload route). Store the returned path and authorize reads and deletes against the stored owner and exact path.

`bucket.copy(from, to, { contentType, cache, metadata })` and `bucket.move(from, to, options)` preserve source properties you omit. `bucket.updateJson(path, fn, { maxAttempts: 6 })` retries a read-modify-write on conflict with backoff.

## Reading

```ts
const res = await bucket.get("reports/q3.pdf")   // record + body: ReadableStream
const info = await bucket.info("reports/q3.pdf") // same record, no bytes (HEAD)
await bucket.exists("avatars/u7.png")            // boolean instead of a throw
const page = await bucket.list({ prefix: "avatars/", limit: 1000 })
```

`get`/`info` throw `not_found`. Nothing is buffered — wrap the stream to read it:

```ts
await new Response((await bucket.get("notes/1.md")).body).text()
```

`list` pages with `page.cursor` (set only while more remains) and carries no `contentType` or `metadata`. `prefix` is the only filter — **keep your own table as the index** and treat the bucket as storage, not a queryable store.

```ts
const { url, expiresAt } = await bucket.signedReadUrl("private/report.pdf", {
  expiresIn: "2m",
  downloadAs: "Report Q3.pdf",   // save under this name instead of rendering inline
})
```

A signed link lives at most 10 minutes (default 5 for a read); a longer `expiresIn` gets 10. Cache the link until `expiresAt`, never a deadline you compute. `await bucket.publicUrl(path)` returns the public URL, `undefined` on a private bucket.

`signedUploadUrl` is the write counterpart, for one PUT from a client that is not using the upload handler. Send `headers` exactly as returned: they are part of the signature.

```ts
const upload = await bucket.signedUploadUrl("u/7/report.pdf", { contentType: "application/pdf", size })
await fetch(upload.url, { method: "PUT", headers: upload.headers, body })
```

It also takes `expiresIn` (default and maximum `'10m'`), `cache`, `metadata` and `allowOverwrite`. A path with an empty segment (`dir/`, `a//b`) cannot be signed.

## Deleting

```ts
await bucket.del("avatars/me.png")            // one path
await bucket.del(["a.png", "b.png"])          // an array, batched by 1000
await bucket.del({ prefix: "tmp/" })          // everything under a prefix
```

Already-gone counts as success, so deletes are safe to retry. An array or prefix delete where objects survive throws `partial_delete` with them in `e.failed`. `del({ prefix: '' })` is refused unless you pass `all: true`.

## Browser uploads

The handler authorizes and records; the bytes go browser → storage, so platform request body caps don't apply. Supply your application's `getUser` and `db.files.upsert` implementations below.

```ts
// lib/uploads.ts
import "server-only"
import { BlobError, uniquePath, uploadHandler } from "@upstash/blob"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"

export const uploads = uploadHandler({
  constraints: { maxSize: "20mb", contentTypes: ["image/*", "application/pdf"] },

  onBeforeUpload: async ({ request, file }) => {
    const user = await getUser(request)
    if (!user) throw new BlobError("unauthorized")     // nothing is signed
    return { path: uniquePath(`${user.id}/${file.name}`), metadata: { owner: user.id } }
  },

  onUploadComplete: async ({ uploadId, path, url, metadata }) => {
    if (!metadata.owner) throw new BlobError("unauthorized")
    await db.files.upsert({ id: uploadId, owner: metadata.owner, path, url })
    return { path }                                    // becomes upload.blob.data
  },
})
```

```ts
// app/api/upload/route.ts
import { uploads } from "@/lib/uploads"

export const { GET, POST } = uploads
```

```ts
// lib/upload-hooks.ts
"use client"
import { uploadHooks } from "@upstash/blob/react"
import type { uploads } from "./uploads"

export const { useUpload } = uploadHooks<typeof uploads>()
```

```tsx
"use client"
import { useUpload } from "@/lib/upload-hooks"

export function UploadForm() {
  const { start, upload, accept } = useUpload()

  return <>
    <input type="file" accept={accept} onChange={(e) => start({ file: e.target.files?.[0] })} />
    {upload?.pending && <progress value={upload.percent} max={100} />}
    {upload?.status === "done" && <a href={upload.blob.url}>{upload.blob.data.path}</a>}
    {upload?.status === "error" && <p>{upload.error.message}</p>}
  </>
}
```

`GET` serves the route's constraints, so `accept` fills the file dialog and an oversized file is refused before any request leaves the browser. `uploadHooks<typeof uploads>()` types route names and completion data at compile time; `import type` keeps server code out of the bundle.

This example assumes a **public** bucket. On a private one `url` is `undefined`, so store `path` instead and hand the client a `bucket.signedReadUrl(path)` when it needs to read.

`onBeforeUpload` runs only on the first request of an upload. To check the session on every request, add `context`: it runs on each POST before any body is read, and its value is `ctx` in every callback. `state` returned from `onBeforeUpload` reaches `onUploadComplete` typed, with no annotation (on a handler without `routes`; a named route gets a typed `state` through `uploadRoute()`).

```ts
export const uploads = uploadHandler({
  context: async (request: Request) => {              // write it above the callbacks that read ctx
    const user = await getUser(request)
    if (!user) throw new BlobError("unauthorized")
    return user
  },
  onBeforeUpload: ({ ctx, file }) => ({ path: uniquePath(`${ctx.id}/${file.name}`), state: { ownerId: ctx.id } }),
  onUploadComplete: async ({ state, path }) => {
    await db.files.upsert({ path, ownerId: state.ownerId })
  },
})
```

Two rules that bite:

- **`onUploadComplete` can run more than once.** The browser retries it, so upsert on `uploadId` rather than inserting.
- **A throw out of `onUploadComplete` deletes the object.** That is right for a refusal and wrong for a transient database error — catch your own storage errors.

Files over 16 MB go up in parts, four at a time, which is what gives `pause()`, `resume()`, per-part retry, and resume-after-reload when the user picks the same file again. `percent` caps at 99 until `status` is `done`; drive UI off `upload.pending`.

An error whose hint says the browser blocked the request before sending any bytes is CORS: add the page's origin to the bucket's CORS origins in the Upstash Console. The route logs a `[upstash-blob]` warning for such an origin too.

Without React, `upload(file, { route: "/api/upload" })` from `@upstash/blob/browser` returns the same task (`await task.done`). It needs `XMLHttpRequest`: in Node or any server runtime it throws `invalid_input`, so use `bucket.put` there.

Use `multipart: true` on the handler to make every upload multipart. Then a closed tab leaves incomplete parts rather than a stored object nobody recorded, and one cron cleans up:

```ts
await bucket.abortStaleMultipartUploads({ olderThan: "1d" })
```

For routes where the bytes must pass through your app, write an ordinary route calling `bucket.put` and drive it with `useServerUpload` from `@upstash/blob/react`.

## Caching

`cache` is written once, at upload, and stored with the object — changing it means writing the object again.

| Value | Stored |
|-------|--------|
| `'immutable'` | `public, max-age=31536000, immutable` |
| `'revalidate'` | `public, max-age=0, must-revalidate` |
| `'no-store'` | `no-store` |
| a duration (`'15m'`, `3600`) | `public, max-age=<seconds>` |

`immutable` needs a path that changes when the bytes do — either `uniquePath` per upload, or a stable path served through `versionedUrl`. On a private bucket `private` replaces `public`.

## Errors

```ts
import { BlobError } from "@upstash/blob"

if (BlobError.is(e) && e.code === "not_found") return null
```

Use `BlobError.is()`, never `instanceof` — an ESM and a CJS copy are different classes. Codes: `not_found`, `already_exists`, `conflict`, `content_type_not_allowed`, `invalid_input`, `too_large`, `empty_body`, `length_required`, `signature_mismatch`, `unauthorized`, `forbidden`, `rate_limited`, `not_ready`, `partial_delete`, `move_left_a_copy`, `invalid_content_type_pattern`, `mint_backoff`, `request_failed`.

A refusal keeps its code all the way to the browser, so hooks switch on `error.code` rather than status numbers. Bad option values (`'5mib'`, a missing token) throw a `TypeError` where they are written, not a `BlobError` per request.

## S3 clients

```ts
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

const config = bucket.s3()
const s3 = new S3Client(config)   // endpoint and credentials are async providers

// config.bucket is the underlying bucket id, available nowhere else
await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: "reports/q3.pdf" }))
```

Buckets are S3-compatible. Use this for what the SDK doesn't wrap — byte ranges, conditional GETs, tagging. Pass the providers through as they come so the AWS SDK can refresh an expired credential.

## Plans and limits

Storage, egress and operation counts depend on the plan (Free, Pay as You Go), so check https://upstash.com/pricing/blob.md before sizing a workload or explaining a bucket that stopped serving. When the user asks about cost, read that page instead of quoting prices from memory.

A Free bucket stops serving once it passes a monthly cap, until its 30-day window rolls over, so put public files with real traffic on Pay as You Go. Every upload, multipart part, list, copy and rename bills as a write, which costs more than a read; deletes are free.
