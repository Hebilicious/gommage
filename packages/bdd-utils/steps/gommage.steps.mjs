import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cliEntrypoint = resolve(workspaceRoot, "apps/cli/dist/index.js");
const actionEntrypoint = resolve(workspaceRoot, "apps/github-action/dist/index.js");
const githubAppEntrypoint = resolve(workspaceRoot, "apps/github-app/dist/index.js");
const shellEntrypoint = resolve(workspaceRoot, "apps/shell/gommage.sh");
const preCommitHookEntrypoint = resolve(workspaceRoot, "apps/pre-commit/hook.sh");

Given("a commit message file with an AI co-author", function () {
  this.createMessageFile(
    ["feat: add policy", "", "Co-authored-by: Claude <noreply@anthropic.com>"].join("\n"),
  );
});

Given("an empty git repository", function () {
  this.currentRepoDir = createGitRepo(this);
});

Given("a git repository with a commit containing an AI co-author", function () {
  const repoDir = createGitRepo(this);
  writeFileSync(repoDir + "/file.txt", "safe\n");
  execFileSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "feat: safe commit"], {
    cwd: repoDir,
    stdio: "ignore",
  });
  writeFileSync(repoDir + "/file.txt", "safe\nviolating\n");
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

Given("a pull request payload with an AI co-author commit", function () {
  this.pullRequestPayload = [
    {
      sha: "abc1234",
      message: ["feat: violating commit", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
      authorName: "BDD Runner",
      authorEmail: "bdd@example.com",
    },
  ];
});

When("I run the CLI check command against that message file", function () {
  this.lastCommand = spawnSync(
    "node",
    [cliEntrypoint, "check", "--message-file", this.currentMessageFile],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
    },
  );
});

When("I run the CLI install command in that repository", function () {
  this.lastCommand = spawnSync("node", [cliEntrypoint, "install", "--cwd", this.currentRepoDir], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
});

When("I run the shell hook against that message file", function () {
  this.lastCommand = spawnSync("sh", [shellEntrypoint, "hook", this.currentMessageFile], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
});

When("I run the pre-commit hook against that message file", function () {
  this.lastCommand = spawnSync("sh", [preCommitHookEntrypoint, this.currentMessageFile], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
});

When("I run the GitHub Action against HEAD in that repository", function () {
  const outputFile = this.currentRepoDir + "/github-output.txt";
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

When("I evaluate the payload with the GitHub App helper", async function () {
  const module = await import(pathToFileURL(githubAppEntrypoint).href);
  this.lastEvaluation = module.evaluatePullRequestCommits(this.pullRequestPayload);
});

Then("the command exits with code {int}", function (code) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.equal(this.lastCommand.status, code);
});

Then("stderr contains {string}", function (expected) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.match(this.lastCommand.stderr, new RegExp(escapeRegExp(expected)));
});

Then("the file {string} exists in that repository", function (relativePath) {
  assert.ok(existsSync(this.getRepoPath(relativePath)));
});

Then("the action exits with code {int}", function (code) {
  assert.ok(this.lastCommand, "Expected the action process to have been executed.");
  assert.equal(this.lastCommand.status, code);
});

Then("the action output {string} equals {string}", function (name, value) {
  assert.equal(this.lastActionOutputs.get(name), value);
});

Then("the GitHub App conclusion is {string}", function (value) {
  assert.ok(this.lastEvaluation, "Expected a GitHub App evaluation result.");
  assert.equal(this.lastEvaluation.conclusion, value);
});

Then("the GitHub App summary contains {string}", function (value) {
  assert.ok(this.lastEvaluation, "Expected a GitHub App evaluation result.");
  assert.match(this.lastEvaluation.summary, new RegExp(escapeRegExp(value)));
});

function createGitRepo(world) {
  const repoDir = world.createTempDir("gommage-repo-");
  execFileSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "BDD Runner"], {
    cwd: repoDir,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.email", "bdd@example.com"], {
    cwd: repoDir,
    stdio: "ignore",
  });
  return repoDir;
}

function parseGithubOutputs(file, stdout) {
  const outputs = new Map();

  if (existsSync(file)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (line.includes("<<")) {
        const [name, delimiter] = line.split("<<", 2);
        const values = [];

        for (index += 1; index < lines.length && lines[index] !== delimiter; index += 1) {
          values.push(lines[index]);
        }

        outputs.set(name, values.join("\n"));
        continue;
      }

      if (!line.includes("=")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      outputs.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
    }
  }

  for (const line of stdout.split(/\r?\n/u)) {
    const match = /^::set-output name=([^:]+)::(.*)$/u.exec(line);
    if (match) {
      outputs.set(match[1], match[2]);
    }
  }

  return outputs;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
