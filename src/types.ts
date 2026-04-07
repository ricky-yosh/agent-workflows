export interface WorkflowPhase {
  name: string;
  loop?: boolean;
  agent?: string;
  steps: WorkflowStep[];
}

export interface SkipWhen {
  /** Output filename under progressDir to read (e.g., "next-task.json"). */
  file: string;
  /** JSON field name to check in the file. */
  field: string;
  /** Value that triggers the skip. */
  equals: unknown;
}

export interface WorkflowStep {
  name: string;
  skill?: string;
  type: "think" | "code" | "input";
  agent?: string;
  permissions?: "default" | "code" | "auto";
  outputs?: string[];
  parallel?: boolean;
  command?: string;
  /** Skip this step when a condition from a prior step's output is met. */
  skip_when?: SkipWhen;
}

export interface Workflow {
  name: string;
  description: string;
  agent?: string;
  progress_dir?: string;
  phases: WorkflowPhase[];
}

export interface Agent {
  name: string;
  /** Build the CLI command to launch this agent (e.g., "claude" or "claude --resume <id>"). */
  buildCommand(prompt: string, opts: {
    cwd: string;
    permissions: "default" | "code" | "auto";
    resumeSessionId?: string;
  }): string;
  isAvailable(): Promise<boolean>;
  resumeCommand(sessionId: string): string;
}

export interface StepState {
  phaseIndex: number;
  stepIndex: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  agent?: string;
  sessionId?: string;
  outputFiles?: string[];
  completedAt?: string;
  startedAt?: string;
}

export interface WorkflowState {
  workflowName: string;
  currentPhase: number;
  currentStep: number;
  steps: StepState[];
  loopIterations: Record<number, number>;
}

export interface AwConfig {
  editor: string;
  agents: Record<string, { command?: string }>;
}

/** Runtime directory for all aw state, signals, and logs. */
export const AW_DIR = ".aw";

/** Signal file written by Claude Code's Stop hook to indicate turn completion. */
export const STOP_SIGNAL_FILE = "stop-signal";

export type ViewMode = "workflow" | "select" | "checklist";
