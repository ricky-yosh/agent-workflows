---
name: review-implementation
description: "Ask the user to verify the implementation before advancing. Reads the implementation digest and presents verification steps, then gates on user confirmation. Writes review-confirmed marker file only after the user approves. Generic skill shared across all workflow families."
model: haiku
---

# Review Implementation

Gate the workflow on user verification after an implementation step.

## Steps

1. Find the active progress directory by checking which of `.aw/brownfield-progress/next-task.json` or `.aw/greenfield-progress/next-task.json` exists. Read it to get the current task ID (the `id` field).

2. Read the implementation digest at `.aw/digests/implement-task-N-digest.md` (where N is the task ID).

3. Print the **How to verify** and **What to look for** sections from the digest so the user can see them without opening the file.

4. Ask:

   ```
   AskUserQuestion:
     question: "Digest is at .aw/digests/implement-task-N-digest.md — take it for a spin. How did it go?"
     options:
       - "Task completed and tested"
       - "Something's off — I'll explain: ___"
   ```

5. **If "Task completed and tested":** Write an empty file to the progress directory at `review-confirmed`. This signals step completion to the runner.

6. **If "Something's off":** Read the user's explanation. Do NOT write `review-confirmed`. Tell the user the step will stay incomplete so they can re-run Execute Plan or fix the issue manually, then re-run this Review step.
