# SDK Overview

This skill provides a concise but complete reference for using the Upstash Search TypeScript SDK. It focuses on practical usage patterns, common pitfalls, and efficient examples that combine multiple commands. Use this skill whenever interacting with the Upstash Search SDK, generating agents that must query, mutate, or paginate search indexes.

---

## Client Initialization

You must configure a Search client using either environment variables or a config object.

```ts
import { Search } from "@upstash/search";

// Option 1: with explicit config
const client = new Search({ 
  url: process.env.UPSTASH_SEARCH_REST_URL!,
  token: process.env.UPSTASH_SEARCH_REST_TOKEN! 
});
const index = client.index("movies");

// Option 2: from process.env (UPSTASH_SEARCH_REST_URL and UPSTASH_SEARCH_REST_TOKEN)
const client2 = Search.fromEnv(); // same as new Search({})
const index2 = client2.index("movies");

// Cloudflare Workers: import from "@upstash/search/cloudflare" and pass the env binding
// const client3 = Search.fromEnv(env);
```

Optional config, on the constructor or as the second argument of `fromEnv`:
```ts
const client4 = new Search({
  url,
  token,
  retry: { retries: 3, backoff: (retryCount) => retryCount * 100 }, // default 5 retries; false disables
  cache: "no-store",      // fetch cache setting, default "no-store"
  enableTelemetry: false, // or set UPSTASH_DISABLE_TELEMETRY
});
```

Type-safe usage:
```ts
type Content = { title: string, genre: string };
type Metadata = { year: number };
const indexTyped = client.index<Content, Metadata>("movies");
```

---

## Upsert (add or update documents)

Pitfalls:
- Document structure must match the index schema.
- Content/metadata types are enforced when using generics.

```ts
// Single
await index.upsert({
  id: "star-wars",
  content: { title: "Star Wars", genre: "sci-fi" },
  metadata: { year: 1977 }
});

// Multiple
await index.upsert([
  { id: "inception", content: { title: "Inception", genre: "action" }, metadata: { year: 2010 } },
  { id: "matrix", content: { title: "The Matrix", genre: "sci-fi" }, metadata: { year: 1999 } },
]);

// Update
await index.upsert({ id: "star-wars", content: { title: "A New Hope" } });
```

---

## Fetch (retrieve documents)

Pitfalls:
- Returns null for IDs not found.
- Supports prefix matching.

```ts
// By IDs
const docs = await index.fetch({ ids: ["star-wars", "inception"] });

// By prefix
const sciFi = await index.fetch({ prefix: "star-" });
```

---

## Delete (IDs, prefix, or filter)

Pitfalls:
- **Filter deletion is O(N)** and slow on large indexes.
- Prefix deletion removes *all* matching documents.

```ts
// ID list
await index.delete(["star-wars", "inception"]);

// Single ID
await index.delete("star-wars");

// Prefix
await index.delete({ prefix: "star-" });

// Filter — expensive
await index.delete({ filter: "age > 30" });
```

---

## Search (AI‑powered)

Pitfalls:
- Default `limit = 5`.
- Scores are 0–1.
- Use filters to restrict by document fields.

```ts
// Basic
const results = await index.search({ query: "space opera", limit: 3 });

// With reranking
await index.search({ query: "space opera", limit: 3, reranking: true });

// With filter
await index.search({ query: "space", filter: "category = 'classic'" });

// Adjust semantic vs keyword weighting (0 to 1, default 0.75)
await index.search({ query: "robots", semanticWeight: 0.2 });

// Input enrichment rewrites the query before searching and is on by default
await index.search({ query: "robots", inputEnrichment: false });

// Keep enrichment but also search with the original query (default false)
await index.search({ query: "robots", keepOriginalQueryAfterEnrichment: true });
```

Each result is `{ id, content, metadata, score }`.

---

## Range (cursor pagination)

Pitfalls:
- Stateless: you must pass all parameters every call.
- `cursor = "0"` for the first request.

```ts
let cursor = "0";
while (cursor !== "") {
  const res = await index.range({ cursor, limit: 2, prefix: "test-" });
  cursor = res.nextCursor;
  console.log(res.documents);
}
```

---

## Reset (delete all documents)

```ts
await index.reset(); // "Success"
```

---

## List and delete indexes

`reset` empties an index; `deleteIndex` removes the index itself and cannot be undone. Run either only on an index the user named, after confirming it with them.

```ts
const names = await client.listIndexes(); // ["movies", ...]
await index.deleteIndex();
```

---

## Info (index or database level)

```ts
// Index-level
const indexInfo = await index.info();
// { documentCount, pendingDocumentCount }

// Database-level
const dbInfo = await client.info();
// { documentCount, pendingDocumentCount, diskSize, indexes: {...} }
```
