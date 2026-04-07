import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Loader
import { loadWorkflow, listWorkflows, loadWorkflowByName } from "../workflows/loader.js";

// State management
import {
  createInitialState,
  completeStep,
  skipStep,
  invalidateStep,
  getStepState,
  getDownstreamSteps,
  saveState,
  loadState,
  resetState,
} from "../workflows/state.js";

// Signal & output detection
import {
  resolveOutputPath,
  allOutputsExist,
  cleanupOutputFiles,
  ensureProgressDir,
  shouldSkipStep,
  cleanupAllSignals,
} from "../workflows/signal.js";

// Task system
import { loadTasks, getNextIncompleteTask, getTaskSummary } from "../workflows/tasks.js";

// Skill discovery
import { discoverSkills } from "../workflows/skills.js";

// Parallel execution
import {
  getParallelStepGroup,
  createParallelGroup,
  markStepComplete,
  markStepFailed,
  isGroupComplete,
  isGroupFailed,
  getRunningSteps,
} from "../workflows/parallel.js";

// Agent registry
import { createAgentRegistry } from "../agents/registry.js";

/**
 * Full-cycle integration test.
 *
 * Simulates the entire aw lifecycle without tmux, touching every subsystem:
 *
 *   YAML workflow → loader → state init → agent registry → skill discovery
 *   → signal/output handling → task loading → step execution (complete, skip,
 *   invalidate) → parallel groups → state persistence → restore → reset
 *
 * The workflow under test mirrors a realistic setup:
 *
 *   Phase 0 "Setup"   — think step with outputs (spec.md)
 *   Phase 1 "Research" — two parallel steps, each with outputs
 *   Phase 2 "Build"    — looping phase with skip_when, code step, input step
 *   Phase 3 "Done"     — command step (no agent)
 */
describe("full workflow cycle — all components", () => {
  const tmp = join(tmpdir(), "aw-integration-" + Date.now());
  const wfDir = join(tmp, "workflows");
  const progressDir = "test-progress";

  // ── Fixture: workflow YAML ──────────────────────────────────────────
  const workflowYaml = `
name: FullCycle
description: Integration test touching every component
agent: claude
progress_dir: ${progressDir}
phases:
  - name: Setup
    steps:
      - name: Create spec
        type: think
        skill: /create-spec
        outputs:
          - spec.md

  - name: Research
    steps:
      - name: Research codebase
        type: think
        parallel: true
        outputs:
          - research.md
      - name: Create design
        type: think
        parallel: true
        outputs:
          - design.md

  - name: Build
    loop: true
    agent: codex
    steps:
      - name: Write tests
        type: code
        skip_when:
          file: next-task.json
          field: skipTests
          equals: true
        outputs:
          - tests-written.json
      - name: Implement
        type: code
        permissions: auto
      - name: Review
        type: input

  - name: Done
    steps:
      - name: Generate report
        type: code
        command: echo done
`;

  // ── Fixture: tasks.json ─────────────────────────────────────────────
  const tasksJson = JSON.stringify([
    { category: "feature", description: "Add login page", steps: ["scaffold", "style", "test"], done: false },
    { category: "bug", description: "Fix timeout", steps: ["diagnose", "patch"], done: false },
    { category: "feature", description: "Dashboard widget", steps: ["design"], done: true },
  ]);

  // ── Fixture: skill directory ────────────────────────────────────────
  const skillsDir = join(tmp, "skills", "testing", "demo-skill");
  const skillMd = `---
name: demo-skill
description: A demo skill for testing
---

Do something useful.
`;

  beforeAll(() => {
    // Workflow YAML
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, "full-cycle.yaml"), workflowYaml);

    // Tasks JSON in progress dir
    const pd = join(tmp, ".aw", progressDir);
    mkdirSync(pd, { recursive: true });
    writeFileSync(join(pd, "tasks.json"), tasksJson);

    // Skill fixture
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "SKILL.md"), skillMd);
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  // ────────────────────────────────────────────────────────────────────
  // 1. LOADER — parse YAML, list workflows, load by name
  // ────────────────────────────────────────────────────────────────────
  describe("1. Loader", () => {
    it("parses workflow YAML with all field types", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      expect(wf.name).toBe("FullCycle");
      expect(wf.agent).toBe("claude");
      expect(wf.progress_dir).toBe(progressDir);
      expect(wf.phases).toHaveLength(4);

      // Phase-level fields
      expect(wf.phases[2].loop).toBe(true);
      expect(wf.phases[2].agent).toBe("codex");

      // Step-level fields
      const specStep = wf.phases[0].steps[0];
      expect(specStep.skill).toBe("/create-spec");
      expect(specStep.outputs).toEqual(["spec.md"]);
      expect(specStep.type).toBe("think");

      const implStep = wf.phases[2].steps[1];
      expect(implStep.permissions).toBe("auto");

      const skipStep = wf.phases[2].steps[0];
      expect(skipStep.skip_when).toEqual({
        file: "next-task.json",
        field: "skipTests",
        equals: true,
      });

      const cmdStep = wf.phases[3].steps[0];
      expect(cmdStep.command).toBe("echo done");
    });

    it("lists workflow files by basename", () => {
      const names = listWorkflows(wfDir);
      expect(names).toContain("full-cycle");
    });

    it("loads by name", () => {
      const wf = loadWorkflowByName(wfDir, "full-cycle");
      expect(wf.name).toBe("FullCycle");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 2. STATE — init, complete, skip, invalidate, cursor advancement
  // ────────────────────────────────────────────────────────────────────
  describe("2. State management", () => {
    it("creates initial state with one StepState per workflow step", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const state = createInitialState(wf);

      // 1 + 2 + 3 + 1 = 7 total steps
      expect(state.steps).toHaveLength(7);
      expect(state.workflowName).toBe("FullCycle");
      expect(state.currentPhase).toBe(0);
      expect(state.currentStep).toBe(0);

      // Every step starts pending
      for (const s of state.steps) {
        expect(s.status).toBe("pending");
      }
    });

    it("completeStep marks done and advances cursor to next pending", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      let state = createInitialState(wf);

      state = completeStep(state, 0, 0, {
        agent: "claude",
        sessionId: "sess-setup",
        outputFiles: ["spec.md"],
      });

      const step0 = getStepState(state, 0, 0)!;
      expect(step0.status).toBe("completed");
      expect(step0.agent).toBe("claude");
      expect(step0.sessionId).toBe("sess-setup");
      expect(step0.completedAt).toBeTruthy();

      // Cursor advanced to phase 1, step 0
      expect(state.currentPhase).toBe(1);
      expect(state.currentStep).toBe(0);
    });

    it("skipStep marks skipped without advancing cursor", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      let state = createInitialState(wf);

      state = skipStep(state, 0, 0);
      const step0 = getStepState(state, 0, 0)!;
      expect(step0.status).toBe("skipped");
      expect(step0.completedAt).toBeTruthy();
    });

    it("invalidateStep resets a step back to pending", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      let state = createInitialState(wf);

      state = completeStep(state, 0, 0, { agent: "claude" });
      state = invalidateStep(state, 0, 0);
      expect(getStepState(state, 0, 0)!.status).toBe("pending");
    });

    it("getDownstreamSteps returns all steps after a given position", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const downstream = getDownstreamSteps(wf, 1, 0);

      // After phase 1 step 0: phase1/step1, phase2/step0-2, phase3/step0
      expect(downstream).toHaveLength(5);
      expect(downstream[0]).toEqual({ phaseIndex: 1, stepIndex: 1 });
      expect(downstream[downstream.length - 1]).toEqual({ phaseIndex: 3, stepIndex: 0 });
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 3. AGENT REGISTRY — create, list, build commands
  // ────────────────────────────────────────────────────────────────────
  describe("3. Agent registry", () => {
    it("creates agents from config and builds CLI commands", () => {
      const registry = createAgentRegistry({
        claude: {},
        codex: { command: "codex" },
      });

      expect(registry.list()).toEqual(["claude", "codex"]);

      const claude = registry.get("claude")!;
      expect(claude.name).toBe("claude");

      const cmd = claude.buildCommand("/create-spec", {
        cwd: tmp,
        permissions: "default",
      });
      expect(cmd).toContain("claude");
      expect(cmd).toContain("/create-spec");

      // Resume command
      const resume = claude.resumeCommand("sess-123");
      expect(resume).toContain("--resume");
      expect(resume).toContain("sess-123");
    });

    it("codex agent maps permissions to approval modes", () => {
      const registry = createAgentRegistry({ codex: { command: "codex" } });
      const codex = registry.get("codex")!;

      const cmd = codex.buildCommand("do stuff", {
        cwd: tmp,
        permissions: "auto",
      });
      expect(cmd).toContain("-a never");
    });

    it("returns undefined for unknown agents", () => {
      const registry = createAgentRegistry({ claude: {} });
      expect(registry.get("unknown")).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 4. SIGNAL & OUTPUT — resolve paths, check existence, cleanup, skip
  // ────────────────────────────────────────────────────────────────────
  describe("4. Signals & outputs", () => {
    it("resolves output paths under .aw/{progressDir}/", () => {
      const p = resolveOutputPath(tmp, progressDir, "spec.md");
      expect(p).toBe(join(tmp, ".aw", progressDir, "spec.md"));
    });

    it("ensureProgressDir creates the directory", () => {
      const subDir = "new-progress";
      ensureProgressDir(tmp, subDir);
      expect(existsSync(join(tmp, ".aw", subDir))).toBe(true);
    });

    it("allOutputsExist returns false when files are missing", () => {
      expect(allOutputsExist(tmp, progressDir, ["spec.md"])).toBe(false);
    });

    it("allOutputsExist returns true after creating the files", () => {
      writeFileSync(join(tmp, ".aw", progressDir, "spec.md"), "# Spec");
      expect(allOutputsExist(tmp, progressDir, ["spec.md"])).toBe(true);
    });

    it("cleanupOutputFiles removes stale outputs", () => {
      writeFileSync(join(tmp, ".aw", progressDir, "stale.md"), "old");
      cleanupOutputFiles(tmp, progressDir, ["stale.md"]);
      expect(existsSync(join(tmp, ".aw", progressDir, "stale.md"))).toBe(false);
    });

    it("shouldSkipStep evaluates skip_when conditions", () => {
      // Write a next-task.json with skipTests: true
      writeFileSync(
        join(tmp, ".aw", progressDir, "next-task.json"),
        JSON.stringify({ skipTests: true, task: "implement" }),
      );

      const skip = shouldSkipStep(tmp, progressDir, {
        file: "next-task.json",
        field: "skipTests",
        equals: true,
      });
      expect(skip).toBe(true);

      // Different value → don't skip
      const noSkip = shouldSkipStep(tmp, progressDir, {
        file: "next-task.json",
        field: "skipTests",
        equals: false,
      });
      expect(noSkip).toBe(false);
    });

    it("shouldSkipStep returns false when file is missing", () => {
      const skip = shouldSkipStep(tmp, progressDir, {
        file: "nonexistent.json",
        field: "x",
        equals: true,
      });
      expect(skip).toBe(false);
    });

    it("cleanupAllSignals removes stop-signal files", () => {
      writeFileSync(join(tmp, ".aw", "stop-signal"), "");
      cleanupAllSignals(tmp);
      expect(existsSync(join(tmp, ".aw", "stop-signal"))).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 5. TASKS — load, iterate, summarize
  // ────────────────────────────────────────────────────────────────────
  describe("5. Task system", () => {
    it("loads tasks and auto-assigns IDs", () => {
      const tasks = loadTasks(tmp, progressDir)!;
      expect(tasks).toHaveLength(3);
      expect(tasks[0].id).toBe(1);
      expect(tasks[0].category).toBe("feature");
      expect(tasks[0].steps).toEqual(["scaffold", "style", "test"]);
    });

    it("getNextIncompleteTask returns first non-done task", () => {
      const task = getNextIncompleteTask(tmp, progressDir)!;
      expect(task.description).toBe("Add login page");
      expect(task.done).toBe(false);
    });

    it("getTaskSummary formats task for display", () => {
      const tasks = loadTasks(tmp, progressDir)!;
      const summary = getTaskSummary(tasks[0]);
      expect(summary).toContain("Task 1: Add login page");
      expect(summary).toContain("Category: feature");
      expect(summary).toContain("Steps:");
      expect(summary).toContain("- scaffold");
    });

    it("returns null when tasks.json is missing", () => {
      expect(loadTasks(tmp, "nonexistent-dir")).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 6. SKILL DISCOVERY — find skills by category
  // ────────────────────────────────────────────────────────────────────
  describe("6. Skill discovery", () => {
    it("discovers skills grouped by category with frontmatter parsing", () => {
      const skills = discoverSkills(tmp);
      expect(skills).toHaveLength(1);

      const skill = skills[0];
      expect(skill.name).toBe("demo-skill");
      expect(skill.category).toBe("testing");
      expect(skill.description).toBe("A demo skill for testing");
      expect(skill.sourcePath).toBe(skillsDir);
    });

    it("returns empty array when skills directory is missing", () => {
      const skills = discoverSkills(join(tmp, "nonexistent"));
      expect(skills).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 7. PARALLEL GROUPS — identify, create, track
  // ────────────────────────────────────────────────────────────────────
  describe("7. Parallel execution", () => {
    it("identifies consecutive parallel steps as a group", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const researchPhase = wf.phases[1]; // Research phase

      const group = getParallelStepGroup(researchPhase, 0);
      expect(group).toEqual([0, 1]);
    });

    it("returns empty for non-parallel steps", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const buildPhase = wf.phases[2]; // Build phase — no parallel steps
      expect(getParallelStepGroup(buildPhase, 0)).toEqual([]);
    });

    it("tracks parallel group lifecycle: running → complete/failed", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const researchPhase = wf.phases[1];
      const indices = getParallelStepGroup(researchPhase, 0);

      let group = createParallelGroup(indices, researchPhase.steps);
      expect(group.steps).toHaveLength(2);
      expect(getRunningSteps(group)).toHaveLength(2);
      expect(isGroupComplete(group)).toBe(false);

      // First step completes
      group = markStepComplete(group, 0, "sess-research");
      expect(getRunningSteps(group)).toHaveLength(1);
      expect(isGroupComplete(group)).toBe(false);

      // Second step completes
      group = markStepComplete(group, 1, "sess-design");
      expect(getRunningSteps(group)).toHaveLength(0);
      expect(isGroupComplete(group)).toBe(true);
      expect(isGroupFailed(group)).toBe(false);
    });

    it("detects group failure", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const researchPhase = wf.phases[1];
      const indices = getParallelStepGroup(researchPhase, 0);

      let group = createParallelGroup(indices, researchPhase.steps);
      group = markStepFailed(group, 0, "network error");
      expect(isGroupFailed(group)).toBe(true);
      expect(group.steps[0].error).toBe("network error");
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 8. PERSISTENCE — save / load / reset round-trip
  // ────────────────────────────────────────────────────────────────────
  describe("8. Persistence", () => {
    it("saveState → loadState round-trips correctly", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      let state = createInitialState(wf);
      state = completeStep(state, 0, 0, { agent: "claude", sessionId: "sess-1" });

      saveState(tmp, state);
      const loaded = loadState(tmp, "FullCycle");
      expect(loaded).toEqual(state);
    });

    it("loadState returns null for unknown workflow", () => {
      expect(loadState(tmp, "NonExistent")).toBeNull();
    });

    it("resetState clears persisted state", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      let state = createInitialState(wf);
      state = completeStep(state, 0, 0, { agent: "claude" });
      saveState(tmp, state);

      const fresh = resetState(tmp, wf);
      expect(fresh.steps.every((s) => s.status === "pending")).toBe(true);

      // File is removed
      expect(loadState(tmp, "FullCycle")).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 9. END-TO-END — walk through the entire workflow lifecycle
  // ────────────────────────────────────────────────────────────────────
  describe("9. Full lifecycle walk-through", () => {
    it("simulates running every phase of the workflow", () => {
      const wf = loadWorkflow(join(wfDir, "full-cycle.yaml"));
      const registry = createAgentRegistry({ claude: {}, codex: { command: "codex" } });
      let state = createInitialState(wf);

      // ── Phase 0: Setup ──────────────────────────────────────────
      // Agent builds the command that would be sent to tmux
      const claude = registry.get("claude")!;
      const setupCmd = claude.buildCommand("/create-spec", {
        cwd: tmp,
        permissions: "default",
      });
      expect(setupCmd).toContain("claude");

      // Simulate: skill writes spec.md output
      ensureProgressDir(tmp, progressDir);
      writeFileSync(resolveOutputPath(tmp, progressDir, "spec.md"), "# Spec\nLogin feature");
      expect(allOutputsExist(tmp, progressDir, ["spec.md"])).toBe(true);

      state = completeStep(state, 0, 0, {
        agent: "claude",
        sessionId: "sess-setup",
        outputFiles: ["spec.md"],
      });
      expect(state.currentPhase).toBe(1);

      // ── Phase 1: Research (parallel) ────────────────────────────
      const parallelIndices = getParallelStepGroup(wf.phases[1], 0);
      expect(parallelIndices).toEqual([0, 1]);

      // Clean stale outputs before launching
      cleanupOutputFiles(tmp, progressDir, ["research.md", "design.md"]);

      // Simulate: both parallel agents write their outputs
      writeFileSync(resolveOutputPath(tmp, progressDir, "research.md"), "# Research");
      writeFileSync(resolveOutputPath(tmp, progressDir, "design.md"), "# Design");
      expect(allOutputsExist(tmp, progressDir, ["research.md", "design.md"])).toBe(true);

      // Track parallel group state
      let pGroup = createParallelGroup(parallelIndices, wf.phases[1].steps);
      pGroup = markStepComplete(pGroup, 0, "sess-research");
      pGroup = markStepComplete(pGroup, 1, "sess-design");
      expect(isGroupComplete(pGroup)).toBe(true);

      // Complete both steps in workflow state
      state = completeStep(state, 1, 0, { agent: "claude", sessionId: "sess-research" });
      state = completeStep(state, 1, 1, { agent: "claude", sessionId: "sess-design" });
      expect(state.currentPhase).toBe(2);

      // ── Phase 2: Build (loop iteration 1) ──────────────────────
      // Check skip_when for "Write tests" step
      const writeTestsStep = wf.phases[2].steps[0];
      const shouldSkip = shouldSkipStep(tmp, progressDir, writeTestsStep.skip_when!);
      // We wrote skipTests: true earlier, so this step is skipped
      expect(shouldSkip).toBe(true);
      state = skipStep(state, 2, 0);
      expect(getStepState(state, 2, 0)!.status).toBe("skipped");

      // "Implement" step uses codex with auto permissions
      const codex = registry.get("codex")!;
      const implCmd = codex.buildCommand("implement login", {
        cwd: tmp,
        permissions: "auto",
      });
      expect(implCmd).toContain("-a never");

      state = completeStep(state, 2, 1, { agent: "codex", sessionId: "sess-impl" });

      // "Review" step is type: input — the runner skips agent execution
      expect(wf.phases[2].steps[2].type).toBe("input");
      state = completeStep(state, 2, 2, {});

      // ── Phase 3: Done ───────────────────────────────────────────
      const reportStep = wf.phases[3].steps[0];
      expect(reportStep.command).toBe("echo done");
      // Command steps run in shell, no agent needed

      state = completeStep(state, 3, 0, {});

      // ── Verify final state ──────────────────────────────────────
      const statuses = state.steps.map((s) => s.status);
      expect(statuses).toEqual([
        "completed", // Setup: Create spec
        "completed", // Research: Research codebase
        "completed", // Research: Create design
        "skipped",   // Build: Write tests (skip_when)
        "completed", // Build: Implement
        "completed", // Build: Review
        "completed", // Done: Generate report
      ]);

      // Persist and verify restore
      saveState(tmp, state);
      const restored = loadState(tmp, "FullCycle")!;
      expect(restored.steps.map((s) => s.status)).toEqual(statuses);

      // Task system available for the build loop
      const nextTask = getNextIncompleteTask(tmp, progressDir);
      expect(nextTask).not.toBeNull();
      expect(nextTask!.description).toBe("Add login page");

      // Skills discovered from project root
      const skills = discoverSkills(tmp);
      expect(skills.length).toBeGreaterThan(0);
    });
  });
});
