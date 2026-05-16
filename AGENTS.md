# Repository Instructions

- Prefer `moon` for all repository tasks. Use commands such as `moon run :build`, `moon run :test`, `moon run :lint`, `moon run :format`, `moon run :format-check`, and `moon run :typecheck` instead of invoking package scripts, `pnpm --filter`, or local binaries directly.
- Keep moon task definitions invoking tools directly. Do not route moon tasks through `pnpm run` or `pnpm exec`.
- Use `pnpm install` only for dependency installation and lockfile updates.
- Use `tsgo` for typechecking and `tsdown` for builds that emit `dist` output.
- Use `oxlint` for linting and `oxfmt` for formatting.
- Put shared Cucumber support code under `packages/bdd-utils`; put app-owned Gherkin feature files under each app's `tests/bdd` directory.
- Keep generated outputs such as `dist`, VitePress build output, and moon cache out of source control.
