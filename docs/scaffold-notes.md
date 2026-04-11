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
- Typechecking is handled by `tsgo` from `@typescript/native-preview`.
- The docs site is built with VitePress.
- Acceptance coverage is written in Gherkin under each app's `tests/bdd` directory, with shared support and step definitions in `packages/bdd-utils`.
- Changesets is configured for versioning and release workflow automation.
- Lefthook is configured to run moon-backed formatting, linting, and typechecking on pre-commit.

## Remaining gaps versus the long-term PRD

- The GitHub App is not yet a hosted webhook server with auth, installation flow, or status reporting.
- There is no `audit` or `fix` command for historical rewriting yet.
- The shell surface intentionally does not parse `.gommage.yml`; it uses the built-in blocklist only.
- The AI identity database is still static code, not an externally maintained feed.

## Verification notes

- `moon run --affected false :build`
- `moon run --affected false :test :lint :typecheck :format-check`
- `moon run --affected false release:status`

Local moon commands require a real git `HEAD` before moon can inspect repository state. Create the initial repository commit first, then use moon commands for normal verification and CI.
