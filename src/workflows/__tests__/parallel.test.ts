import { describe, it, expect } from "vitest";
import type { WorkflowPhase, WorkflowStep } from "../../types.js";

// --- getParallelStepGroup ---
// This function does not exist yet. It will be implemented in src/workflows/parallel.ts.
// Import will fail until implementation — that's the point.
import { getParallelStepGroup } from "../parallel.js";

const makeStep = (name: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep => ({
  name,
  type: "think",
  ...overrides,
});

const makePhase = (name: string, steps: WorkflowStep[]): WorkflowPhase => ({
  name,
  steps,
});

describe("getParallelStepGroup", () => {
  it("returns a single parallel step when only one is marked parallel", () => {
    const phase = makePhase("P1", [
      makeStep("S1"),
      makeStep("S2", { parallel: true }),
      makeStep("S3"),
    ]);

    const group = getParallelStepGroup(phase, 1);
    expect(group).toEqual([1]);
  });

  it("returns all consecutive parallel steps starting from stepIndex", () => {
    const phase = makePhase("P1", [
      makeStep("S1"),
      makeStep("S2", { parallel: true }),
      makeStep("S3", { parallel: true }),
      makeStep("S4", { parallel: true }),
      makeStep("S5"),
    ]);

    const group = getParallelStepGroup(phase, 1);
    expect(group).toEqual([1, 2, 3]);
  });

  it("returns empty array when step at index is not parallel", () => {
    const phase = makePhase("P1", [
      makeStep("S1"),
      makeStep("S2"),
      makeStep("S3", { parallel: true }),
    ]);

    const group = getParallelStepGroup(phase, 0);
    expect(group).toEqual([]);
  });

  it("returns empty array when stepIndex is out of bounds", () => {
    const phase = makePhase("P1", [makeStep("S1")]);

    const group = getParallelStepGroup(phase, 5);
    expect(group).toEqual([]);
  });

  it("handles all steps being parallel", () => {
    const phase = makePhase("P1", [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
      makeStep("S3", { parallel: true }),
    ]);

    const group = getParallelStepGroup(phase, 0);
    expect(group).toEqual([0, 1, 2]);
  });

  it("stops at the first non-parallel step", () => {
    const phase = makePhase("P1", [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
      makeStep("S3"), // not parallel — boundary
      makeStep("S4", { parallel: true }),
    ]);

    const group = getParallelStepGroup(phase, 0);
    expect(group).toEqual([0, 1]);
  });

  it("returns a group starting from the middle of the phase", () => {
    const phase = makePhase("P1", [
      makeStep("S1"),
      makeStep("S2"),
      makeStep("S3", { parallel: true }),
      makeStep("S4", { parallel: true }),
    ]);

    const group = getParallelStepGroup(phase, 2);
    expect(group).toEqual([2, 3]);
  });

  it("handles a phase with a single step that is parallel", () => {
    const phase = makePhase("P1", [
      makeStep("S1", { parallel: true }),
    ]);

    const group = getParallelStepGroup(phase, 0);
    expect(group).toEqual([0]);
  });

  it("handles an empty steps array", () => {
    const phase = makePhase("P1", []);

    const group = getParallelStepGroup(phase, 0);
    expect(group).toEqual([]);
  });
});
