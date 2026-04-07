---
name: ex-save-progress
description: "Example skill — mark current task done and write progress.json + tasks.json. Demonstrates multi-output completion detection."
---

# Save Progress (Example)

Mark the current task done and save progress. No questions needed.

## Step 1: Write progress

Read `.aw/test-progress/next-task.json` to get the current task.

Write `.aw/test-progress/progress.json`:

```json
{
  "timestamp": "<ISO timestamp>",
  "taskId": <id from next-task.json>,
  "status": "finished"
}
```

## Step 2: Update tasks

Read `.aw/test-progress/tasks.json`. Mark the current task `done: true`. Write the updated file.

Say: "Progress saved."
