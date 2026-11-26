# Pub/Sub

## Overview

`redis.publish` sends a message to a channel. `redis.subscribe` and `redis.psubscribe` return a `Subscriber` that receives messages over a streaming HTTP connection, one per channel or pattern.

## Good For

- Real-time notifications and fan-out to long-running processes
- Broadcasting events between services

## Limitations

- Messages are not stored: a subscriber only sees what is published while it is connected. Use streams for durable delivery.
- The connection stays open until `unsubscribe()`, so it does not fit short-lived serverless invocations.

## Examples

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const subscriber = redis.subscribe<{ text: string }>(["chat:1", "chat:2"]);

subscriber.on("message", ({ channel, message }) => {
  console.log(channel, message.text); // message is already JSON-parsed
});
subscriber.on("message:chat:1", ({ message }) => {}); // one channel only
subscriber.on("error", (error) => console.error(error));

await redis.publish("chat:1", { text: "hello" }); // number of receivers

await subscriber.unsubscribe(["chat:2"]); // some channels
await subscriber.unsubscribe(); // everything, also removes the listeners

// Patterns
const psubscriber = redis.psubscribe("chat:*");
psubscriber.on("pmessage", ({ pattern, channel, message }) => {});
```
