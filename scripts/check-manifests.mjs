import { readFileSync, existsSync } from "fs";
import { join, resolve, relative, isAbsolute } from "path";

const ROOT = join(import.meta.dirname, "..");
const errors = [];

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf-8"));
const fail = (msg) => errors.push(msg);

const MCP_URL = "https://mcp.upstash.com/mcp";

// Redis is the flagship, so every user-facing plugin title says so — people
// searching a marketplace for "redis" have to find us. See AGENTS.md.
const DISPLAY_NAME = "Upstash Redis";

// The slug is the install identifier (`/plugin install upstash@upstash`) and
// the vendor is the company. Neither is a display surface; renaming the slug
// would break every install command in the README.
const SLUG = "upstash";
const VENDOR = "Upstash";

const root = read("plugin.json");
const claude = read(".claude-plugin/plugin.json");
const claudeMarket = read(".claude-plugin/marketplace.json");
const codex = read(".codex-plugin/plugin.json");
const cursor = read(".cursor-plugin/plugin.json");
const cursorMarket = read(".cursor-plugin/marketplace.json");
const gemini = read("gemini-extension.json");
const mcp = read("mcp.json");

// Every manifest must agree on version, description, repository and license.
const manifests = {
  "plugin.json": root,
  ".claude-plugin/plugin.json": claude,
  ".codex-plugin/plugin.json": codex,
  ".cursor-plugin/plugin.json": cursor,
  "gemini-extension.json": gemini,
};

for (const [name, manifest] of Object.entries(manifests)) {
  for (const field of ["version", "description"]) {
    if (manifest[field] !== root[field]) {
      fail(`${name} ${field} must match plugin.json (got ${JSON.stringify(manifest[field])}).`);
    }
  }
}

for (const [name, manifest] of [[".claude-plugin/plugin.json", claude], [".codex-plugin/plugin.json", codex], [".cursor-plugin/plugin.json", cursor]]) {
  for (const field of ["repository", "license"]) {
    if (manifest[field] !== root[field]) fail(`${name} ${field} must match plugin.json.`);
  }
}

// The plugin is titled after the flagship product everywhere it is shown.
const displayNames = {
  ".claude-plugin/plugin.json": claude.displayName,
  ".cursor-plugin/plugin.json": cursor.displayName,
  ".codex-plugin/plugin.json": codex.interface?.displayName,
};
for (const [name, value] of Object.entries(displayNames)) {
  if (value !== DISPLAY_NAME) {
    fail(`${name} display name must be ${JSON.stringify(DISPLAY_NAME)} (got ${JSON.stringify(value)}).`);
  }
}

// ...but the slug and the vendor are not display surfaces.
for (const [name, manifest] of Object.entries(manifests)) {
  if (manifest.name !== SLUG) {
    fail(`${name} name must stay ${JSON.stringify(SLUG)} — it is the install identifier, not a title (got ${JSON.stringify(manifest.name)}).`);
  }
  if (manifest.author && manifest.author.name !== VENDOR) {
    fail(`${name} author.name must stay ${JSON.stringify(VENDOR)} — that is the company, not the plugin (got ${JSON.stringify(manifest.author.name)}).`);
  }
}

// Marketplace entries must mirror the plugin they point at.
for (const [name, market] of [[".claude-plugin/marketplace.json", claudeMarket], [".cursor-plugin/marketplace.json", cursorMarket]]) {
  const entry = market.plugins?.find((p) => p.name === "upstash");
  if (!entry) {
    fail(`${name} has no "upstash" plugin entry.`);
    continue;
  }
  for (const field of ["description", "version"]) {
    if (entry[field] !== root[field]) fail(`${name} plugin entry ${field} must match plugin.json.`);
  }
  if (entry.displayName !== DISPLAY_NAME) {
    fail(`${name} plugin entry displayName must be ${JSON.stringify(DISPLAY_NAME)} (got ${JSON.stringify(entry.displayName)}).`);
  }
  if (market.owner?.name !== VENDOR) {
    fail(`${name} owner.name must stay ${JSON.stringify(VENDOR)} — the marketplace is the vendor's, not the plugin's.`);
  }
}

// The description is the only place users learn the plugin ships the MCP server.
if (!/\bMCP\b/.test(root.description)) {
  fail("plugin.json description must mention the MCP server — the plugins bundle it.");
}

// Every client that can register the MCP must point at the same URL.
const mcpUrls = {
  "mcp.json": mcp.mcpServers?.upstash?.url,
  ".claude-plugin/plugin.json": claude.mcpServers?.upstash?.url,
  ".codex-plugin/plugin.json": codex.mcpServers?.upstash?.url,
  ".cursor-plugin/plugin.json": cursor.mcpServers?.upstash?.url,
  "gemini-extension.json": gemini.mcpServers?.upstash?.httpUrl,
};
for (const [name, url] of Object.entries(mcpUrls)) {
  if (url !== MCP_URL) fail(`${name} must declare the Upstash MCP server at ${MCP_URL} (got ${JSON.stringify(url)}).`);
}

// Codex renders the plugin card from `interface`; missing fields mean a blank card.
const iface = codex.interface;
if (!iface || typeof iface !== "object") {
  fail(".codex-plugin/plugin.json is missing the required interface object.");
} else {
  for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "category"]) {
    if (typeof iface[field] !== "string" || !iface[field].trim()) {
      fail(`.codex-plugin/plugin.json interface.${field} must be a non-empty string.`);
    }
  }
  if (!Array.isArray(iface.capabilities) || iface.capabilities.length === 0) {
    fail(".codex-plugin/plugin.json interface.capabilities must be a non-empty array.");
  }
  if (!Array.isArray(iface.defaultPrompt) || iface.defaultPrompt.length === 0 || iface.defaultPrompt.length > 3) {
    fail(".codex-plugin/plugin.json interface.defaultPrompt must contain one to three prompts.");
  } else {
    for (const [i, prompt] of iface.defaultPrompt.entries()) {
      if (typeof prompt !== "string" || prompt.length === 0 || prompt.length > 128) {
        fail(`.codex-plugin/plugin.json interface.defaultPrompt[${i}] must contain 1-128 characters.`);
      }
    }
  }
  // Without a real logo the plugin installs with no Upstash icon.
  for (const field of ["composerIcon", "logo"]) {
    const value = iface[field];
    if (typeof value !== "string") {
      fail(`.codex-plugin/plugin.json interface.${field} is required so the plugin shows the Upstash icon.`);
      continue;
    }
    if (!value.startsWith("./")) {
      fail(`.codex-plugin/plugin.json interface.${field} must start with "./".`);
      continue;
    }
    const target = resolve(ROOT, value);
    const rel = relative(ROOT, target);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      fail(`.codex-plugin/plugin.json interface.${field} must stay inside the plugin root.`);
    } else if (!existsSync(target)) {
      fail(`.codex-plugin/plugin.json interface.${field} references a missing file: ${value}`);
    }
  }
}

// Skills are the payload — every client that can be pointed at them should be.
for (const [name, manifest] of [[".claude-plugin/plugin.json", claude], [".codex-plugin/plugin.json", codex], [".cursor-plugin/plugin.json", cursor]]) {
  if (manifest.skills !== "./skills/") fail(`${name} skills must be "./skills/".`);
}

if (errors.length > 0) {
  console.error("\n >> Manifest check failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  console.error();
  process.exit(1);
}

console.log("Plugin manifests are consistent.");
