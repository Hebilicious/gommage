import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { GommageWorld } from "../../../../packages/bdd-utils/src/world.ts";
import {
  cliEntrypoint,
  createGitRepo,
  escapeRegExp,
  readLatestCommitMessage,
  workspaceRoot,
} from "../../../../packages/bdd-utils/src/helpers.ts";

Given("a commit message file with an AI co-author", function (this: GommageWorld) {
  this.createMessageFile(
    ["feat: add policy", "", "Co-authored-by: Claude <noreply@anthropic.com>"].join("\n"),
  );
});

Given("an empty git repository", function (this: GommageWorld) {
  this.currentRepoDir = createGitRepo(this);
});

Given("a git repository with a commit containing an AI co-author", function (this: GommageWorld) {
  const repoDir = createGitRepo(this);
  writeFileSync(`${repoDir}/file.txt`, "safe\n");
  execFileSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "feat: safe commit"], {
    cwd: repoDir,
    stdio: "ignore",
  });
  writeFileSync(`${repoDir}/file.txt`, "safe\nviolating\n");
  execFileSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "commit",
      "-m",
      ["feat: violating commit", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
    ],
    {
      cwd: repoDir,
      stdio: "ignore",
    },
  );
  this.currentRepoDir = repoDir;
});

When("I run the CLI check command against that message file", function (this: GommageWorld) {
  this.lastCommand = spawnSync(
    "node",
    [cliEntrypoint, "check", "--message-file", this.currentMessageFile ?? ""],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
});

When("I run the CLI install command in that repository", function (this: GommageWorld) {
  this.lastCommand = spawnSync(
    "node",
    [cliEntrypoint, "install", "--cwd", this.currentRepoDir ?? ""],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
});

When("I run the CLI fix command in that repository with dry-run", function (this: GommageWorld) {
  this.lastCommand = spawnSync(
    "node",
    [cliEntrypoint, "fix", "--repo", this.currentRepoDir ?? "", "--dry-run"],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
});

When("I run the CLI fix command in that repository", function (this: GommageWorld) {
  this.lastCommand = spawnSync(
    "node",
    [cliEntrypoint, "fix", "--repo", this.currentRepoDir ?? ""],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
});

Then("the command exits with code {int}", function (this: GommageWorld, code: number) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.equal(this.lastCommand.status, code);
});

Then("stderr contains {string}", function (this: GommageWorld, expected: string) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.match(this.lastCommand.stderr, new RegExp(escapeRegExp(expected)));
});

Then("stdout contains {string}", function (this: GommageWorld, expected: string) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.match(this.lastCommand.stdout, new RegExp(escapeRegExp(expected)));
});

Then(
  "the file {string} exists in that repository",
  function (this: GommageWorld, relativePath: string) {
    assert.ok(existsSync(this.getRepoPath(relativePath)));
  },
);

Then(
  "the latest commit message in that repository contains {string}",
  function (this: GommageWorld, expected: string) {
    assert.ok(this.currentRepoDir, "Expected a repository to exist.");
    assert.match(readLatestCommitMessage(this.currentRepoDir), new RegExp(escapeRegExp(expected)));
  },
);

Then(
  "the latest commit message in that repository does not contain {string}",
  function (this: GommageWorld, expected: string) {
    assert.ok(this.currentRepoDir, "Expected a repository to exist.");
    assert.doesNotMatch(
      readLatestCommitMessage(this.currentRepoDir),
      new RegExp(escapeRegExp(expected)),
    );
  },
);
