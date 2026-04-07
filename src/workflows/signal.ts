import { existsSync, unlinkSync, readdirSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AW_DIR } from "../types.js";
import type { SkipWhen } from "../types.js";

/**
 * Resolve the full path of an output file.
 * Path: {cwd}/.aw/{progressDir}/{filename}
 */
export function resolveOutputPath(cwd: string, progressDir: string, filename: string): string {
  return join(cwd, AW_DIR, progressDir, filename);
}

/**
 * Check if ALL output files exist for a step.
 * Returns true only if every file in the list exists.
 */
export function allOutputsExist(cwd: string, progressDir: string, outputs: string[]): boolean {
  return outputs.every(f => existsSync(resolveOutputPath(cwd, progressDir, f)));
}

/**
 * Delete output files before a step starts. Prevents stale files from
 * a previous run from triggering premature advancement.
 */
export function cleanupOutputFiles(cwd: string, progressDir: string, outputs: string[]): void {
  for (const f of outputs) {
    try { unlinkSync(resolveOutputPath(cwd, progressDir, f)); } catch {}
  }
}

/**
 * Ensure the progress directory exists under .aw/.
 */
export function ensureProgressDir(cwd: string, progressDir: string): void {
  mkdirSync(join(cwd, AW_DIR, progressDir), { recursive: true });
}

/**
 * Evaluate a skip_when condition by reading a JSON file from the progress
 * directory and checking whether a field matches the expected value.
 * Returns false if the file is missing, unreadable, or the field is absent.
 */
export function shouldSkipStep(cwd: string, progressDir: string, skipWhen: SkipWhen): boolean {
  const filePath = join(cwd, AW_DIR, progressDir, skipWhen.file);
  if (!existsSync(filePath)) return false;
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return data[skipWhen.field] === skipWhen.equals;
  } catch {
    return false;
  }
}

/**
 * Remove all stop-signal files from the .aw directory.
 */
export function cleanupAllSignals(cwd: string): void {
  const awDir = join(cwd, AW_DIR);
  try {
    const files = readdirSync(awDir) as string[];
    for (const file of files) {
      if (file === "stop-signal") {
        try { unlinkSync(join(awDir, file)); } catch {}
      }
    }
  } catch {
    // .aw dir doesn't exist — nothing to clean
  }
}
