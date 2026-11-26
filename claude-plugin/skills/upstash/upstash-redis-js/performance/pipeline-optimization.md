# Pipeline Optimization

## Overview

Pipelines batch multiple Redis commands into one HTTP request. Use automatic pipelines for Promise.all patterns, manual pipelines for sequential operations.

## Good For

- Multiple independent operations
- High-latency networks
- Serverless functions with cold starts
- Operations that don't depend on each other's results

## Limitations

- Commands in pipeline cannot depend on previous results
- Large pipelines increase memory usage
- Errors in one command don't stop others

## Examples

### Auto-Pipeline Basics

```typescript
import { Redis } from "@upstash/redis";

// Auto-pipeline is on by default (enableAutoPipelining: false turns it off)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// With auto-pipeline: Promise.all batches automatically
const [user, postCount, commentCount] = await Promise.all([
  redis.get("user:1"),
  redis.llen("posts:1"),
  redis.llen("comments:1"),
]);
// Single HTTP request. Reads and writes go in separate requests, and range/scan
// commands such as lrange, zrange and hgetall are not batched (see auto-pipeline.md).
```

### Manual Pipeline

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Manual pipeline: explicit control
const pipeline = redis.pipeline();
pipeline.get("user:1");
pipeline.lrange("posts:1", 0, 9);
pipeline.lrange("comments:1", 0, 9);

const results = await pipeline.exec();
```

### When to Use Pipelines

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// ❌ Bad: second operation depends on first
const bad = redis.pipeline();
bad.get("counter");
bad.incr("counter"); // Might not see previous get result
await bad.exec();

// ✅ Good: independent operations
const good = redis.pipeline();
good.get("user:1");
good.get("user:2");
good.get("user:3");
await good.exec();
```

### Pipeline Size Optimization

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const OPTIMAL_SIZE = 50;

async function pipelinedBatch(keys: string[]) {
  const results = [];
  for (let i = 0; i < keys.length; i += OPTIMAL_SIZE) {
    const batch = keys.slice(i, i + OPTIMAL_SIZE);
    const pipeline = redis.pipeline();
    batch.forEach((key) => pipeline.get(key));

    const batchResults = await pipeline.exec();
    results.push(...batchResults);
  }

  return results;
}

// Usage
const keys = Array.from({ length: 200 }, (_, i) => `key:${i}`);
const allResults = await pipelinedBatch(keys);
```
