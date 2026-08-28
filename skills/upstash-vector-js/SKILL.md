---
name: upstash-vector-js
description: Work with the @upstash/vector TypeScript/JavaScript SDK, a serverless vector database for embeddings, similarity search, semantic search, and RAG (retrieval-augmented generation). Use when upserting, querying, fetching, ranging, or deleting vectors, upserting raw text against an index with a built-in embedding model, choosing dense, sparse, or hybrid indexes, filtering by metadata, organizing data with namespaces, running resumable queries, or connecting Upstash Vector to an AI or LLM application. Also use when the user asks for a vector store, vector search, nearest-neighbor or kNN search, embeddings storage, semantic cache, recommendations or similarity features, or a hosted vector index that needs no infrastructure.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

# Vector Documentation Skill

## Quick Start

Vector is a high‑performance vector database for storing, querying, and managing vector embeddings.

Basic workflow:

- Install the Vector TS SDK.
- Connect to a Vector instance.
- Upsert vectors, query them, and manage namespaces.

Example (TypeScript):

```ts
import { Index } from "@upstash/vector";
const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

await index.upsert([{ id: "1", vector: [0.1, 0.2], metadata: { tag: "example" } }]);

const results = await index.query({
  vector: [0.1, 0.2],
  topK: 5,
});
```

For full usage, refer to the linked skill files below.

## Other Skill Files

### TS SDK Reference

- `sdk-methods`: Explains SDK commands: delete, fetch, info, query, range, reset, resumable-query, upsert

### Features

- `features/namespaces`: Explains namespaces and dataset organization.
- `features/index-structure`: Covers hybrid and sparse index structures.
- `features/filtering-and-metadata`: Details metadata storage and server-side filtering.

Use these files for deeper guidance on SDK usage, advanced configurations, algorithms, and integrations.
