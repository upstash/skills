# Workflow REST API Skill

This Skill provides TypeScript-focused guidance for interacting with the Upstash QStash Workflow Dead Letter Queue (DLQ) REST API. It includes practical usage examples, consolidated patterns, and key considerations for safely restarting, resuming, listing, deleting, and inspecting failed workflow runs.

The goal is to help agents construct correct TypeScript API requests, handle optional fields, and avoid common pitfalls when working with workflow recovery operations.

---

## Core Concepts

• **DLQ Entries** represent failed workflow runs containing metadata such as payload, headers, timestamps, failure callback state, and workflow configuration.  
• **Restart** recreates the entire workflow run from the beginning (fresh execution, no preserved state).  
• **Resume** creates a new run continuing from the failed step (preserves successful steps).  
• **Bulk operations** take their filters as query parameters, process up to 100 DLQ entries per request (`count`, default and maximum 100) and return a `cursor` while more remain.
• **Flow-Control and Retry Overrides** are passed via headers and apply only to the newly created workflow run.

Be careful: changing workflow code **before** the failed step may cause resume operations to break.

---

# HTTP Endpoints Overview

Below is a complete summary of the API endpoints supported by this skill.

• `GET /v2/workflows/dlq` — List DLQ entries with filtering.  
• `GET /v2/workflows/dlq/{dlqId}` — Retrieve a single DLQ entry.  
• `DELETE /v2/workflows/dlq/{dlqId}` — Delete a DLQ entry.  
• `POST /v2/workflows/dlq/restart/{dlqId}` — Restart a workflow from scratch.  
• `POST /v2/workflows/dlq/resume/{dlqId}` — Resume a workflow from point of failure.  
• `POST /v2/workflows/dlq/restart` — Bulk restart (up to 100 per request).  
• `POST /v2/workflows/dlq/resume` — Bulk resume (up to 100 per request).  
• `POST /v2/workflows/dlq/callback/{dlqId}` — Rerun a failed failure-callback.  
• `DELETE /v2/workflows/dlq/callback/{dlqId}`: Cancel an in-progress failure-callback.  
• `DELETE /v2/workflows/dlq`: Bulk delete by `dlqIds` or filters.  
• `DELETE /v2/workflows/runs`: Bulk cancel runs by `workflowRunIds` or filters (`workflowUrl` is a prefix unless `workflowUrlExactMatch=true`).  
• `GET /v2/flowControl` and `/v2/flowControl/{key}` — Flow-control inspection.

---

# TypeScript Usage Patterns

Below is a single integrated example illustrating several endpoints, optional query parameters, header overrides, and response field handling.

```ts
import fetch from "node-fetch";

const token = process.env.QSTASH_TOKEN;
const base = "https://qstash.upstash.io/v2";

async function example() {
  // 1. List DLQ items with filters
  const list = await fetch(
    `${base}/workflows/dlq?workflowUrl=https://my.app/workflow&fromDate=1700000000000`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  ).then((r) => r.json());

  const firstDlqId = list.messages?.[0]?.dlqId;

  // 2. Restart or Resume a specific run (headers may override flow control or retries)
  const restart = await fetch(`${base}/workflows/dlq/restart/${firstDlqId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Upstash-Flow-Control-Key": "my-key", // optional
      "Upstash-Flow-Control-Value": "parallelism=1", // optional
      "Upstash-Retries": "3", // optional
    },
  }).then((r) => r.json());

  // 3. Bulk resume using filters and cursor handling
  // Filters are query parameters, not a JSON body
  const query = new URLSearchParams({
    fromDate: "1700000000000",
    workflowUrl: "https://my.app/workflow",
    count: "100",
  });
  let cursor = "";
  do {
    if (cursor) query.set("cursor", cursor);
    const bulkResume = await fetch(`${base}/workflows/dlq/resume?${query}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    cursor = bulkResume.cursor ?? "";
  } while (cursor);

  // 4. Rerun failure callback
  const callback = await fetch(`${base}/workflows/dlq/callback/${firstDlqId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  // 5. Delete a DLQ entry
  await fetch(`${base}/workflows/dlq/${firstDlqId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  // 6. Inspect Flow-Control
  const fc = await fetch(`${base}/flowControl/my-key`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  console.log({ list, restart, callback, fc });
}
```

---

# Key Fields and Behaviors

## Request Query Fields

• **dlqIds: string[]** — Exact DLQ IDs for targeting specific failed runs (bulk restart/resume).  
• **fromDate / toDate: number** — Millisecond timestamps; inclusive range filters.  
• **workflowUrl: string** — Filters by workflow endpoint URL.  
• **workflowRunId: string** — Can match full run ID or prefix.  
• **workflowCreatedAt: number** — Timestamp filter for creation time.  
• **responseStatus: number** — Filter by HTTP status of failed run.  
• **callerIP: string** — Filter by origin IP.  
• **failureFunctionState: string**: Filter by failure callback state: `CALLBACK_INPROGRESS`, `CALLBACK_SUCCESS`, `CALLBACK_FAIL` or `CALLBACK_CANCELED`.  
• **label, flowControlKey: string**: Filter by run label or flow-control key.  
• **cursor: string** — Pagination cursor; returned by list & bulk ops.  
• **count: number** — Limit for listing DLQ entries (default/max 100).

## Header Overrides

These apply only when creating a **new workflow run** (restart or resume).

• **Upstash-Flow-Control-Key** — Override flow-control key.  
• **Upstash-Flow-Control-Value** — Override flow-control config (e.g., "parallelism=1").  
• **Upstash-Retries** — Override step retry configuration.

All are optional; original values are reused if omitted.

## Response Fields

• **cursor?: string** — If returned, additional entries exist.  
• **workflowRuns: { workflowRunId: string; workflowCreatedAt: number }[]** — Returned by bulk restart/resume.  
• **message objects** (DLQ list/get) include:

- **workflowRunId, workflowCreatedAt, workflowUrl**
- **responseStatus, responseHeader, responseBody**
- **failureCallbackInfo.state** — Identify failed callbacks.
- **dlqId** — Unique DLQ entry identifier.

---

# Pitfalls & Best Practices

• **Resume only works if workflow code before the failed step stays unchanged**. Any change may cause resume to fail.  
• **Bulk operations process max 100 items per request**. Repeat the call with the returned `cursor` until it comes back empty.  
• **Deleting a DLQ entry is permanent**; once removed, it cannot be resumed or restarted.  
• **Failure callback reruns are independent** and do not affect workflow execution. They only retry the failure-notification step.  
• **Prefix matching on workflowRunId** can unintentionally match more runs than expected—use full ID for precision.

---

# Recommended Patterns

• Fetch → Check cursor → Continue looping for bulk operations.  
• Always log `failureCallbackInfo.state` to determine whether a callback rerun is required.  
• Apply header overrides sparingly; flow-control misconfiguration may stall large batches.  
• Prefer filtering in bulk operations instead of manually passing large dlqIds arrays.
