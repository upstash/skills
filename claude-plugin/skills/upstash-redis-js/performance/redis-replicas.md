# Global Redis Replicas

## Overview

Upstash Redis uses global replication with one primary and multiple replicas worldwide. Writes go to primary, reads can use nearest replica. Read-your-writes ensures consistency.

If you want to optimize read latency, you can add more read regions to your Upstash Redis database via the Upstash Console.

## Good For

- Low-latency reads from nearby regions
- Global applications with distributed users
- Read-heavy workloads
- High availability

## Read Your Writes

On by default: the client sends the sync token of its last response, so its reads observe its own earlier writes even when served by a replica. Versions 1.34.5 to 1.38.3 sent a stale token, so use 1.38.4 or later.

```typescript
import { Redis } from "@upstash/redis";

// Turn it off when stale reads are acceptable
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  readYourWrites: false,
});
```

The guarantee is per client instance. To keep it across instances (another request, another function), pass the token along:

```typescript
await writer.set("key", "value");
const token = writer.readYourWritesSyncToken;

// in the other client
reader.readYourWritesSyncToken = token;
await reader.get("key"); // "value"
```
