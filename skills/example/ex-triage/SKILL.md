---
name: ex-triage
description: "Example skill — pick the next task and write next-task.json. Demonstrates task selection with AskUserQuestion and skip_when output."
---

# Triage (Example)

Pick the next task from `tasks.json` and write the decision to `next-task.json`.

## Step 1: Load tasks

Read `.aw/test-progress/tasks.json`. If it doesn't exist, create it:

```json
[
  { "id": 1, "description": "Add a greeting function", "done": false },
  { "id": 2, "description": "Fix the return value", "done": false }
]
```

Find the first task where `done` is `false`. If all tasks are done, say "All tasks complete." and stop.

## Step 2: Confirm with user

```
AskUserQuestion:
  question: "Next: Task <id> — <description>. Skip tests?"
  options:
    - "Go (with tests)"
    - "Go (skip tests)"
    - "Done — stop here"
```

## Step 3: Write decision

Write `.aw/test-progress/next-task.json`:

```json
{
  "taskId": <id>,
  "description": "<description>",
  "skipTests": <true if "skip tests" was selected>
}
```

Say: "Triage complete."
