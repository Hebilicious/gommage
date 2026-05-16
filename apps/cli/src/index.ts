#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineCommand, runMain } from "citty";

import {
  checkGitRange,
  checkMessageFile,
  formatRewritePlan,
  formatCheckResult,
  hasViolations,
  planHistoryRewrite,
  rewriteGitHistory,
  type CheckResult,
} from "@gommage/core";

const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Check commit history or a commit message file for authorship policy violations.",
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
          range: getFirstPositional(args),
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
    const messageFile = args["message-file"] ?? getFirstPositional(args);
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
      description: "Git revision range or selector to rewrite. Defaults to --all.",
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
  },
  async run({ args }) {
    const cwd = resolve(args.repo ?? process.cwd());
    const rewriteOptions = {
      cwd,
      configPath: args.config,
      range: args.range,
      replacementAuthorName: args["author-name"],
      replacementAuthorEmail: args["author-email"],
    };
    const dryRun = Boolean(args["dry-run"]);
    const plan = dryRun ? planHistoryRewrite(rewriteOptions) : rewriteGitHistory(rewriteOptions);

    console.log(formatRewritePlan(plan, { dryRun }));
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
  },
});

function getFirstPositional(args: Record<string, unknown>): string | undefined {
  const positional = args._;
  if (!Array.isArray(positional) || positional.length === 0) {
    return undefined;
  }

  const value = positional[0];
  return typeof value === "string" ? value : undefined;
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
