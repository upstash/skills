# Redis Best Practices

Rules for code that talks to Redis. Timings come from an Upstash Redis Pay as You Go database with a client in the same region, about 1 ms away. Where stock Redis behaves differently, the rule says so, because Upstash runs its own engine: disk-backed, with per-key locks.

If Upstash MCP tools are available, read the database's stats and command mix first. The number that looks wrong usually names the rule below.

## Decide what the database is

- **Cache:** eviction on, and a TTL on every key.
- **Store:** eviction off, backups on, and a size limit raised before it is hit.

Half the trouble in support comes from databases that are neither, growing until writes fail or keys vanish. A cache with no expirations and a high miss rate only grows.

Know the eviction policy. Upstash has eviction off by default and offers one policy, `optimistic-volatile`, which samples at random and prefers keys with a TTL. On stock Redis, `noeviction` fails writes at the limit, `allkeys-lru` deletes keys you may not be able to reload, and `volatile-*` frees nothing when no keys carry a TTL.

## Batch with the right command

| Need | Use |
| --- | --- |
| Read many plain keys | `MGET` in chunks of 1,000 |
| Write many plain keys | `MSET` in chunks of 1,000 |
| Read many fields of one hash | `HMGET` |
| Mixed commands | Pipeline in chunks of 1,000 |
| All or nothing | Transaction (N + 2 commands) |

A pipeline saves round trips, never commands. Upstash bills it as N commands, while `MGET` counts as 1. Reading 100,000 keys took 528 ms and 100 commands with chunked `MGET`, and 9.4 s and 100,000 commands with a pipeline, because most plans allow 10,000 commands per second.

Always chunk. One `MGET` of 100,000 values of 1 KB failed, because a single request or reply is limited to 10 MB on Free and Pay as You Go. A pipeline of 200,000 commands grew client memory by 404 MB, against 4 MB in chunks of 1,000. Lower the chunk size when values are large, so a chunk's reply stays well under the limit.

Details and numbers: [Why MGET Is Faster Than a Redis Pipeline for Reading Many Keys](https://upstash.com/kb/redis-pipeline-vs-mget)

## Keep keys small and bounded

- Keep values in the tens of kilobytes. Put large files in object storage and keep the path in Redis, or compress on the client. One cache served 400 KiB values at 12 M reads a day, which came to over 100 TB of bandwidth a month.
- Keep collections under about 10,000 members. Split larger ones by a hash of the ID or by time bucket.
- A big key can stall when it loads. A plain `HLEN` on a 1 million field hash took 566 ms once on Pay as You Go, and 9.4 s repeatedly on a free database with 64 MB of memory. Every client touching that key waits, while unrelated keys stay at about 1 ms. On stock Redis, a big key can stall every client instead.
- Prefer `HMGET` of named fields, which stays at about 1 ms at any size. `HGETALL` failed past about 200,000 small fields. `HSCAN` works, but one page cost 276 ms at 1 million fields, so split instead of paging.
- Bound every queue from the first write: `XADD ... MAXLEN ~ 1000` or `MINID`, `LTRIM` after every `LPUSH`, and a TTL on temporary results, including anything a `*STORE` command produces.
- Use `UNLINK` on stock Redis, since lazy freeing is off by default for `DEL`.

Details and numbers: [How Big Should a Redis Key Be?](https://upstash.com/kb/redis-big-keys)

## TTLs and cache hit rate

- Put a TTL on every cache key, with `SET key value EX ttl` in one command.
- Add 10% jitter when many keys are written together. It cut the peak miss rate by 54% in a bulk load, which protects the database behind the cache. Total misses stay about the same, so a higher hit rate needs a longer TTL.
- Set jitter in milliseconds on short TTLs, or rounding removes it.
- Protect a single hot key with a lock or stale-while-revalidate, since jitter spreads many keys and one key still expires at one moment. See [the thundering herd guide](https://upstash.com/kb/thundering-herd-problem-cache-stampede).
- Cache negative results with a sentinel and a short TTL, or keep a membership set or bloom filter.
- Watch the miss rate. A cache that misses more than it hits is a bug: reads ask for one prefix and writes use another, or the TTL is shorter than the reuse interval. One database did 800 M reads a day at a 99 percent miss rate.

Details and numbers: [How TTL Jitter Protects Your Database When Redis Keys Expire Together](https://upstash.com/kb/redis-ttl-jitter)

## Commands

| Instead of | Use | Why |
| --- | --- | --- |
| `KEYS` in code | `SCAN` with `COUNT 1000`, or an index set | `KEYS` stalls stock Redis. On Upstash it fails once the database holds about 100,000 keys, even for a pattern that matches one key |
| `SCAN` with a leading wildcard | A fixed prefix such as `tenant:42:*` | On Upstash, a fixed prefix found 100 keys among 1 million in 1 page and 2 ms. A leading wildcard took 93 pages and 607 ms. Stock Redis filters after the walk either way |
| `HGETALL`, `SMEMBERS`, `LRANGE 0 -1` | `HMGET`, `SSCAN`, `LRANGE` windows | Whole-collection reads grow with the data and then fail at the request limit |
| `XRANGE key - +` | `XRANGE` with `COUNT`, paging from the last ID | On Upstash, it returns at most 1,000 entries with no error |
| `SET` then `EXPIRE` | `SET key value EX ttl` | One command, and no key left without a TTL |
| `EXISTS` then `SET` | `SET key value NX` | One command, no race |
| `EXISTS` then `GET` | `GET` | One command |
| `SORT` | A sorted set, or sort on the client | O(N log N) on the server |
| `INFO`, `DBSIZE`, `CONFIG GET` as health checks | `PING` | Some clients run these on every connection |
| `*STORE` on every call | Update the result on write, or `ZRANGESTORE ... LIMIT` | Each call recomputes the whole result. One database ran 740 K `ZINTERSTORE` a day |
| `FLUSHDB` in code | `SCAN` plus `UNLINK` by prefix, and separate databases per environment | One copied console command wipes the data |
| Polling `XLEN`, `XPENDING` or `TTL` in a loop | `XREADGROUP ... COUNT n BLOCK 5000` | One consumer group ran 1.3 M reads a day against 850 K acknowledgements |

- Never run `MONITOR` in production. It streams every command to one client.
- Give blocking reads a finite timeout and a small, limited pool, because each one parks a connection.
- Use pub/sub only when losing messages is fine. Delivery is fire and forget, and a slow subscriber gets disconnected. Use streams for anything durable.
- Have stream consumers call `XACK`, use `XAUTOCLAIM` for dead consumers, and add a dead-letter path. On Upstash, a consumer that never acknowledged stopped at 900 pending entries.
- Leave keyspace notifications off unless something consumes them. They cost every write.
- Name keys `service:entity:id`, and keep names short. Prefer prefixes to numbered databases, which Upstash and clusters don't offer. Use hash tags like `{tenant}` when multi-key commands or scripts must see keys together.
- Know what your library does per call. One database spent 2.3 M of its 9 M daily commands on `SCRIPT` alone.

Details and numbers: [How to List Keys in Redis Safely With SCAN](https://upstash.com/kb/redis-keys-vs-scan)

## Scripts and transactions

Use the built-in command first (`INCR`, `SET NX`), then a short Lua script, and `WATCH` only when few clients share a key. At 25 clients on one key, `WATCH` took 8.1 s and 91 commands per update for 1,000 updates, and Lua took 97 ms. A plain read then write lost 940 of the 1,000 updates with no error.

- A script blocks other commands for its whole run. Upstash scripts take a global lock by default, and back-to-back scripts of 50 ms cut an unrelated client's throughput by 87%. Stock Redis returns `BUSY` to other clients past 5 s.
- Start short scripts with `#!lua flags=allow-key-locking`, so they lock only their declared keys. In the same test, the unrelated client lost 13% instead of 87%. It made no difference on a free database, since it depends on the database's parallelism.
- Upstash killed scripts at about 250 ms on the databases we tested, with or without the flag. Scripts don't roll back, so writes made before the kill stay. Check inputs first, write last, and make scripts safe to run twice.
- Never loop over an unbounded collection, and never call `KEYS` or `SCAN` or read a whole collection in a script. Don't build big tables or strings in Lua. Page with arguments from the client, and serialize on the client.
- Pass every key through `KEYS` and every value through `ARGV`. A key first touched mid-script can force a disk read with the lock held. A body with a value baked in is a new script every call.
- Load scripts at startup and call `EVALSHA` with an `EVAL` fallback. `createScript` in `@upstash/redis` does this.
- Don't wrap a script in `MULTI`. A script is already atomic, and on Upstash it then always takes the global lock.
- Lock with `SET key token NX PX ttl`, and release with a script that checks the token. Always set a TTL on the lock.
- `WATCH` needs TCP, since the Upstash REST API doesn't support it. Scripts bill as 1 command plus 1 per `redis.call`.

Details and numbers: [Why Lua Scripts Beat WATCH When Many Clients Update One Redis Key](https://upstash.com/kb/redis-watch-vs-lua)

## Connections and clients

- Reuse connections. A reused TCP connection took 0.7 ms per `GET`, and a new connection per `GET` took 7.8 ms. We saw databases at 112 K connections a day with 9 commands each.
- In serverless, create one client at module level and reuse it across warm invocations, or use the HTTP client (`@upstash/redis`). Don't subscribe from a function.
- Keep idle connections alive with keep-alive pings, and retry once on `ECONNRESET`. Proxies and load balancers close idle sockets.
- Size pools against `maxclients`: pool size times processes times regions, before the next scale-out.
- Limit client-side concurrency. A fan-out of ten thousand promises becomes ten thousand connections or queued requests.
- Set explicit timeouts and a retry budget. Retry only idempotent writes, since `INCR`, `LPUSH` and most scripts aren't safe to replay.
- Put the database where the clients are. The same 1,000 awaited `GET`s took 1 s from 1 ms away and 118 s from 116 ms away. Use a read replica near read-heavy fleets.
- Don't read back from another region what you just wrote, unless you handle staleness. On `@upstash/redis`, use 1.38.4 or later for `readYourWrites`.
- Pace bulk writes with smaller batches and client-side rate limits. A burst of big values fills replication and persistence queues together.
- Keep client libraries and runtimes current, and set `CLIENT SETINFO` per service, so the server can say which fleet did it.

## Security and operations

- Use one ACL user per service, with key-prefix patterns and the smallest command set, plus `-@dangerous`. Don't run production on the default user.
- Rotate credentials by adding a user, switching, then deleting the old one. We found a database receiving 5,700 failed `AUTH` a day from a deployment nobody remembered.
- Keep secrets in a secret manager, and use `rediss://` with TLS on.
- Delete what you don't use. Idle databases and read regions serving zero commands still bill.
- Watch five numbers: miss rate; command mix; memory against the limit, with evictions; connections against the limit; replication lag and the write latency tail. Upstash has no `SLOWLOG`, so use the console and Prometheus metrics.

## Upstash errors

| Error | Meaning | Fix |
| --- | --- | --- |
| `ERR max request size exceeded` | One command or reply is over the plan's limit, 10 MB on Free and Pay as You Go | Chunk it, or read in pages |
| `ERR max requests limit exceeded` | The monthly command quota ran out, and the server closes the connection partway through a pipeline | Send fewer commands, or upgrade |
| `ERR too many keys to fetch, please use SCAN` | `KEYS` matched more than about 5,000 keys | `SCAN` |
| `ERR KEYS command is disabled because total number of keys is too large` | The database holds about 100,000 keys or more | `SCAN` or an index set |
| `ERR Error running script: execution timed out` | The script ran past the time limit, and its earlier writes stay | Shorten it, and run many short calls |
| `ERR Dynamic keys are not allowed in Lua scripts` | A script with `allow-key-locking` touched a key it didn't declare | Pass the key through `KEYS` |
| `ERR XReadGroup is cancelled` | The consumer's pending list is near the limit of 1,000 | `XACK`, and read fewer at a time |
