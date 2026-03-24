import { execSync } from "child_process";

const status = execSync("git status --porcelain", { encoding: "utf-8" }).trim();

if (status) {
  console.error("\n >> Error: upstash skill is out of date. Run `npm run build` and commit the result.\n");
  console.error("Changed files:\n");
  console.error(status);
  console.error();
  process.exit(1);
}

console.log("upstash skill is up to date.");
