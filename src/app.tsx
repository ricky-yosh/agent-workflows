import React, { useState, useEffect, useRef } from 'react';
import { useInput } from 'ink';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { Layout } from './components/Layout.js';
import { Sidebar } from './components/Sidebar.js';
import { KeyBar } from './components/KeyBar.js';
import { TabBar } from './components/TabBar.js';
import type { TabInfo } from './components/TabBar.js';
import { SelectPrompt } from './components/SelectPrompt.js';
import type { SelectOption } from './components/SelectPrompt.js';
import { ChecklistPrompt } from './components/ChecklistPrompt.js';
import type { ChecklistItem } from './components/ChecklistPrompt.js';
import type { Workflow, WorkflowState, AwConfig } from './types.js';
import { discoverSkills, applySkillLinks, autoLinkGenericSkills } from './workflows/skills.js';
import type { ViewMode } from './types.js';
import type { AgentRegistry } from './agents/registry.js';
import { createInitialState, loadState, saveState, completeStep, skipStep, getStepState, getDownstreamSteps, invalidateStep, resetState } from './workflows/state.js';
import { loadTasks, getNextIncompleteTask } from './workflows/tasks.js';
import type { Task } from './workflows/tasks.js';
import { runStep } from './workflows/runner.js';
import { getParallelStepGroup } from './workflows/parallel.js';
import { runParallelGroup } from './workflows/parallel-runner.js';
import type { TmuxContext } from './tmux/lifecycle.js';
import { sendKeys, sendInterrupt, sendExit, focusPane, killPane, respawnPane } from './tmux/pane.js';
import { cleanupAllSignals, shouldSkipStep } from './workflows/signal.js';

const KEY_BINDINGS = [
  { key: '↑↓', label: 'nav' },
  { key: '⏎', label: 'run' },
  { key: 'c', label: 'cont' },
  { key: 'i', label: 'focus' },
  { key: 'esc', label: 'stop' },
  { key: 't', label: 'task' },
  { key: 'r', label: 'reset' },
  { key: 'w', label: 'wkfl' },
  { key: 'd', label: 'docs' },
  { key: 'l', label: 'link' },
  { key: 'q', label: 'quit' },
];

interface AppProps {
  workflow: Workflow;
  cwd: string;
  awRoot: string;
  availableWorkflows: string[];
  defaultAgent: string;
  agentRegistry: AgentRegistry;
  onSwitchWorkflow: (name: string) => void;
  config: AwConfig;
  tmuxContext: TmuxContext;
}

export function App({ workflow, cwd, awRoot, availableWorkflows, defaultAgent, agentRegistry, onSwitchWorkflow, tmuxContext }: AppProps): React.ReactElement {
  const [workflowState, setWorkflowState] = useState<WorkflowState>(() => {
    const saved = loadState(cwd, workflow.name);
    if (saved && saved.workflowName === workflow.name) return saved;
    return createInitialState(workflow);
  });

  const positionRestored = workflowState.workflowName === workflow.name &&
    workflowState.steps.some((s) => s.status === "completed");

  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(workflowState.currentPhase);
  const [selectedStepIndex, setSelectedStepIndex] = useState(workflowState.currentStep);

  const [viewMode, setViewMode] = useState<ViewMode>("workflow");
  const [selectTitle, setSelectTitle] = useState("");
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([]);
  const [selectCallback, setSelectCallback] = useState<((v: string) => void) | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCallback, setChecklistCallback] = useState<((selections: Map<string, boolean>) => void) | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);

  // Parallel tab state
  const [parallelTabs, setParallelTabs] = useState<{ stepIndex: number; stepName: string; paneId: string; status: TabInfo['status'] }[] | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Session ID persists across steps within a phase for --resume
  const sessionIdRef = useRef<string | undefined>(undefined);
  const sessionPhaseRef = useRef<number | null>(null);
  const lastAgentRef = useRef<string | null>(null);
  // Whether the agent CLI is currently running in the right pane
  const agentRunningRef = useRef(false);
  const runIdRef = useRef(0);
  const lastSavedRef = useRef<{ phase: number; step: number }>({ phase: workflowState.currentPhase, step: workflowState.currentStep });

  // Auto-link generic skills (shared utilities like create-digest)
  // Link into awRoot and also into cwd when it's a different repo (e.g., a worktree)
  useEffect(() => {
    autoLinkGenericSkills(awRoot);
    if (cwd !== awRoot) {
      autoLinkGenericSkills(awRoot, cwd);
    }
  }, [awRoot, cwd]);

  // Reset state when switching workflows (useState initializer only runs on mount)
  useEffect(() => {
    const saved = loadState(cwd, workflow.name);
    const newState = saved && saved.workflowName === workflow.name
      ? saved
      : createInitialState(workflow);
    setWorkflowState(newState);
    setSelectedPhaseIndex(newState.currentPhase);
    setSelectedStepIndex(newState.currentStep);
    lastSavedRef.current = { phase: newState.currentPhase, step: newState.currentStep };
    sessionIdRef.current = undefined;
    sessionPhaseRef.current = null;
    lastAgentRef.current = null;
  }, [workflow.name]);

  useEffect(() => {
    setWorkflowState((prev) => ({
      ...prev,
      currentPhase: selectedPhaseIndex,
      currentStep: selectedStepIndex,
    }));
  }, [selectedPhaseIndex, selectedStepIndex]);

  useEffect(() => {
    const last = lastSavedRef.current;
    if (last.phase === selectedPhaseIndex && last.step === selectedStepIndex) return;
    lastSavedRef.current = { phase: selectedPhaseIndex, step: selectedStepIndex };
    saveState(cwd, { ...workflowState, currentPhase: selectedPhaseIndex, currentStep: selectedStepIndex });
  }, [selectedPhaseIndex, selectedStepIndex]);

  const progressDir = workflow.progress_dir ?? "";

  // Reload tasks whenever the selected phase changes or a step completes
  const refreshTasks = () => {
    const phase = workflow.phases[selectedPhaseIndex];
    if (phase?.loop && progressDir) {
      const loaded = loadTasks(cwd, progressDir);
      setTasks(loaded);
      if (loaded?.length && !highlightedTaskId) {
        const next = getNextIncompleteTask(cwd, progressDir);
        setHighlightedTaskId(next?.id ?? loaded[0].id);
      }
    } else {
      setTasks(null);
      setHighlightedTaskId(null);
    }
  };

  useEffect(refreshTasks, [selectedPhaseIndex]);

  // Don't auto-show task details — the sidebar checklist is enough.
  // The `t` key shows a compact one-liner in the status bar.

  useInput((input, key) => {
    if (viewMode !== "workflow") return;

    if (key.escape && isRunning) {
      const parallelPanes = parallelTabs?.map((t) => t.paneId) ?? [];
      if (parallelPanes.length > 0) {
        for (const paneId of parallelPanes) {
          sendInterrupt(paneId);
        }
        for (const paneId of parallelPanes) {
          if (paneId !== tmuxContext.rightPaneId) {
            killPane(paneId);
          }
        }
      } else {
        sendInterrupt(tmuxContext.rightPaneId);
      }
      setIsAutoAdvancing(false);
      setIsRunning(false);
      agentRunningRef.current = false;
      sessionIdRef.current = undefined;
      setParallelTabs(null);
      setActiveTabIndex(0);
      setStatusMessage("Step cancelled.");
      return;
    }

    // Continue: send "continue" to the agent pane
    if (input === 'c' && isRunning) {
      sendKeys(tmuxContext.rightPaneId, "continue");
      return;
    }

    // Focus: switch keyboard focus to the agent pane (or active parallel tab's pane)
    if (input === 'i') {
      if (parallelTabs && parallelTabs.length > 0) {
        focusPane(parallelTabs[activeTabIndex].paneId);
      } else {
        focusPane(tmuxContext.rightPaneId);
      }
      return;
    }

    // Tab switching for parallel steps
    if (parallelTabs && parallelTabs.length > 0) {
      // Number keys 1-9 jump to specific tab
      const num = parseInt(input, 10);
      if (num >= 1 && num <= parallelTabs.length) {
        const newIdx = num - 1;
        setActiveTabIndex(newIdx);
        focusPane(parallelTabs[newIdx].paneId);
        return;
      }
      // Tab key cycles forward
      if (key.tab) {
        const newIdx = (activeTabIndex + 1) % parallelTabs.length;
        setActiveTabIndex(newIdx);
        focusPane(parallelTabs[newIdx].paneId);
        return;
      }
    }

    // Run step
    if (key.return) {
      const step = workflow.phases[selectedPhaseIndex]?.steps[selectedStepIndex];
      if (!step) return;

      if (isRunning) {
        runIdRef.current++;
      }

      setIsAutoAdvancing(false);

      const executeStep = (stepToRun: typeof step, opts: { phaseIdx?: number; stepIdx?: number; freshSession?: boolean } = {}) => {
        const phaseIdx = opts.phaseIdx ?? selectedPhaseIndex;
        const stepIdx = opts.stepIdx ?? selectedStepIndex;
        const freshSession = opts.freshSession ?? false;

        const resolvedAgentName = stepToRun.agent ?? workflow.phases[phaseIdx]?.agent ?? workflow.agent ?? defaultAgent;
        const agent = agentRegistry.get(resolvedAgentName);
        if (!agent) {
          setStatusMessage(`Agent "${resolvedAgentName}" not available.`);
          return;
        }

        // Phase boundary or agent switch — clear session when switching
        const isPhaseChange = sessionPhaseRef.current !== null && sessionPhaseRef.current !== phaseIdx;
        const isAgentSwitch = lastAgentRef.current !== null && lastAgentRef.current !== resolvedAgentName;
        if (isPhaseChange || isAgentSwitch || freshSession) {
          agentRunningRef.current = false;
          sessionIdRef.current = undefined;
        }
        sessionPhaseRef.current = phaseIdx;
        lastAgentRef.current = resolvedAgentName;

        const thisRunId = ++runIdRef.current;
        setIsRunning(true);
        setStatusMessage(`Running: ${stepToRun.name}`);

        runStep(stepToRun, {
          cwd,
          agent,
          tmux: tmuxContext,
          progressDir: workflow.progress_dir,
          resumeSessionId: sessionIdRef.current,
          agentRunning: agentRunningRef.current,
          awRoot,
        }).then((result) => {
          if (thisRunId !== runIdRef.current) return;

          // Track agent state — both CC and Codex (interactive) stay running.
          // Agent switch between steps is handled by isAgentSwitch above.
          if (result.sessionId) sessionIdRef.current = result.sessionId;
          agentRunningRef.current = true;

          if (result.skipped) {
            setIsRunning(false);
            setIsAutoAdvancing(false);
            setStatusMessage(`"${stepToRun.name}" is a user input step.`);
            return;
          }

          setWorkflowState((prev) => completeStep(prev, phaseIdx, stepIdx, {
            agent: resolvedAgentName,
            sessionId: result.sessionId,
            outputFiles: result.outputFiles,
          }));

          // Refresh task checklist after each step so the sidebar stays current
          refreshTasks();

          // Auto-advance: next step in phase
          const phase = workflow.phases[phaseIdx];
          let nextIdx = stepIdx + 1;

          // Skip steps whose skip_when condition is met (e.g., triage says no tests needed)
          const skippedIndices: number[] = [];
          while (nextIdx < phase.steps.length) {
            const candidate = phase.steps[nextIdx];
            if (candidate.skip_when && progressDir && shouldSkipStep(cwd, progressDir, candidate.skip_when)) {
              skippedIndices.push(nextIdx);
              nextIdx++;
            } else {
              break;
            }
          }

          if (skippedIndices.length > 0) {
            const skippedNames = skippedIndices.map(i => phase.steps[i].name).join(", ");
            setWorkflowState((prev) => {
              let next = prev;
              for (const si of skippedIndices) {
                next = skipStep(next, phaseIdx, si);
              }
              return next;
            });
            setStatusMessage(`✓ ${stepToRun.name} — skipped ${skippedNames}`);
          }

          if (result.exitCode === 0 && nextIdx < phase.steps.length) {
            const nextStep = phase.steps[nextIdx];
            setSelectedStepIndex(nextIdx);
            setIsAutoAdvancing(true);
            if (skippedIndices.length === 0) {
              setStatusMessage(`✓ ${stepToRun.name} — advancing…`);
            }

            // Check if next step is parallel — dispatch to parallel group
            if (nextStep.parallel) {
              const groupIndices = getParallelStepGroup(phase, nextIdx);
              if (groupIndices.length > 0) {
                setTimeout(() => executeParallelGroupFn(phaseIdx, groupIndices), 500);
              } else {
                setTimeout(() => executeStep(nextStep, { phaseIdx, stepIdx: nextIdx }), 500);
              }
            } else {
              setTimeout(() => executeStep(nextStep, { phaseIdx, stepIdx: nextIdx }), 500);
            }
          } else if (result.exitCode === 0 && !phase.loop && phaseIdx < workflow.phases.length - 1) {
            // Cross-phase auto-advance
            const nextPhaseIdx = phaseIdx + 1;
            const nextPhase = workflow.phases[nextPhaseIdx];
            setSelectedPhaseIndex(nextPhaseIdx);
            setSelectedStepIndex(0);
            setIsAutoAdvancing(true);
            setStatusMessage(`✓ Phase "${phase.name}" done — advancing…`);
            setTimeout(() => executeStep(nextPhase.steps[0], { phaseIdx: nextPhaseIdx, stepIdx: 0 }), 500);
          } else if (result.exitCode === 0 && phase.loop) {
            // Loop phase: check if all tasks are complete before restarting
            const nextTask = getNextIncompleteTask(cwd, progressDir);

            if (nextTask === null) {
              // All tasks complete — exit loop
              if (phaseIdx < workflow.phases.length - 1) {
                const nextPhaseIdx = phaseIdx + 1;
                const nextPhase = workflow.phases[nextPhaseIdx];
                setSelectedPhaseIndex(nextPhaseIdx);
                setSelectedStepIndex(0);
                setIsAutoAdvancing(true);
                setStatusMessage(`✓ All tasks complete — advancing to "${nextPhase.name}"…`);
                setTimeout(() => executeStep(nextPhase.steps[0], { phaseIdx: nextPhaseIdx, stepIdx: 0 }), 500);
              } else {
                setIsRunning(false);
                setIsAutoAdvancing(false);
                setStatusMessage("✓ All tasks complete — workflow finished!");
              }
            } else {
              // Tasks remain — restart loop iteration
              const iteration = (workflowState.loopIterations[phaseIdx] ?? 0) + 1;

              setWorkflowState((prev) => ({
                ...prev,
                loopIterations: { ...prev.loopIterations, [phaseIdx]: iteration },
                steps: prev.steps.map((s) =>
                  s.phaseIndex === phaseIdx ? { ...s, status: "pending" as const, completedAt: undefined, startedAt: undefined } : s
                ),
              }));

              setSelectedStepIndex(0);
              setIsAutoAdvancing(true);
              setStatusMessage(`✓ Loop iteration ${iteration} — restarting…`);
              setTimeout(() => executeStep(phase.steps[0], { phaseIdx, stepIdx: 0, freshSession: true }), 500);
            }
          } else {
            setIsRunning(false);
            setIsAutoAdvancing(false);
            setStatusMessage(
              result.exitCode === 0
                ? `✓ ${stepToRun.name} (${Math.round(result.duration / 1000)}s)`
                : `✗ ${stepToRun.name} failed`
            );
          }
        });
      };

      // --- Parallel group execution ---
      const executeParallelGroupFn = (phaseIdx: number, groupIndices: number[]) => {
        const phase = workflow.phases[phaseIdx];
        const groupSteps = groupIndices.map((i) => phase.steps[i]);
        const resolvedAgentName = phase.agent ?? workflow.agent ?? defaultAgent;
        const agent = agentRegistry.get(resolvedAgentName);
        if (!agent) {
          setStatusMessage(`Agent "${resolvedAgentName}" not available.`);
          return;
        }

        // Clear session state — parallel always uses fresh sessions
        sessionIdRef.current = undefined;
        agentRunningRef.current = false;

        const thisRunId = ++runIdRef.current;
        setIsRunning(true);
        setActiveTabIndex(0);
        setStatusMessage(`Running ${groupIndices.length} steps in parallel...`);

        runParallelGroup(groupSteps, groupIndices, {
          cwd,
          agent,
          tmux: tmuxContext,
          phaseIndex: phaseIdx,
          progressDir: workflow.progress_dir,
          onStart: (paneIds) => {
            setParallelTabs(groupIndices.map((idx, i) => ({
              stepIndex: idx,
              stepName: phase.steps[idx].name,
              paneId: paneIds[i],
              status: 'running' as const,
            })));
          },
        }).then(({ group, allSucceeded }) => {
          if (thisRunId !== runIdRef.current) return;

          // Clear session state and tab bar after parallel run
          sessionIdRef.current = undefined;
          agentRunningRef.current = false;
          setParallelTabs(null);
          setActiveTabIndex(0);

          // Mark all steps in one setWorkflowState call to avoid batching issues
          setWorkflowState((prev) => {
            let next = prev;
            for (const stepState of group.steps) {
              if (stepState.status === "completed") {
                next = completeStep(next, phaseIdx, stepState.stepIndex, {
                  agent: resolvedAgentName,
                  sessionId: stepState.sessionId,
                  outputFiles: phase.steps[stepState.stepIndex]?.outputs || [],
                });
              }
            }
            return next;
          });

          if (allSucceeded) {
            // Advance past the group
            const lastGroupIdx = groupIndices[groupIndices.length - 1];
            const nextIdx = lastGroupIdx + 1;

            if (nextIdx < phase.steps.length) {
              const nextStep = phase.steps[nextIdx];
              setSelectedStepIndex(nextIdx);
              setIsAutoAdvancing(true);
              setStatusMessage(`✓ Parallel group done — advancing…`);

              // Check if next step is also parallel
              if (nextStep.parallel) {
                const nextGroup = getParallelStepGroup(phase, nextIdx);
                setTimeout(() => executeParallelGroupFn(phaseIdx, nextGroup), 500);
              } else {
                setTimeout(() => executeStep(nextStep, { phaseIdx, stepIdx: nextIdx }), 500);
              }
            } else if (!phase.loop && phaseIdx < workflow.phases.length - 1) {
              // Cross-phase advance
              const nextPhaseIdx = phaseIdx + 1;
              const nextPhase = workflow.phases[nextPhaseIdx];
              setSelectedPhaseIndex(nextPhaseIdx);
              setSelectedStepIndex(0);
              setIsAutoAdvancing(true);
              setStatusMessage(`✓ Phase "${phase.name}" done — advancing…`);
              setTimeout(() => executeStep(nextPhase.steps[0], { phaseIdx: nextPhaseIdx, stepIdx: 0 }), 500);
            } else {
              setIsRunning(false);
              setIsAutoAdvancing(false);
              setStatusMessage(`✓ Parallel group complete`);
            }
          } else {
            // Some steps failed — pause
            setIsRunning(false);
            setIsAutoAdvancing(false);
            const failedNames = group.steps
              .filter((s) => s.status === "failed")
              .map((s) => s.stepName)
              .join(", ");
            setStatusMessage(`✗ Parallel steps failed: ${failedNames}`);
          }
        });
      };

      // Check for re-run confirmation
      const stepState = getStepState(workflowState, selectedPhaseIndex, selectedStepIndex);
      if (stepState?.status === "completed") {
        const downstream = getDownstreamSteps(workflow, selectedPhaseIndex, selectedStepIndex);
        if (downstream.length > 0) {
          setViewMode("select");
          setSelectTitle(`Re-running "${step.name}" may invalidate ${downstream.length} downstream step(s).`);
          setSelectOptions([
            { label: "Re-run this step only", value: "this" },
            { label: "Re-run this step + all downstream", value: "cascade" },
            { label: "Cancel", value: "cancel" },
          ]);
          setSelectCallback(() => (value: string) => {
            setViewMode("workflow");
            if (value === "cancel") return;
            if (value === "cascade") {
              let newState = workflowState;
              for (const ds of downstream) {
                newState = invalidateStep(newState, ds.phaseIndex, ds.stepIndex);
              }
              setWorkflowState(newState);
            }
            executeStep(step, { freshSession: true });
          });
          return;
        }
      }

      // Check if this is a parallel step — dispatch to parallel group
      if (step.parallel) {
        const phase = workflow.phases[selectedPhaseIndex];
        const groupIndices = getParallelStepGroup(phase, selectedStepIndex);
        if (groupIndices.length > 0) {
          executeParallelGroupFn(selectedPhaseIndex, groupIndices);
          return;
        }
      }

      executeStep(step);
      return;
    }

    // Quit
    if (input === 'q') {
      process.exit(0);
      return;
    }

    // Reset workflow
    if (input === 'r' && !isRunning) {
      setSelectTitle(`Reset workflow "${workflow.name}"? All progress will be cleared.`);
      setSelectOptions([
        { label: "Yes, reset", value: "reset" },
        { label: "Cancel", value: "cancel" },
      ]);
      setSelectCallback(() => (value: string) => {
        setViewMode("workflow");
        if (value === "cancel") return;

        respawnPane(tmuxContext.rightPaneId);
        sessionIdRef.current = undefined;
        sessionPhaseRef.current = null;
        lastAgentRef.current = null;
        agentRunningRef.current = false;
        runIdRef.current++;

        cleanupAllSignals(cwd);

        const freshState = resetState(cwd, workflow);
        setWorkflowState(freshState);
        saveState(cwd, freshState);

        setSelectedPhaseIndex(0);
        setSelectedStepIndex(0);
        setParallelTabs(null);
        setActiveTabIndex(0);
        setStatusMessage("Workflow reset.");
      });
      setViewMode("select");
      return;
    }

    // Switch workflow
    if (input === 'w') {
      setSelectTitle("Switch Workflow");
      setSelectOptions(availableWorkflows.map((name) => ({ label: name, value: name })));
      setSelectCallback(() => (name: string) => { onSwitchWorkflow(name); });
      setViewMode("select");
      return;
    }

    // Cycle tasks — highlight next and show one-liner in status.
    // Pressing t past the last task dismisses the highlight and status.
    if (input === 't' && tasks?.length) {
      const currentIdx = tasks.findIndex((t) => t.id === highlightedTaskId);
      const nextIdx = currentIdx + 1;
      if (nextIdx >= tasks.length) {
        // Wrapped past end — dismiss
        setHighlightedTaskId(null);
        setStatusMessage(null);
      } else {
        const task = tasks[nextIdx];
        setHighlightedTaskId(task.id);
        const done = task.done ? "done" : "pending";
        setStatusMessage(`Task ${task.id}: ${task.description} (${done})`);
      }
      return;
    }

    // Generate docs (always available, even while a step is running)
    if (input === 'd') {
      setStatusMessage("Generating docs...");
      const scriptPath = join(awRoot, "scripts", "generate-docs.js");
      execFile("node", [scriptPath], { cwd }, (error) => {
        if (error) {
          setStatusMessage(`Docs error: ${error.message}`);
        } else {
          setStatusMessage("Docs generated.");
          const docsPath = join(cwd, ".aw", "docs", "index.html");
          execFile("open", [docsPath], () => {});
        }
      });
      return;
    }

    // Skill linker
    if (input === 'l') {
      const skills = discoverSkills(awRoot);
      if (skills.length === 0) {
        setStatusMessage("No skills found.");
        return;
      }
      setChecklistItems(skills.map((s) => ({
        label: `${s.category}/${s.name}`,
        value: s.name,
        checked: s.linked,
      })));
      setChecklistCallback(() => (selections: Map<string, boolean>) => {
        const freshSkills = discoverSkills(awRoot);
        applySkillLinks(freshSkills, selections);
        const linked = [...selections.values()].filter(Boolean).length;
        setStatusMessage(`Skills updated (${linked} linked).`);
        setViewMode("workflow");
        setChecklistCallback(null);
      });
      setViewMode("checklist");
      return;
    }

    // Navigation
    const phase = workflow.phases[selectedPhaseIndex];
    if (!phase) return;

    if (key.upArrow) {
      if (selectedStepIndex > 0) {
        setSelectedStepIndex(selectedStepIndex - 1);
      } else if (selectedPhaseIndex > 0) {
        const prevPhase = workflow.phases[selectedPhaseIndex - 1];
        setSelectedPhaseIndex(selectedPhaseIndex - 1);
        setSelectedStepIndex(prevPhase.steps.length - 1);
      }
    }

    if (key.downArrow) {
      if (selectedStepIndex < phase.steps.length - 1) {
        setSelectedStepIndex(selectedStepIndex + 1);
      } else if (selectedPhaseIndex < workflow.phases.length - 1) {
        setSelectedPhaseIndex(selectedPhaseIndex + 1);
        setSelectedStepIndex(0);
      }
    }
  });

  // Build the overlay for select prompts
  let overlay: React.ReactNode | undefined;
  if (viewMode === "select" && selectCallback) {
    overlay = (
      <SelectPrompt
        title={selectTitle}
        options={selectOptions}
        onSelect={(v) => { selectCallback(v); setSelectCallback(null); setViewMode("workflow"); }}
        onCancel={() => { setViewMode("workflow"); setSelectCallback(null); }}
      />
    );
  } else if (viewMode === "checklist" && checklistCallback) {
    overlay = (
      <ChecklistPrompt
        title="Link Skills to ~/.claude/skills/"
        items={checklistItems}
        onConfirm={(selections) => { checklistCallback(selections); }}
        onCancel={() => { setViewMode("workflow"); setChecklistCallback(null); }}
      />
    );
  }

  const tabBar = parallelTabs && parallelTabs.length > 0 ? (
    <TabBar
      tabs={parallelTabs.map((t) => ({ label: t.stepName, status: t.status }))}
      activeIndex={activeTabIndex}
    />
  ) : undefined;

  return (
    <Layout
      sidebar={
        <Sidebar
          workflow={workflow}
          state={workflowState}
          selectedPhase={selectedPhaseIndex}
          selectedStep={selectedStepIndex}
          defaultAgent={workflow.agent ?? defaultAgent}
          tasks={tasks}
          highlightedTaskId={highlightedTaskId}
          isAutoAdvancing={isAutoAdvancing}
          parallelStepIndices={parallelTabs?.map((t) => t.stepIndex) ?? null}
          activeParallelStep={parallelTabs ? parallelTabs[activeTabIndex]?.stepIndex ?? null : null}
        />
      }
      tabBar={tabBar}
      overlay={overlay}
      statusLine={statusMessage ?? undefined}
      footer={<KeyBar bindings={KEY_BINDINGS} />}
    />
  );
}
