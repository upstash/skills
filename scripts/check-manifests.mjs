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

// Marketplace entries must mirror the plugin they point at. The two schemas
// differ: Claude's entry carries full metadata, Cursor's allows only
// name/source/description under additionalProperties:false, so extra fields
// there are a validation error rather than harmless noise.
const CURSOR_ENTRY_FIELDS = ["name", "source", "description", "minClientVersions"];

for (const [name, market] of [[".claude-plugin/marketplace.json", claudeMarket], [".cursor-plugin/marketplace.json", cursorMarket]]) {
  const entry = market.plugins?.find((p) => p.name === SLUG);
  if (!entry) {
    fail(`${name} has no ${JSON.stringify(SLUG)} plugin entry.`);
    continue;
  }
  if (entry.description !== root.description) {
    fail(`${name} plugin entry description must match plugin.json.`);
  }
  if (market.owner?.name !== VENDOR) {
    fail(`${name} owner.name must stay ${JSON.stringify(VENDOR)} — the marketplace is the vendor's, not the plugin's.`);
  }
}

// Claude's entry is the only one that may carry the richer metadata.
const claudeEntry = claudeMarket.plugins?.find((p) => p.name === SLUG);
if (claudeEntry) {
  if (claudeEntry.version !== root.version) fail(".claude-plugin/marketplace.json plugin entry version must match plugin.json.");
  if (claudeEntry.displayName !== DISPLAY_NAME) {
    fail(`.claude-plugin/marketplace.json plugin entry displayName must be ${JSON.stringify(DISPLAY_NAME)} (got ${JSON.stringify(claudeEntry.displayName)}).`);
  }
}

// Cursor rejects anything outside its four entry fields.
for (const entry of cursorMarket.plugins ?? []) {
  const extra = Object.keys(entry).filter((k) => !CURSOR_ENTRY_FIELDS.includes(k));
  if (extra.length > 0) {
    fail(`.cursor-plugin/marketplace.json entry "${entry.name}" has fields Cursor's schema rejects (additionalProperties:false): ${extra.join(", ")}. Put plugin metadata in .cursor-plugin/plugin.json instead.`);
  }
}
if (cursorMarket.owner && Object.keys(cursorMarket.owner).some((k) => !["name", "email"].includes(k))) {
  fail(".cursor-plugin/marketplace.json owner allows only name and email.");
}

// $schema is only safe where the client actually accepts it. Cursor's schemas
// are additionalProperties:false and declare no $schema property (and none of
// Cursor's own 65 manifests carry one), so adding it there is a violation.
const schemaRefs = {
  "plugin.json": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "mcp.json": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  ".claude-plugin/plugin.json": "https://code.claude.com/schemas/plugin.json",
  ".claude-plugin/marketplace.json": "https://code.claude.com/schemas/marketplace.json",
};
for (const [name, expected] of Object.entries(schemaRefs)) {
  const actual = { "plugin.json": root, "mcp.json": mcp, ".claude-plugin/plugin.json": claude, ".claude-plugin/marketplace.json": claudeMarket }[name].$schema;
  if (actual !== expected) fail(`${name} $schema must be ${JSON.stringify(expected)} (got ${JSON.stringify(actual)}).`);
}
for (const [name, manifest] of [[".cursor-plugin/plugin.json", cursor], [".cursor-plugin/marketplace.json", cursorMarket]]) {
  if (manifest.$schema !== undefined) {
    fail(`${name} must not declare $schema — Cursor's schema is additionalProperties:false and does not allow the key.`);
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

// Cursor has its own logo field (relative to the plugin root, no "./" prefix
// in Cursor's own plugins), so the icon is wired up there as well as in Codex.
if (typeof cursor.logo !== "string" || !cursor.logo) {
  fail(".cursor-plugin/plugin.json logo is required so the plugin shows the Upstash icon in Cursor.");
} else if (cursor.logo.startsWith("/") || cursor.logo.startsWith("./")) {
  fail(`.cursor-plugin/plugin.json logo must be a plain path relative to the plugin root (got ${JSON.stringify(cursor.logo)}).`);
} else if (!existsSync(resolve(ROOT, cursor.logo))) {
  fail(`.cursor-plugin/plugin.json logo references a missing file: ${cursor.logo}`);
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
