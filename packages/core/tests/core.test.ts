import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkCommitMessage,
  checkGitRange,
  checkMessageFile,
  checkPullRequest,
  formatCheckResult,
  formatPullRequestCheck,
  formatPullRequestPlan,
  formatRewritePlan,
  getDefaultConfig,
  loadConfig,
  planHistoryRewrite,
  planPullRequestRewrite,
  pullRequestRevisionRange,
  rewriteGitHistory,
  scanSurface,
} from "../src/index.js";

const tempDirs: string[] = [];
const GIT_INTEGRATION_TIMEOUT_MS = 30_000;

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("@gommage/core", () => {
  it("flags AI co-authors and badges", () => {
    const result = checkCommitMessage({
      sha: "abc1234",
      authorName: "Jane Human",
      authorEmail: "jane@example.com",
      message: [
        "feat: add detector",
        "",
        "🤖 Generated with [Claude Code]",
        "",
        "Co-authored-by: Claude <noreply@anthropic.com>",
      ].join("\n"),
    });

    expect(result.violations.map((violation) => violation.code)).toEqual([
      "ai-coauthor",
      "ai-badge",
    ]);
  });

  it("does not block human co-authors by default", () => {
    const result = checkCommitMessage({
      sha: "abc1234",
      authorName: "Jane Human",
      authorEmail: "jane@example.com",
      message: ["feat: pairing commit", "", "Co-authored-by: John Pair <john@example.com>"].join(
        "\n",
      ),
    });

    expect(result.violations).toHaveLength(0);
  });

  it("enforces stricter human co-author policy when configured", () => {
    const config = getDefaultConfig();
    config.rules.allowHumanCoauthors = false;
    config.rules.maxAuthors = 1;

    const result = checkCommitMessage(
      {
        sha: "abc1234",
        authorName: "Jane Human",
        authorEmail: "jane@example.com",
        message: ["feat: pairing commit", "", "Co-authored-by: John Pair <john@example.com>"].join(
          "\n",
        ),
      },
      config,
    );

    expect(result.violations.map((violation) => violation.code)).toEqual([
      "human-coauthor",
      "max-authors",
    ]);
  });

  it("supports custom blocked and allowed patterns", () => {
    const config = getDefaultConfig();
    config.rules.blockedPatterns = ["Generated with", "/Cursor/i"];
    config.rules.allowedPatterns = ["Allowed Bot"];

    const result = checkCommitMessage(
      {
        sha: "abc1234",
        authorName: "Jane Human",
        authorEmail: "jane@example.com",
        message: [
          "docs: update notes",
          "",
          "Generated with Allowed Bot",
          "Internal marker: Cursor",
        ].join("\n"),
      },
      config,
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.code).toBe("blocked-pattern");
  });

  it("loads repo config from yaml", () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, ".gommage.yml"),
      [
        "version: 1",
        "",
        "rules:",
        "  no-ai-coauthor: true",
        "  max-authors: 1",
        "  allow-human-coauthors: false",
        "  blocked-patterns:",
        '    - "Generated with"',
        "scope:",
        '  range: "HEAD~1..HEAD"',
      ].join("\n"),
    );

    const loaded = loadConfig({ cwd: dir });

    expect(loaded.path).toBe(join(dir, ".gommage.yml"));
    expect(loaded.config.rules.maxAuthors).toBe(1);
    expect(loaded.config.rules.allowHumanCoauthors).toBe(false);
    expect(loaded.config.scope.range).toBe("HEAD~1..HEAD");
  });

  it("checks a commit message file", () => {
    const dir = createTempDir();
    const messageFile = join(dir, "COMMIT_EDITMSG");
    writeFileSync(
      messageFile,
      ["feat: commit", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
    );

    const result = checkMessageFile({ cwd: dir, messageFile });

    expect(result.violationCount).toBe(1);
    expect(result.commits[0]?.violations[0]?.code).toBe("ai-coauthor");
  });

  it(
    "reads git ranges and formats a report",
    () => {
      const dir = createGitRepo();

      commitInRepo(dir, "feat: safe commit", "Alice Example", "alice@example.com");

      commitInRepo(
        dir,
        ["feat: ai commit", "", "Co-authored-by: GitHub Copilot <copilot@github.com>"].join("\n"),
        "Alice Example",
        "alice@example.com",
      );

      const result = checkGitRange({ cwd: dir, range: "HEAD~1..HEAD" });
      const report = formatCheckResult(result);

      expect(result.violationCount).toBe(1);
      expect(report).toContain("[ai-coauthor]");
      expect(report).toContain("Gommage found 1 violation(s)");
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "plans commit-message rewrites for violating history",
    () => {
      const dir = createGitRepo();

      commitInRepo(
        dir,
        [
          "feat: ai commit",
          "",
          "🤖 Generated with [Claude Code]",
          "",
          "Co-authored-by: GitHub Copilot <copilot@github.com>",
        ].join("\n"),
        "Alice Example",
        "alice@example.com",
      );

      const plan = planHistoryRewrite({ cwd: dir, range: "HEAD" });

      expect(plan.commits).toHaveLength(1);
      expect(plan.commits[0]?.sanitizedMessage).toBe("feat: ai commit");
      expect(plan.commits[0]?.changes).toContain(
        'remove AI co-author trailer: "Co-authored-by: GitHub Copilot <copilot@github.com>"',
      );
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "plans author replacement for AI-authored commits",
    () => {
      const dir = createGitRepo();

      commitInRepo(dir, "feat: ai authored", "Codex", "bot@openai.com");

      const plan = planHistoryRewrite({
        cwd: dir,
        range: "HEAD",
        replacementAuthorName: "Test Runner",
        replacementAuthorEmail: "test@example.com",
      });

      expect(plan.commits).toHaveLength(1);
      expect(plan.commits[0]?.sanitizedAuthorName).toBe("Test Runner");
      expect(plan.commits[0]?.sanitizedAuthorEmail).toBe("test@example.com");
      expect(plan.commits[0]?.changes).toContain("replace author identity");
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "formats dry-run rewrite output as a concrete preview",
    () => {
      const dir = createGitRepo();

      commitInRepo(
        dir,
        ["feat: ai authored", "", "Co-authored-by: Test Runner <noreply@example.com>"].join("\n"),
        "Codex",
        "bot@openai.com",
      );

      const plan = planHistoryRewrite({
        cwd: dir,
        range: "HEAD",
        replacementAuthorName: "Test Runner",
        replacementAuthorEmail: "test@example.com",
      });
      const output = formatRewritePlan(plan, { dryRun: true });

      expect(output).toContain("Commit ");
      expect(output).toContain("Old author:");
      expect(output).toContain("  Codex <bot@openai.com>");
      expect(output).toContain("New author:");
      expect(output).toContain("  Test Runner <test@example.com>");
      expect(output).toContain("Old message:");
      expect(output).toContain("  Co-authored-by: Test Runner <noreply@example.com>");
      expect(output).toContain("New message:");
      expect(output).toContain("  feat: ai authored");
      expect(plan.commits[0]?.sanitizedMessage).not.toContain(
        "Co-authored-by: Test Runner <noreply@example.com>",
      );
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "removes co-author trailers when the rewritten commit still has one author",
    () => {
      const dir = createGitRepo();

      commitInRepo(
        dir,
        ["feat: ai authored", "", "Co-authored-by: Test Runner <noreply@example.com>"].join("\n"),
        "Codex",
        "bot@openai.com",
      );

      const plan = planHistoryRewrite({
        cwd: dir,
        range: "HEAD",
        replacementAuthorName: "Test Runner",
        replacementAuthorEmail: "test@example.com",
      });

      expect(plan.commits[0]?.sanitizedMessage).toBe("feat: ai authored");
      expect(plan.commits[0]?.changes).toContain(
        'remove redundant co-author trailer: "Co-authored-by: Test Runner <noreply@example.com>"',
      );
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "rewrites git history to remove AI co-author trailers",
    () => {
      const dir = createGitRepo();

      commitInRepo(dir, "feat: safe commit", "Alice Example", "alice@example.com");
      commitInRepo(
        dir,
        ["feat: ai commit", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
        "Alice Example",
        "alice@example.com",
      );

      const before = checkGitRange({ cwd: dir, range: "HEAD" });
      expect(before.violationCount).toBe(1);

      rewriteGitHistory({ cwd: dir, range: "--all" });

      const message = execFileSync("git", ["log", "-1", "--format=%B"], {
        cwd: dir,
        encoding: "utf8",
      });
      const after = checkGitRange({ cwd: dir, range: "HEAD" });

      expect(message).not.toContain("Co-authored-by: Codex <bot@openai.com>");
      expect(after.violationCount).toBe(0);
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "checks several ranges in one run",
    () => {
      const dir = createGitRepo();

      commitInRepo(dir, "feat: base", "Alice Example", "alice@example.com");
      commitOnBranch(
        dir,
        "feature-a",
        ["feat: a", "", "Co-authored-by: Claude <noreply@anthropic.com>"].join("\n"),
      );
      commitOnBranch(
        dir,
        "feature-b",
        ["feat: b", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
      );

      const single = checkGitRange({ cwd: dir, range: "main..feature-a" });
      const multiple = checkGitRange({
        cwd: dir,
        range: ["main..feature-a", "main..feature-b"],
      });

      expect(single.commits).toHaveLength(1);
      expect(multiple.commits).toHaveLength(2);
      expect(multiple.violationCount).toBe(2);
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it("reads a list of ranges from yaml", () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, ".gommage.yml"),
      [
        "version: 1",
        "",
        "scope:",
        "  range:",
        '    - "origin/main..HEAD"',
        '    - "origin/bartering..HEAD"',
      ].join("\n"),
    );

    const loaded = loadConfig({ cwd: dir });

    expect(loaded.config.scope.range).toEqual(["origin/main..HEAD", "origin/bartering..HEAD"]);
  });

  it(
    "commits a rewritten history as the replacement identity rather than the previous author",
    () => {
      const dir = createGitRepo();

      commitInRepo(
        dir,
        ["feat: ai trailer", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
        "Alice Example",
        "alice@example.com",
        { name: "Release Bot", email: "bot@ci.example.com" },
      );

      const plan = planHistoryRewrite({ cwd: dir, range: "HEAD" });

      expect(plan.commits[0]?.originalCommitterName).toBe("Release Bot");
      expect(plan.commits[0]?.sanitizedCommitterName).toBe("Test Runner");
      expect(plan.commits[0]?.sanitizedCommitterEmail).toBe("test@example.com");
      expect(plan.commits[0]?.sanitizedAuthorName).toBe("Alice Example");

      rewriteGitHistory({ cwd: dir, range: "HEAD" });

      expect(readIdentity(dir, "HEAD", "%an")).toBe("Alice Example");
      expect(readIdentity(dir, "HEAD", "%cn")).toBe("Test Runner");
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "keeps the original committer when no replacement identity is configured",
    () => {
      const dir = createGitRepo();
      execFileSync("git", ["config", "user.name", ""], { cwd: dir, stdio: "ignore" });
      execFileSync("git", ["config", "user.email", ""], { cwd: dir, stdio: "ignore" });

      commitInRepo(
        dir,
        ["feat: ai trailer", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
        "Alice Example",
        "alice@example.com",
        { name: "Release Bot", email: "bot@ci.example.com" },
      );

      const plan = planHistoryRewrite({ cwd: dir, range: "HEAD" });

      expect(plan.commits[0]?.sanitizedCommitterName).toBe("Release Bot");
      expect(plan.commits[0]?.sanitizedCommitterEmail).toBe("bot@ci.example.com");
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "refuses a replacement identity that is itself an AI identity",
    () => {
      const dir = createGitRepo();

      commitInRepo(dir, "feat: ai authored", "Claude", "noreply@anthropic.com");

      expect(() =>
        planHistoryRewrite({
          cwd: dir,
          range: "HEAD",
          replacementAuthorName: "Claude",
          replacementAuthorEmail: "noreply@anthropic.com",
        }),
      ).toThrow(/replacement identity/i);
    },
    GIT_INTEGRATION_TIMEOUT_MS,
  );

  it(
    "signs rewritten commits when gpgSign is enabled",
    () => {
      const gpgHome = createTempDir();
      const keyId = createGpgKey(gpgHome);
      const dir = createGitRepo();

      commitInRepo(
        dir,
        ["feat: ai commit", "", "Co-authored-by: Codex <bot@openai.com>"].join("\n"),
        "Alice Example",
        "alice@example.com",
      );

      withEnv({ GNUPGHOME: gpgHome }, () => {
        rewriteGitHistory({ cwd: dir, range: "HEAD", gpgSign: keyId });
      });

      const rawCommit = execFileSync("git", ["cat-file", "commit", "HEAD"], {
        cwd: dir,
        encoding: "utf8",
      });

      expect(rawCommit).toContain("gpgsig");
      expect(() =>
        withEnv({ GNUPGHOME: gpgHome }, () => {
          execFileSync("git", ["verify-commit", "HEAD"], { cwd: dir, stdio: "ignore" });
        }),
      ).not.toThrow();
      expect(readIdentity(dir, "HEAD", "%cn")).toBe("Test Runner");
    },
    GIT_INTEGRATION_TIMEOUT_MS * 2,
  );

  it("flags the Claude Code footer and session links in a pull request body", () => {
    const result = scanSurface(
      "body",
      [
        "## Summary",
        "",
        "- ship the solver",
        "",
        "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
        "",
        "https://claude.ai/code/session_01RP3WXuPxXyMpKVySfnFAF7",
      ].join("\n"),
    );

    expect(result.violations).toHaveLength(2);
    expect(result.violations.every((violation) => violation.code === "ai-badge")).toBe(true);
    expect(result.sanitized).toBe(["## Summary", "", "- ship the solver"].join("\n"));
  });

  it("preserves markdown indentation and untouched lines", () => {
    const result = scanSurface(
      "body",
      [
        "## Summary",
        "",
        "  - indented item",
        "",
        "    const x = 1;",
        "",
        "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
      ].join("\n"),
    );

    expect(result.sanitized).toContain("  - indented item");
    expect(result.sanitized).toContain("    const x = 1;");
    expect(result.sanitized).not.toContain("Claude Code");
  });

  it("flags AI co-author trailers that appear in pull request text", () => {
    const result = scanSurface(
      "body",
      ["Notes", "", "Co-authored-by: Claude <noreply@anthropic.com>"].join("\n"),
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.code).toBe("ai-coauthor");
    expect(result.sanitized).toBe("Notes");
  });

  it("honours allowed patterns in pull request text", () => {
    const config = getDefaultConfig();
    config.rules.blockedPatterns = ["internal-marker"];
    config.rules.allowedPatterns = ["internal-marker"];

    const result = scanSurface("body", "internal-marker: keep me", config);

    expect(result.violations).toHaveLength(0);
    expect(result.sanitized).toBe("internal-marker: keep me");
  });

  it("checks a pull request title and body together", () => {
    const pullRequest = {
      number: 7,
      url: "https://github.com/example/repo/pull/7",
      title: "Ship the solver",
      body: ["Body", "", "🤖 Generated with [Claude Code](https://claude.com/claude-code)"].join(
        "\n",
      ),
    };

    const result = checkPullRequest(pullRequest);
    const report = formatPullRequestCheck(result);

    expect(result.violationCount).toBe(1);
    expect(report).toContain("pull request #7 body");
    expect(report).toContain('run "gommage pr fix"');
  });

  it("plans a pull request rewrite that shows the old and new text", () => {
    const plan = planPullRequestRewrite({
      number: 7,
      url: "https://github.com/example/repo/pull/7",
      title: "Ship the solver",
      body: ["Body", "", "🤖 Generated with [Claude Code](https://claude.com/claude-code)"].join(
        "\n",
      ),
    });
    const output = formatPullRequestPlan(plan, { dryRun: true });

    expect(plan.surfaces).toHaveLength(1);
    expect(plan.surfaces[0]?.surface).toBe("body");
    expect(output).toContain("would rewrite the pull request #7 body");
    expect(output).toContain("Old:");
    expect(output).toContain("New:");
    expect(output).toContain("No pull request was changed");
  });

  it("derives the revision range a pull request contributes", () => {
    expect(
      pullRequestRevisionRange({ baseRefName: "bartering", headRefName: "branch/route-solver-v3" }),
    ).toBe("origin/bartering..branch/route-solver-v3");
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gommage-"));
  tempDirs.push(dir);
  return dir;
}

function createGitRepo(): string {
  const dir = createTempDir();
  execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test Runner"], {
    cwd: dir,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
    stdio: "ignore",
  });
  // The developer's global config must not force signing onto test commits.
  execFileSync("git", ["config", "commit.gpgsign", "false"], {
    cwd: dir,
    stdio: "ignore",
  });

  return dir;
}

function commitOnBranch(repoDir: string, branch: string, message: string): void {
  execFileSync("git", ["checkout", "-q", "-b", branch, "main"], { cwd: repoDir, stdio: "ignore" });
  commitInRepo(repoDir, message, "Alice Example", "alice@example.com");
  execFileSync("git", ["checkout", "-q", "main"], { cwd: repoDir, stdio: "ignore" });
}

interface Committer {
  name: string;
  email: string;
}

function commitInRepo(
  repoDir: string,
  message: string,
  authorName: string,
  authorEmail: string,
  committer?: Committer,
): void {
  writeFileSync(join(repoDir, "file.txt"), `${message}\n`, { flag: "a" });
  execFileSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["commit", "--author", `${authorName} <${authorEmail}>`, "-m", message], {
    cwd: repoDir,
    stdio: "ignore",
    env: committer
      ? {
          ...process.env,
          GIT_COMMITTER_NAME: committer.name,
          GIT_COMMITTER_EMAIL: committer.email,
        }
      : process.env,
  });
}

function readIdentity(repoDir: string, revision: string, format: string): string {
  return execFileSync("git", ["log", "-1", `--format=${format}`, revision], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
}

function createGpgKey(gpgHome: string): string {
  const parameters = [
    "%no-protection",
    "Key-Type: eddsa",
    "Key-Curve: ed25519",
    "Name-Real: Gommage Test",
    "Name-Email: gommage-test@example.com",
    "Expire-Date: 0",
    "%commit",
  ].join("\n");

  execFileSync("gpg", ["--homedir", gpgHome, "--batch", "--gen-key"], {
    input: parameters,
    stdio: ["pipe", "ignore", "ignore"],
  });

  const listing = execFileSync(
    "gpg",
    ["--homedir", gpgHome, "--list-secret-keys", "--with-colons"],
    { encoding: "utf8" },
  );
  const secretLine = listing.split("\n").find((line) => line.startsWith("sec:"));
  const keyId = secretLine?.split(":")[4];

  if (!keyId) {
    throw new Error("Failed to create a test GPG key.");
  }

  return keyId;
}

function withEnv<T>(values: Record<string, string>, run: () => T): T {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }

  try {
    return run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
