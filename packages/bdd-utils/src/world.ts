import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SpawnSyncReturns } from "node:child_process";

import { After, setWorldConstructor } from "@cucumber/cucumber";

export class GommageWorld {
  tempDirs: string[] = [];
  lastCommand: SpawnSyncReturns<string> | null = null;
  lastActionOutputs = new Map<string, string>();
  lastEvaluation: { conclusion: string; summary: string } | null = null;
  currentRepoDir: string | null = null;
  currentMessageFile: string | null = null;
  pullRequestPayload: Array<{
    sha: string;
    message: string;
    authorName: string;
    authorEmail: string;
  }> | null = null;

  createTempDir(prefix = "gommage-bdd-"): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    this.tempDirs.push(dir);
    return dir;
  }

  createMessageFile(contents: string): string {
    const dir = this.createTempDir("gommage-msg-");
    const file = join(dir, "COMMIT_EDITMSG");
    writeFileSync(file, contents);
    this.currentMessageFile = file;
    return file;
  }

  getRepoPath(...segments: string[]): string {
    if (!this.currentRepoDir) {
      throw new Error("No repository has been created for this scenario.");
    }

    return resolve(this.currentRepoDir, ...segments);
  }
}

setWorldConstructor(GommageWorld);

After(function cleanup(this: GommageWorld) {
  for (const dir of this.tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});
