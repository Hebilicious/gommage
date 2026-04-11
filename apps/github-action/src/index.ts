import * as core from "@actions/core";

import {
  checkGitRange,
  checkMessageFile,
  formatCheckResult,
  hasViolations,
  loadConfig,
} from "@gommage/core";

async function run(): Promise<void> {
  try {
    const cwd = getOptionalInput("cwd");
    const configPath = getOptionalInput("config-path");
    const range = getOptionalInput("range");
    const messageFile = getOptionalInput("message-file");

    const loaded = loadConfig({ cwd, configPath });
    const result = messageFile
      ? checkMessageFile({ cwd, configPath, messageFile })
      : checkGitRange({
          cwd,
          configPath,
          range: range ?? loaded.config.scope.range,
        });

    core.setOutput("violations", String(result.violationCount));
    core.setOutput("commits-checked", String(result.commits.length));
    core.setOutput("config-path", loaded.path ?? "");

    const report = formatCheckResult(result);
    if (hasViolations(result)) {
      core.error(report);
      core.setFailed(report);
      return;
    }

    core.info(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

function getOptionalInput(name: string): string | undefined {
  const value = core.getInput(name);
  return value.length > 0 ? value : undefined;
}

void run();
