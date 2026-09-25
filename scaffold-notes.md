# Implementation Notes

## What now exists

- `@gommage/core` enforces AI co-author, AI badge, blocked domain, max author, and custom pattern rules.
- `.gommage.yml` is loaded from the current directory upward or from an explicit path.
- The CLI is refactored to `citty` and supports `check`, `hook`, and `install`.
- The shell script and `commit-msg` hook provide lightweight local enforcement.
- The GitHub Action exposes the same checks through standard Action inputs and outputs.
- The GitHub App package exposes PR evaluation helpers instead of a hard failure placeholder.
- The repository uses moon tasks directly instead of package scripts.
- Linting and formatting are handled by `oxlint` and `oxfmt`.
- Typechecking is handled by the native `tsc` from `typescript`.
- Package builds are handled by `tsdown`.
- The website is built with VitePress from `website/`.
- Acceptance coverage is written in Gherkin under each app's `tests/bdd` directory, with shared world/helpers in `packages/bdd-utils` and app-local TypeScript step files beside each feature.
- Changesets is configured for versioning and release workflow automation.
- Lefthook is configured to run moon-backed formatting, linting, and typechecking on pre-commit.
- The CLI now includes `gommage fix` with a concrete dry-run preview and history rewrite flow.
- `scope.range` accepts a list, and the CLI and Action accept several revisions, so one run can union multiple branch ranges.
- `gommage fix` preserves or sets the committer deliberately, refuses a replacement identity that is itself an AI identity or blocked domain, and can GPG-sign every rewritten commit with `--gpg-sign` and `--gpg-key`.
- `gommage pr check` and `gommage pr fix` read and rewrite pull request titles and bodies through the GitHub CLI, using the same rule engine as commit messages.
- `gommage pr fix --commits` scrubs the title, the body and the commits in `origin/<base>..<head>` in one run, with the same identity and signing options as `gommage fix`, and refuses to run once the pull request is merged.
- `gommage protect` restricts a repository to squash merges with a title-only squash message, so rebase merges and the repository's commit-message setting cannot copy AI attribution into merged history.

## Remaining gaps versus the long-term PRD

- The GitHub App is not yet a hosted webhook server with auth, installation flow, or status reporting.
- There is no dedicated `audit` command for full-history reporting yet.
- The shell surface intentionally does not parse `.gommage.yml`; it uses the built-in blocklist only.
- The AI identity database is still static code, not an externally maintained feed.
- The GitHub Action only checks; it cannot rewrite or sign a branch, so a signed repair needs a workflow step that runs the CLI.
- Pull request comments and review comments are not scanned, only titles and bodies.
- The GitHub Action does not check the pull request body, because it never reads the event payload.
- Merged history can be rewritten, but a merged pull request's own commit pages cannot be purged, because GitHub keeps `refs/pull/<number>/head` permanently.

## Verification notes

- `moon run --affected false :build`
- `moon run --affected false :test :lint :typecheck :format-check`
- `moon run --affected false release:status`

Local moon commands require a real git `HEAD` before moon can inspect repository state. Create the initial repository commit first, then use moon commands for normal verification and CI.
