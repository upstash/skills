# Messages and Logs

## Reading a Message

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

const message = await client.messages.get("msg_123...");
console.log(message.url, message.notBefore, message.labels);
```

`labels` holds every label of the message; the older `label` field holds only the first one.

## Cancelling Messages

`cancel` takes a message id, an array of ids, a filter, or `{ all: true }`, and returns `{ cancelled: number }`.

```typescript
await client.messages.cancel("msg_123...");
await client.messages.cancel(["msg_123...", "msg_456..."]);

await client.messages.cancel({
  filter: {
    label: ["tenant-42", "tenant-43"], // values in an array are ORed
    host: "api.example.com", // separate filters are ANDed
  },
});

await client.messages.cancel({ all: true });
```

Filter fields: `url`, `host`, `path`, `urlGroup`, `queueName`, `scheduleId`, `label`, `flowControlKey`, `callerIp` (each a value or an array), plus `fromDate` and `toDate`.

A filter or `all` call cancels every matching pending message in one request, so no loop is needed and `count` is ignored. `delete`, `deleteMany` and `deleteAll` are deprecated, use `cancel`.

## Running a Message Now

Deliver a waiting message immediately instead of at its scheduled time:

```typescript
await client.messages.runNow("msg_123...");
```

Works for a message published with `delay` or `notBefore` and for a message waiting out its retry backoff. Queue messages are not supported. Throws a `QstashError` with `status` 404 when the message is no longer waiting (already running or finished).

## Logs

```typescript
const { logs, cursor } = await client.logs({
  filter: {
    state: "FAILED",
    label: ["tenant-42", "tenant-43"],
    fromDate: Date.now() - 86_400_000,
  },
  count: 100,
});

for (const log of logs) {
  console.log(log.time, log.state, log.messageId, log.url);
}
```

- Pass the returned `cursor` back as `cursor` to read the next page.
- Filters are the cancel filters plus `state` (`CREATED`, `ACTIVE`, `DELIVERED`, `ERROR`, `RETRY`, `FAILED`, `CANCELED`, `IN_PROGRESS`).
- For specific messages use `client.logs({ messageIds: ["msg_123..."] })` instead of `filter`.
- Fields hidden with `redact` at publish time are not shown in logs.

## Errors

Failed API calls throw `QstashError` (with the HTTP `status`). Rate limits throw its subclasses `QstashRatelimitError` and `QstashDailyRatelimitError`, which carry `limit`, `remaining` and `reset`.

Methods that take a single id (`messages.get`, `messages.cancel`, `messages.runNow`, `schedules.get`, `schedules.delete`, `dlq.delete`, `urlGroups.get`, `urlGroups.delete`, `flowControl.get`) throw a `QstashError` for an empty string before sending a request.

The client retries failed network requests 5 times with exponential backoff, logging a `[Upstash QStash]` warning per retry and an error when the request finally fails. Tune or disable it on the client:

```typescript
new Client({ token, retry: { retries: 2, backoff: (retryCount) => 2 ** retryCount * 100 } });
new Client({ token, retry: false });
```
