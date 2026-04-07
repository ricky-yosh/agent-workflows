import React from 'react';
import { Box, Text } from 'ink';
import type { Workflow, WorkflowState, StepState } from '../types.js';
import type { Task } from '../workflows/tasks.js';
import { statusIcon, statusColor } from './statusHelpers.js';

interface SidebarProps {
  workflow: Workflow;
  state: WorkflowState;
  selectedPhase: number;
  selectedStep: number;
  defaultAgent: string;
  tasks?: Task[] | null;
  highlightedTaskId?: number | null;
  isAutoAdvancing?: boolean;
  /** Step indices in the active parallel group (if any). */
  parallelStepIndices?: number[] | null;
  /** The step index of the currently focused parallel tab. */
  activeParallelStep?: number | null;
}

type StepStatus = StepState["status"] | "pending";

export function Sidebar({
  workflow,
  state,
  selectedPhase,
  selectedStep,
  defaultAgent,
  tasks,
  highlightedTaskId,
  isAutoAdvancing,
  parallelStepIndices,
  activeParallelStep,
}: SidebarProps): React.ReactElement {
  const doneCount = tasks?.filter((t) => t.done).length ?? 0;
  const totalCount = tasks?.length ?? 0;
  const hasTasks = tasks && tasks.length > 0;

  return (
    <Box flexDirection="column" justifyContent="space-between" height="100%">
      {/* Top: workflow phases + steps */}
      <Box flexDirection="column">
        {workflow.phases.map((phase, pi) => {
          const isSelectedPhase = pi === selectedPhase;
          const isLoopPhase = !!phase.loop;
          return (
            <Box key={pi} flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <Text bold={isSelectedPhase} color={isSelectedPhase ? 'cyan' : undefined}>
                  {isSelectedPhase ? '▶' : ' '} {phase.name}
                </Text>
                {isSelectedPhase && isAutoAdvancing && (
                  <Text color="green" bold>▶▶</Text>
                )}
                {isLoopPhase && totalCount > 0 && (
                  <Text dimColor>({doneCount}/{totalCount})</Text>
                )}
                {isLoopPhase && totalCount === 0 && (state.loopIterations[pi] ?? 0) > 0 && (
                  <Text dimColor>(x{state.loopIterations[pi]})</Text>
                )}
                {phase.agent && (
                  <Text dimColor>[{phase.agent}]</Text>
                )}
              </Box>

              {isSelectedPhase && phase.steps.map((step, si) => {
                const stepState = state.steps.find(s => s.phaseIndex === pi && s.stepIndex === si);
                const status: StepStatus = stepState?.status ?? 'pending';
                const isSelectedStep = si === selectedStep;
                const isInParallelGroup = parallelStepIndices?.includes(si) ?? false;
                const isActiveTab = activeParallelStep === si;
                return (
                  <Box key={si} flexDirection="row" paddingLeft={2} gap={1}>
                    <Text color={statusColor(status)}>{statusIcon(status)}</Text>
                    <Text
                      bold={isSelectedStep || isActiveTab}
                      color={isActiveTab ? 'cyan' : isInParallelGroup ? 'yellow' : isSelectedStep ? 'white' : 'gray'}
                      wrap="truncate-end"
                    >
                      {isInParallelGroup ? '║ ' : ''}{step.name}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>

      {/* Bottom: task checklist (separate from workflow) + footer */}
      <Box flexDirection="column">
        {hasTasks && (
          <Box flexDirection="column" borderStyle="single" borderColor="gray" borderLeft={false} borderRight={false} borderBottom={false} paddingTop={0}>
            <Text bold>
              Tasks{' '}
              <Text dimColor>
                {doneCount}/{totalCount}
                {doneCount === totalCount ? ' done' : ''}
              </Text>
            </Text>
            {tasks.map((task) => {
              const isHighlighted = task.id === highlightedTaskId;
              return (
                <Box key={task.id} flexDirection="row">
                  <Box flexShrink={0} width={2}>
                    <Text color={task.done ? 'green' : 'gray'}>
                      {task.done ? '☑' : '☐'}
                    </Text>
                  </Box>
                  <Box flexGrow={1} flexShrink={1}>
                    <Text
                      color={task.done ? 'green' : isHighlighted ? 'cyan' : undefined}
                      bold={isHighlighted}
                      dimColor={task.done && !isHighlighted}
                      wrap="truncate-end"
                    >
                      {task.description}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        <Box flexDirection="column" borderStyle="single" borderColor="gray" borderLeft={false} borderRight={false} borderBottom={false}>
          <Text dimColor wrap="truncate-end">{workflow.name}</Text>
          <Text dimColor wrap="truncate-end">agent: {workflow.phases[selectedPhase]?.agent ?? defaultAgent}</Text>
        </Box>
      </Box>
    </Box>
  );
}
