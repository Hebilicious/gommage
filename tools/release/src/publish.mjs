import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "../../..");
const dryRun = process.argv.includes("--dry-run");

const publishTargets = [
  { dir: "packages/core", name: "@gommage/core" },
  { dir: "apps/cli", name: "@gommage/cli" },
];

main();

function main() {
  assertMinimumVersion("node", process.versions.node, "22.14.0");
  assertMinimumVersion("npm", run("npm", ["--version"]).trim(), "11.5.1");

  const packDir = mkdtempSync(join(tmpdir(), "gommage-publish-"));

  try {
    for (const target of publishTargets) {
      publishTarget(target, packDir);
    }

    if (!dryRun) {
      run(join(workspaceRoot, "node_modules/.bin/changeset"), ["tag"], {
        cwd: workspaceRoot,
        stdio: "inherit",
      });
    }
  } finally {
    rmSync(packDir, { recursive: true, force: true });
  }
}

function publishTarget(target, packDir) {
  const packageDir = join(workspaceRoot, target.dir);
  const packageJson = readPackageJson(packageDir);

  if (packageJson.name !== target.name) {
    throw new Error(`Expected ${target.name} at ${target.dir}, found ${packageJson.name}`);
  }

  if (packageJson.private) {
    throw new Error(`${target.name} is private and cannot be published to npm`);
  }

  if (isVersionPublished(target.name, packageJson.version)) {
    console.log(`${target.name}@${packageJson.version} is already published; skipping.`);
    return;
  }

  const tarball = packPackage(packageDir, packDir);
  const publishArgs = ["publish", tarball, "--access", "public"];

  if (dryRun) {
    publishArgs.push("--dry-run");
  }

  run("npm", publishArgs, { cwd: workspaceRoot, stdio: "inherit" });
}

function readPackageJson(packageDir) {
  return JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
}

function packPackage(packageDir, packDir) {
  const output = run("pnpm", ["pack", "--pack-destination", packDir, "--json"], {
    cwd: packageDir,
  });
  const result = JSON.parse(output);
  const packed = Array.isArray(result) ? result[0] : result;

  if (!packed?.filename) {
    throw new Error(`Unable to determine packed tarball from output: ${output}`);
  }

  return packed.filename;
}

function isVersionPublished(name, version) {
  try {
    const publishedVersion = run("npm", ["view", `${name}@${version}`, "version"]).trim();
    return publishedVersion === version;
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;

    if (output.includes("E404") || output.includes("404 Not Found")) {
      return false;
    }

    throw error;
  }
}

function assertMinimumVersion(tool, actual, minimum) {
  if (compareVersions(actual, minimum) < 0) {
    throw new Error(`${tool} ${minimum} or newer is required for npm trusted publishing; found ${actual}`);
  }
}

function compareVersions(actual, minimum) {
  const actualParts = actual.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);

  for (let index = 0; index < minimumParts.length; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;

    if (actualPart > minimumPart) {
      return 1;
    }

    if (actualPart < minimumPart) {
      return -1;
    }
  }

  return 0;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    ...options,
  });
}
