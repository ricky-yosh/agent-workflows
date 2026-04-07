import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function tmux(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("tmux", args);
  return stdout.trim();
}

/** Get the current pane's ID (e.g., "%0"). */
export async function getCurrentPaneId(): Promise<string> {
  return tmux("display-message", "-p", "#{pane_id}");
}

/** Split the current window horizontally, returning the new pane's ID. */
export async function splitWindow(target: string, percent = 70): Promise<string> {
  return tmux("split-window", "-h", "-t", target, "-p", String(percent), "-d", "-P", "-F", "#{pane_id}");
}

/** Send keystrokes to a pane followed by Enter. */
export async function sendKeys(paneId: string, text: string): Promise<void> {
  await tmux("send-keys", "-t", paneId, "-l", "--", text);
  // Delay so the target app finishes processing the bracketed paste before Enter
  await new Promise(resolve => setTimeout(resolve, 200));
  await tmux("send-keys", "-t", paneId, "Enter");
}

/** Send a control key (e.g., "C-c") to a pane. */
export async function sendInterrupt(paneId: string): Promise<void> {
  await tmux("send-keys", "-t", paneId, "C-c");
}

/** Send Ctrl+D to exit the running CLI in a pane. */
export async function sendExit(paneId: string): Promise<void> {
  await tmux("send-keys", "-t", paneId, "C-d");
}

/** Focus a pane so the user can type in it directly. */
export async function focusPane(paneId: string): Promise<void> {
  await tmux("select-pane", "-t", paneId);
}

/** Check if a pane's process has exited. */
export async function isPaneDead(paneId: string): Promise<boolean> {
  const result = await tmux("list-panes", "-t", paneId, "-F", "#{pane_dead}");
  return result === "1";
}

/** Get the exit status of a dead pane's process. */
export async function getPaneExitStatus(paneId: string): Promise<number> {
  const result = await tmux("list-panes", "-t", paneId, "-F", "#{pane_dead_status}");
  return parseInt(result, 10) || 1;
}

/** Capture the last N lines of a pane's visible output. */
export async function capturePane(paneId: string, lines = 50): Promise<string> {
  return tmux("capture-pane", "-t", paneId, "-p", "-S", `-${lines}`);
}

/** Kill and respawn a pane with a fresh shell. */
export async function respawnPane(paneId: string): Promise<void> {
  await tmux("respawn-pane", "-k", "-t", paneId);
}

/** Kill a pane entirely. */
export async function killPane(paneId: string): Promise<void> {
  try {
    await tmux("kill-pane", "-t", paneId);
  } catch {
    // Pane already gone
  }
}

/** Kill a pane synchronously (for use in exit handlers). */
export function killPaneSync(paneId: string): void {
  try {
    execFileSync("tmux", ["kill-pane", "-t", paneId]);
  } catch {
    // Pane already gone
  }
}

/** Kill the current tmux session synchronously (for use in exit handlers). */
export function killSessionSync(): void {
  try {
    execFileSync("tmux", ["kill-session"]);
  } catch {
    // Session already gone
  }
}

/** Set a tmux option on a specific pane. */
export async function setPaneOption(paneId: string, option: string, value: string): Promise<void> {
  await tmux("set-option", "-t", paneId, option, value);
}
