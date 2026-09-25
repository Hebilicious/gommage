# CLI

The CLI is built with `citty` and exposes six commands.

## `gommage check`

```bash
gommage check [range...] [--cwd DIR] [--config FILE] [--output text|json]
gommage check --message-file FILE [--cwd DIR] [--config FILE]
```

Examples:

```bash
gommage check
gommage check HEAD~10..HEAD
gommage check "origin/main..HEAD" "origin/bartering..HEAD"
gommage check --message-file .git/COMMIT_EDITMSG --output json
```

Pass more than one revision to union several ranges in a single run. Any argument starting with `-`, such as `--all` or `--branches=branch/*`, needs a `--` separator so it is treated as a revision rather than a flag:

```bash
gommage check -- --all
gommage check -- "--branches=branch/*"
```

## `gommage hook`

```bash
gommage hook .git/COMMIT_EDITMSG
```

This command is designed for `commit-msg` hooks and returns a non-zero exit code on policy violations. A `commit-msg` hook only receives the message file, so it cannot see the author or committer identity and catches trailers, badges, and configured patterns only.

## `gommage install`

```bash
gommage install --force
```

This installs a `commit-msg` hook into `.git/hooks/commit-msg`. The generated hook prefers `gommage` from `PATH` and falls back to the installing CLI path.

## `gommage fix`

```bash
gommage fix [range...] [--repo DIR] [--range RANGE] [--dry-run]
gommage fix [--repo DIR] [--author-name NAME] [--author-email EMAIL]
gommage fix [--repo DIR] [--gpg-sign] [--gpg-key KEYID]
```

This command rewrites git history to remove AI co-author trailers, AI badge lines, blocked pattern lines, and offending author identities. It uses `scope.range` from `.gommage.yml` when no range is given, and falls back to `--all`.

Examples:

```bash
gommage fix --repo ../some-repo --dry-run
gommage fix --repo ../some-repo --range HEAD~10..HEAD
gommage fix --repo ../some-repo "origin/main..HEAD" "origin/bartering..HEAD"
gommage fix --repo ../some-repo --author-name "Jane Human" --author-email jane@example.com
gommage fix --repo ../some-repo --gpg-sign
gommage fix --repo ../some-repo --gpg-sign --gpg-key 0123456789ABCDEF
```

Use `--dry-run` first. Real rewrites create backup refs under `refs/original/` because the implementation uses `git filter-branch`.

Identity handling:

- The replacement identity comes from `--author-name` and `--author-email`, otherwise from `git config user.name` and `user.email`.
- A rewritten commit is committed by the replacement identity, which is what `git rebase` and `git commit --amend` do. When no replacement identity resolves, the original committer is preserved.
- If the replacement identity is itself an AI identity or a blocked domain, the rewrite is refused instead of silently leaving the author unchanged.

Signing:

- `--gpg-sign` signs every rewritten commit with the default signing key.
- `--gpg-key KEYID` selects an explicit key.
- The key must be usable in the environment running the command, so a CI job needs the private key material available to GPG.

Dry-run output shows a concrete rewrite preview for every affected commit:

- the exact old and new author
- the exact old and new committer
- the exact old message
- the exact new message
- the cleanup operations that caused the rewrite

## `gommage pr`

Git history is only one place AI attribution is written. Agent tools also add a footer to pull request bodies, which is permanent and public. These commands read and rewrite that text through the GitHub CLI, so `gh` must be installed and authenticated.

```bash
gommage pr check [PR] [--repo OWNER/NAME] [--cwd DIR] [--config FILE] [--output text|json]
gommage pr fix   [PR] [--repo OWNER/NAME] [--cwd DIR] [--config FILE] [--dry-run] [--commits]
```

Without `PR`, both use the pull request for the current branch. `check` exits non-zero when the title or body carries a violation, which makes it usable as a gate.

```bash
gommage pr check --repo Hebilicious/jarettes-box --pr 106
gommage pr fix --repo Hebilicious/jarettes-box --pr 106 --dry-run
```

The same rules drive both surfaces. A line is flagged when it matches a built-in AI attribution pattern, such as a generated-with footer or a `claude.ai/code/session_...` link, when it matches a configured `blocked-patterns` entry, or when it is an AI co-author trailer. `allowed-patterns` exempts a line.

`pr fix` preserves the rest of the body verbatim, including markdown indentation, and only removes the flagged lines.

### Cleaning the commits before a merge

A merge from the GitHub web interface writes into shared history. With `Create a merge commit` or `Rebase and merge` it copies every branch commit, authorship and trailers included, onto the base branch. With `Squash and merge` it writes one new commit whose message comes from the repository's squash settings, and the default can fold the branch commit messages, trailers included, into that message.

`--commits` makes `pr fix` a complete pre-merge scrub: the title, the body, and the commits in `origin/<base>..<head>` in one run.

```bash
gommage pr fix --pr 106 --commits --dry-run \
  --author-name "Hebilicious" --author-email xsh4k3@gmail.com --gpg-sign
gommage pr fix --pr 106 --commits \
  --author-name "Hebilicious" --author-email xsh4k3@gmail.com --gpg-sign
```

It accepts the same `--author-name`, `--author-email`, `--gpg-sign` and `--gpg-key` options as `gommage fix`, and it needs a local checkout containing both the base branch and the pull request branch.

It refuses to run on a merged or closed pull request. That refusal is about the pull request record, not about the branch.

Rewriting merged history is entirely possible. `gommage fix` on a range that includes the merged commits rewrites the base branch, and a force push updates what `git log`, `git blame`, the code browser, and the default-branch commit pages show. Nothing in this repository's settings blocks that.

What a rewrite cannot do is purge the pull request's own record. GitHub keeps `refs/pull/<number>/head` for a merged pull request permanently, even after the head branch is deleted, so `/pull/<number>/commits` and the original `/commit/<sha>` pages stay live and stay eligible for search results. Cleaning the branch before the merge is the only step that keeps those pages from ever existing. The order that works is: clean the branch, push, then merge.

## `gommage protect`

Prevention is stronger than repair. This command restricts a repository's merge settings so AI attribution cannot reach the default branch in the first place.

```bash
gommage protect [--repo OWNER/NAME] [--cwd DIR] [--dry-run]
```

It applies:

| Setting | Value | Why |
| --- | --- | --- |
| `allow_squash_merge` | `true` | Squash is the only merge method left |
| `allow_merge_commit` | `false` | A merge commit would be fine, but rebase-style paths would not |
| `allow_rebase_merge` | `false` | Rebase and merge copies every commit, authorship and trailers included, onto the target |
| `squash_merge_commit_title` | `PR_TITLE` | The merged subject comes from the pull request title |
| `squash_merge_commit_message` | `BLANK` | A blank default body, so commit messages and their trailers cannot be folded into the merged commit |

Apply it after reviewing the dry run:

```bash
gommage protect --repo Hebilicious/jarettes-box --dry-run
gommage protect --repo Hebilicious/jarettes-box
```

`gh` must be authenticated with repository administration permission.
