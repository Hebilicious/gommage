import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { After, setWorldConstructor } from "@cucumber/cucumber";

class GommageWorld {
  constructor() {
    this.tempDirs = [];
    this.lastCommand = null;
    this.lastActionOutputs = new Map();
    this.lastEvaluation = null;
    this.currentRepoDir = null;
    this.currentMessageFile = null;
    this.pullRequestPayload = null;
  }

  createTempDir(prefix = "gommage-bdd-") {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    this.tempDirs.push(dir);
    return dir;
  }

  createMessageFile(contents) {
    const dir = this.createTempDir("gommage-msg-");
    const file = join(dir, "COMMIT_EDITMSG");
    writeFileSync(file, contents);
    this.currentMessageFile = file;
    return file;
  }

  getRepoPath(...segments) {
    if (!this.currentRepoDir) {
      throw new Error("No repository has been created for this scenario.");
    }

    return resolve(this.currentRepoDir, ...segments);
  }
}

setWorldConstructor(GommageWorld);

After(function cleanup() {
  for (const dir of this.tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});
