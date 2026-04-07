#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, readdirSync, lstatSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { AW_DIR } from './types.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { App } from './app.js';
import { loadWorkflowByName, listWorkflows } from './workflows/loader.js';
import { createAgentRegistry } from './agents/registry.js';
import type { Workflow, AwConfig } from './types.js';
import { initTmux } from './tmux/lifecycle.js';
import { killPaneSync, killSessionSync } from './tmux/pane.js';
import yaml from 'js-yaml';

const cwd = process.cwd();

const DEFAULT_CONFIG: AwConfig = {
  editor: process.env.EDITOR || "vim",
  agents: { claude: { command: "claude" }, codex: { command: "codex" } },
};

function loadConfig(dir: string): AwConfig {
  const configPath = join(dir, AW_DIR, "config.yaml");
  if (!existsSync(configPath)) return DEFAULT_CONFIG;
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = yaml.load(raw) as Partial<AwConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      agents: { ...DEFAULT_CONFIG.agents, ...(parsed.agents || {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const awRoot = join(__dirname, '..');

const cwdWorkflowsDir = join(cwd, 'workflows');
const bundledWorkflowsDir = join(awRoot, 'workflows');
const bundledSkillsDir = join(awRoot, 'skills');

/**
 * Ensure Claude Code's Stop hook is configured in the project's
 * .claude/settings.local.json. The hook writes .aw/stop-signal after each
 * assistant turn, which is how waitForStepComplete knows a step is done.
 */
function ensureStopHook(projectCwd: string): void {
  const claudeDir = join(projectCwd, ".claude");
  const settingsPath = join(claudeDir, "settings.local.json");

  let settings: Record<string, unknown> = {};
  try {
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    }
  } catch {
    // Unreadable or malformed — start fresh
  }

  const hooks = (settings.hooks as Record<string, unknown> | undefined) ?? {};
  const stopHooks = (hooks.Stop as unknown[] | undefined) ?? [];

  // Check if our stop-signal hook is already present
  const alreadyConfigured = stopHooks.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const innerHooks = (entry as Record<string, unknown>).hooks as unknown[] | undefined;
    return innerHooks?.some((h: unknown) => {
      const cmd = (h as Record<string, unknown>)?.command;
      return typeof cmd === "string" && cmd.includes("stop-signal");
    });
  });

  if (alreadyConfigured) return;

  hooks.Stop = [
    ...stopHooks,
    {
      matcher: "",
      hooks: [{ type: "command", command: "mkdir -p .aw && touch .aw/stop-signal" }],
    },
  ];
  settings.hooks = hooks;

  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * Ensure Codex's Stop hook is configured in the project's .codex/hooks.json.
 * Mirrors the CC stop hook — writes .aw/stop-signal after each turn.
 */
function ensureCodexStopHook(projectCwd: string): void {
  const codexDir = join(projectCwd, ".codex");
  const hooksPath = join(codexDir, "hooks.json");

  let config: Record<string, unknown> = {};
  try {
    if (existsSync(hooksPath)) {
      config = JSON.parse(readFileSync(hooksPath, "utf-8"));
    }
  } catch {
    // Unreadable or malformed — start fresh
  }

  const hooks = (config.hooks as unknown[] | undefined) ?? [];

  // Check if our stop-signal hook is already present
  const alreadyConfigured = hooks.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const handlers = (entry as Record<string, unknown>).handlers as unknown[] | undefined;
    return handlers?.some((h: unknown) => {
      const cmd = (h as Record<string, unknown>)?.command;
      return typeof cmd === "string" && cmd.includes("stop-signal");
    });
  });

  if (alreadyConfigured) return;

  hooks.push({
    event: "Stop",
    handlers: [
      { type: "command", command: "mkdir -p .aw && touch .aw/stop-signal" },
    ],
  });
  config.hooks = hooks;

  mkdirSync(codexDir, { recursive: true });
  writeFileSync(hooksPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Symlink bundled skills into the target project's .claude/skills/ directory.
 * Skips skills that already exist (user may have customized them).
 * Returns the list of symlinks created (for cleanup).
 */
function symlinkSkills(targetCwd: string, workflow: Workflow): string[] {
  const targetSkillsDir = join(targetCwd, ".claude", "skills");
  const created: string[] = [];

  // Symlink all skills from the workflow's matching skills directory
  // (e.g. workflow "greenfield" → skills/greenfield/*)
  // This picks up both step-referenced skills and utility skills
  // invoked indirectly by other skills.
  const workflowSkillsDir = join(bundledSkillsDir, workflow.name.toLowerCase().replace(/\s+/g, '-'));
  try {
    for (const name of readdirSync(workflowSkillsDir)) {
      const sourcePath = join(workflowSkillsDir, name);
      if (!existsSync(join(sourcePath, "SKILL.md"))) continue;

      const targetPath = join(targetSkillsDir, name);
      if (existsSync(targetPath)) continue;

      mkdirSync(targetSkillsDir, { recursive: true });
      try {
        symlinkSync(sourcePath, targetPath);
        created.push(targetPath);
      } catch {
        // Symlink failed — skip
      }
    }
  } catch {
    // Workflow skills directory doesn't exist — fall through
  }

  return created;
}

/** Remove symlinks created by symlinkSkills. */
function cleanupSymlinks(paths: string[]): void {
  for (const p of paths) {
    try {
      const stat = lstatSync(p);
      if (stat.isSymbolicLink()) unlinkSync(p);
    } catch {}
  }
}

function resolveWorkflowsDir(): string {
  if (existsSync(cwdWorkflowsDir)) return cwdWorkflowsDir;
  if (existsSync(bundledWorkflowsDir)) return bundledWorkflowsDir;
  process.stderr.write('No workflows directory found. Expected: workflows/ in current directory.\n');
  process.exit(1);
}

const workflowDir = resolveWorkflowsDir();

const availableWorkflows = listWorkflows(workflowDir);
if (availableWorkflows.length === 0) {
  process.stderr.write(`No workflow files found in ${workflowDir}\n`);
  process.exit(1);
}

(async () => {
  // tmux is required
  if (!process.env.TMUX) {
    process.stderr.write('aw must run inside tmux. Start with:\n  tmux new-session -s aw\n  (aw = Agentic Workflows)\n');
    process.exit(1);
  }

  const tmuxContext = await initTmux();

  // Clean up on exit: remove symlinks, kill the right pane, kill the tmux session
  const cleanup = () => {
    cleanupSymlinks(createdSymlinks);
    killPaneSync(tmuxContext.rightPaneId);
    killSessionSync();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  const config = loadConfig(cwd);
  const agentRegistry = createAgentRegistry(config.agents);
  const availableAgents = await agentRegistry.getAvailable();

  if (availableAgents.length === 0) {
    process.stderr.write('No agents available. Please install claude or codex.\n');
    cleanup();
    process.exit(1);
  }

  mkdirSync(join(cwd, AW_DIR), { recursive: true });
  ensureStopHook(cwd);
  ensureCodexStopHook(cwd);
  const lastUsedPath = join(cwd, AW_DIR, "last-workflow");
  const lastUsed = (() => { try { return readFileSync(lastUsedPath, "utf-8").trim(); } catch { return ""; } })();
  const defaultWorkflow = availableWorkflows.includes(lastUsed) ? lastUsed : availableWorkflows[0];

  let currentWorkflow: Workflow = loadWorkflowByName(workflowDir, defaultWorkflow);
  try { writeFileSync(lastUsedPath, defaultWorkflow, "utf-8"); } catch {}

  // Symlink bundled skills into the target project's .claude/skills/
  let createdSymlinks = symlinkSkills(cwd, currentWorkflow);

  function handleSwitchWorkflow(name: string) {
    // Clean up old symlinks before switching
    cleanupSymlinks(createdSymlinks);
    currentWorkflow = loadWorkflowByName(workflowDir, name);
    createdSymlinks = symlinkSkills(cwd, currentWorkflow);
    try { writeFileSync(lastUsedPath, name, "utf-8"); } catch {}
    rerender(
      React.createElement(App, {
        workflow: currentWorkflow,
        cwd,
        awRoot,
        availableWorkflows,
        defaultAgent: currentWorkflow.agent ?? availableAgents[0],
        agentRegistry,
        onSwitchWorkflow: handleSwitchWorkflow,
        config,
        tmuxContext,
      })
    );
  }

  const { rerender } = render(
    React.createElement(App, {
      workflow: currentWorkflow,
      cwd,
      awRoot,
      availableWorkflows,
      defaultAgent: currentWorkflow.agent ?? availableAgents[0],
      agentRegistry,
      onSwitchWorkflow: handleSwitchWorkflow,
      config,
      tmuxContext,
    }),
    { exitOnCtrlC: true }
  );
})();
