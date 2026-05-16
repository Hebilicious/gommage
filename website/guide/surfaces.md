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

`@gommage/github-action` translates Action inputs into the shared core checks and sets Action outputs.

## GitHub App

`@gommage/github-app` currently provides pull-request evaluation helpers and check-run output builders for a future hosted webhook service.
