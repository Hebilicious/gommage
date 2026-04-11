# CLI

The CLI is built with `citty` and exposes three commands.

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
