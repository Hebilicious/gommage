#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineCommand, runMain } from "citty";

import {
  checkGitRange,
  checkMessageFile,
  checkPullRequest,
  formatPullRequestCheck,
  formatPullRequestPlan,
  formatRewritePlan,
  formatCheckResult,
  hasViolations,
  loadConfig,
  planHistoryRewrite,
  planPullRequestRewrite,
  pullRequestRevisionRange,
  rewriteGitHistory,
  type CheckResult,
} from "@gommage/core";

import {
  PROTECTED_MERGE_SETTINGS,
  readMergeSettings,
  readPullRequest,
  resolveRepository,
  updateMergeSettings,
  updatePullRequest,
} from "./github.js";

const checkCommand = defineCommand({
  meta: {
    name: "check",
    description:
      "Check commit history or a commit message file for authorship policy violations. Pass one or more revisions or ranges as positional arguments to override .gommage.yml scope.range.",
  },
  args: {
    cwd: {
      type: "string",
      description: "Working directory used for git and config discovery.",
    },
    config: {
      type: "string",
      description: "Explicit path to a .gommage.yml file.",
    },
    "message-file": {
      type: "string",
      description: "Commit message file to validate instead of a git range.",
    },
    output: {
      type: "string",
      default: "text",
      description: "Output format: text or json.",
    },
  },
  async run({ args }) {
    const result = args["message-file"]
      ? checkMessageFile({
          cwd: args.cwd,
          configPath: args.config,
          messageFile: args["message-file"],
        })
      : checkGitRange({
          cwd: args.cwd,
          configPath: args.config,
          range: getPositionals(args),
        });

    printResult(result, args.output);
    process.exitCode = hasViolations(result) ? 1 : 0;
  },
});

const hookCommand = defineCommand({
  meta: {
    name: "hook",
    description: "Validate a commit message file from a commit-msg hook.",
  },
  args: {
    cwd: {
      type: "string",
      description: "Working directory used for config discovery.",
    },
    config: {
      type: "string",
      description: "Explicit path to a .gommage.yml file.",
    },
    "message-file": {
      type: "string",
      description: "Commit message file to validate.",
    },
  },
  async run({ args }) {
    const messageFile = args["message-file"] ?? getPositionals(args)?.[0];
    if (!messageFile) {
      throw new Error("hook requires a commit message file path.");
    }

    const result = checkMessageFile({
      cwd: args.cwd,
      configPath: args.config,
      messageFile,
    });

    printResult(result, "text");
    process.exitCode = hasViolations(result) ? 1 : 0;
  },
});

const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Install Gommage as a commit-msg hook for the current repository.",
  },
  args: {
    cwd: {
      type: "string",
      description: "Repository root where the hook should be installed.",
    },
    force: {
      type: "boolean",
      description: "Overwrite an existing commit-msg hook.",
    },
  },
  async run({ args }) {
    const cwd = resolve(args.cwd ?? process.cwd());
    const force = Boolean(args.force);
    const gitDir = resolveGitDir(cwd);
    const hookPath = resolve(gitDir, "hooks", "commit-msg");
    const hookDir = dirname(hookPath);
    const cliPath = fileURLToPath(import.meta.url);

    if (existsSync(hookPath) && !force) {
      throw new Error(
        `Refusing to overwrite existing hook at ${hookPath}. Re-run with --force to replace it.`,
      );
    }

    mkdirSync(hookDir, { recursive: true });
    writeFileSync(
      hookPath,
      [
        "#!/bin/sh",
        "",
        "if command -v gommage >/dev/null 2>&1; then",
        '  exec gommage hook "$1"',
        "fi",
        "",
        `if [ -f "${cliPath}" ]; then`,
        `  exec node "${cliPath}" hook "$1"`,
        "fi",
        "",
        'echo "gommage: unable to find the CLI in PATH." >&2',
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(hookPath, 0o755);

    console.log(`Installed Gommage commit-msg hook at ${hookPath}`);
  },
});

const fixCommand = defineCommand({
  meta: {
    name: "fix",
    description: "Rewrite commit history to remove policy-violating metadata and message lines.",
  },
  args: {
    repo: {
      type: "string",
      description: "Repository root whose history should be rewritten.",
    },
    config: {
      type: "string",
      description: "Explicit path to a .gommage.yml file.",
    },
    range: {
      type: "string",
      description:
        "Git revision range or selector to rewrite. Pass several as positional arguments. Defaults to .gommage.yml scope.range, then --all.",
    },
    "dry-run": {
      type: "boolean",
      description: "Print the rewrite plan without changing git history.",
    },
    "author-name": {
      type: "string",
      description: "Replacement author name for commits whose author identity must be rewritten.",
    },
    "author-email": {
      type: "string",
      description: "Replacement author email for commits whose author identity must be rewritten.",
    },
    "gpg-sign": {
      type: "boolean",
      description: "GPG-sign every rewritten commit using the default or --gpg-key signing key.",
    },
    "gpg-key": {
      type: "string",
      description: "Key id used for --gpg-sign. Defaults to the configured signing key.",
    },
  },
  async run({ args }) {
    const cwd = resolve(args.repo ?? process.cwd());
    const rewriteOptions = {
      cwd,
      configPath: args.config,
      range: getPositionals(args) ?? args.range,
      replacementAuthorName: args["author-name"],
      replacementAuthorEmail: args["author-email"],
      gpgSign: args["gpg-key"] ?? Boolean(args["gpg-sign"]),
    };
    const dryRun = Boolean(args["dry-run"]);
    const plan = dryRun ? planHistoryRewrite(rewriteOptions) : rewriteGitHistory(rewriteOptions);

    console.log(formatRewritePlan(plan, { dryRun }));
  },
});

const prCheckCommand = defineCommand({
  meta: {
    name: "check",
    description: "Check a pull request title and body for AI attribution using the GitHub CLI.",
  },
  args: {
    pr: {
      type: "string",
      description: "Pull request number. Defaults to the pull request for the current branch.",
    },
    repo: {
      type: "string",
      description: "Repository as owner/name. Defaults to the repository of the working directory.",
    },
    cwd: {
      type: "string",
      description: "Working directory used for GitHub CLI discovery.",
    },
    config: {
      type: "string",
      description: "Explicit path to a .gommage.yml file.",
    },
    output: {
      type: "string",
      default: "text",
      description: "Output format: text or json.",
    },
  },
  run({ args }) {
    const context = { cwd: args.cwd, repo: args.repo };
    const pullRequest = readPullRequest({ ...context, number: args.pr });
    const { config } = loadConfig({ cwd: args.cwd, configPath: args.config });
    const result = checkPullRequest(pullRequest, config);

    if (args.output === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const report = formatPullRequestCheck(result);
      const stream = hasViolations(result) ? process.stderr : process.stdout;
      stream.write(`${report}\n`);
    }

    process.exitCode = hasViolations(result) ? 1 : 0;
  },
});

const prFixCommand = defineCommand({
  meta: {
    name: "fix",
    description:
      "Strip AI attribution lines from a pull request title and body using the GitHub CLI.",
  },
  args: {
    pr: {
      type: "string",
      description: "Pull request number. Defaults to the pull request for the current branch.",
    },
    repo: {
      type: "string",
      description: "Repository as owner/name. Defaults to the repository of the working directory.",
    },
    cwd: {
      type: "string",
      description: "Working directory used for GitHub CLI discovery.",
    },
    config: {
      type: "string",
      description: "Explicit path to a .gommage.yml file.",
    },
    "dry-run": {
      type: "boolean",
      description: "Print the planned rewrite without editing the pull request.",
    },
    commits: {
      type: "boolean",
      description:
        "Also rewrite the commits the pull request would merge, so the branch history is clean before the merge.",
    },
    "author-name": {
      type: "string",
      description: "Replacement author name for commits whose author identity must be rewritten.",
    },
    "author-email": {
      type: "string",
      description: "Replacement author email for commits whose author identity must be rewritten.",
    },
    "gpg-sign": {
      type: "boolean",
      description: "GPG-sign every rewritten commit using the default or --gpg-key signing key.",
    },
    "gpg-key": {
      type: "string",
      description: "Key id used for --gpg-sign. Defaults to the configured signing key.",
    },
  },
  async run({ args }) {
    const context = { cwd: args.cwd, repo: args.repo };
    const pullRequest = readPullRequest({ ...context, number: args.pr });

    if (args.commits && pullRequest.state !== "OPEN") {
      throw new Error(
        `Pull request #${pullRequest.number} is ${pullRequest.state.toLowerCase()}. Rewriting after a merge force-pushes shared history, and GitHub keeps the original commits reachable at refs/pull/${pullRequest.number}/head regardless, so clean the branch before merging instead.`,
      );
    }

    const { config } = loadConfig({ cwd: args.cwd, configPath: args.config });
    const plan = planPullRequestRewrite(pullRequest, config);
    const dryRun = Boolean(args["dry-run"]);

    const title = plan.surfaces.find((surface) => surface.surface === "title");
    const body = plan.surfaces.find((surface) => surface.surface === "body");

    if (!dryRun && title && title.sanitized.trim().length === 0) {
      throw new Error(
        `Every line of pull request #${pullRequest.number} would be removed from the title. Set a replacement title by hand.`,
      );
    }

    if (!dryRun && plan.surfaces.length > 0) {
      updatePullRequest({
        ...context,
        number: pullRequest.number,
        title: title?.sanitized,
        body: body?.sanitized,
      });
    }

    console.log(formatPullRequestPlan(plan, { dryRun }));

    if (!args.commits) {
      return;
    }

    const rewriteOptions = {
      cwd: args.cwd,
      configPath: args.config,
      range: pullRequestRevisionRange(pullRequest),
      replacementAuthorName: args["author-name"],
      replacementAuthorEmail: args["author-email"],
      gpgSign: args["gpg-key"] ?? Boolean(args["gpg-sign"]),
    };
    const revisionPlan = dryRun
      ? planHistoryRewrite(rewriteOptions)
      : rewriteGitHistory(rewriteOptions);

    console.log("");
    console.log(formatRewritePlan(revisionPlan, { dryRun }));
  },
});

const prCommand = defineCommand({
  meta: {
    name: "pr",
    description: "Check and clean AI attribution in pull request titles and bodies.",
  },
  subCommands: {
    check: prCheckCommand,
    fix: prFixCommand,
  },
});

const protectCommand = defineCommand({
  meta: {
    name: "protect",
    description:
      "Restrict a repository to squash merges with a title-only message, so AI attribution cannot reach the default branch.",
  },
  args: {
    repo: {
      type: "string",
      description: "Repository as owner/name. Defaults to the repository of the working directory.",
    },
    cwd: {
      type: "string",
      description: "Working directory used for GitHub CLI discovery.",
    },
    "dry-run": {
      type: "boolean",
      description: "Print the planned settings change without applying it.",
    },
  },
  run({ args }) {
    const context = { cwd: args.cwd, repo: args.repo };
    const repo = resolveRepository(context);
    const current = readMergeSettings(repo, args.cwd);
    const keys = Object.keys(PROTECTED_MERGE_SETTINGS) as Array<
      keyof typeof PROTECTED_MERGE_SETTINGS
    >;
    const changes = keys
      .filter((key) => current[key] !== PROTECTED_MERGE_SETTINGS[key])
      .map((key) => ({
        key,
        from: String(current[key]),
        to: String(PROTECTED_MERGE_SETTINGS[key]),
      }));

    if (changes.length === 0) {
      console.log(`${repo} already uses protected merge settings.`);
      return;
    }

    const report = changes.map((change) => `  - ${change.key}: ${change.from} -> ${change.to}`);

    if (args["dry-run"]) {
      console.log([`Gommage would update ${repo}:`, ...report].join("\n"));
      console.log("\nNo repository settings were changed because --dry-run was set.");
      return;
    }

    updateMergeSettings(repo, PROTECTED_MERGE_SETTINGS, args.cwd);
    console.log([`Gommage updated ${repo}:`, ...report].join("\n"));
  },
});

const main = defineCommand({
  meta: {
    name: "gommage",
    description: "Enforce commit authorship policy across local and CI workflows.",
  },
  subCommands: {
    check: checkCommand,
    fix: fixCommand,
    hook: hookCommand,
    install: installCommand,
    pr: prCommand,
    protect: protectCommand,
  },
});

function getPositionals(args: Record<string, unknown>): string[] | undefined {
  const positional = args._;
  if (!Array.isArray(positional)) {
    return undefined;
  }

  const values = positional.filter((value): value is string => typeof value === "string");
  return values.length > 0 ? values : undefined;
}

function printResult(result: CheckResult, output: string): void {
  if (output === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const stream = hasViolations(result) ? process.stderr : process.stdout;
  stream.write(`${formatCheckResult(result)}\n`);
}

function resolveGitDir(cwd: string): string {
  const output = execFileSync("git", ["rev-parse", "--git-dir"], {
    cwd,
    encoding: "utf8",
  }).trim();

  return resolve(cwd, output);
}

runMain(main).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`gommage: ${message}`);
  process.exitCode = 1;
});
