# Configuration

Gommage discovers `.gommage.yml` by walking upward from the working directory unless a CLI flag or Action input points to a specific file.

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

`scope.range` accepts either a single revision or a list. Each entry is passed to git as its own argument, so a list unions independent ranges:

```yaml
scope:
  range:
    - "origin/main..HEAD"
    - "origin/bartering..HEAD"
```

## Rule semantics

- `no-ai-coauthor`: flags known AI co-author identities.
- `max-authors`: limits total authors, including the primary author.
- `allow-human-coauthors`: blocks non-AI co-authors when set to `false`.
- `blocked-patterns`: custom literal strings or regexes such as `/Cursor/i`.
- `blocked-domains`: blocked email domains or full email addresses.
- `allowed-patterns`: exemptions matched against the violating line.

## Defaults

- AI co-authors are blocked by default.
- Human co-authors are allowed by default.
- No max-author limit is enforced unless configured.
- Custom pattern and domain lists default to empty.
