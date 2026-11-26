# Automatic Pipelining

## Overview

Automatic pipelining batches multiple Redis commands into a single HTTP request, reducing round-trip latency for independent operations.

It's enabled by default. Use `enableAutoPipelining: false` to disable automatic pipelining.

## Good For

- Multiple independent GET/SET operations
- Batch reads across different keys
- Reducing latency in high-latency networks
- Serverless environments with cold starts

## Limitations

- Only works with independent commands (no command depends on another's result)
- Not beneficial for single commands
- Not batched, each is its own request: `scan`, `keys`, `dbsize`, `flushdb`, `flushall`, `hgetall`, `hkeys`, `hscan`, `lrange`, `smembers`, `sscan`, `xrange`, `xrevrange`, `zrange`, `zscan`, and `redis.search` / `redis.vector` calls
- A batch holds at most 1000 commands, larger ones are split into more requests

## Examples

```typescript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Without auto-pipeline: 3 separate HTTP requests
// With auto-pipeline: 1 HTTP request containing all 3 commands
const [user, posts, comments] = await Promise.all([
  redis.get("user:1"),
  redis.get("posts:1"),
  redis.get("comments:1"),
]);

// Auto-pipeline batches these independent operations
async function fetchUserData(userId: string) {
  const [profile, settings, activity] = await Promise.all([
    redis.hmget(`user:${userId}:profile`, "name", "email"),
    redis.hget(`user:${userId}:settings`, "theme"),
    redis.zcard(`user:${userId}:activity`),
  ]);

  return { profile, settings, activity };
}
```

### Reads and writes are batched separately

Since 1.38.0, commands issued together go into two pipelines, one for reads and one for writes, sent as parallel HTTP requests. A read is not guaranteed to see a write from the same `Promise.all`:

```typescript
// WRONG: the get can run before the set
const [, value] = await Promise.all([redis.set("key", "value"), redis.get("key")]);

// CORRECT: await the write, then read
await redis.set("key", "value");
const value = await redis.get("key");
```

Use `redis.pipeline()` or `redis.multi()` when commands must run in order in one request.

A failed command rejects only its own promise with an `UpstashError`; the other commands in the batch still resolve.
