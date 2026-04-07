import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface ChecklistItem {
  label: string;
  value: string;
  description?: string;
  checked: boolean;
}

interface ChecklistPromptProps {
  title: string;
  items: ChecklistItem[];
  onConfirm: (selections: Map<string, boolean>) => void;
  onCancel: () => void;
}

export function ChecklistPrompt({
  title,
  items,
  onConfirm,
  onCancel,
}: ChecklistPromptProps) {
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>();
    for (const item of items) {
      m.set(item.value, item.checked);
    }
    return m;
  });

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : items.length - 1));
    }
    if (key.downArrow) {
      setCursor((c) => (c < items.length - 1 ? c + 1 : 0));
    }
    if (input === " ") {
      setChecked((prev) => {
        const next = new Map(prev);
        const val = items[cursor].value;
        next.set(val, !next.get(val));
        return next;
      });
    }
    if (key.return) {
      onConfirm(checked);
    }
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" gap={0}>
      <Text bold>{title}</Text>
      <Text> </Text>
      {items.map((item, i) => {
        const isCursor = i === cursor;
        const isChecked = checked.get(item.value) ?? false;
        const checkbox = isChecked ? "■" : "□";
        return (
          <Box key={item.value} flexDirection="column">
            <Text>
              <Text color={isCursor ? "yellow" : "gray"}>
                {isCursor ? "▸" : " "}
              </Text>
              <Text color={isChecked ? "green" : "gray"}> {checkbox}</Text>
              <Text bold={isCursor}> {item.label}</Text>
            </Text>
            {item.description && (
              <Text dimColor>      {item.description}</Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      <Text dimColor>↑↓ navigate  space toggle  enter confirm  esc cancel</Text>
    </Box>
  );
}
