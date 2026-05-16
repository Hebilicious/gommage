import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import type { GommageWorld } from "../../../../packages/bdd-utils/src/world.ts";
import { githubAppEntrypoint } from "../../../../packages/bdd-utils/src/helpers.ts";

Given("a pull request payload with an AI co-author commit", function (this: GommageWorld) {
  this.pullRequestPayload = [
    {
      sha: "abc1234",
      message: ["feat: violating commit", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
      authorName: "BDD Runner",
      authorEmail: "bdd@example.com",
    },
  ];
});

When("I evaluate the payload with the GitHub App helper", async function (this: GommageWorld) {
  const module = await import(pathToFileURL(githubAppEntrypoint).href);
  this.lastEvaluation = module.evaluatePullRequestCommits(this.pullRequestPayload);
});

Then("the GitHub App conclusion is {string}", function (this: GommageWorld, value: string) {
  assert.ok(this.lastEvaluation, "Expected a GitHub App evaluation result.");
  assert.equal(this.lastEvaluation.conclusion, value);
});

Then("the GitHub App summary contains {string}", function (this: GommageWorld, value: string) {
  assert.ok(this.lastEvaluation, "Expected a GitHub App evaluation result.");
  assert.match(
    this.lastEvaluation.summary,
    new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});
