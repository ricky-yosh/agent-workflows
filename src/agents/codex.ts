import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Agent } from "../types.js";

const execFileAsync = promisify(execFile);

const PERMISSION_MAP: Record<string, string> = {
  default: "untrusted", code: "on-request", auto: "never",
};

/**
 * Write the prompt to a temp file and return the path.
 * Used when the prompt is too long or multi-line for a shell argument.
 */
function writePromptFile(prompt: string): string {
  const promptDir = join(tmpdir(), "aw-codex-prompts");
  mkdirSync(promptDir, { recursive: true });
  const promptFile = join(promptDir, `prompt-${Date.now()}.md`);
  writeFileSync(promptFile, prompt, "utf-8");
  return promptFile;
}

export function createCodexAgent(command: string): Agent {
  return {
    name: "codex",

    buildCommand(prompt, opts) {
      const approval = PERMISSION_MAP[opts.permissions] || "untrusted";
      // Interactive TUI mode with --no-alt-screen for tmux compatibility.
      // The Stop hook (configured in .codex/hooks.json) signals turn completion,
      // same as CC's Stop hook.
      const base = `${command} --no-alt-screen -a ${approval}`;

      if (!prompt) {
        return base;
      }

      // For short single-line prompts, pass directly as a quoted arg
      if (!prompt.includes("\n") && prompt.length < 500) {
        const escaped = prompt.replace(/'/g, "'\\''");
        return `${base} '${escaped}'`;
      }

      // For multi-line / long prompts, write to a temp file and use
      // command substitution so the shell passes it as a single argument.
      const promptFile = writePromptFile(prompt);
      return `${base} "$(cat '${promptFile}')"`;
    },

    async isAvailable(): Promise<boolean> {
      try { await execFileAsync(command, ["--version"]); return true; }
      catch { return false; }
    },

    resumeCommand(sessionId: string): string {
      return `${command} resume --last`;
    },
  };
}
