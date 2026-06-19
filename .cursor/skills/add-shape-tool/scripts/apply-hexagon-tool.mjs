#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const scriptDir = dirname(fileURLToPath(import.meta.url));
const patchPath = join(tmpdir(), `excalidraw-hexagon-tool-${process.pid}.patch`);

const readWorkspaceFile = (path) => readFileSync(join(root, path), "utf8");
const run = (args) =>
  spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const alreadyImplemented = () => {
  try {
    return (
      readWorkspaceFile("packages/common/src/constants.ts").includes(
        'hexagon: "hexagon"',
      ) &&
      readWorkspaceFile("packages/excalidraw/components/shapes.tsx").includes(
        'value: "hexagon"',
      ) &&
      readWorkspaceFile("packages/element/src/bounds.ts").includes(
        "getHexagonPoints",
      )
    );
  } catch {
    return false;
  }
};

if (alreadyImplemented()) {
  console.log("Hexagon tool already appears to be implemented. No changes made.");
  process.exit(0);
}

const patchBase64 = readFileSync(
  join(scriptDir, "hexagon-tool.patch.b64"),
  "utf8",
).trim();
writeFileSync(patchPath, Buffer.from(patchBase64, "base64"));

try {
  const check = run(["apply", "--check", "--3way", patchPath]);
  if (check.status !== 0) {
    console.error("Hexagon patch did not apply cleanly.");
    console.error(check.stderr || check.stdout);
    console.error(
      "Inspect only the file named in the git apply error, repair the anchor, and rerun yarn test:typecheck.",
    );
    process.exit(check.status ?? 1);
  }

  const apply = run(["apply", "--3way", patchPath]);
  if (apply.status !== 0) {
    console.error("Hexagon patch failed while applying.");
    console.error(apply.stderr || apply.stdout);
    process.exit(apply.status ?? 1);
  }

  console.log("Applied the hexagon shape tool patch.");
  console.log("Next: yarn test:typecheck");
} finally {
  try {
    unlinkSync(patchPath);
  } catch {
    // temp cleanup best effort
  }
}
