/**
 * Lint Excalidraw UI files for hardcoded color literals.
 *
 * Usage:
 *   node scripts/lint-design-system.js           # changed lines vs merge-base (CI default)
 *   node scripts/lint-design-system.js --changed # same as above
 *   node scripts/lint-design-system.js --all     # scan all target files (audit)
 *
 * Env:
 *   DESIGN_SYSTEM_BASE_REF — override merge base (default: origin/${GITHUB_BASE_REF} in GitHub PRs, else origin/master)
 */

const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");

const TARGET_DIRS = [
  "packages/excalidraw/components",
  "packages/excalidraw/css",
];

const TARGET_EXT = /\.(scss|tsx)$/;

/** Files where defining raw color values is expected. */
const FILE_ALLOWLIST = new Set([
  "packages/excalidraw/css/theme.scss",
  "packages/excalidraw/css/variables.module.scss",
  // SVG icon paths use literal fills/strokes.
  "packages/excalidraw/components/icons.tsx",
  "packages/excalidraw/components/shapes.tsx",
]);

const COLOR_LITERAL =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

const CSS_ID_SELECTOR_FOLLOWER = /^\s*(?:$|[{:.,>[+~)])/;
const CSS_DECLARATION_PREFIX =
  /(?:^|[{;]\s*)(?:\$[-\w]+|[-\w]+)\s*:[^{};]*$/;

const isTargetFile = (filePath) => {
  const normalized = filePath.replace(/\\/g, "/");
  if (!TARGET_EXT.test(normalized)) {
    return false;
  }
  if (FILE_ALLOWLIST.has(normalized)) {
    return false;
  }
  return TARGET_DIRS.some(
    (dir) =>
      normalized.startsWith(`${dir}/`) ||
      normalized === dir,
  );
};

const stripDiffPrefix = (line) => {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return line.slice(1);
  }
  return null;
};

const isCommentLine = (line) => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("{/*") ||
    trimmed.startsWith("/*") ||
    /^\*(?!\s*[{[.:#>+~,*&|])/.test(trimmed)
  );
};

const isCssIdSelectorLiteral = (line, index, literal) => {
  const before = line.slice(0, index);
  const after = line.slice(index + literal.length);

  return (
    literal.startsWith("#") &&
    CSS_ID_SELECTOR_FOLLOWER.test(after) &&
    !CSS_DECLARATION_PREFIX.test(before)
  );
};

const findColorLiteralsOnLine = (line) => {
  if (isCommentLine(line)) {
    return [];
  }

  // Data URIs and other url() values often embed encoded colors.
  const lineWithoutUrls = line.replace(
    /url\s*\((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^)])*\)/gi,
    (match) => " ".repeat(match.length),
  );

  const matches = Array.from(lineWithoutUrls.matchAll(COLOR_LITERAL));
  if (matches.length === 0) {
    return [];
  }

  return matches
    .filter((match) => {
      const index = match.index;
      const before = line.slice(0, index);
      // Ignore literals inside var(--...) references (shouldn't happen, but safe).
      if (/var\s*\(\s*--[^,)]*$/.test(before)) {
        return false;
      }
      if (isCssIdSelectorLiteral(line, index, match[0])) {
        return false;
      }
      return true;
    })
    .map((match) => match[0]);
};

const exitWithGitError = (description, error) => {
  const stderr = error.stderr?.toString().trim();
  const message = stderr || error.message;
  console.error(`design-system: ${description} failed.`);
  console.error(message);
  process.exit(1);
};

const getMergeBase = () => {
  const baseRef =
    process.env.DESIGN_SYSTEM_BASE_REF ||
    (process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : "origin/master");
  try {
    return execSync(`git merge-base HEAD ${baseRef}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    exitWithGitError(`git merge-base HEAD ${baseRef}`, error);
  }
};

const getChangedLineNumbers = (filePath) => {
  const mergeBase = getMergeBase();
  let diff;
  try {
    diff = execSync(`git diff -U0 ${mergeBase} -- ${filePath}`, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    exitWithGitError(`git diff -U0 ${mergeBase} -- ${filePath}`, error);
  }

  const lineNumbers = [];
  let currentLine = 0;

  for (const line of diff.split("\n")) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1]);
      continue;
    }

    const added = stripDiffPrefix(line);
    if (added === null) {
      continue;
    }

    lineNumbers.push({ lineNumber: currentLine, content: added });
    currentLine += 1;
  }

  return lineNumbers;
};

const getAllTargetFiles = () => {
  const files = execSync(
    `git ls-files ${TARGET_DIRS.map((d) => JSON.stringify(d)).join(" ")}`,
    { encoding: "utf8" },
  )
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .filter(isTargetFile);

  return files;
};

const lintFileLines = (filePath, linesToCheck) => {
  const violations = [];

  for (const { lineNumber, content } of linesToCheck) {
    const matches = findColorLiteralsOnLine(content);
    for (const match of matches) {
      violations.push({
        file: filePath,
        line: lineNumber,
        match,
        content: content.trim(),
      });
    }
  }

  return violations;
};

const lintChanged = () => {
  const mergeBase = getMergeBase();
  let changedFiles;
  try {
    changedFiles = execSync(
      `git diff --name-only ${mergeBase} -- ${TARGET_DIRS.map((d) => JSON.stringify(d)).join(" ")}`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .filter(isTargetFile);
  } catch (error) {
    exitWithGitError(
      `git diff --name-only ${mergeBase} -- ${TARGET_DIRS.join(" ")}`,
      error,
    );
  }

  const violations = [];

  for (const file of changedFiles) {
    const changedLines = getChangedLineNumbers(file);
    violations.push(...lintFileLines(file, changedLines));
  }

  return violations;
};

const lintAll = () => {
  const violations = [];

  for (const file of getAllTargetFiles()) {
    if (!existsSync(file)) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").map((content, index) => ({
      lineNumber: index + 1,
      content,
    }));
    violations.push(...lintFileLines(file, lines));
  }

  return violations;
};

const main = () => {
  const mode = process.argv.includes("--all") ? "all" : "changed";

  let violations;
  if (mode === "all") {
    violations = lintAll();
  } else {
    violations = lintChanged();
  }

  if (violations.length === 0) {
    console.log(
      `design-system: no hardcoded color literals found (${mode} mode).`,
    );
    process.exit(0);
  }

  console.error(
    `design-system: found ${violations.length} hardcoded color literal(s) (${mode} mode).\n` +
      "Use CSS variables from packages/excalidraw/css/theme.scss instead.\n",
  );

  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}  ${v.match}  ${v.content.slice(0, 120)}`,
    );
  }

  process.exit(1);
};

main();
