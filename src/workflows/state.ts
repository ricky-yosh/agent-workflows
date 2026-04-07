import * as fs from "fs";
import * as path from "path";
import type { Workflow, WorkflowState, StepState } from "../types.js";
import { AW_DIR } from "../types.js";

function stateFile(workflowName?: string): string {
  if (!workflowName) return "state.json";
  const safe = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `state-${safe}.json`;
}

function ensureAwDir(dir: string): void {
  fs.mkdirSync(path.join(dir, AW_DIR), { recursive: true });
}

export function createInitialState(workflow: Workflow): WorkflowState {
  const steps: StepState[] = [];

  for (let phaseIndex = 0; phaseIndex < workflow.phases.length; phaseIndex++) {
    const phase = workflow.phases[phaseIndex];
    for (let stepIndex = 0; stepIndex < phase.steps.length; stepIndex++) {
      steps.push({
        phaseIndex,
        stepIndex,
        status: "pending",
      });
    }
  }

  return {
    workflowName: workflow.name,
    currentPhase: 0,
    currentStep: 0,
    steps,
    loopIterations: {},
  };
}

export function saveState(dir: string, state: WorkflowState): void {
  ensureAwDir(dir);
  const filePath = path.join(dir, AW_DIR, stateFile(state.workflowName));
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(dir: string, workflowName?: string): WorkflowState | null {
  const filePath = path.join(dir, AW_DIR, stateFile(workflowName));
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as WorkflowState;
  } catch {
    return null;
  }
}

export function getStepState(
  state: WorkflowState,
  phaseIndex: number,
  stepIndex: number
): StepState | undefined {
  return state.steps.find(
    (s) => s.phaseIndex === phaseIndex && s.stepIndex === stepIndex
  );
}

export function completeStep(
  state: WorkflowState,
  phaseIndex: number,
  stepIndex: number,
  result: { agent?: string; sessionId?: string; outputFiles?: string[] }
): WorkflowState {
  const steps = state.steps.map((s) => {
    if (s.phaseIndex === phaseIndex && s.stepIndex === stepIndex) {
      return {
        ...s,
        status: "completed" as const,
        agent: result.agent,
        sessionId: result.sessionId,
        outputFiles: result.outputFiles,
        completedAt: new Date().toISOString(),
      };
    }
    return s;
  });

  // steps is always ordered by (phaseIndex, stepIndex) — maintained by createInitialState
  const completedIdx = steps.findIndex(
    (s) => s.phaseIndex === phaseIndex && s.stepIndex === stepIndex
  );

  let nextPhase = state.currentPhase;
  let nextStep = state.currentStep;

  for (let i = completedIdx + 1; i < steps.length; i++) {
    const candidate = steps[i];
    if (candidate.status === "pending") {
      nextPhase = candidate.phaseIndex;
      nextStep = candidate.stepIndex;
      break;
    }
  }

  return {
    ...state,
    steps,
    currentPhase: nextPhase,
    currentStep: nextStep,
  };
}

export function getDownstreamSteps(
  workflow: Workflow,
  phaseIndex: number,
  stepIndex: number
): Array<{ phaseIndex: number; stepIndex: number }> {
  const result: Array<{ phaseIndex: number; stepIndex: number }> = [];

  for (let pi = phaseIndex; pi < workflow.phases.length; pi++) {
    const phase = workflow.phases[pi];
    const startStep = pi === phaseIndex ? stepIndex + 1 : 0;
    for (let si = startStep; si < phase.steps.length; si++) {
      result.push({ phaseIndex: pi, stepIndex: si });
    }
  }

  return result;
}


export function resetState(dir: string, workflow: Workflow): WorkflowState {
  const fresh = createInitialState(workflow);
  const filePath = path.join(dir, AW_DIR, stateFile(workflow.name));
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File doesn't exist — that's fine
  }
  return fresh;
}

export function skipStep(
  state: WorkflowState,
  phaseIndex: number,
  stepIndex: number,
): WorkflowState {
  const steps = state.steps.map((s) => {
    if (s.phaseIndex === phaseIndex && s.stepIndex === stepIndex) {
      return {
        ...s,
        status: "skipped" as const,
        completedAt: new Date().toISOString(),
      };
    }
    return s;
  });

  return { ...state, steps };
}

export function invalidateStep(
  state: WorkflowState,
  phaseIndex: number,
  stepIndex: number
): WorkflowState {
  const steps = state.steps.map((s) => {
    if (s.phaseIndex === phaseIndex && s.stepIndex === stepIndex) {
      return {
        phaseIndex: s.phaseIndex,
        stepIndex: s.stepIndex,
        status: "pending" as const,
      };
    }
    return s;
  });

  return { ...state, steps };
}
