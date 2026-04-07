import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Workflow } from "../../types.js";
import {
  createInitialState,
  saveState,
  loadState,
  completeStep,
  skipStep,
  getDownstreamSteps,
} from "../state.js";

const testWorkflow: Workflow = {
  name: "Test",
  description: "Test",
  phases: [
    {
      name: "P1",
      steps: [
        { name: "S1", type: "think", outputs: ["out.txt"] },
        { name: "S2", type: "code" },
      ],
    },
    {
      name: "P2",
      steps: [{ name: "S3", type: "think" }],
    },
  ],
};

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aw-state-test-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createInitialState", () => {
  it("creates state with all steps pending, currentPhase=0, currentStep=0", () => {
    const state = createInitialState(testWorkflow);

    expect(state.workflowName).toBe("Test");
    expect(state.currentPhase).toBe(0);
    expect(state.currentStep).toBe(0);
    expect(state.loopIterations).toEqual({});

    expect(state.steps).toHaveLength(3);

    for (const step of state.steps) {
      expect(step.status).toBe("pending");
    }

    expect(state.steps[0]).toMatchObject({ phaseIndex: 0, stepIndex: 0, status: "pending" });
    expect(state.steps[1]).toMatchObject({ phaseIndex: 0, stepIndex: 1, status: "pending" });
    expect(state.steps[2]).toMatchObject({ phaseIndex: 1, stepIndex: 0, status: "pending" });
  });
});

describe("saveState / loadState", () => {
  it("round-trips correctly", () => {
    const state = createInitialState(testWorkflow);
    saveState(tmpDir, state);
    const loaded = loadState(tmpDir, "Test");

    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(state);
  });

  it("returns null when no state file exists", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "aw-empty-"));
    try {
      const result = loadState(emptyDir, "Test");
      expect(result).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("completeStep", () => {
  it("marks step completed and advances cursor to next pending step", () => {
    const state = createInitialState(testWorkflow);
    const result = completeStep(state, 0, 0, { agent: "claude", sessionId: "abc" });

    const completedStep = result.steps.find(
      (s) => s.phaseIndex === 0 && s.stepIndex === 0
    );
    expect(completedStep?.status).toBe("completed");
    expect(completedStep?.agent).toBe("claude");
    expect(completedStep?.sessionId).toBe("abc");
    expect(completedStep?.completedAt).toBeDefined();

    // cursor advances to next pending: phase 0, step 1
    expect(result.currentPhase).toBe(0);
    expect(result.currentStep).toBe(1);
  });

  it("advances cursor across phase boundaries", () => {
    const state = createInitialState(testWorkflow);
    // Complete P1/S1
    const s1 = completeStep(state, 0, 0, {});
    // Complete P1/S2
    const s2 = completeStep(s1, 0, 1, {});

    // cursor should now point to P2/S1
    expect(s2.currentPhase).toBe(1);
    expect(s2.currentStep).toBe(0);
  });
});

describe("skipStep", () => {
  it("marks a step as skipped with a timestamp", () => {
    const state = createInitialState(testWorkflow);
    const result = skipStep(state, 0, 1);
    const step = result.steps.find(s => s.phaseIndex === 0 && s.stepIndex === 1);
    expect(step?.status).toBe("skipped");
    expect(step?.completedAt).toBeDefined();
  });

  it("does not affect other steps", () => {
    const state = createInitialState(testWorkflow);
    const result = skipStep(state, 0, 1);
    const other = result.steps.find(s => s.phaseIndex === 0 && s.stepIndex === 0);
    expect(other?.status).toBe("pending");
  });

  it("completeStep auto-advances past skipped steps", () => {
    let state = createInitialState(testWorkflow);
    // Skip P1/S2
    state = skipStep(state, 0, 1);
    // Complete P1/S1 — cursor should jump to P2/S1 (skipping P1/S2)
    state = completeStep(state, 0, 0, {});
    expect(state.currentPhase).toBe(1);
    expect(state.currentStep).toBe(0);
  });
});

describe("getDownstreamSteps", () => {
  it("returns all steps after the given one", () => {
    const downstream = getDownstreamSteps(testWorkflow, 0, 0);

    // After P1/S1: P1/S2, P2/S1
    expect(downstream).toEqual([
      { phaseIndex: 0, stepIndex: 1 },
      { phaseIndex: 1, stepIndex: 0 },
    ]);
  });

  it("returns empty array when given the last step", () => {
    const downstream = getDownstreamSteps(testWorkflow, 1, 0);
    expect(downstream).toEqual([]);
  });

  it("returns all steps in following phases when given last step of a phase", () => {
    const downstream = getDownstreamSteps(testWorkflow, 0, 1);
    expect(downstream).toEqual([{ phaseIndex: 1, stepIndex: 0 }]);
  });
});
