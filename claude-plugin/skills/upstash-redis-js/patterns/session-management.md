# Session Management

## Overview

Store user sessions in Redis with TTL-based expiration. A session is a hash keyed by an unguessable id, so individual fields can be updated atomically without reading and rewriting the whole session.

## Good For

- User authentication sessions
- Shopping carts
- Temporary user state
- Multi-page form data
- "Remember me" tokens

## Limitations

- Sessions expire after TTL (must be renewed)
- Large session objects consume memory
- Shared sessions require coordination across devices

## Security notes

- **Authentication is out of scope.** The examples take an already verified user. Check passwords with your auth library (argon2, bcrypt, or your identity provider) before calling `createSession`; never stub that check.
- **Validate ids before building keys.** Session ids and tokens come from cookies or headers, so check their format before putting them in a key. The examples accept only UUIDs.
- **Rotate "remember me" tokens.** Read and delete the token in one command (`GETDEL`) and issue a new one on every use, so a stolen token works at most once.
- **Store only what you need.** Keep secrets such as password hashes or provider tokens out of the session.

## Examples

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const SESSION_TTL = 3600; // 1 hour
const REMEMBER_TTL = 60 * 60 * 24 * 30; // 30 days
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionKey(sessionId: string) {
  if (!UUID.test(sessionId)) throw new Error("Invalid session id");
  return `session:${sessionId}`;
}

type SessionUser = { id: string; email: string; role: string };

// Create a session for a user your auth layer has already verified.
// Writing the hash, its TTL and the per-user index in one transaction keeps them consistent.
async function createSession(user: SessionUser) {
  const sessionId = crypto.randomUUID();
  const key = sessionKey(sessionId);

  await redis
    .multi()
    .hset(key, { userId: user.id, email: user.email, role: user.role, createdAt: Date.now() })
    .expire(key, SESSION_TTL)
    .sadd(`user:${user.id}:sessions`, sessionId)
    .expire(`user:${user.id}:sessions`, REMEMBER_TTL)
    .exec();

  return sessionId;
}

// Get a session; returns null for unknown, expired or malformed ids
async function getSession(sessionId: string) {
  if (!UUID.test(sessionId)) return null;
  const session = await redis.hgetall<Record<string, unknown>>(sessionKey(sessionId));
  return session && Object.keys(session).length > 0 ? session : null;
}

// Update fields and refresh the TTL atomically.
// HSET changes only the given fields, so concurrent updates to other fields are not lost.
async function updateSession(sessionId: string, updates: Record<string, string | number>) {
  const key = sessionKey(sessionId);
  if (!(await redis.exists(key))) throw new Error("Session not found");

  await redis
    .multi()
    .hset(key, { ...updates, updatedAt: Date.now() })
    .expire(key, SESSION_TTL)
    .exec();
}

// Sliding expiration: refresh the TTL on each access
async function touchSession(sessionId: string) {
  // EXPIRE returns 0 when the key is gone, so a deleted session is not revived
  return (await redis.expire(sessionKey(sessionId), SESSION_TTL)) === 1;
}

// Logout
async function deleteSession(userId: string, sessionId: string) {
  await redis
    .multi()
    .del(sessionKey(sessionId))
    .srem(`user:${userId}:sessions`, sessionId)
    .exec();
}

// Logout from all devices
async function logoutAllDevices(userId: string) {
  const sessions = await redis.smembers(`user:${userId}:sessions`);
  const tx = redis.multi();
  for (const sessionId of sessions) {
    if (UUID.test(sessionId)) tx.del(`session:${sessionId}`);
  }
  tx.del(`user:${userId}:sessions`);
  await tx.exec();
}

// Drop ids of sessions that expired on their own from the per-user index
async function pruneSessionIndex(userId: string) {
  const sessions = await redis.smembers(`user:${userId}:sessions`);
  if (sessions.length === 0) return;

  const p = redis.pipeline();
  for (const sessionId of sessions) p.exists(`session:${sessionId}`);
  const results = await p.exec<number[]>();

  const stale = sessions.filter((_, i) => results[i] === 0);
  if (stale.length > 0) await redis.srem(`user:${userId}:sessions`, ...stale);
}

// "Remember me": single-use tokens, rotated on every login
async function createRememberMeToken(userId: string) {
  const token = crypto.randomUUID();
  await redis.set(`remember:${token}`, { userId }, { ex: REMEMBER_TTL });
  return token;
}

async function loginWithRememberMe(token: string, loadUser: (id: string) => Promise<SessionUser | null>) {
  if (!UUID.test(token)) return null;

  // GETDEL reads and removes the token in one step, so it cannot be replayed
  const data = await redis.getdel<{ userId: string }>(`remember:${token}`);
  if (!data) return null;

  const user = await loadUser(data.userId); // re-check the account still exists and is active
  if (!user) return null;

  const sessionId = await createSession(user);
  const newToken = await createRememberMeToken(user.id);
  return { sessionId, rememberMeToken: newToken };
}

// Shopping cart as a hash of productId -> quantity (atomic per item, no read-modify-write)
async function addToCart(sessionId: string, productId: string, quantity = 1) {
  if (!UUID.test(sessionId)) throw new Error("Invalid session id");
  const key = `cart:${sessionId}`;
  await redis
    .multi()
    .hincrby(key, productId, quantity)
    .expire(key, 86400) // 24 hour cart
    .exec();
}
```
