---
name: bf-triage
description: "Pick the next task to work on and write it to next-task.json. Reads tasks.json, selects the first not-done task, confirms with the user, and persists the choice. Part of the brownfield skill family. Use when the user says /bf-triage, 'what should I work on next', 'which task is next', or as the step between /bf-resume and /bf-plan."
model: sonnet
---

# Triage (Brownfield)

Pick the next task and write it down.

## Steps

1. Read `.aw/brownfield-progress/tasks.json`. If missing, tell the user to run `/bf-create-tasks` first.

2. Find the first not-done task.

3. Use `AskUserQuestion` to confirm the task and ask about the cycle:
   - Question: "Next up is Task N — [description]. How do you want to approach it?"
   - Options: `["Full cycle (tests + plan)", "Fast-track (implement directly)"]`

4. Write `.aw/brownfield-progress/next-task.json`:

   ```json
   {
     "task": 2,
     "description": "The task description from tasks.json",
     "fast_track": false,
     "recommended_at": "2026-03-31"
   }
   ```

   Set `fast_track` to `true` if the user chose "Fast-track", `false` otherwise.
