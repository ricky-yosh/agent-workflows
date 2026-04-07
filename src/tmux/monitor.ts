import { watch, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isPaneDead, getPaneExitStatus, capturePane } from "./pane.js";
import { allOutputsExist } from "../workflows/signal.js";
import { STOP_SIGNAL_FILE, AW_DIR } from "../types.js";

export interface StepCompleteResult {
  exitCode: number;
  source: "stop_hook" | "pane_exit" | "output_poll";
}

/**
 * Clean up the stop-signal file before starting a step.
 */
export function cleanupStopSignal(cwd: string): void {
  try { unlinkSync(join(cwd, AW_DIR, STOP_SIGNAL_FILE)); } catch {}
}

/**
 * Wait for the agent in the right pane to finish processing a prompt.
 *
 * Uses a two-way race:
 * 1. Stop hook signal — Claude Code's Stop hook writes .aw/stop-signal.
 *    For steps with outputs, each stop signal triggers a file-existence check.
 *    If all output files exist, the step is complete. Otherwise, the stop signal
 *    is consumed and we wait for the next one.
 * 2. Pane exit — the CLI process crashed or the user exited.
 */
export async function waitForStepComplete(opts: {
  paneId: string;
  cwd: string;
  /** Expected output filenames (e.g., ["spec.xml"]). If empty/undefined, stop signal alone advances. */
  outputs?: string[];
  /** Progress directory under .aw/ (e.g., "lf-progress"). Required if outputs is non-empty. */
  progressDir?: string;
  timeout?: number;
  /** Override the stop signal file path. Pass `null` to disable stop-hook watching. */
  stopSignalFile?: string | null;
}): Promise<StepCompleteResult> {
  const timeout = opts.timeout ?? 5 * 60 * 1000;
  const hasOutputs = !!opts.outputs?.length;

  return new Promise((resolve) => {
    let resolved = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let stopWatcher: ReturnType<typeof watch> | undefined;

    function finish(result: StepCompleteResult) {
      if (resolved) return;
      resolved = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (stopWatcher) { try { stopWatcher.close(); } catch {} }
      resolve(result);
    }

    // Stop hook signal file (written by Claude Code's Stop hook)
    // When stopSignalFile is null, stop-hook watching is disabled (used for parallel steps)
    const stopDisabled = opts.stopSignalFile === null;
    const resolvedStopFile = opts.stopSignalFile ?? STOP_SIGNAL_FILE;
    const awDir = join(opts.cwd, AW_DIR);
    mkdirSync(awDir, { recursive: true });
    const stopSignalPath = join(awDir, resolvedStopFile);

    // For steps without outputs, the Stop hook fires after EVERY assistant
    // turn — including intermediate turns where Claude is still working
    // (e.g., reading files before producing final output). Debounce: consume
    // the signal and only resolve after a quiet period with no new signals.
    const DEBOUNCE_MS = 2000;

    function checkStopSignal() {
      if (resolved || stopDisabled) return;
      if (!existsSync(stopSignalPath)) return;

      if (!hasOutputs) {
        // Consume the signal so we can detect the next one
        try { unlinkSync(stopSignalPath); } catch {}

        // Reset debounce timer — another turn may follow
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!resolved) {
            finish({ exitCode: 0, source: "stop_hook" });
          }
        }, DEBOUNCE_MS);
        return;
      }

      // Has outputs: check if all exist
      if (allOutputsExist(opts.cwd, opts.progressDir!, opts.outputs!)) {
        finish({ exitCode: 0, source: "stop_hook" });
      } else {
        // Not done yet — consume this stop signal so we detect the next one
        try { unlinkSync(stopSignalPath); } catch {}
      }
    }

    // Check immediately in case it already exists
    checkStopSignal();
    if (resolved) return;

    // Watch the directory for the stop signal file
    if (!stopDisabled) {
      try {
        stopWatcher = watch(awDir, (eventType, filename) => {
          if (filename === resolvedStopFile || filename === null) {
            checkStopSignal();
          }
        });
        stopWatcher.on("error", () => {
          if (stopWatcher) { try { stopWatcher.close(); } catch {} stopWatcher = undefined; }
        });
      } catch {
        // fs.watch not available — polling below covers it
      }
    }

    // Poll for pane exit + stop signal fallback + direct output check
    pollTimer = setInterval(async () => {
      if (resolved) return;

      try {
        // Check pane death
        if (await isPaneDead(opts.paneId)) {
          const code = await getPaneExitStatus(opts.paneId);
          finish({ exitCode: code, source: "pane_exit" });
          return;
        }

        // Fallback poll for stop signal (in case fs.watch misses it)
        checkStopSignal();

        // Direct output polling — advances even if the Stop hook is not configured.
        // Runs every 2s (every 6th 300ms tick) to avoid thrashing.
        if (hasOutputs && opts.progressDir) {
          if (allOutputsExist(opts.cwd, opts.progressDir, opts.outputs!)) {
            finish({ exitCode: 0, source: "output_poll" });
          }
        }
      } catch {
        finish({ exitCode: 1, source: "pane_exit" });
      }
    }, 300);

    // Timeout
    timeoutTimer = setTimeout(() => {
      finish({ exitCode: 1, source: "pane_exit" });
    }, timeout);
  });
}

/**
 * Poll for output file existence without relying on stop signals.
 * Used by parallel steps where stop signals are disabled.
 */
export async function pollForOutputs(opts: {
  paneId: string;
  cwd: string;
  progressDir: string;
  outputs: string[];
  timeout?: number;
}): Promise<StepCompleteResult> {
  const timeout = opts.timeout ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    // Check pane death first
    try {
      if (await isPaneDead(opts.paneId)) {
        const code = await getPaneExitStatus(opts.paneId);
        return { exitCode: code, source: "pane_exit" };
      }
    } catch {
      return { exitCode: 1, source: "pane_exit" };
    }

    // Check if all outputs exist
    if (allOutputsExist(opts.cwd, opts.progressDir, opts.outputs)) {
      return { exitCode: 0, source: "output_poll" };
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  return { exitCode: 1, source: "pane_exit" }; // timeout
}

/**
 * Poll pane output to extract the session ID from Claude's startup.
 * Claude prints something like "Session: <uuid>" early in its output.
 */
export async function captureSessionId(paneId: string, timeout = 15000): Promise<string | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const output = await capturePane(paneId, 30);
      const match = output.match(/(?:Session|session_id)[:\s]+([0-9a-f-]{36})/i);
      if (match) return match[1];
    } catch {
      // Pane not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}
