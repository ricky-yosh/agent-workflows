import type { WorkflowPhase, WorkflowStep } from "../types.js";

export interface ParallelStepState {
  stepIndex: number;
  status: "running" | "completed" | "failed";
  stepName: string;
  streamBuffer: string;
  sessionId?: string;
  error?: string;
}

export interface ParallelGroup {
  steps: ParallelStepState[];
}

/**
 * Walk consecutive `parallel: true` steps starting from stepIndex.
 * Returns empty array if the step at stepIndex is not parallel or out of bounds.
 */
export function getParallelStepGroup(phase: WorkflowPhase, stepIndex: number): number[] {
  if (stepIndex < 0 || stepIndex >= phase.steps.length) return [];
  if (!phase.steps[stepIndex].parallel) return [];

  const indices: number[] = [];
  for (let i = stepIndex; i < phase.steps.length; i++) {
    if (!phase.steps[i].parallel) break;
    indices.push(i);
  }
  return indices;
}

/**
 * Create a ParallelGroup with all steps starting in "running" state.
 */
export function createParallelGroup(indices: number[], steps: WorkflowStep[]): ParallelGroup {
  return {
    steps: indices.map((idx, i) => ({
      stepIndex: idx,
      status: "running" as const,
      stepName: steps[i].name,
      streamBuffer: "",
    })),
  };
}

/**
 * Immutably mark a step as completed. No-op if stepIndex not in group.
 */
export function markStepComplete(group: ParallelGroup, stepIndex: number, sessionId: string): ParallelGroup {
  const found = group.steps.some((s) => s.stepIndex === stepIndex);
  if (!found) return group;

  return {
    ...group,
    steps: group.steps.map((s) =>
      s.stepIndex === stepIndex
        ? { ...s, status: "completed" as const, sessionId }
        : s
    ),
  };
}

/**
 * Immutably mark a step as failed. No-op if stepIndex not in group.
 */
export function markStepFailed(group: ParallelGroup, stepIndex: number, error: string): ParallelGroup {
  const found = group.steps.some((s) => s.stepIndex === stepIndex);
  if (!found) return group;

  return {
    ...group,
    steps: group.steps.map((s) =>
      s.stepIndex === stepIndex
        ? { ...s, status: "failed" as const, error }
        : s
    ),
  };
}

/**
 * True when every step is "completed" (empty group counts as complete).
 */
export function isGroupComplete(group: ParallelGroup): boolean {
  return group.steps.every((s) => s.status === "completed");
}

/**
 * True when any step is "failed".
 */
export function isGroupFailed(group: ParallelGroup): boolean {
  return group.steps.some((s) => s.status === "failed");
}

/**
 * Return all steps still in "running" state.
 */
export function getRunningSteps(group: ParallelGroup): ParallelStepState[] {
  return group.steps.filter((s) => s.status === "running");
}
