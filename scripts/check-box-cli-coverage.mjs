/**
 * Fail when the box CLI has a command the upstash-box-cli skill never mentions.
 *
 * A skill is documentation an agent executes, so an undocumented command is not
 * a thin section: it is a capability the agent does not have. That has happened
 * twice — `box list` and `box use` were missing for a release, so an agent told
 * to use an existing box could only create a new one.
 *
 * Opt-in, because it needs a built CLI:
 *   BOX_CLI=../box/packages/cli/dist/cli.js node scripts/check-box-cli-coverage.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const cli = process.env.BOX_CLI;
if (!cli || !existsSync(cli)) {
  console.log("BOX_CLI not set or not built — skipping box CLI coverage check.");
  process.exit(0);
}

/** Subcommands listed under a command's help, excluding `help` itself. */
function subcommands(path) {
  const out = execFileSync("node", [cli, ...path, "--help"], { encoding: "utf8" });
  if (!out.includes("Commands:")) return [];
  return out
    .split("Commands:")[1]
    .split("\n")
    .map((line) => /^ {2}([a-z][a-z-]*)/.exec(line)?.[1])
    .filter((name) => name && name !== "help");
}

const leaves = [];
for (const top of subcommands([])) {
  const kids = subcommands([top]);
  if (kids.length === 0) {
    leaves.push([top]);
    continue;
  }
  for (const kid of kids) {
    const grandkids = subcommands([top, kid]);
    if (grandkids.length === 0) leaves.push([top, kid]);
    else for (const g of grandkids) leaves.push([top, kid, g]);
  }
}

const skill = readFileSync("skills/upstash-box-cli/SKILL.md", "utf8");
// Match the literal invocation. Searching for the bare word would let `list`
// match inside `box files list`, which is how a gap survived an earlier audit.
const missing = leaves.filter((leaf) => !skill.includes(`box ${leaf.join(" ")}`));

if (missing.length > 0) {
  console.error(`\n >> ${missing.length} box command(s) are not in the skill:\n`);
  for (const leaf of missing) console.error(`   box ${leaf.join(" ")}`);
  console.error("\nDocument them, or say plainly why an agent should not run them.\n");
  process.exit(1);
}

console.log(`box CLI coverage: ${leaves.length}/${leaves.length} commands documented.`);
