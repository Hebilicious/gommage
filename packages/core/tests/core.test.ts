import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkCommitMessage,
  checkGitRange,
  checkMessageFile,
  formatCheckResult,
  getDefaultConfig,
  loadConfig,
} from "../src/index.js";

const tempDirs: string[] = [];

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

  it("reads git ranges and formats a report", () => {
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

  return dir;
}

function commitInRepo(
  repoDir: string,
  message: string,
  authorName: string,
  authorEmail: string,
): void {
  writeFileSync(join(repoDir, "file.txt"), `${message}\n`, { flag: "a" });
  execFileSync("git", ["add", "file.txt"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["commit", "--author", `${authorName} <${authorEmail}>`, "-m", message], {
    cwd: repoDir,
    stdio: "ignore",
  });
}
