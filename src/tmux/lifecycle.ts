import { getCurrentPaneId, splitWindow, killPane } from "./pane.js";

export interface TmuxContext {
  rightPaneId: string;
  leftPaneId: string;
}

/**
 * Initialize the tmux layout: split the current pane to create a right pane
 * for the agent CLI. Must be called from inside a tmux session.
 */
export async function initTmux(rightPercent = 70): Promise<TmuxContext> {
  if (!process.env.TMUX) {
    throw new Error("Not inside a tmux session. Start with: tmux new-session -s aw (Agentic Workflows)");
  }

  const leftPaneId = await getCurrentPaneId();
  const rightPaneId = await splitWindow(leftPaneId, rightPercent);

  return { rightPaneId, leftPaneId };
}

/** Clean up the right pane on exit. */
export async function cleanupTmux(ctx: TmuxContext): Promise<void> {
  await killPane(ctx.rightPaneId);
}
