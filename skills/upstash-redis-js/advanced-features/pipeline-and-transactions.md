# Pipelines and Transactions

## Overview

**Pipelines** batch multiple commands for efficiency. **Transactions** (MULTI/EXEC) execute commands sequentially and in isolation — no other client's commands are interleaved between them.

## Good For

- **Pipelines**: Reducing round trips for independent operations
- **Transactions**: Running a group of commands back-to-back with no other client interleaving
- **Lua scripts (`redis.eval`)**: True all-or-nothing semantics — validate every precondition before writing anything

## Limitations

- Pipeline commands execute independently (no atomicity, no isolation)
- **Transactions do not roll back.** If a queued command fails at runtime (e.g. a WRONGTYPE error on one key), the commands that already ran keep their effects and the remaining commands still execute. `exec()` reports the error for that one command, but there is no undo — the transaction can be left partially applied.
- No WATCH / optimistic locking over the REST client — use a Lua script (`redis.eval`) for atomic check-and-set

## Examples

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Manual Pipeline - batch operations for efficiency
const pipeline = redis.pipeline();
pipeline.set("user:1:name", "Alice");
pipeline.set("user:1:email", "alice@example.com");
pipeline.incr("user:count");
pipeline.lpush("recent:users", "user:1");

const results = await pipeline.exec();
// Returns array of results: [OK, OK, 1, 1]

// Transaction (MULTI/EXEC) - runs sequentially, isolated from other clients
const tx = redis.multi();
tx.decrby("inventory:item:1", 5); // Deduct inventory
tx.incrby("user:123:purchases", 5); // Add to user purchases
tx.lpush("orders", JSON.stringify({ userId: 123, itemId: 1, qty: 5 }));

const txResults = await tx.exec();
// No other client's commands run in between — but there is NO rollback.
// If decrby fails at runtime, the incrby and lpush still apply, leaving a
// partially-applied transaction that you have to compensate for yourself.
```

### All-or-Nothing with a Lua Script

When you truly need every write to land or none of them, use `redis.eval`. A Lua
script runs as a single unit and lets you check all preconditions *before*
performing the first write, so no partial state is possible.

```typescript
const script = `
  local stock = tonumber(redis.call("GET", KEYS[1]) or "0")
  local qty = tonumber(ARGV[1])

  -- Validate everything up front; return early before any write
  if stock < qty then
    return -1
  end

  -- Only now perform the writes
  redis.call("DECRBY", KEYS[1], qty)
  redis.call("INCRBY", KEYS[2], qty)
  redis.call("LPUSH", KEYS[3], ARGV[2])
  return stock - qty
`;

const remaining = await redis.eval<number>(
  script,
  ["inventory:item:1", "user:123:purchases", "orders"],
  ["5", JSON.stringify({ userId: 123, itemId: 1, qty: 5 })]
);

if (remaining === -1) {
  // Nothing was written — safe to retry or reject the order
}
```
