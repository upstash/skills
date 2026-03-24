import { readdirSync, rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT_DIR = join(SKILLS_DIR, "upstash");

// Pre-check: ensure no unstaged changes under skills/upstash/
const diff = execSync("git diff --name-only -- skills/upstash/", { cwd: ROOT, encoding: "utf-8" }).trim();
if (diff) {
  console.error("\n >> Error: there are unstaged changes under skills/upstash/. Stage or discard them before building.\n");
  console.error(diff);
  console.error();
  process.exit(1);
}

// Step 1: Remove existing upstash folder if it exists
rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR);

// Step 2: Get all skill folders (exclude upstash itself)
const skillFolders = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "upstash")
  .map((d) => d.name)
  .sort();

const entries = [];

for (const folder of skillFolders) {
  const srcDir = join(SKILLS_DIR, folder);
  const destDir = join(OUTPUT_DIR, folder);

  // Step 3: Copy the skill folder into upstash/
  cpSync(srcDir, destDir, { recursive: true });

  // Step 4: Read SKILL.md, strip frontmatter, rename to overview.md
  const skillMdPath = join(destDir, "SKILL.md");
  const raw = readFileSync(skillMdPath, "utf-8");

  // Parse frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let description = "";
  let body = raw;

  if (fmMatch) {
    const frontmatter = fmMatch[1];
    body = fmMatch[2];

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  // Write overview.md (body without frontmatter)
  writeFileSync(join(destDir, "overview.md"), body.replace(/^\n+/, ""));
  rmSync(skillMdPath);

  entries.push({ folder, description });
}

// Step 5: Write the new SKILL.md using header template + generated entries
const header = readFileSync(join(import.meta.dirname, "header.md"), "utf-8");
const entryLines = entries
  .map(({ folder, description }) => `## [${folder}](${folder}/overview.md)\n\n${description}`)
  .join("\n\n");

writeFileSync(join(OUTPUT_DIR, "SKILL.md"), header + "\n" + entryLines + "\n");

console.log(`Built upstash skill with ${entries.length} sub-skills.`);
