# CLI

The CLI is built with `citty` and exposes four commands.

## `gommage check`

```bash
gommage check [range] [--cwd DIR] [--config FILE] [--output text|json]
gommage check --message-file FILE [--cwd DIR] [--config FILE]
```

Examples:

```bash
gommage check
gommage check HEAD~10..HEAD
gommage check --message-file .git/COMMIT_EDITMSG --output json
```

## `gommage hook`

```bash
gommage hook .git/COMMIT_EDITMSG
```

This command is designed for `commit-msg` hooks and returns a non-zero exit code on policy violations.

## `gommage install`

```bash
gommage install --force
```

This installs a `commit-msg` hook into `.git/hooks/commit-msg`. The generated hook prefers `gommage` from `PATH` and falls back to the installing CLI path.

## `gommage fix`

```bash
gommage fix [--repo DIR] [--range RANGE] [--dry-run]
gommage fix [--repo DIR] [--range RANGE] [--author-name NAME] [--author-email EMAIL]
```

This command rewrites git history to remove AI co-author trailers, AI badge lines, blocked pattern lines, and offending author identities. It defaults to rewriting `--all`.

Examples:

```bash
gommage fix --repo ../some-repo --dry-run
gommage fix --repo ../some-repo --range HEAD~10..HEAD
gommage fix --repo ../some-repo --author-name "Jane Human" --author-email jane@example.com
```

Use `--dry-run` first. Real rewrites create backup refs under `refs/original/` because the implementation uses `git filter-branch`.

Dry-run output shows a concrete rewrite preview for every affected commit:

- the exact old author
- the exact new author
- the exact old message
- the exact new message
- the cleanup operations that caused the rewrite
