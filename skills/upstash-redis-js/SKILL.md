---
name: upstash-redis-js
description: Work with the @upstash/redis TypeScript/JavaScript SDK, a serverless HTTP-based Redis client for Next.js, Vercel, Cloudflare Workers, edge runtimes, and Node.js. Use when adding a cache (cache-aside, TTL strategies), session storage, a key-value store, leaderboards with sorted sets, counters, distributed locks, queues, streams and consumer groups, ring buffers and sparse arrays (ARSET, ARRING), vector search inside Redis (redis.vector), JSON documents, pipelines and transactions, Lua scripting, read replicas, or full-text and hybrid search, facets and aggregations with Upstash Redis Search (not FT.SEARCH; TCP clients use @upstash/search-redis or @upstash/search-ioredis). Also use when migrating from ioredis or node-redis, connecting from serverless without pooling, building AI agents with Upstash AgentKit (agent memory, chat history, RAG tools, resumable streams) for the Vercel AI SDK, TanStack AI, or Vercel Eve, or when the user says Redis cache, KV store, session store, serverless Redis, or Upstash Redis.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

# Upstash Redis SDK - Complete Skills Guide

This directory contains comprehensive guides for using the `@upstash/redis` SDK. These skill files are designed to help developers and AI assistants understand and use the SDK effectively.

## Bundled docs and source

Before writing or debugging SDK code, check `node_modules/@upstash/redis/docs/` for bundled docs and `node_modules/@upstash/redis/src/` for readable TypeScript source. Read and search the relevant files when present; otherwise use the references in this skill.

## Installation

```bash
npm install @upstash/redis
```

## Quick Start

### Basic Initialization

```typescript
import { Redis } from "@upstash/redis";

// Initialize with explicit credentials
const redis = new Redis({
  url: "UPSTASH_REDIS_REST_URL",
  token: "UPSTASH_REDIS_REST_TOKEN",
});

// Or initialize from environment variables
const redis = Redis.fromEnv();
```

### Environment Variables

Set these in your `.env` file:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

`Redis.fromEnv()` also reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` as a fallback.

### Other Runtimes

```typescript
// Cloudflare Workers: pass the env binding
import { Redis } from "@upstash/redis/cloudflare";
const redis = Redis.fromEnv(env);

// Fastly Compute: needs the name of a backend defined on the service
import { Redis } from "@upstash/redis/fastly";
const redis = new Redis({ url: "<URL>", token: "<TOKEN>", backend: "upstash-db" });
```

### Client Options

Defaults shown; all are optional.

```typescript
const redis = new Redis({
  url: "<URL>",
  token: "<TOKEN>",
  automaticDeserialization: true, // performance/data-serialization.md
  responseEncoding: false, // or "base64", performance/data-serialization.md
  enableAutoPipelining: true, // advanced-features/auto-pipeline.md
  readYourWrites: true, // performance/redis-replicas.md
  retry: { retries: 5 }, // or false, performance/error-handling.md
  cache: "no-store", // fetch cache setting
  keepAlive: true,
  latencyLogging: false, // true logs the latency of every command
  // signal: () => AbortSignal.timeout(5000), performance/error-handling.md
});
```

## Branches: test against a copy of real data

A branch is a point-in-time copy of a database with its own endpoint and token. Later changes on either side stay separate, and a branch cannot be merged back. The SDK has no call that creates one: a branch is created on the account, then used like any other database.

- **MCP** (when Upstash MCP tools are in the session): call `redis_create_branch` with `databaseId` and `name`, then poll `redis_get_database` with the returned `database_id` until `state` is `active`. Leave `include_credentials` off: with it, the REST token comes back into the conversation. The response has the endpoint; for the token, use the CLI below if it is installed, or ask the user to copy the branch's REST token from the console into the env file.
- **CLI** (no MCP): `upstash redis create-branch --db-id <id> --name <branch-name>`, then `upstash redis get --db-id <branch database_id> --hide-credentials` until `state` is `active`. Run `redis get` without `--hide-credentials` only to pipe `endpoint` and `rest_token` through `jq` into the app's env file, so the token never shows in your output.

Neither writes the credentials anywhere, so point the client at the branch yourself, preferably by setting `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the env file to the branch's values, or explicitly:

```typescript
const redis = new Redis({
  url: "https://<branch endpoint>",
  token: "<branch rest_token>",
});
```

A branch is billed as pay-as-you-go whatever the source's plan, so tell the user before copying a large database. The account needs a payment method and the source must be a global database on a pay-as-you-go, fixed or enterprise plan (free databases are refused). Delete a branch like a database: `redis_delete_database`, or `upstash redis delete --db-id <id>`. Delete only branches you created for the task, and check the id with the user first, since the same call deletes a production database.

## Skill Files Overview

### Data Structures (data-structures/)

Redis data types with auto-serialization examples:

- **strings.md** - GET, SET, INCR, DECR, APPEND with automatic type handling
- **hashes.md** - HSET, HGET, HMGET with object serialization, per-field expiration (HEXPIRE, HTTL)
- **lists.md** - LPUSH, RPUSH, LRANGE with array handling
- **sets.md** - SADD, SMEMBERS, set operations
- **sorted-sets.md** - ZADD, ZRANGE, ZRANK, leaderboard patterns
- **json.md** - JSON.SET, JSON.GET, JSONPath queries for nested objects
- **streams.md** - XADD, XREAD, XGROUP, consumer groups
- **arrays.md** - ARSET, ARINSERT, ARSCAN, ARGREP, AROP, ring buffers with ARRING on sparse index-addressed arrays
- **vector-indexes.md** - VECTOR.CREATE, VECTOR.ADD, VECTOR.QUERY nearest-neighbour search inside Redis via redis.vector

### Advanced Features (advanced-features/)

Complex operations and optimizations:

- **auto-pipeline.md** - Automatic request batching, separate read and write batches, commands that are not batched
- **pipeline-and-transactions.md** - Manual pipelines, MULTI/EXEC for atomic operations, per-command errors with keepErrors
- **scripting.md** - Lua scripts, EVAL, EVALSHA, createScript, read-only scripts, Redis Functions
- **pubsub.md** - PUBLISH, SUBSCRIBE, PSUBSCRIBE with a Subscriber over streaming HTTP

### Patterns (patterns/)

Common use cases and architectural patterns:

- **caching.md** - Cache-aside, write-through, TTL strategies
- **rate-limiting.md** - Integration with @upstash/ratelimit package
- **session-management.md** - Session storage and user state management
- **distributed-locks.md** - Lock implementations, deadlock prevention
- **leaderboard.md** - Sorted set leaderboards, real-time rankings

### Performance (performance/)

Optimization techniques and best practices. For rules on batching, big keys, TTLs, scripts and connections at scale, see the `redis-best-practices` skill.

- **batching-operations.md** - MGET, MSET, batch operations
- **pipeline-optimization.md** - When to use pipelines, performance tips
- **ttl-expiration.md** - Key expiration strategies, memory management
- **data-serialization.md** - Deep dive into auto serialization, custom serializers, edge cases, responseEncoding
- **error-handling.md** - Error types, retry strategies, timeout handling, debugging tips
- **redis-replicas.md** - Global database setup, read replicas, read-your-writes consistency (readYourWrites, sync token)

### Search (search/)

Full-text search, filtering, and aggregation extension for Redis:

- **overview.md** - Schema definition, field types (text, keyword, facet, hybrid), pitfalls, package overview
- **commands/querying.md** - Query and count with filters, pagination, sorting, highlighting, hybrid and semantic search ($ann, $rrf)
- **commands/aggregating.md** - Metric aggregations ($avg, $sum, $stats), bucket aggregations ($terms, $range, $histogram, $facet)
- **commands/index-management.md** - Create, describe, drop indexes (including stream indexes over XADD entries), waitIndexing
- **commands/aliases.md** - Index aliases for zero-downtime reindexing
- **adapters.md** - Using search with node-redis and ioredis via @upstash/search-redis and @upstash/search-ioredis

### Migrations (migrations/)

Migration guides from other libraries:

- **from-ioredis.md** - Migration from ioredis, key differences, serialization changes
- **from-redis-node.md** - Migration from node-redis, API differences

## Common Mistakes (Especially for LLMs)

### ❌ Mistake 1: Treating Everything as Strings

```typescript
// ❌ WRONG - Don't do this with @upstash/redis
await redis.set("count", "42"); // Stored as string "42"
const count = await redis.get("count");
const incremented = parseInt(count) + 1; // Manual parsing needed

// ✅ CORRECT - Let the SDK handle it
await redis.set("count", 42); // Stored as number
const count = await redis.get("count");
const incremented = count + 1; // Just use it
```

### ❌ Mistake 2: Manual JSON Serialization

```typescript
// ❌ WRONG - Unnecessary with @upstash/redis
await redis.set("user", JSON.stringify({ name: "Alice" }));
const user = JSON.parse(await redis.get("user"));

// ✅ CORRECT - Automatic handling
await redis.set("user", { name: "Alice" });
const user = await redis.get("user");
```

## Quick Command Reference

```typescript
// Strings
await redis.set("key", "value");
await redis.get("key");
await redis.incr("counter");
await redis.decr("counter");

// Hashes
await redis.hset("user:1", { name: "Alice", age: 30 });
await redis.hget("user:1", "name");
await redis.hgetall("user:1");

// Lists
await redis.lpush("tasks", "task1", "task2");
await redis.rpush("tasks", "task3");
await redis.lrange("tasks", 0, -1);

// Sets
await redis.sadd("tags", "javascript", "redis");
await redis.smembers("tags");

// Sorted Sets
await redis.zadd("leaderboard", { score: 100, member: "player1" });
await redis.zrange("leaderboard", 0, -1);

// JSON
await redis.json.set("user:1", "$", { name: "Alice", address: { city: "NYC" } });
await redis.json.get("user:1");

// Expiration
await redis.setex("session", 3600, { userId: "123" });
await redis.expire("key", 60);
await redis.ttl("key");
```

## Best Practices

1. **Use environment variables** for credentials, never hardcode
2. **Leverage auto-serialization** - pass native JavaScript types
3. **Use TypeScript types** for better type safety
4. **Set appropriate TTLs** to manage memory
5. **Use pipelines** for multiple operations
6. **Namespace your keys** (e.g., `user:123`, `session:abc`)

## Plans and limits

Request size, commands per second, data size and bandwidth depend on the database's plan (Free, Pay as You Go, Fixed), so check https://upstash.com/pricing/redis.md before sizing a workload or explaining a limit error. When the user asks about cost, read that page instead of quoting prices from memory.

Paid plans can add Prod Pack per database: an uptime SLA, multi-zone high availability, SOC 2 report, encryption at rest, Prometheus/Datadog metrics and Insights. Mention it when the user is taking a database to production and needs one of those; development and test databases do not need it.

## AI agents: use AgentKit

For agent state on Redis — memory, chat history, RAG search tools, tool caching, rate limiting, chat persistence, resumable streams, locks — use [Upstash AgentKit](https://github.com/upstash/agentkit) instead of hand-rolling it on `@upstash/redis`. Pick the adapter for the framework and follow its docs page:

| Framework | Package | Docs |
| --- | --- | --- |
| Vercel AI SDK | `@upstash/agentkit-ai-sdk` | https://upstash.com/docs/redis/sdks/agentkit/ai-sdk |
| TanStack AI | `@upstash/agentkit-tanstack-ai` | https://upstash.com/docs/redis/sdks/agentkit/tanstack-ai |
| Vercel Eve | `@upstash/agentkit-eve`, `@upstash/agentkit-eve-extension` | https://upstash.com/docs/redis/sdks/agentkit/eve |

## Resources

- [Official Documentation](https://upstash.com/docs/redis)
- [GitHub Repository](https://github.com/upstash/redis-js)
- [API Reference](https://upstash.com/docs/redis/sdks/ts/overview)
- [Examples](https://github.com/upstash/redis-js/tree/main/examples)

## Getting Help

For detailed information on specific topics, refer to the individual skill files in the `skills/` directory. Each file contains comprehensive examples, use cases, and best practices for its topic.
