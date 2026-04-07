import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Agent } from "../types.js";

const execFileAsync = promisify(execFile);

export function createClaudeAgent(): Agent {
  return {
    name: "claude",

    buildCommand(prompt, opts) {
      const args = ["claude", "--permission-mode", "acceptEdits"];
      if (opts.resumeSessionId) {
        args.push("--resume", opts.resumeSessionId);
      }
      // Pass the prompt as a CLI argument so Claude starts and immediately
      // processes it — no prompt-readiness polling needed.
      if (prompt) {
        args.push(prompt.replace(/'/g, "'\\''"));
      }
      return args.join(" ");
    },

    async isAvailable(): Promise<boolean> {
      try {
        await execFileAsync("which", ["claude"]);
        return true;
      } catch {
        return false;
      }
    },

    resumeCommand(sessionId: string): string {
      return `claude --resume ${sessionId}`;
    },
  };
}
