---
name: upstash-workflow-js
description: Work with the @upstash/workflow TypeScript/JavaScript SDK for durable, long-running workflows in serverless functions, multi-step processes that survive timeouts, retries, and restarts (built on QStash). Use when defining a workflow endpoint with serve(), running steps with context.run, sleeping for minutes to days without holding a function open, calling external APIs with context.call, waiting for an external event or webhook, invoking other workflows, configuring retries, failure callbacks, and a DLQ, controlling concurrency, rate, and parallelism, triggering, cancelling, or inspecting runs with the Workflow client, building AI agents and orchestrators, human-in-the-loop approvals, realtime updates, local development with the QStash dev server, adding middleware, or migrating workflows safely. Also use when the user asks for durable execution, step functions, saga or orchestration patterns, background jobs with checkpoints, or long-running tasks on Vercel, Next.js, Cloudflare Workers, or other serverless platforms.
license: MIT
metadata:
  author: Upstash
  homepage: https://upstash.com
---

# Upstash Workflow SDK

## Quick Start

The Upstash Workflow SDK lets you expose serverless workflow endpoints and run them reliably using QStash under the hood.

Install:

```bash
npm install @upstash/workflow
```

Define a simple workflow endpoint:

```ts
import { serve } from "@upstash/workflow";

export const { POST } = serve(async (context) => {
  await context.run("step-1", () => console.log("step 1"));
  await context.run("step-2", () => console.log("step 2"));
});
```

Trigger it from your backend:

```ts
import { Client } from "@upstash/workflow";

const client = new Client({ token: process.env.QSTASH_TOKEN! });
await client.trigger({ url: "https://your-app.com/api/workflow" });
```

## Other Skill Files

These files contain the full documentation. Use them for details, patterns, and advanced behavior.

- basics:
  - **basics/serve** – How to expose workflow endpoints.
  - **basics/context** – Full API for workflow `context` (steps, waits, webhooks, events, invoke, etc.).
  - **basics/client** – Using the Workflow client to trigger, cancel, inspect, and notify runs.
- features:
  - **features/invoke** – Cross‑workflow invocation.
  - **features/reliability** – Retries, failure callbacks, and DLQ.
  - **features/flow-control** – Rate limits, concurrency, and parallelism.
  - **features/wait-for-event** – Notify and wait-for-event patterns.
  - **features/webhooks** – Webhook creation and consumption.
- how to:
  - **how-to/local-dev** – Local QStash dev server (auto via `QSTASH_DEV=true`) and tunneling.
  - **how-to/realtime** – Realtime and human‑in‑the‑loop workflows.
  - **how-to/migrations** – Migrating workflows safely.
  - **how-to/middleware** – Adding middleware to workflows.
- other files:
  - **rest-api** – Low-level REST endpoints for interacting with QStash/Workflow.
  - **troubleshooting** – Common debugging and environment issues.
  - **agents** – Using Workflow with agents, orchestrators, and automation patterns.
