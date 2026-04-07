import React from 'react';
import { Box, Text } from 'ink';
import { statusIcon, statusColor } from './statusHelpers.js';

export interface TabInfo {
  label: string;
  status: 'running' | 'completed' | 'failed';
}

interface TabBarProps {
  tabs: TabInfo[];
  activeIndex: number;
}

export function TabBar({ tabs, activeIndex }: TabBarProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={1} paddingX={1}>
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        return (
          <Box key={i} flexDirection="row">
            <Text color={statusColor(tab.status)}>{statusIcon(tab.status)}</Text>
            <Text bold={isActive} color={isActive ? 'white' : 'gray'} underline={isActive}>
              {' '}{i + 1}:{tab.label}
            </Text>
            {i < tabs.length - 1 && <Text dimColor> │</Text>}
          </Box>
        );
      })}
    </Box>
  );
}
