import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { GommageWorld } from "./world.ts";

export const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const cliEntrypoint = resolve(workspaceRoot, "apps/cli/dist/index.mjs");
export const actionEntrypoint = resolve(workspaceRoot, "apps/github-action/dist/index.mjs");
export const githubAppEntrypoint = resolve(workspaceRoot, "apps/github-app/dist/index.mjs");
export const shellEntrypoint = resolve(workspaceRoot, "apps/shell/gommage.sh");
export const preCommitHookEntrypoint = resolve(workspaceRoot, "apps/pre-commit/hook.sh");

export function createGitRepo(world: GommageWorld): string {
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
  execFileSync("git", ["config", "commit.gpgsign", "false"], {
    cwd: repoDir,
    stdio: "ignore",
  });

  return repoDir;
}

export function readLatestCommitMessage(repoDir: string): string {
  return execFileSync("git", ["log", "-1", "--format=%B"], {
    cwd: repoDir,
    encoding: "utf8",
  });
}

export function parseGithubOutputs(file: string, stdout: string): Map<string, string> {
  const outputs = new Map<string, string>();

  if (existsSync(file)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (line.includes("<<")) {
        const [name, delimiter] = line.split("<<", 2);
        const values: string[] = [];

        for (index += 1; index < lines.length && lines[index] !== delimiter; index += 1) {
          values.push(lines[index] ?? "");
        }

        outputs.set(name ?? "", values.join("\n"));
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
      outputs.set(match[1] ?? "", match[2] ?? "");
    }
  }

  return outputs;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
