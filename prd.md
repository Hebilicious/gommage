# Gommage — Product Requirements Document

## TL;DR

Gommage is a CI-first tool that ensures LLMs never sneak into your git history as co-authors. It ships as a GitHub App, a GitHub Action, a CLI, a shell script, and a pre-commit hook — one core engine, many surfaces. The monorepo is managed with moon + proto.

---

## 1. Problem

AI coding assistants (Claude Code, GitHub Copilot, Cursor, OpenCode, Devin, etc.) silently inject `Co-authored-by` trailers, `🤖 Generated with` badges, and sometimes even set themselves as the primary commit author. This causes real problems:

- **Polluted `git blame`**: AI bots show up as code owners, making it impossible to find the human responsible.
- **Broken contribution graphs**: Copilot/Claude appear as top contributors on GitHub profiles and org dashboards.
- **Compliance & IP risk**: Some companies and open-source projects have policies requiring human-only authorship or explicit AI disclosure — uncontrolled injection satisfies neither.
- **No unified enforcement**: Each tool (Claude Code, Cursor, OpenCode) has its own opt-out mechanism (`settings.json`, `CLAUDE.md`, IDE settings). There's no cross-tool, CI-enforced solution.

The demand is real — GitHub community discussions, blog posts, and dev forums are full of developers asking how to strip AI co-authorship. The current "fix" is a patchwork of per-tool config flags and manual `git commit --amend`.

---

## 2. Market Landscape

### Direct competitors (commit message linting / policy enforcement)

| Tool | What it does | Gap Gommage fills |
| --- | --- | --- |
| **commitlint** | Lints commit messages against Conventional Commits rules. Huge ecosystem (Husky, commitizen, semantic-release). | No AI-specific rules. You'd have to write a custom plugin to detect `Co-authored-by: Claude`. Not designed for authorship policy. |
| **gommit** (antham/gommit) | Go binary that validates commit message format via regex patterns in `.gommit.toml`. CI-friendly. | Format-only — checks structure, not authorship metadata. No awareness of AI trailers. Confusingly similar name (we own the branding angle). |
| **gitlint** | Python-based commit message linter, configurable rules, pre-commit compatible. | Same gap as commitlint — no AI author detection out of the box. |
| **conform** | Go tool for repo policy enforcement (commit format, GPG signing, branch naming). | Closest in spirit but still focused on format/signing, not AI authorship. |
| **commitsar** | Go tool checking Conventional Commits compliance. Docker image for CI. | Format-only. |

### Adjacent tools (AI attribution management)

| Tool / Approach | What it does | Gap |
| --- | --- | --- |
| **Claude Code `settings.json`** | `includeCoAuthoredBy: false` disables Claude's trailer insertion. | Only works for Claude Code. Opt-in per developer. No enforcement. |
| **Cursor settings** | IDE-level toggle for co-author injection. | Same — per-developer, per-tool, no CI gate. |
| **OpenCode issue #919** | Community request to disable co-authoring. Config-based. | Tool-specific. |
| **Custom git hooks (blog posts)** | Ad-hoc `prepare-commit-msg` scripts that `sed` out patterns. | Fragile, not portable, no CI story, no config file, no ecosystem. |
| **DIY CI scripts** | GitLab/Jenkins/GHA snippets grepping for `cursoragent` etc. | One-off, not maintained, not configurable, usually hardcoded to one AI tool. |

### Key insight

**Nobody owns the "AI authorship policy" category.** commitlint owns commit *format*. Gommage owns commit *authorship*. They're complementary — you'd run both. Gommage is the only tool that treats AI co-authorship as a first-class policy concern with cross-tool coverage and multi-surface delivery.

---

## 3. Target Users

1. **Engineering teams at companies with AI-use policies** — need CI enforcement that AI contributions are properly attributed (or not attributed at all).
2. **Open-source maintainers** — want clean contributor graphs, or want to require explicit AI disclosure rather than silent injection.
3. **Solo developers** — want to keep their commit history clean without remembering per-tool config flags.
4. **Compliance / security teams** — need auditable proof that authorship policies are enforced.

---

## 4. Product Surfaces

Gommage ships as **one core library** with **five delivery mechanisms**:

| Surface | Use case | How it works |
| --- | --- | --- |
| **CLI** (`gommage`) | Local dev, CI scripts, ad-hoc checks | `gommage check`, `gommage check HEAD~5..HEAD`, `gommage fix --dry-run`, `gommage install` |
| **Pre-commit hook** | Block bad commits before they're created | `commit-msg` hook via `gommage hook` or `.pre-commit-config.yaml` |
| **Shell script** | Zero-dependency option for any CI | Portable `sh` script, downloads nothing, greps commit messages |
| **GitHub Action** | First-class GHA workflow step | `uses: gommage/gommage-action@v1` with config inputs |
| **GitHub App** | Org-wide enforcement without per-repo config | Installs on org, runs checks on every PR, configurable via `.gommage.yml` |

---

## 5. Core Engine — `@gommage/core`

### What it checks

1. **AI co-author trailers** — pattern-match against a maintained list of known AI identities:
   - `Co-authored-by: Claude`, `Co-authored-by: GitHub Copilot`, `Co-authored-by: Cursor`, `Co-authored-by: Devin`, `Co-authored-by: OpenCode`, `Co-authored-by: Codeium`, `Co-authored-by: Tabnine`, `Co-authored-by: Codex`, etc.
2. **AI generation badges** — `🤖 Generated with [Claude Code]`, `Generated by Copilot`, etc.
3. **Author count policy** — configurable max authors per commit (default: no co-authors allowed).
4. **Blocked email domains** — e.g. `noreply@github.com` for bot accounts.
5. **Custom patterns** — user-defined regex or string patterns.

### Configuration (`.gommage.yml`)

```yaml
# .gommage.yml
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

### Output

```text
🧹 Gommage found 2 violation(s) in commit a1b2c3d:

  ✗ [ai-coauthor]  AI co-authorship detected: "Co-authored-by: Claude <noreply@anthropic.com>"
  ✗ [ai-badge]     AI generation badge found: "🤖 Generated with [Claude Code]"

Hint: Configure your AI tool to disable co-authorship, or update .gommage.yml to allow it.
```

---

## 6. Architecture — Monorepo with moon + proto

```text
gommage/
├── .prototools
├── .moon/
│   ├── workspace.yml
│   └── toolchains.yml
├── pnpm-workspace.yaml
├── packages/
│   └── core/
│       ├── moon.yml
│       ├── package.json
│       ├── src/
│       └── tests/
├── apps/
│   ├── cli/
│   │   ├── moon.yml
│   │   └── src/
│   ├── github-action/
│   │   ├── moon.yml
│   │   └── action.yml
│   ├── github-app/
│   │   ├── moon.yml
│   │   └── src/
│   ├── pre-commit/
│   │   └── hook.sh
│   └── shell/
│       └── gommage.sh
├── .agents/
│   ├── AGENTS.md
│   └── skills/
│       ├── git-commit/
│       ├── moon/
│       ├── proto/
│       ├── grill-me/
│       └── tdd/
├── website/
│   └── guide/
├── prd.md
└── scaffold-notes.md
```

### Why moon + proto

- **proto** pins exact versions of Node, pnpm, and moon itself in `.prototools` — every contributor and CI runner uses identical tooling with zero setup.
- **moon** orchestrates tasks across the monorepo with dependency-aware caching. `moon ci :build :test :lint` runs everything in the right order, skipping unchanged packages.
- The GitHub Action and CLI both depend on `@gommage/core`. Moon's `deps: ["^:build"]` ensures core is built first.

---

## 7. Milestones

### v0.1 — MVP

- `@gommage/core`: pattern matching engine with default AI blocklist, config loading, violation reporting.
- `@gommage/cli`: `check`, `hook`, `install` commands.
- Pre-commit hook (`commit-msg`).
- `.gommage.yml` config support.
- Monorepo scaffolded with moon + proto.
- Tests for core (TDD, per the tdd skill).

### v0.2 — CI surfaces

- GitHub Action (`gommage/gommage-action@v1`).
- Shell script (zero-dep, POSIX-compatible).
- Pre-commit framework integration (`.pre-commit-config.yaml` entry).
- Documentation site.

### v0.3 — GitHub App

- Webhook-based PR check.
- Org-level default config.
- Per-repo override via `.gommage.yml`.
- Dashboard showing violation trends.

### v1.0 — Ecosystem

- Maintained, community-updated AI identity database.
- commitlint plugin (`@gommage/commitlint-plugin`) for teams already using commitlint.
- GitLab CI template.
- `gommage audit` command — scan entire repo history for AI co-authorship.
- `gommage fix` command — rewrite commits to remove AI trailers, bad author identities, and other blocked metadata with a dry-run preview.

---

## 8. Non-Goals (for now)

- **Code-level AI detection** (e.g. "was this code written by an LLM?") — that's a different, much harder problem. Gommage only checks commit metadata.
- **Forcing AI disclosure** — Gommage blocks AI authorship by default, but the inverse policy ("require AI disclosure") is a future feature, not MVP.
- **Replacing commitlint** — Gommage is complementary. It checks *who*, not *what format*.

---

## 9. Success Metrics

- **Adoption**: GitHub stars, npm weekly downloads, GHA marketplace installs.
- **Coverage**: Number of AI tools in the default blocklist.
- **Reliability**: Zero false positives on the default config (human co-authors must never be blocked).
- **Speed**: < 100ms for checking a single commit, < 2s for a 500-commit range.

---

## 10. Open Questions

1. **Naming collision**: `antham/gommit` exists (Go, commit format linting). The name "Gommage" is distinct enough, but worth noting for SEO and discoverability.
2. **Default strictness**: Should the default be "block all co-authors" or "block only AI co-authors"? Leaning toward "block AI co-authors only" to avoid blocking legitimate human pair-programming co-authors.
3. **AI identity database**: Should this be a separate, community-maintained package (like `caniuse-db`) or inline in core?
4. **Inverse mode**: Some teams *want* to require AI disclosure (force `Co-authored-by: Claude` when AI was used). This is a fundamentally different product direction — park it for v1.0+.
