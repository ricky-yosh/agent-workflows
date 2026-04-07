import React from 'react';
import { Box, Text, useStdout } from 'ink';

interface KeyBinding {
  key: string;
  label: string;
}

interface KeyBarProps {
  bindings: KeyBinding[];
}

export function KeyBar({ bindings }: KeyBarProps): React.ReactElement {
  const { stdout } = useStdout();
  const width = stdout.columns;

  // Measure how wide a single row would be: "key label │ key label │ ..."
  // Each binding takes key.length + 1 + label.length, plus 3 for " │ " separator
  const totalWidth = bindings.reduce((sum, b, i) => {
    return sum + b.key.length + 1 + b.label.length + (i > 0 ? 3 : 0);
  }, 0);

  // If it fits in one row (with padding), use one row
  if (totalWidth <= width - 4) {
    return (
      <Box flexDirection="row" flexWrap="nowrap">
        {bindings.map((binding, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text dimColor> │ </Text>}
            <Text bold color="yellow">{binding.key}</Text>
            <Text dimColor> {binding.label}</Text>
          </React.Fragment>
        ))}
      </Box>
    );
  }

  // Otherwise split into rows that fit
  const rows: KeyBinding[][] = [];
  let currentRow: KeyBinding[] = [];
  let currentWidth = 0;
  const maxWidth = width - 4; // account for padding

  for (const binding of bindings) {
    const itemWidth = binding.key.length + 1 + binding.label.length;
    const separatorWidth = currentRow.length > 0 ? 3 : 0;

    if (currentWidth + separatorWidth + itemWidth > maxWidth && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [binding];
      currentWidth = itemWidth;
    } else {
      currentRow.push(binding);
      currentWidth += separatorWidth + itemWidth;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx} flexDirection="row" flexWrap="nowrap">
          {row.map((binding, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text dimColor> │ </Text>}
              <Text bold color="yellow">{binding.key}</Text>
              <Text dimColor> {binding.label}</Text>
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}
