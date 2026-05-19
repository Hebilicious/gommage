# CI and Automation

## GitHub Actions

Build the action package and point workflows at the action directory or a published release.

```yaml
- uses: actions/checkout@v6.0.2
  with:
    fetch-depth: 0

- uses: moonrepo/setup-toolchain@v0.6.4
  with:
    auto-install: true

- run: pnpm install --frozen-lockfile

- run: moon run :build :test :lint :typecheck :format-check
```

The GitHub Action itself accepts these inputs:

- `cwd`
- `config-path`
- `range`
- `message-file`

It emits:

- `violations`
- `commits-checked`
- `config-path`

## Changesets

Versioning and release metadata are managed through Changesets. Create a release note with:

```bash
moon run release:changeset -- --empty
```

Version packages with:

```bash
moon run release:version
```
