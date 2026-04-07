import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AW_DIR } from "../types.js";

export interface Task {
  id: number;
  category: string;
  description: string;
  steps: string[];
  done: boolean;
}

/**
 * Load tasks from {cwd}/.aw/{progressDir}/tasks.json.
 * Assigns sequential IDs if missing (brownfield format omits them).
 */
export function loadTasks(cwd: string, progressDir: string): Task[] | null {
  const path = join(cwd, AW_DIR, progressDir, "tasks.json");
  if (!existsSync(path)) return null;
  try {
    const raw: unknown[] = JSON.parse(readFileSync(path, "utf-8"));
    return raw.map((t: any, i) => ({
      id: t.id ?? i + 1,
      category: t.category ?? "feature",
      description: t.description ?? "",
      steps: t.steps ?? [],
      done: t.done ?? false,
    }));
  } catch {
    return null;
  }
}

export function getNextIncompleteTask(cwd: string, progressDir: string): Task | null {
  const tasks = loadTasks(cwd, progressDir);
  if (!tasks) return null;
  return tasks.find((t) => !t.done) ?? null;
}

export function getTaskSummary(task: Task): string {
  const lines: string[] = [];
  lines.push(`Task ${task.id}: ${task.description}`);
  lines.push("─".repeat(Math.min(40, task.description.length + 10)));
  lines.push(`Category: ${task.category}`);
  lines.push(`Status: ${task.done ? "done" : "pending"}`);

  if (task.steps.length) {
    lines.push("");
    lines.push("Steps:");
    for (const s of task.steps) lines.push(`  - ${s}`);
  }

  return lines.join("\n");
}
