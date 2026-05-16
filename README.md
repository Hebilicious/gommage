# Gommage

Gommage is a CI-first tool for enforcing commit authorship policy so LLMs do not silently land in git history as co-authors, badges, or bot identities.

## Implemented surfaces

- `@gommage/core`: config loading, commit parsing, AI co-author detection, badge detection, blocked domains, custom patterns, and report formatting
- `@gommage/cli`: a `citty`-based CLI with `check`, `fix`, `hook`, and `install`
- `apps/pre-commit/hook.sh`: portable `commit-msg` hook entrypoint
- `apps/shell/gommage.sh`: zero-dependency shell checker for ranges or commit message files
- `@gommage/github-action`: GitHub Action entrypoint with inputs and outputs
- `@gommage/github-app`: pull-request evaluation helpers for wiring into a hosted app
- `website/`: a VitePress site that documents setup, configuration, CLI usage, CI, and product surfaces
- Per-app `tests/bdd` directories: Gherkin acceptance coverage for the CLI, shell, pre-commit hook, GitHub Action, and GitHub App helper with shared TypeScript step files, with only shared world/helpers in `packages/bdd-utils`

## Tooling model

- `moon` is the task runner. Package scripts have been removed in favor of project tasks.
- `pnpm` uses workspace catalogs for all external dependency versions.
- `oxlint` handles linting and `oxfmt` handles formatting.
- `tsgo` from `@typescript/native-preview` is used for typechecking.
- `tsdown` handles package builds.
- `changesets` manages versions and release flow.
- `lefthook` runs formatting, linting, and typechecking before commits.

## Configuration

Gommage discovers `.gommage.yml` by walking up from the current working directory unless `--config` or the Action `config-path` input is provided.

```yaml
version: 1

rules:
  no-ai-coauthor: true
  max-authors: 1
  allow-human-coauthors: false
  blocked-patterns:
    - "Generated with"
    - "🤖"
  blocked-domains:
    - "bot.example.com"
  allowed-patterns: []

scope:
  range: "origin/main..HEAD"
```

Defaults are intentionally conservative about false positives for human collaborators:

- `no-ai-coauthor: true`
- `allow-human-coauthors: true`
- `max-authors: null`
- empty custom pattern and domain lists

## Common commands

```bash
pnpm install

moon run --affected false :build
moon run --affected false :test
moon run --affected false :lint
moon run --affected false :typecheck
moon run --affected false :format-check

moon run --affected false cli:build
moon run --affected false website:dev
moon run --affected false release:status

node apps/cli/dist/index.mjs fix --repo . --dry-run
```

`--affected false` is useful in fresh local clones before the repository has an initial `HEAD` commit. Once the repo has normal git history, `moon run :build` and `moon ci ...` work as expected.

The Git pre-commit hook is managed by Lefthook and runs `moon run --affected false :format`, `moon run --affected false :lint`, and `moon run --affected false :typecheck`.

## CI and releases

- CI uses `moon ci :build :test :lint :typecheck :format-check`.
- Release automation is configured through `.changeset/config.json` and `.github/workflows/release.yml`.
- The release workflow uses Changesets to open release PRs and publish when configured with `NPM_TOKEN`.

## Documentation

The website is in [website](/Users/hebilicious/GitHub/gommage/website) and can be built with:

```bash
moon run --affected false website:build
```

The website includes:

- getting started
- configuration reference
- CLI usage
- CI and release flow
- product surface overview

The repository-level planning docs live at [prd.md](/Users/hebilicious/GitHub/gommage/prd.md) and [scaffold-notes.md](/Users/hebilicious/GitHub/gommage/scaffold-notes.md).
