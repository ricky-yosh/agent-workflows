---
name: gf-review
description: "Gate the greenfield workflow on user verification after an implementation step. Reads the implementation digest, shows verification steps, and waits for the user to confirm before advancing. Part of the gf (greenfield) skill family."
model: haiku
---

# Review Implementation (Greenfield)

Gate the workflow on user verification after an implementation step.

## Steps

1. Read `.aw/greenfield-progress/next-task.json` to get the current task ID (the `task` field). If missing, tell the user to run `/gf-resume` first.

2. Read the implementation digest at `.aw/digests/implement-task-N-digest.md` (where N is the task ID).

3. Print the **How to verify** and **What to look for** sections from the digest.

4. Ask:

   ```
   AskUserQuestion:
     question: "Digest is at .aw/digests/implement-task-N-digest.md — take it for a spin. How did it go?"
     options:
       - "Task completed and tested"
       - "Something's off — I'll explain: ___"
   ```

5. **If "Task completed and tested":** Write an empty file to `.aw/greenfield-progress/review-confirmed`. Then write an empty file to `.aw/stop-signal` to trigger the runner to advance to the next step.

6. **If "Something's off":** Read the user's explanation. Do NOT write `review-confirmed`. Tell the user the step stays incomplete so they can re-run the implement step or fix manually, then re-run `/gf-review`.
