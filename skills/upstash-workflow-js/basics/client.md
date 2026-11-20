# Workflow Client Basics

This skill provides guidance for using the Workflow Client to trigger, cancel, inspect, resume, and manage workflow runs. It focuses on TypeScript usage patterns, argument structures, and common pitfalls.

---

## Core Operations

### Triggering Workflow Runs (`client.trigger`)

Starts one or multiple workflow runs with optional payload, metadata, retry logic, and flow control.

```ts
// Single and multiple triggers
const single = await client.trigger({
  url: "https://your-endpoint/workflow", // required
  body: { msg: "hello" }, // optional payload
  headers: { "x-user": "123" }, // optional headers
  workflowRunId: "custom-id", // run id becomes "wfr_custom-id"
  retries: 3, // retry count for steps
  retryDelay: "1000 * (1 + retried)", // expression-based retry delay
  delay: "10s", // start later
  notBefore: Math.floor(Date.now() / 1000) + 60, // absolute schedule
  label: ["my-run", "tenant-42"], // string or string[], for filtering logs, DLQ and cancel
  failureUrl: "https://your-endpoint/failure", // called when the run fails
  redact: { body: true, header: ["Authorization"] }, // hide fields in logs
  disableTelemetry: true, // opt‑out telemetry
  flowControl: {
    // concurrency & rate limiting
    key: "user-key",
    rate: 10,
    parallelism: 5,
    period: "10m",
  },
});

const multiple = await client.trigger([
  { url: "https://api/runA", body: { a: 1 } },
  { url: "https://api/runB", retries: 5 },
]);
```

**Pitfalls**:

- `wfr_` is always prepended to `workflowRunId`. Use the returned `workflowRunId` for notify, cancel and logs.
- Labels and `flowControl.key` may only contain letters, digits, `-`, `_` and `.`. Anything else (or an empty label array) throws `WorkflowNonRetryableError` before the request is sent.
- `redact.header` is `true` (all headers) or a list of header names. `redact.body` is `true`.
- `delay` is ignored if `notBefore` is provided.
- Using `url` incorrectly (missing protocol or dynamic segments) leads to invalid workflow endpoints.

---

### Canceling Workflow Runs (`client.cancel`)

Cancel runs by ID, by filter, or all active/pending runs. Returns `{ cancelled: number }`.

```ts
await client.cancel("wfr_123");
await client.cancel(["wfr_123", "wfr_456"]);
await client.cancel({ filter: { workflowUrl: "https://your-endpoint.com/workflow" } }); // exact URL
await client.cancel({ filter: { workflowUrlStartingWith: "https://your-endpoint.com" } });
await client.cancel({
  filter: { label: ["tenant-42", "tenant-43"], flowControlKey: "user-key" },
  count: 50,
});
await client.cancel({ all: true });
```

- Filter fields: `workflowUrl` or `workflowUrlStartingWith` (mutually exclusive), `label`, `flowControlKey`, `host`, `path`, `callerIp`, `fromDate`, `toDate`.
- An array value matches any of its entries (OR). Separate fields are combined with AND.
- Filter and `all` calls cancel up to `count` runs per call (default 100). There is no cursor. Repeat the call to cancel more.
- Empty ids and empty arrays throw instead of widening the scope. Use `{ all: true }` to target everything.
- `cancel({ ids })` and `cancel({ urlStartingWith })` still work but are deprecated.

---

### Retrieving Logs (`client.logs`)

Fetch workflow execution logs with filtering and cursor-based pagination.

```ts
const { runs, cursor } = await client.logs({
  count: 50, // limit return size, default 10
  cursor: undefined, // pagination
  filter: {
    workflowRunId: "wfr_123", // a specific run
    workflowUrl: "https://endpoint", // exact match
    state: "RUN_FAILED", // RUN_STARTED | RUN_SUCCESS | RUN_FAILED | RUN_CANCELED
    label: ["tenant-42", "tenant-43"], // runs with any of these labels
    workflowCreatedAt: 1700000000000,
  },
});
```

- `filter` also accepts `flowControlKey`, `host`, `path`, `callerIp`, `messageId`, `fromDate` and `toDate`. The top-level `workflowRunId`, `state`, `workflowUrl`, `label` and `workflowCreatedAt` parameters are deprecated.
- Each run has `labels: string[]` (`label` is deprecated and holds only the first one).
- For a step that is failing or being retried, the `type: "next"` step group carries `stepName`, `errors`, `retries` and `state`.
- `run.failureFunction` describes the failure callback: `state` is `CALLBACK_INPROGRESS`, `CALLBACK_SUCCESS`, `CALLBACK_FAIL` or `CALLBACK_CANCELED`, and `nextDeliveryTime` is the optional time of its next delivery.

---

### Notifying Events (`client.notify`)

Notify workflows paused at `context.waitForEvent`.

```ts
await client.notify({
  eventId: "order-paid",
  eventData: { orderId: 1 }, // delivered to waiting workflow
  workflowRunId: "wfr_123", // optional, see below
});
```

- Without `workflowRunId`, the notify is lost if no workflow is waiting, and no error is thrown.
- With `workflowRunId`, the event is kept for that run even if it has not reached `waitForEvent` yet (lookback).
- `eventId` may only contain letters, digits, `-`, `_` and `.`.

---

### Fetching Waiting Workflows (`client.getWaiters`)

Retrieve active waiters waiting for a specific event.

```ts
const waiters = await client.getWaiters({ eventId: "order-paid" });
```

This is useful for debugging or coordinating external signals.

---

## Dead Letter Queue (DLQ) Operations

### Listing DLQ Messages (`client.dlq.list`)

```ts
const { messages, cursor } = await client.dlq.list({
  cursor,
  count: 20,
  filter: {
    fromDate: Date.now() - 86400000,
    toDate: Date.now(),
    workflowUrl: "https://your-endpoint.com",
    label: "tenant-42",
    failureFunctionState: "CALLBACK_FAIL",
  },
});
```

- Date fields use Unix **ms**, not seconds.
- `filter` also accepts `workflowRunId`, `workflowCreatedAt`, `flowControlKey` and `callerIp`. `url` and `responseStatus` are deprecated.
- Messages carry `dlqId`, `labels` and `failureCallbackInfo`.

---

### Bulk Targets for `resume`, `restart` and `delete`

All three take the same first argument:

```ts
await client.dlq.delete("dlq-1"); // one id
await client.dlq.delete(["dlq-1", "dlq-2"]); // several ids
await client.dlq.delete({ filter: { label: "tenant-42", fromDate: 1640995200000 } });

// filter and all calls process up to count messages (default 100) and return a cursor
let cursor: string | undefined;
do {
  const result = await client.dlq.delete({ all: true, count: 100, cursor });
  cursor = result.cursor;
} while (cursor);
```

- Filter fields: `workflowUrl`, `workflowRunId`, `workflowCreatedAt`, `label`, `flowControlKey`, `callerIp`, `failureFunctionState`, `fromDate`, `toDate`. Array values match any entry.
- `delete` returns `{ deleted, cursor? }`. `resume` and `restart` return `{ workflowRuns, cursor? }`.
- Empty ids and empty arrays throw. Use `{ all: true }` to target everything.

---

### Restarting DLQ Runs (`client.dlq.restart`)

Restart from the **beginning** of the workflow. The optional second argument overrides retries and flow control of the new run.

```ts
const { workflowRuns } = await client.dlq.restart(["dlq-1", "dlq-2"], {
  retries: 5,
  flowControl: {
    key: "restart-group",
    parallelism: 10,
  },
});
```

---

### Resuming DLQ Runs (`client.dlq.resume`)

Continue from the **failed step**.

```ts
const { workflowRuns } = await client.dlq.resume("dlq-123", {
  retries: 3,
  flowControl: {
    key: "resume-group",
    rate: 5,
  },
});
```

**Common confusion**:

- `restart` = new run from step 0.
- `resume` = same run continues at the failed step.
- `resume({ dlqId, retries })` and `restart({ dlqId, retries })` still work but are deprecated.

---

### Failure Callback (`retryFailureFunction`, `cancelFailureFunction`)

```ts
// the failureFunction/failureUrl call failed: run it again
await client.dlq.retryFailureFunction({ dlqId: "dlq-123" });

// the failureFunction/failureUrl call is still in progress: stop it
await client.dlq.cancelFailureFunction({ dlqId: "dlq-123" });
```

`cancelFailureFunction` throws if the run has no failure function call in progress.

---

## General Tips for TS Consumers

- Use flow control when bulk‑triggering or restarting large batches to avoid rate limits.
