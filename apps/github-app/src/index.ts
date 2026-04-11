import {
  checkCommits,
  formatCheckResult,
  getDefaultConfig,
  type CheckResult,
  type CommitInput,
  type GommageConfig,
} from "@gommage/core";

export interface PullRequestCommitPayload {
  sha: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
}

export interface PullRequestEvaluation {
  conclusion: "success" | "failure";
  summary: string;
  text: string;
  result: CheckResult;
}

export function evaluatePullRequestCommits(
  commits: PullRequestCommitPayload[],
  config: GommageConfig = getDefaultConfig(),
): PullRequestEvaluation {
  const normalizedCommits: CommitInput[] = commits.map((commit) => ({
    sha: commit.sha,
    message: commit.message,
    authorName: commit.authorName ?? "",
    authorEmail: commit.authorEmail ?? "",
  }));

  const result = checkCommits(normalizedCommits, config);
  const conclusion = result.violationCount > 0 ? "failure" : "success";

  return {
    conclusion,
    summary:
      conclusion === "failure"
        ? `Gommage found ${result.violationCount} violation(s).`
        : `Gommage checked ${result.commits.length} commit(s) with no violations.`,
    text: formatCheckResult(result),
    result,
  };
}

export function buildCheckRunOutput(evaluation: PullRequestEvaluation): {
  title: string;
  summary: string;
  text: string;
} {
  return {
    title: "Gommage authorship policy",
    summary: evaluation.summary,
    text: evaluation.text,
  };
}

export async function bootstrapGithubApp(): Promise<{
  evaluatePullRequestCommits: typeof evaluatePullRequestCommits;
  buildCheckRunOutput: typeof buildCheckRunOutput;
}> {
  return {
    evaluatePullRequestCommits,
    buildCheckRunOutput,
  };
}
