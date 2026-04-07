---
name: gf-resume
description: "Resume work on a long feature by loading context from .aw/greenfield-progress/ files. Reads spec.xml, tasks.json, progress.txt, and recent git log to summarize where you left off. Writes next-task.json for the next not-done task. Part of the gf (greenfield) skill family."
model: sonnet
---

# Resume (Long Feature)

Reload session context from the greenfield-progress files and set up the next task.

The purpose of this skill is to silently prime the conversation context so you can work effectively on the feature. The user already knows what the feature is — they don't need a recap.

## Steps

1. Read the following files (skip any that don't exist):
   - `.aw/greenfield-progress/spec.xml`
   - `.aw/greenfield-progress/tasks.json`
   - `.aw/greenfield-progress/progress.txt`

2. Run `git log --oneline -20` to understand recent commits.

3. **Write `next-task.json`.** Find the first not-done task in `tasks.json` and write `.aw/greenfield-progress/next-task.json`:

   ```json
   {
     "task": 2,
     "description": "The task description from tasks.json",
     "approach": "direct",
     "needs_tests": true
   }
   ```

   Copy `approach` and `needs_tests` directly from the task in `tasks.json`. If the task is missing these fields (legacy tasks.json), default to `"direct"` and `false`.

   If all tasks are done, do not write `next-task.json`. Say "All tasks complete."

4. **Output only this:**

   > Loaded in previous session. *\<one sentence summarizing the current state, e.g. "3 of 8 tasks done, last session implemented the CLI parser."\>*
