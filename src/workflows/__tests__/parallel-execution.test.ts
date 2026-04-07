import { describe, it, expect } from "vitest";
import type { WorkflowStep } from "../../types.js";

// These types and functions do not exist yet — they will be implemented in src/workflows/parallel.ts.
import {
  createParallelGroup,
  markStepComplete,
  markStepFailed,
  isGroupComplete,
  isGroupFailed,
  getRunningSteps,
  type ParallelStepState,
  type ParallelGroup,
} from "../parallel.js";

const makeStep = (name: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep => ({
  name,
  type: "think",
  ...overrides,
});

describe("createParallelGroup", () => {
  it("creates a group with all steps in running state", () => {
    const steps = [
      makeStep("Research A", { parallel: true }),
      makeStep("Research B", { parallel: true }),
    ];
    const group = createParallelGroup([2, 3], steps);

    expect(group.steps).toHaveLength(2);
    expect(group.steps[0]).toMatchObject({
      stepIndex: 2,
      status: "running",
      stepName: "Research A",
    });
    expect(group.steps[1]).toMatchObject({
      stepIndex: 3,
      status: "running",
      stepName: "Research B",
    });
  });

  it("each step has its own empty stream buffer", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    const group = createParallelGroup([0, 1], steps);

    for (const step of group.steps) {
      expect(step.streamBuffer).toBe("");
    }
    // Verify buffers are independent references
    expect(group.steps[0]).not.toBe(group.steps[1]);
  });

  it("each step has an undefined sessionId initially", () => {
    const steps = [makeStep("S1", { parallel: true })];
    const group = createParallelGroup([0], steps);

    expect(group.steps[0].sessionId).toBeUndefined();
  });
});

describe("markStepComplete", () => {
  it("marks a specific step as completed", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    const group = createParallelGroup([0, 1], steps);
    const updated = markStepComplete(group, 0, "session-abc");

    expect(updated.steps[0].status).toBe("completed");
    expect(updated.steps[0].sessionId).toBe("session-abc");
    expect(updated.steps[1].status).toBe("running");
  });

  it("does not mutate the original group", () => {
    const steps = [makeStep("S1", { parallel: true })];
    const group = createParallelGroup([0], steps);
    const updated = markStepComplete(group, 0, "sess-1");

    expect(group.steps[0].status).toBe("running");
    expect(updated.steps[0].status).toBe("completed");
  });

  it("is a no-op for a stepIndex not in the group", () => {
    const steps = [makeStep("S1", { parallel: true })];
    const group = createParallelGroup([0], steps);
    const updated = markStepComplete(group, 99, "sess-1");

    expect(updated).toEqual(group);
  });
});

describe("markStepFailed", () => {
  it("marks a specific step as failed with an error message", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    const group = createParallelGroup([0, 1], steps);
    const updated = markStepFailed(group, 1, "Agent crashed");

    expect(updated.steps[1].status).toBe("failed");
    expect(updated.steps[1].error).toBe("Agent crashed");
    expect(updated.steps[0].status).toBe("running");
  });

  it("does not mutate the original group", () => {
    const steps = [makeStep("S1", { parallel: true })];
    const group = createParallelGroup([0], steps);
    const updated = markStepFailed(group, 0, "error");

    expect(group.steps[0].status).toBe("running");
    expect(updated.steps[0].status).toBe("failed");
  });
});

describe("isGroupComplete", () => {
  it("returns true when all steps are completed", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1], steps);
    group = markStepComplete(group, 0, "s1");
    group = markStepComplete(group, 1, "s2");

    expect(isGroupComplete(group)).toBe(true);
  });

  it("returns false when some steps are still running", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1], steps);
    group = markStepComplete(group, 0, "s1");

    expect(isGroupComplete(group)).toBe(false);
  });

  it("returns false when a step has failed", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1], steps);
    group = markStepComplete(group, 0, "s1");
    group = markStepFailed(group, 1, "error");

    expect(isGroupComplete(group)).toBe(false);
  });

  it("returns true for an empty group", () => {
    const group = createParallelGroup([], []);
    expect(isGroupComplete(group)).toBe(true);
  });
});

describe("isGroupFailed", () => {
  it("returns true when any step has failed", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1], steps);
    group = markStepFailed(group, 0, "boom");

    expect(isGroupFailed(group)).toBe(true);
  });

  it("returns false when no steps have failed", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1], steps);
    group = markStepComplete(group, 0, "s1");

    expect(isGroupFailed(group)).toBe(false);
  });

  it("returns false for an empty group", () => {
    const group = createParallelGroup([], []);
    expect(isGroupFailed(group)).toBe(false);
  });
});

describe("getRunningSteps", () => {
  it("returns all steps that are still running", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
      makeStep("S3", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1, 2], steps);
    group = markStepComplete(group, 0, "s1");

    const running = getRunningSteps(group);
    expect(running).toHaveLength(2);
    expect(running.map((s) => s.stepIndex)).toEqual([1, 2]);
  });

  it("returns empty array when all steps are done", () => {
    const steps = [makeStep("S1", { parallel: true })];
    let group = createParallelGroup([0], steps);
    group = markStepComplete(group, 0, "s1");

    expect(getRunningSteps(group)).toEqual([]);
  });

  it("does not include failed steps", () => {
    const steps = [
      makeStep("S1", { parallel: true }),
      makeStep("S2", { parallel: true }),
    ];
    let group = createParallelGroup([0, 1], steps);
    group = markStepFailed(group, 0, "err");

    const running = getRunningSteps(group);
    expect(running).toHaveLength(1);
    expect(running[0].stepIndex).toBe(1);
  });
});
