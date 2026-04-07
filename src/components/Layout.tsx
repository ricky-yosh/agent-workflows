import React from 'react';
import { Box, Text, useStdout } from 'ink';

interface LayoutProps {
  sidebar: React.ReactNode;
  footer: React.ReactNode;
  /** Optional overlay (e.g., SelectPrompt) that replaces the sidebar. */
  overlay?: React.ReactNode;
  /** Optional tab bar shown above the sidebar when parallel steps are active. */
  tabBar?: React.ReactNode;
  /** Status line shown above the footer. */
  statusLine?: string;
}

export function Layout({ sidebar, footer, overlay, tabBar, statusLine }: LayoutProps): React.ReactElement {
  const { stdout } = useStdout();
  const width = stdout.columns;
  const height = stdout.rows;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {tabBar && !overlay && (
        <Box borderStyle="single" borderColor="gray" borderLeft={false} borderRight={false} borderTop={false}>
          {tabBar}
        </Box>
      )}

      <Box flexGrow={1} paddingX={1} overflow="hidden">
        {overlay || sidebar}
      </Box>

      {statusLine && (
        <Box paddingX={1}>
          <Text dimColor>{statusLine}</Text>
        </Box>
      )}

      <Box borderStyle="single" borderColor="gray" borderLeft={false} borderRight={false} borderBottom={false} paddingX={1}>
        {footer}
      </Box>
    </Box>
  );
}
