import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  resolveOutputPath,
  allOutputsExist,
  cleanupOutputFiles,
  ensureProgressDir,
  shouldSkipStep,
} from "../signal.js";

const TEST_DIR = join(tmpdir(), `signal-test-${process.pid}`);
const PROGRESS_DIR = "lf-progress";

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".aw", PROGRESS_DIR), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("resolveOutputPath", () => {
  it("builds the correct path", () => {
    const result = resolveOutputPath(TEST_DIR, PROGRESS_DIR, "spec.xml");
    expect(result).toBe(join(TEST_DIR, ".aw", PROGRESS_DIR, "spec.xml"));
  });
});

describe("allOutputsExist", () => {
  it("returns true when all output files exist", () => {
    writeFileSync(join(TEST_DIR, ".aw", PROGRESS_DIR, "spec.xml"), "<spec/>");
    writeFileSync(join(TEST_DIR, ".aw", PROGRESS_DIR, "tasks.json"), "[]");
    expect(allOutputsExist(TEST_DIR, PROGRESS_DIR, ["spec.xml", "tasks.json"])).toBe(true);
  });

  it("returns false when some files are missing", () => {
    writeFileSync(join(TEST_DIR, ".aw", PROGRESS_DIR, "spec.xml"), "<spec/>");
    expect(allOutputsExist(TEST_DIR, PROGRESS_DIR, ["spec.xml", "tasks.json"])).toBe(false);
  });

  it("returns false when no files exist", () => {
    expect(allOutputsExist(TEST_DIR, PROGRESS_DIR, ["spec.xml"])).toBe(false);
  });

  it("returns true for an empty outputs list", () => {
    expect(allOutputsExist(TEST_DIR, PROGRESS_DIR, [])).toBe(true);
  });
});

describe("cleanupOutputFiles", () => {
  it("deletes existing output files", () => {
    const specPath = join(TEST_DIR, ".aw", PROGRESS_DIR, "spec.xml");
    writeFileSync(specPath, "<spec/>");
    expect(existsSync(specPath)).toBe(true);

    cleanupOutputFiles(TEST_DIR, PROGRESS_DIR, ["spec.xml"]);
    expect(existsSync(specPath)).toBe(false);
  });

  it("does not throw if files do not exist", () => {
    expect(() => cleanupOutputFiles(TEST_DIR, PROGRESS_DIR, ["nonexistent.xml"])).not.toThrow();
  });

  it("deletes multiple files", () => {
    const specPath = join(TEST_DIR, ".aw", PROGRESS_DIR, "spec.xml");
    const tasksPath = join(TEST_DIR, ".aw", PROGRESS_DIR, "tasks.json");
    writeFileSync(specPath, "<spec/>");
    writeFileSync(tasksPath, "[]");

    cleanupOutputFiles(TEST_DIR, PROGRESS_DIR, ["spec.xml", "tasks.json"]);
    expect(existsSync(specPath)).toBe(false);
    expect(existsSync(tasksPath)).toBe(false);
  });
});

describe("ensureProgressDir", () => {
  it("creates the progress directory if missing", () => {
    const newDir = "new-progress";
    const fullPath = join(TEST_DIR, ".aw", newDir);
    expect(existsSync(fullPath)).toBe(false);

    ensureProgressDir(TEST_DIR, newDir);
    expect(existsSync(fullPath)).toBe(true);
  });

  it("does not throw if directory already exists", () => {
    expect(() => ensureProgressDir(TEST_DIR, PROGRESS_DIR)).not.toThrow();
  });
});

describe("shouldSkipStep", () => {
  it("returns true when field matches the expected value", () => {
    writeFileSync(
      join(TEST_DIR, ".aw", PROGRESS_DIR, "next-task.json"),
      JSON.stringify({ needs_tests: false, approach: "direct" })
    );
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "next-task.json", field: "needs_tests", equals: false })).toBe(true);
  });

  it("returns false when field does not match", () => {
    writeFileSync(
      join(TEST_DIR, ".aw", PROGRESS_DIR, "next-task.json"),
      JSON.stringify({ needs_tests: true, approach: "plan" })
    );
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "next-task.json", field: "needs_tests", equals: false })).toBe(false);
  });

  it("returns false when the file does not exist", () => {
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "missing.json", field: "x", equals: true })).toBe(false);
  });

  it("returns false when the field is absent from the JSON", () => {
    writeFileSync(
      join(TEST_DIR, ".aw", PROGRESS_DIR, "next-task.json"),
      JSON.stringify({ approach: "direct" })
    );
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "next-task.json", field: "needs_tests", equals: false })).toBe(false);
  });

  it("returns false when the file contains malformed JSON", () => {
    writeFileSync(join(TEST_DIR, ".aw", PROGRESS_DIR, "bad.json"), "not json{{{");
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "bad.json", field: "x", equals: true })).toBe(false);
  });

  it("matches string values", () => {
    writeFileSync(
      join(TEST_DIR, ".aw", PROGRESS_DIR, "next-task.json"),
      JSON.stringify({ approach: "direct" })
    );
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "next-task.json", field: "approach", equals: "direct" })).toBe(true);
    expect(shouldSkipStep(TEST_DIR, PROGRESS_DIR, { file: "next-task.json", field: "approach", equals: "plan" })).toBe(false);
  });
});
