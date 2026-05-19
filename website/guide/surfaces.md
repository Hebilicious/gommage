# Surfaces

## Core

`@gommage/core` exposes config loading, git range inspection, commit message inspection, and result formatting.

## CLI

`@gommage/cli` wraps the core engine for local development, CI scripts, and hook installation.

## Shell

`apps/shell/gommage.sh` provides a zero-dependency path for environments where Node tooling is unavailable. It intentionally uses the built-in AI blocklist only.

## Pre-commit hook

`apps/pre-commit/hook.sh` is a thin `commit-msg` entrypoint that delegates to the CLI or shell fallback.

## GitHub Action

The GitHub Action translates Action inputs into the shared core checks and sets Action outputs. It is distributed through GitHub Actions, not npm.

## GitHub App

The GitHub App surface is for organization-wide pull request checks without adding a workflow file to every repository. It is distributed as a GitHub App or Marketplace listing, not npm.
