/**
 * Upstash bundle for DeepSeek Harness.
 *
 * Mounts two things into the composition:
 *
 *   1. the skills shipped in this repository, as an isolated `ctx.skills`
 *      provider rooted at this package's own `skills/` directory;
 *   2. `@upstash/mcp-server` over stdio through the generic MCP client,
 *      credentialed from the managed credential document.
 *
 * The MCP client is mounted from code rather than from a `cordis.patch.yml`
 * row because the credentials live in `$DSH_HOME/.credentials.yaml`, which is
 * deliberately never materialized into `process.env` and so cannot be read by
 * a `!!js` expression in YAML.
 */

import { fileURLToPath } from "node:url";
import * as McpClient from "@deepseek-ai/dsh-mcp-client";
import * as SkillFilesystem from "@deepseek-ai/dsh-skill-filesystem";

/** Credential references this bundle reads and writes. */
const EMAIL = "UPSTASH_EMAIL";
const API_KEY = "UPSTASH_API_KEY";

/** The skill root shipped with this package. */
const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));

export const name = "upstash";
export const inject = ["skills", "credentials", "commands"];

export function apply(ctx) {
  // 1. Skills. `includeDefaultRoots: false` keeps this provider to its own
  // root, so it adds the Upstash skills without shadowing or duplicating the
  // project and user roots the shipped filesystem provider already scans.
  ctx.plugin(SkillFilesystem, {
    providerName: "upstash",
    includeDefaultRoots: false,
    customSkillDirs: [SKILLS_DIR],
  });

  // 2. MCP server. Mounted once both credentials resolve, and remounted
  // whenever either changes — `credentials/updated` fires on `set`, `unset`,
  // and external edits of the document alike.
  let fiber;
  let queue = Promise.resolve();

  const remount = async () => {
    await fiber?.dispose();
    fiber = undefined;

    const [email, apiKey] = await Promise.all([
      ctx.credentials.resolve(EMAIL),
      ctx.credentials.resolve(API_KEY),
    ]);
    if (!email || !apiKey) {
      ctx.logger.info(
        `upstash: ${EMAIL} and ${API_KEY} are not both configured — MCP server not started. Run /upstash-login to store them.`,
      );
      return;
    }

    fiber = ctx.plugin(McpClient, {
      serverName: "upstash",
      transport: "stdio",
      // Fetched by `npx` rather than declared as a dependency of this package,
      // so installing the bundle stays dependency-free. The first start of a
      // fresh version needs network access; npx serves it from cache after that.
      command: "npx",
      args: ["-y", "@upstash/mcp-server@latest"],
      // The subprocess scrub strips credential-shaped names (/KEY|PASSWORD|
      // SECRET|TOKEN/i) from the inherited environment, so the API key has to
      // be handed to the child explicitly.
      env: { [EMAIL]: email.value, [API_KEY]: apiKey.value },
    });
  };

  // Serialized: `/upstash-login` stores two references and so emits two
  // events, and overlapping remounts would orphan a spawned server.
  const refresh = () => {
    queue = queue.then(remount).catch((error) => {
      ctx.logger.error(`upstash: failed to start the MCP server: ${String(error)}`);
    });
  };

  ctx.on("credentials/updated", (ref) => {
    if (ref === EMAIL || ref === API_KEY) refresh();
  });

  refresh();

  // 3. Credential entry. A bundle distributed outside the harness repository
  // cannot contribute a Settings card (namespace exposure is a Host allowlist),
  // so a command is the way in. `recordInput: false` keeps the key out of the
  // session log, and command results never enter model history.
  ctx.commands.register({
    name: "upstash-login",
    description: "Store Upstash credentials for the Upstash MCP server",
    input: { hint: "<email> <api-key>" },
    recordInput: false,
    handler: async ({ rawInput }) => {
      const [email, apiKey, ...rest] = rawInput.trim().split(/\s+/);
      if (!email || !apiKey || rest.length > 0) {
        return { kind: "error", text: "Usage: /upstash-login <email> <api-key>" };
      }

      for (const [ref, value] of [
        [EMAIL, email],
        [API_KEY, apiKey],
      ]) {
        // A value inherited from the launching environment always outranks the
        // managed document, so storing one would silently have no effect.
        const info = await ctx.credentials.describe(ref);
        if (!info.writable) {
          return {
            kind: "error",
            text: `${ref} is supplied by the environment dsh was launched with (source: ${info.source}). Unset it there and retry.`,
          };
        }
        await ctx.credentials.set(ref, value);
      }

      return { kind: "success", text: "Upstash credentials stored. The MCP server is connecting." };
    },
  });
}
