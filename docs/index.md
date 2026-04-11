# Gommage

Clean commit history, enforced everywhere.

Gommage blocks AI co-authors, AI-generated badges, blocked bot domains, and authorship policy violations before they land in your repository history. The same core engine powers the CLI, shell script, commit hook, GitHub Action, and GitHub App integration helpers.

## Why teams use it

- Keep `git blame` and contributor graphs human-readable.
- Enforce authorship policy in CI instead of relying on per-editor settings.
- Support local hooks, ad-hoc checks, and PR automation from one rule set.

## Quick start

```bash
pnpm install
moon run --affected false core:build
moon run --affected false cli:build
node apps/cli/dist/index.js check
```

Continue with the [Getting Started guide](/guide/getting-started).
