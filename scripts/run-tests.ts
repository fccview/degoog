import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function collectTests(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    const relPath = relative(process.cwd(), fullPath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (relPath === "tests/stress" || relPath.startsWith("tests/stress/")) {
        continue;
      }

      files.push(...collectTests(fullPath));
      continue;
    }

    if (entry.isFile() && relPath.endsWith(".test.ts")) {
      files.push(relPath);
    }
  }

  return files;
}

const testsRoot = join(process.cwd(), "tests");

if (!statSync(testsRoot).isDirectory()) {
  throw new Error(`Tests directory not found: ${testsRoot}`);
}

const testFiles = collectTests(testsRoot).sort();

if (testFiles.length === 0) {
  throw new Error("No test files found outside tests/stress.");
}

const proc = Bun.spawn({
  cmd: ["bun", "test", ...testFiles],
  cwd: process.cwd(),
  env: {
    ...process.env,
    LOGGER: process.env.LOGGER ?? "",
  },
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await proc.exited;

if (exitCode !== 0) {
  process.exit(exitCode);
}
