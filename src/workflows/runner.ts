import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Agent, WorkflowStep } from "../types.js";
import type { TmuxContext } from "../tmux/lifecycle.js";
import { sendKeys, sendInterrupt, isPaneDead, respawnPane } from "../tmux/pane.js";
import { waitForStepComplete, captureSessionId, cleanupStopSignal } from "../tmux/monitor.js";
import { cleanupOutputFiles, ensureProgressDir } from "./signal.js";

export function escapeForShell(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export interface RunStepOpts {
  cwd: string;
  agent: Agent;
  tmux: TmuxContext;
  /** Progress directory under .aw/ (e.g., "lf-progress"). */
  progressDir?: string;
  /** Session ID from a previous step in this phase, for --resume. */
  resumeSessionId?: string;
  /** Whether the agent CLI is already running in the right pane. */
  agentRunning?: boolean;
  /** Root directory of the aw project (for resolving skill files). */
  awRoot?: string;
}

/**
 * Resolve a Codex prompt template for a skill.
 * Looks for CODEX-PROMPT.md next to the skill's SKILL.md,
 * reads it, and substitutes {{variable}} placeholders with
 * file contents from the progress directory.
 */
function resolveCodexPrompt(
  skillSlashCmd: string,
  awRoot: string,
  cwd: string,
  progressDir?: string,
): string | null {
  // Convert "/bf-implement" to skill directory path
  // Skills live under skills/<category>/<name>/
  const skillName = skillSlashCmd.replace(/^\//, "");
  const skillsRoot = join(awRoot, "skills");

  // Search all categories for the skill
  let codexPromptPath: string | null = null;
  try {
    for (const category of readdirSync(skillsRoot)) {
      const candidate = join(skillsRoot, category, skillName, "CODEX-PROMPT.md");
      if (existsSync(candidate)) {
        codexPromptPath = candidate;
        break;
      }
    }
  } catch {
    return null;
  }

  if (!codexPromptPath) return null;

  let template = readFileSync(codexPromptPath, "utf-8");

  // Strip frontmatter
  const fmMatch = template.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  if (fmMatch) {
    template = template.slice(fmMatch[0].length);
  }

  // Substitute {{variable}} placeholders with file contents from progress dir
  const progressPath = progressDir ? join(cwd, ".aw", progressDir) : cwd;
  template = template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    // Try common file extensions
    for (const ext of ["", ".md", ".txt", ".json"]) {
      const filePath = join(progressPath, varName + ext);
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf-8");
      }
    }
    return `[File not found: ${varName}]`;
  });

  return template.trim();
}

export interface StepRunResult {
  exitCode: number;
  sessionId?: string;
  duration: number;
  skipped: boolean;
  outputFiles: string[];
}

export async function runStep(step: WorkflowStep, opts: RunStepOpts): Promise<StepRunResult> {
  if (step.type === "input") {
    return { exitCode: 0, skipped: true, duration: 0, outputFiles: [] };
  }

  const start = Date.now();

  // Direct shell commands — run in the right pane
  if (step.command) {
    await sendKeys(opts.tmux.rightPaneId, step.command);
    const result = await waitForStepComplete({
      paneId: opts.tmux.rightPaneId,
      cwd: opts.cwd,
    });
    return {
      exitCode: result.exitCode,
      skipped: false,
      duration: Date.now() - start,
      outputFiles: [],
    };
  }

  // Agent-driven steps — for Claude Code, send the skill slash command directly
  // (e.g. "/lf-resume") so it invokes it natively with frontmatter support.
  // For Codex, resolve the CODEX-PROMPT.md template with substituted variables.
  const isCodex = opts.agent.name === "codex";
  let prompt: string;
  if (isCodex && step.skill && opts.awRoot) {
    const codexPrompt = resolveCodexPrompt(step.skill, opts.awRoot, opts.cwd, opts.progressDir);
    prompt = codexPrompt || step.skill;
  } else {
    prompt = step.skill || step.name;
  }
  const permissions = step.permissions || "default";

  // Clean up stale output files and stop signal before starting
  if (step.outputs?.length && opts.progressDir) {
    cleanupOutputFiles(opts.cwd, opts.progressDir, step.outputs);
    ensureProgressDir(opts.cwd, opts.progressDir);
  }
  cleanupStopSignal(opts.cwd);

  if (!opts.agentRunning) {
    await respawnPane(opts.tmux.rightPaneId);
    await new Promise((r) => setTimeout(r, 500));

    // Prompt is passed as a CLI argument — Claude launches and immediately
    // processes it. No prompt-readiness polling needed.
    const command = opts.agent.buildCommand(prompt, {
      cwd: opts.cwd,
      permissions,
      resumeSessionId: opts.resumeSessionId,
    });
    await sendKeys(opts.tmux.rightPaneId, command);
  } else {
    // Agent already running (Stop hook confirmed previous step done) —
    // just send the prompt to the existing interactive session.
    const escapedPrompt = escapeForShell(prompt);
    await sendKeys(opts.tmux.rightPaneId, escapedPrompt);
  }

  // Start capturing session ID in the background (non-blocking)
  let sessionId: string | undefined;
  const sessionIdPromise = captureSessionId(opts.tmux.rightPaneId).then(id => { sessionId = id; });

  // Wait for the step to complete
  const result = await waitForStepComplete({
    paneId: opts.tmux.rightPaneId,
    cwd: opts.cwd,
    outputs: step.outputs,
    progressDir: opts.progressDir,
    timeout: step.timeout_ms,
  });

  // Give session ID capture a brief moment if it hasn't resolved yet,
  // but don't block for the full 15s timeout.
  if (!sessionId) {
    await Promise.race([sessionIdPromise, new Promise(r => setTimeout(r, 500))]);
  }

  return {
    exitCode: result.exitCode,
    sessionId,
    skipped: false,
    duration: Date.now() - start,
    outputFiles: step.outputs || [],
  };
}
