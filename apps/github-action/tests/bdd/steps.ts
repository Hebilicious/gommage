import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { GommageWorld } from "../../../../packages/bdd-utils/src/world.ts";
import {
  actionEntrypoint,
  createGitRepo,
  parseGithubOutputs,
} from "../../../../packages/bdd-utils/src/helpers.ts";

Given("a git repository with a commit containing an AI co-author", function (this: GommageWorld) {
  const repoDir = createGitRepo(this);
  writeFileSync(`${repoDir}/file.txt`, "safe\n");
  spawnSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  spawnSync("git", ["commit", "-m", "feat: safe commit"], { cwd: repoDir, stdio: "ignore" });
  writeFileSync(`${repoDir}/file.txt`, "safe\nviolating\n");
  spawnSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  spawnSync(
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

When("I run the GitHub Action against HEAD in that repository", function (this: GommageWorld) {
  assert.ok(this.currentRepoDir, "Expected a repository to exist.");
  const outputFile = `${this.currentRepoDir}/github-output.txt`;
  writeFileSync(outputFile, "");
  this.lastCommand = spawnSync("node", [actionEntrypoint], {
    cwd: this.currentRepoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      INPUT_RANGE: "HEAD",
      GITHUB_OUTPUT: outputFile,
    },
  });
  this.lastActionOutputs = parseGithubOutputs(outputFile, this.lastCommand.stdout);
});

Then("the action exits with code {int}", function (this: GommageWorld, code: number) {
  assert.ok(this.lastCommand, "Expected the action process to have been executed.");
  assert.equal(this.lastCommand.status, code);
});

Then(
  "the action output {string} equals {string}",
  function (this: GommageWorld, name: string, value: string) {
    assert.equal(this.lastActionOutputs.get(name), value);
  },
);
