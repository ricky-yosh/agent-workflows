import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface SelectOption {
  label: string;
  description?: string;
  value: string;
}

interface SelectPromptProps {
  title: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  onCancel?: () => void;
}

export function SelectPrompt({
  title,
  options,
  onSelect,
  onCancel,
}: SelectPromptProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((s) => (s > 0 ? s - 1 : options.length - 1));
    }
    if (key.downArrow) {
      setSelected((s) => (s < options.length - 1 ? s + 1 : 0));
    }
    if (key.return) {
      onSelect(options[selected].value);
    }
    if (key.escape && onCancel) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text bold>{title}</Text>
      <Text> </Text>
      {options.map((opt, i) => {
        const isSelected = i === selected;
        return (
          <Box key={opt.value} flexDirection="column">
            <Text>
              <Text color={isSelected ? "yellow" : "gray"}>
                {isSelected ? "●" : "○"}
              </Text>
              <Text bold={isSelected}> {opt.label}</Text>
            </Text>
            {opt.description && (
              <Text dimColor>    {opt.description}</Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      <Text dimColor>↑↓ navigate  enter select  esc cancel</Text>
    </Box>
  );
}
