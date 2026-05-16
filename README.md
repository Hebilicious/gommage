# Gommage

Gommage keeps AI assistants out of your git authorship metadata. It checks commit messages and commit authors for AI co-author trailers, generated-with badges, blocked patterns, blocked email domains, and commits authored by known bot identities.

It is meant to fit into the workflow you already use: local checks, commit hooks, CI, GitHub Actions, shell-only environments, and history cleanup.

## Documentation

### Install

Use the CLI package when you want local checks, hooks, or history cleanup:

```bash
pnpm add -D @gommage/cli
```

Then run it through your package manager or installed binary:

```bash
gommage check
```

### Configure

Gommage discovers `.gommage.yml` by walking up from the current directory. You can also pass an explicit config path with `--config` or the GitHub Action `config-path` input.

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

Defaults are conservative about human collaborators:

- AI co-author trailers are blocked.
- Human co-authors are allowed unless `allow-human-coauthors: false`.
- There is no author-count limit unless `max-authors` is set.
- Custom blocked patterns and domains are empty unless configured.

### Use It Locally

Check the configured range:

```bash
gommage check
```

Check a specific range before opening a pull request:

```bash
gommage check origin/main..HEAD
```

Get machine-readable output for scripts:

```bash
gommage check HEAD~10..HEAD --output json
```

### Block Bad Commits Before They Land

Install Gommage as a `commit-msg` hook:

```bash
gommage install
```

The hook validates the commit message file and fails the commit if an AI trailer or blocked marker is present. Use this when you want fast local feedback before CI.

### Clean Existing History

Preview a cleanup before rewriting anything:

```bash
gommage fix --repo . --dry-run
```

Dry-run output shows the exact old author, new author, old message, and new message for every commit that would change. If the preview is correct, rerun without `--dry-run`:

```bash
gommage fix --repo .
```

You can restrict the rewrite and set the replacement identity explicitly:

```bash
gommage fix --repo . --range HEAD~10..HEAD --author-name "Jane Human" --author-email jane@example.com
```

History rewrites are destructive by nature. Review the dry run first, coordinate with collaborators, and push rewritten history only when everyone expects it.

### Use It in GitHub Actions

Run Gommage on pull requests:

```yaml
name: gommage

on:
  pull_request:

jobs:
  authorship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: gommage/gommage-action@v1
        with:
          range: origin/${{ github.base_ref }}..HEAD
```

The action accepts `cwd`, `config-path`, `range`, and `message-file`. It outputs `violations`, `commits-checked`, and `config-path`.

### Use It in a GitHub App

Use the GitHub App package when you want organization-wide PR checks without adding a workflow file to every repository. The package gives your app the policy evaluation and check-run output helpers; your app stays responsible for receiving webhooks, loading repository config, and creating the GitHub check run.

```ts
import { buildCheckRunOutput, evaluatePullRequestCommits } from "@gommage/github-app";

const evaluation = evaluatePullRequestCommits([
  {
    sha: "abc1234",
    message: "feat: add policy",
    authorName: "Jane Human",
    authorEmail: "jane@example.com",
  },
]);

const output = buildCheckRunOutput(evaluation);
```

Use this surface when you want one installed GitHub App to enforce the same authorship policy across many repositories, while still allowing each repository to keep its own `.gommage.yml`.

### Use It Without Node Tooling

For minimal CI images or repositories that do not use Node, install or vendor the shell checker as `gommage.sh` and run it directly:

```bash
gommage.sh check origin/main..HEAD
```

The shell checker catches common AI co-author trailers and generated-with badges. Use the CLI when you need the full `.gommage.yml` policy engine.

### Fit It Into a Team Workflow

- Solo developers can run `gommage install` once and let the commit hook catch accidental AI trailers.
- Maintainers can run `gommage check origin/main..HEAD` before merging contributor branches.
- CI can run the GitHub Action on pull requests so policy is enforced even when contributors do not install hooks.
- Teams cleaning old repositories can use `gommage fix --dry-run` to review an exact rewrite plan before changing history.
- Organizations can wire the GitHub App helper into a hosted app for centralized PR checks across many repositories.

### More Docs

The full documentation website lives in [website](website).

## Contributors

This section is for people changing Gommage itself. End users should not need these commands.

Install dependencies:

```bash
pnpm install
```

Use moon for repository tasks:

```bash
moon run :build
moon run :test
moon run :lint
moon run :typecheck
moon run :format-check
```

Run the docs site locally:

```bash
moon run website:dev
```

Before pushing changes, run the same verification used for review:

```bash
moon run :build :test :lint :typecheck :format-check
moon run release:status
```

Contributor notes:

- Prefer `moon` commands over package scripts or direct binaries.
- Use `pnpm install` only for dependency installation and lockfile updates.
- Generated outputs such as `dist`, VitePress build output, and moon cache should stay out of source control.
