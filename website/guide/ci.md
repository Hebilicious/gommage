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

The `range` input accepts one revision, or several separated by newlines or commas.

## Repairing a branch in CI with signed commits

The Action only checks. To rewrite a branch and sign the result, run the CLI in a workflow step with the signing key imported into the runner. GitHub marks a commit verified when its signature is valid and the key's verified email matches the committer identity, so the rewrite must commit as the same identity that owns the key.

```yaml
name: gommage-repair

on:
  pull_request:

permissions:
  contents: write

jobs:
  repair:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          ref: ${{ github.head_ref }}
          fetch-depth: 0

      - uses: crazy-max/ghaction-import-gpg@v6
        with:
          gpg_private_key: ${{ secrets.GPG_PRIVATE_KEY }}
          passphrase: ${{ secrets.GPG_PASSPHRASE }}
          git_user_signingkey: true
          git_commit_gpgsign: true
          git_config_global: true

      - run: gommage pr fix "${{ github.event.pull_request.number }}" --commits --gpg-sign \
          --author-name "${{ github.actor }}" --author-email "${{ github.actor }}@users.noreply.github.com" \
          "origin/${{ github.base_ref }}..HEAD"

      - run: git push --force-with-lease
```

Notes:

- The private key must be available to the runner. Import a signing subkey rather than the primary key when possible, and treat the secret as you would any other credential.
- Fork pull requests cannot be pushed with the default token, so this workflow only works for branches in the same repository.
- A force push moves the pull request head, which re-runs required checks and can dismiss approvals.
- Treating this as a repair step means bad commits are still created first. Setting the identity in the environment that authors the commits, and running the `commit-msg` hook, prevents them instead.

## Why cleaning happens before the merge

Rewriting merged history works. `gommage fix` on a range that covers the merged commits rewrites the base branch, a force push updates it, and `git log`, `git blame`, the code browser and the default-branch commit pages then show the cleaned commits.

What rewriting cannot do is purge the pull request's own record. GitHub keeps `refs/pull/<number>/head` permanently, even after the head branch is deleted, so `/pull/<number>/commits` and the original `/commit/<sha>` pages stay live and stay eligible for search results. Those pages are the part that survives, and the only way to keep them from existing is to clean before merging.

That makes the order the whole game:

1. Run `gommage pr fix <number> --commits --gpg-sign` and push the cleaned branch.
2. Force-pushing updates the pull request's commit list, so the record shows the cleaned commits.
3. Merge, with `gommage protect` in place so the merge cannot reintroduce attribution.

If a pull request with attribution has already been merged, rewriting the base branch still cleans the branch. It just cannot remove the pull request pages.

One further distinction: none of this is exposed to search engines in a private repository. A private repository's commit and pull request pages are only reachable by collaborators, so the indexing concern applies to public repositories.

## Changesets

Versioning and release metadata are managed through Changesets. Create a release note with:

```bash
moon run release:changeset -- --empty
```

Version packages with:

```bash
moon run release:version
```
