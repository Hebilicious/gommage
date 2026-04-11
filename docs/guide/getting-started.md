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
node apps/cli/dist/index.js check
node apps/cli/dist/index.js check HEAD~5..HEAD
node apps/cli/dist/index.js hook .git/COMMIT_EDITMSG
```

## Install the commit hook

```bash
node apps/cli/dist/index.js install --force
```

## Use moon directly

```bash
moon run --affected false :build
moon run --affected false :test
moon run --affected false :lint
moon run --affected false :typecheck
moon run --affected false :format-check
```

`--affected false` is useful in fresh local clones before the repository has an initial `HEAD` commit.
