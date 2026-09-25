import { execFileSync } from "node:child_process";

export interface GithubPullRequest {
  number: number;
  url: string;
  title: string;
  body: string;
  state: string;
  baseRefName: string;
  headRefName: string;
}

export interface GithubContext {
  cwd?: string;
  repo?: string;
}

export interface RepositoryMergeSettings {
  allow_squash_merge: boolean;
  allow_merge_commit: boolean;
  allow_rebase_merge: boolean;
  squash_merge_commit_title: string;
  squash_merge_commit_message: string;
}

/**
 * Merge settings that make AI attribution unable to reach the default branch:
 * squash is the only merge method, so no individual commit is ever copied onto
 * the target, and the squashed message is the pull request title alone, so
 * commit trailers cannot be folded into it either.
 */
export const PROTECTED_MERGE_SETTINGS: RepositoryMergeSettings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "BLANK",
};

export function readPullRequest(options: GithubContext & { number?: string }): GithubPullRequest {
  const args = [
    "pr",
    "view",
    ...(options.number ? [options.number] : []),
    "--json",
    "number,title,body,url,state,baseRefName,headRefName",
  ];

  if (options.repo) {
    args.push("--repo", options.repo);
  }

  const output = runGh(args, options.cwd);
  const parsed = JSON.parse(output) as Partial<GithubPullRequest>;

  if (typeof parsed.number !== "number") {
    throw new Error("gh pr view did not return a pull request number.");
  }

  return {
    number: parsed.number,
    title: typeof parsed.title === "string" ? parsed.title : "",
    body: typeof parsed.body === "string" ? parsed.body : "",
    url: typeof parsed.url === "string" ? parsed.url : "",
    state: typeof parsed.state === "string" ? parsed.state : "",
    baseRefName: typeof parsed.baseRefName === "string" ? parsed.baseRefName : "",
    headRefName: typeof parsed.headRefName === "string" ? parsed.headRefName : "",
  };
}

export function updatePullRequest(
  options: GithubContext & {
    number: number;
    title?: string;
    body?: string;
  },
): void {
  const args = ["pr", "edit", String(options.number)];

  if (options.repo) {
    args.push("--repo", options.repo);
  }

  if (options.title !== undefined) {
    args.push("--title", options.title);
  }

  if (options.body !== undefined) {
    args.push("--body-file", "-");
  }

  runGh(args, options.cwd, options.body);
}

export function resolveRepository(options: GithubContext): string {
  if (options.repo) {
    return options.repo;
  }

  const output = runGh(["repo", "view", "--json", "nameWithOwner"], options.cwd);
  const parsed = JSON.parse(output) as { nameWithOwner?: string };

  if (!parsed.nameWithOwner) {
    throw new Error("Unable to resolve the repository. Pass --repo owner/name.");
  }

  return parsed.nameWithOwner;
}

export function readMergeSettings(repo: string, cwd?: string): RepositoryMergeSettings {
  const output = runGh(["api", `repos/${repo}`], cwd);
  const parsed = JSON.parse(output) as Partial<RepositoryMergeSettings>;

  return {
    allow_squash_merge: Boolean(parsed.allow_squash_merge),
    allow_merge_commit: Boolean(parsed.allow_merge_commit),
    allow_rebase_merge: Boolean(parsed.allow_rebase_merge),
    squash_merge_commit_title: String(parsed.squash_merge_commit_title ?? ""),
    squash_merge_commit_message: String(parsed.squash_merge_commit_message ?? ""),
  };
}

export function updateMergeSettings(
  repo: string,
  settings: RepositoryMergeSettings,
  cwd?: string,
): void {
  const args = ["api", "-X", "PATCH", `repos/${repo}`];

  for (const [key, value] of Object.entries(settings)) {
    args.push("-f", `${key}=${String(value)}`);
  }

  runGh(args, cwd);
}

function runGh(args: string[], cwd?: string, input?: string): string {
  try {
    return execFileSync("gh", args, {
      cwd,
      encoding: "utf8",
      input,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? "").trim()
        : "";

    throw new Error(
      stderr.length > 0
        ? `gh ${args.slice(0, 2).join(" ")} failed: ${stderr}`
        : `gh ${args.slice(0, 2).join(" ")} failed. Is the GitHub CLI installed and authenticated?`,
    );
  }
}
