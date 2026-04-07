import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { loadTasks, getTaskSummary, getNextIncompleteTask } from "../tasks.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("tasks", () => {
  const tmp = join(tmpdir(), "aw-tasks-test-" + Date.now());
  const progressDir = "lf-progress";

  beforeAll(() => {
    mkdirSync(join(tmp, ".aw", progressDir), { recursive: true });
    writeFileSync(
      join(tmp, ".aw", progressDir, "tasks.json"),
      JSON.stringify([
        { id: 1, category: "infrastructure", description: "Set up project skeleton", steps: ["Create dirs", "Init package"], done: true },
        { id: 2, category: "feature", description: "Add API routes", steps: ["Create router", "Add endpoints"], done: false },
        { id: 3, category: "feature", description: "Add input validation", steps: ["Install zod", "Create schemas"], done: false },
      ])
    );
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("loads tasks from .aw/{progressDir}/tasks.json", () => {
    const tasks = loadTasks(tmp, progressDir);
    expect(tasks).toHaveLength(3);
    expect(tasks![0].description).toBe("Set up project skeleton");
    expect(tasks![1].done).toBe(false);
  });

  it("assigns sequential IDs when missing", () => {
    const tmp2 = join(tmpdir(), "aw-tasks-noid-" + Date.now());
    mkdirSync(join(tmp2, ".aw", progressDir), { recursive: true });
    writeFileSync(
      join(tmp2, ".aw", progressDir, "tasks.json"),
      JSON.stringify([
        { category: "feature", description: "Task A", steps: [], done: false },
        { category: "feature", description: "Task B", steps: [], done: false },
      ])
    );
    const tasks = loadTasks(tmp2, progressDir);
    expect(tasks![0].id).toBe(1);
    expect(tasks![1].id).toBe(2);
    rmSync(tmp2, { recursive: true, force: true });
  });

  it("returns null when no tasks.json exists", () => {
    const tasks = loadTasks(join(tmp, "nonexistent"), progressDir);
    expect(tasks).toBeNull();
  });

  it("generates a task summary", () => {
    const tasks = loadTasks(tmp, progressDir)!;
    const summary = getTaskSummary(tasks[1]);
    expect(summary).toContain("Add API routes");
    expect(summary).toContain("pending");
    expect(summary).toContain("Create router");
  });
});

describe("getNextIncompleteTask", () => {
  const tmp = join(tmpdir(), "aw-next-task-test-" + Date.now());
  const progressDir = "lf-progress";

  beforeEach(() => {
    mkdirSync(join(tmp, ".aw", progressDir), { recursive: true });
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("returns the first non-done task", () => {
    writeFileSync(
      join(tmp, ".aw", progressDir, "tasks.json"),
      JSON.stringify([
        { id: 1, category: "infrastructure", description: "Task A", steps: [], done: true },
        { id: 2, category: "feature", description: "Task B", steps: [], done: false },
        { id: 3, category: "feature", description: "Task C", steps: [], done: false },
      ])
    );
    const task = getNextIncompleteTask(tmp, progressDir);
    expect(task).not.toBeNull();
    expect(task!.id).toBe(2);
    expect(task!.done).toBe(false);
  });

  it("returns null when all tasks are done", () => {
    writeFileSync(
      join(tmp, ".aw", progressDir, "tasks.json"),
      JSON.stringify([
        { id: 1, category: "feature", description: "Done", steps: [], done: true },
        { id: 2, category: "feature", description: "Done", steps: [], done: true },
      ])
    );
    const task = getNextIncompleteTask(tmp, progressDir);
    expect(task).toBeNull();
  });

  it("returns null when tasks.json contains an empty array", () => {
    writeFileSync(join(tmp, ".aw", progressDir, "tasks.json"), JSON.stringify([]));
    const task = getNextIncompleteTask(tmp, progressDir);
    expect(task).toBeNull();
  });

  it("returns null when tasks.json does not exist", () => {
    const task = getNextIncompleteTask(join(tmp, "nonexistent"), progressDir);
    expect(task).toBeNull();
  });

  it("returns null when tasks.json contains malformed JSON", () => {
    writeFileSync(join(tmp, ".aw", progressDir, "tasks.json"), "not valid json{{{");
    const task = getNextIncompleteTask(tmp, progressDir);
    expect(task).toBeNull();
  });

  it("returns the only task when it is not done", () => {
    writeFileSync(
      join(tmp, ".aw", progressDir, "tasks.json"),
      JSON.stringify([
        { id: 1, category: "feature", description: "Solo task", steps: ["Do it"], done: false },
      ])
    );
    const task = getNextIncompleteTask(tmp, progressDir);
    expect(task).not.toBeNull();
    expect(task!.id).toBe(1);
    expect(task!.description).toBe("Solo task");
  });

  it("skips done tasks and returns the first incomplete", () => {
    writeFileSync(
      join(tmp, ".aw", progressDir, "tasks.json"),
      JSON.stringify([
        { id: 1, category: "feature", description: "D1", steps: [], done: true },
        { id: 2, category: "feature", description: "D2", steps: [], done: true },
        { id: 3, category: "feature", description: "D3", steps: [], done: true },
        { id: 4, category: "feature", description: "Remaining", steps: [], done: false },
      ])
    );
    const task = getNextIncompleteTask(tmp, progressDir);
    expect(task).not.toBeNull();
    expect(task!.id).toBe(4);
  });
});
