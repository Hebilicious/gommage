# Getting Started

## Install dependencies

```bash
pnpm install
```

## Build the core surfaces

```bash
moon run --affected false core:build
moon run --affected false cli:build
moon run --affected false github-action:build
moon run --affected false github-app:build
```

## Run checks locally

```bash
node apps/cli/dist/index.mjs check
node apps/cli/dist/index.mjs check HEAD~5..HEAD
node apps/cli/dist/index.mjs hook .git/COMMIT_EDITMSG
node apps/cli/dist/index.mjs fix --repo . --dry-run
```

## Install the commit hook

```bash
node apps/cli/dist/index.mjs install --force
```

## Dry-run a history cleanup

```bash
node apps/cli/dist/index.mjs fix --repo . --dry-run
```

If the plan looks correct, run the same command without `--dry-run` to rewrite the selected history.

The dry run prints the exact rewritten author and the exact rewritten commit message so you can review the end state before touching git history.

## Use moon directly

```bash
moon run --affected false :build
moon run --affected false :test
moon run --affected false :lint
moon run --affected false :typecheck
moon run --affected false :format-check
```

`--affected false` is useful in fresh local clones before the repository has an initial `HEAD` commit.
