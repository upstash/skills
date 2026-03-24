# Upstash Skills

This repo contains agent skills for Upstash SDKs. Each skill lives in its own folder under `skills/` and is also bundled into a single combined `skills/upstash/` skill.

## Repository structure

```
skills/
  upstash-qstash-js/     # Individual skill (source of truth)
  upstash-vector-js/
  upstash-workflow-js/
  ...
  upstash/                # Generated combined skill (do not edit manually)
scripts/
  build.mjs              # Generates skills/upstash/ from the individual skills
  check.mjs              # Verifies the generated output is up to date
  header.md              # SKILL.md header template for the combined skill
```

## Making changes

### Updating an existing skill

1. Edit the files in the individual skill folder (e.g. `skills/upstash-qstash-js/`).
2. Run `npm run build` to regenerate `skills/upstash/`.
3. Commit both the source changes and the regenerated output.

### Adding a new skill

1. Create a new folder under `skills/` (e.g. `skills/upstash-redis-js/`).
2. Add a `SKILL.md` with the standard frontmatter (`name` and `description`) and any supporting files.
3. Run `npm run build` — the new skill will be picked up automatically.
4. Commit everything.

### Changing the combined skill header

The frontmatter and introductory text for `skills/upstash/SKILL.md` comes from `scripts/header.md`. Edit that file, then run `npm run build`.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `npm run build` | Regenerates `skills/upstash/` from all individual skills. |
| `check` | `npm run check` | Runs the build, then fails if there is a git diff — used in CI to ensure the generated output is committed. |

## CI

The GitHub Actions workflow (`.github/workflows/check.yml`) runs `npm run check` on every push and PR. If you forget to run `npm run build` before pushing, CI will fail.
