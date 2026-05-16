import { spawnSync } from "node:child_process";

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import type { GommageWorld } from "../../../../packages/bdd-utils/src/world.ts";
import {
  escapeRegExp,
  shellEntrypoint,
  workspaceRoot,
} from "../../../../packages/bdd-utils/src/helpers.ts";

Given("a commit message file with an AI co-author", function (this: GommageWorld) {
  this.createMessageFile(
    ["feat: add policy", "", "Co-authored-by: Claude <noreply@anthropic.com>"].join("\n"),
  );
});

When("I run the shell hook against that message file", function (this: GommageWorld) {
  this.lastCommand = spawnSync("sh", [shellEntrypoint, "hook", this.currentMessageFile ?? ""], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
});

Then("the command exits with code {int}", function (this: GommageWorld, code: number) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.equal(this.lastCommand.status, code);
});

Then("stderr contains {string}", function (this: GommageWorld, expected: string) {
  assert.ok(this.lastCommand, "Expected a command to have been executed.");
  assert.match(this.lastCommand.stderr, new RegExp(escapeRegExp(expected)));
});
