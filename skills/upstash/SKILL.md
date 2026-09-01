---
name: upstash
description: Work with any Upstash product, SDK, or tool, including serverless Redis (caching, sessions, leaderboards, key-value storage), Ratelimit (rate limiting and throttling), QStash (message queue, cron schedules, background jobs), Workflow (durable long-running functions), Vector (vector database for embeddings, semantic search, and RAG), Search (full-text and semantic search), Box (sandboxed cloud containers for AI agents, TypeScript/JavaScript and Python), the Upstash CLI, and no-signup scratch Redis for agents. Use when the user mentions Upstash or needs any of these capabilities in a serverless, edge, or Node.js app.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

# Upstash Skills

This skill combines documentation for all Upstash SDKs. Pick the relevant sub-skill below.

## [upstash-box-cli](upstash-box-cli/overview.md)

Drive an Upstash Box (a remote sandboxed workspace) from the terminal with the `box` CLI. Use when asked to run commands, edit files, clone repos, run builds or tests, publish a public URL, or do any work inside a box rather than on this machine.

## [upstash-box-js](upstash-box-js/overview.md)

Work with the @upstash/box TypeScript/JavaScript SDK for sandboxed cloud containers with AI agents, shell, filesystem, git, cron schedules, snapshots, and a headless browser. Use when building with Upstash Box, creating a sandbox or isolated environment to run untrusted or agent-generated code, running AI coding agents in containers, giving an agent a cloud dev environment with a shell and repository, browser automation from a box, scheduling recurring jobs inside a box, saving and restoring snapshots, or orchestrating parallel boxes.

## [upstash-box-py](upstash-box-py/overview.md)

Work with the upstash-box Python SDK for sandboxed cloud containers with AI agents, shell, filesystem, git, cron schedules, snapshots, and a headless browser. Use when building with Upstash Box in Python, creating a sandbox or isolated environment to run untrusted or agent-generated code, running AI coding agents in containers, giving an agent a cloud dev environment with a shell and repository, browser automation from a box, scheduling recurring jobs inside a box, saving and restoring snapshots, or orchestrating parallel boxes.

## [upstash-cli](upstash-cli/overview.md)

Run the Upstash CLI (`upstash`) against the Upstash Developer API for Redis, Vector, Search, QStash, and teams, with non-interactive commands and JSON output for scripts, CI, and agents. Use when creating, listing, renaming, or deleting Redis databases, changing plans, regions, TLS, eviction, auto-upgrade, or budgets, managing backups, running Redis commands with `upstash redis exec`, creating or inspecting Vector and Search indexes, managing QStash instances and tokens, managing team members, reading usage stats, or automating any Upstash account operation from the terminal. Also use when the user asks how to provision or manage Upstash resources without the console.

## [upstash-qstash-js](upstash-qstash-js/overview.md)

Work with the @upstash/qstash TypeScript/JavaScript SDK, an HTTP-based message queue, task scheduler, and background job system for serverless and edge runtimes (Next.js, Vercel, Cloudflare Workers, Deno, Node.js). Use when publishing messages to HTTP endpoints or URL groups, running background jobs without a long-running worker process, scheduling with cron expressions, delaying messages, building FIFO queues with parallelism and flow control, configuring retries and callbacks, handling a dead letter queue (DLQ), deduplicating messages, fanning out to multiple endpoints, verifying QStash webhook signatures (Next.js App Router, Pages Router, and Edge Runtime), running a local QStash dev server, or migrating regions. Also use when the user asks for a serverless cron job, async task queue, job scheduler, delayed delivery, webhook delivery with retries, or event-driven messaging between services.

## [upstash-ratelimit-js](upstash-ratelimit-js/overview.md)

Rate limiting for serverless and edge apps with the @upstash/ratelimit TypeScript/JavaScript SDK backed by Upstash Redis. Use when adding a rate limiter or throttling to an API route, Next.js middleware, Vercel Edge, Cloudflare Workers, or any HTTP endpoint; returning 429 Too Many Requests; choosing between fixed window, sliding window, and token bucket algorithms; limiting per user, IP, API key, or tenant with prefixes and custom keys; protecting login, signup, form, or AI endpoints from abuse, bots, and brute force; using deny lists, ephemeral caching, analytics, timeouts, and multi-region rate limits; or estimating the Redis command cost of rate limiting. Also use when the user says rate limit, rate-limiting, throttle, quota, request limits, or traffic protection.

## [upstash-redis-js](upstash-redis-js/overview.md)

Work with the @upstash/redis TypeScript/JavaScript SDK, a serverless HTTP-based Redis client for Next.js, Vercel, Cloudflare Workers, edge runtimes, and Node.js. Use when adding a cache (cache-aside, write-through, TTL and expiration strategies), session storage and user sessions, a key-value store, leaderboards and rankings with sorted sets, counters, distributed locks, queues with lists, streams and consumer groups, JSON documents, pipelines and MULTI/EXEC transactions, Lua scripting, read replicas, or full-text search, typo-tolerant search, facets, and aggregations with Upstash Redis Search (different from regular FT.SEARCH; also available for TCP clients via @upstash/search-redis and @upstash/search-ioredis). Also use when migrating from ioredis or node-redis, when a Redis connection is needed from a serverless function without connection pooling, when integrating @upstash/ratelimit, or when the user says Redis cache, KV store, session store, serverless Redis, or Upstash Redis. Supports automatic serialization/deserialization of JavaScript types.

## [upstash-redis-start](upstash-redis-start/overview.md)

Provision a zero-config, no-signup, temporary Upstash Redis database for an AI agent with a single POST to https://upstash.com/start-redis, with no account, API key, or SDK setup required. Use when an agent needs scratch Redis right now and the user has not provided credentials, for short-term memory across tool calls, conversation history, a sub-agent work queue, ranked recall, or a quick prototype or demo. Covers idempotent creation and re-fetching credentials, calling the database through the body-style REST API or the official SDKs, and telling the user how to claim it. The database lives 3 days unless the user claims it; not for production data, PII, or secrets.

## [upstash-search-js](upstash-search-js/overview.md)

Work with the @upstash/search TypeScript/JavaScript SDK, a serverless full-text and semantic search database with built-in reranking. Use when adding search to an app or site, creating a search index, upserting documents with searchable content and filterable metadata, running keyword, semantic, or hybrid search queries, reranking results, filtering with SQL-like or structured filter syntax, paginating with range, fetching or deleting documents, resetting an index, or checking index info. Also use when the user asks for site search, product, document, or knowledge-base search, or a managed search service that needs no cluster to run.

## [upstash-vector-js](upstash-vector-js/overview.md)

Work with the @upstash/vector TypeScript/JavaScript SDK, a serverless vector database for embeddings, similarity search, semantic search, and RAG (retrieval-augmented generation). Use when upserting, querying, fetching, ranging, or deleting vectors, upserting raw text against an index with a built-in embedding model, choosing dense, sparse, or hybrid indexes, filtering by metadata, organizing data with namespaces, running resumable queries, or connecting Upstash Vector to an AI or LLM application. Also use when the user asks for a vector store, vector search, nearest-neighbor or kNN search, embeddings storage, semantic cache, recommendations or similarity features, or a hosted vector index that needs no infrastructure.

## [upstash-workflow-js](upstash-workflow-js/overview.md)

Work with the @upstash/workflow TypeScript/JavaScript SDK for durable, long-running workflows in serverless functions, multi-step processes that survive timeouts, retries, and restarts (built on QStash). Use when defining a workflow endpoint with serve(), running steps with context.run, sleeping for minutes to days without holding a function open, calling external APIs with context.call, waiting for an external event or webhook, invoking other workflows, configuring retries, failure callbacks, and a DLQ, controlling concurrency, rate, and parallelism, triggering, cancelling, or inspecting runs with the Workflow client, building AI agents and orchestrators, human-in-the-loop approvals, realtime updates, local development with the QStash dev server, adding middleware, or migrating workflows safely. Also use when the user asks for durable execution, step functions, saga or orchestration patterns, background jobs with checkpoints, or long-running tasks on Vercel, Next.js, Cloudflare Workers, or other serverless platforms.
