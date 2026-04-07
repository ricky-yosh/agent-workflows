import type { Agent, WorkflowStep } from "../types.js";
import type { TmuxContext } from "../tmux/lifecycle.js";
import { splitWindow, sendKeys, respawnPane, killPane } from "../tmux/pane.js";
import { pollForOutputs, captureSessionId, cleanupStopSignal } from "../tmux/monitor.js";
import { cleanupOutputFiles, ensureProgressDir } from "./signal.js";
import {
  createParallelGroup,
  markStepComplete,
  markStepFailed,
  type ParallelGroup,
} from "./parallel.js";

export interface ParallelRunOpts {
  cwd: string;
  agent: Agent;
  tmux: TmuxContext;
  phaseIndex: number;
  /** Progress directory under .aw/ (e.g., "lf-progress"). */
  progressDir?: string;
  /** Called after panes are allocated, before agents start. */
  onStart?: (paneIds: string[]) => void;
}

export interface ParallelRunResult {
  group: ParallelGroup;
  allSucceeded: boolean;
}

/**
 * Run a group of parallel steps concurrently in separate tmux panes.
 *
 * - First step reuses rightPaneId; additional steps get new vertical splits.
 * - Completion detected by polling for output files (stop signals disabled for parallel).
 * - All parallel steps must declare outputs: in the workflow YAML.
 * - Uses Promise.allSettled for individual failure handling.
 */
export async function runParallelGroup(
  steps: WorkflowStep[],
  stepIndices: number[],
  opts: ParallelRunOpts
): Promise<ParallelRunResult> {
  // Validate: all parallel steps must have outputs for completion detection
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].outputs?.length) {
      throw new Error(
        `Parallel step "${steps[i].name}" must declare outputs: for completion detection`
      );
    }
  }

  const progressDir = opts.progressDir ?? "progress";
  let group = createParallelGroup(stepIndices, steps);

  // Allocate panes: first step uses rightPaneId, rest get new splits
  const paneIds: string[] = [];
  paneIds.push(opts.tmux.rightPaneId);

  for (let i = 1; i < stepIndices.length; i++) {
    const paneId = await splitWindow(opts.tmux.rightPaneId, Math.floor(100 / (stepIndices.length - i + 1)));
    paneIds.push(paneId);
  }

  // Notify caller of allocated panes
  opts.onStart?.(paneIds);

  // Clean stale output files for all parallel steps
  for (const step of steps) {
    if (step.outputs?.length) {
      cleanupOutputFiles(opts.cwd, progressDir, step.outputs);
    }
  }
  ensureProgressDir(opts.cwd, progressDir);

  // Also clean the global stop signal — we won't use it but don't want stale state
  cleanupStopSignal(opts.cwd);

  // Launch all agents concurrently
  const promises = stepIndices.map(async (stepIndex, i) => {
    const step = steps[i];
    const paneId = paneIds[i];

    await respawnPane(paneId);
    await new Promise((r) => setTimeout(r, 500));

    const prompt = step.skill || step.name;
    const permissions = step.permissions || "default";

    // Prompt is passed as a CLI argument — Claude launches and immediately
    // processes it. No prompt-readiness polling needed.
    const command = opts.agent.buildCommand(prompt, {
      cwd: opts.cwd,
      permissions,
      // Always fresh sessions for parallel — no --resume
    });
    await sendKeys(paneId, command);

    const sessionIdPromise = captureSessionId(paneId);

    // Poll for output files instead of using signals
    const result = await pollForOutputs({
      paneId,
      cwd: opts.cwd,
      progressDir,
      outputs: step.outputs!,
    });

    const sessionId = await sessionIdPromise;

    return { stepIndex, exitCode: result.exitCode, sessionId };
  });

  // Wait for all steps — handle individual failures
  const settled = await Promise.allSettled(promises);

  for (const result of settled) {
    if (result.status === "fulfilled") {
      const { stepIndex, exitCode, sessionId } = result.value;
      if (exitCode === 0) {
        group = markStepComplete(group, stepIndex, sessionId ?? "unknown");
      } else {
        group = markStepFailed(group, stepIndex, `Exit code: ${exitCode}`);
      }
    } else {
      // Promise rejected — find which step by index in the settled array
      const idx = settled.indexOf(result);
      const stepIndex = stepIndices[idx];
      group = markStepFailed(group, stepIndex, result.reason?.message ?? "Unknown error");
    }
  }

  // Cleanup: kill extra panes concurrently, then respawn rightPaneId
  await Promise.all(paneIds.slice(1).map(killPane));
  await respawnPane(opts.tmux.rightPaneId);

  const allSucceeded = group.steps.every((s) => s.status === "completed");

  return { group, allSucceeded };
}
