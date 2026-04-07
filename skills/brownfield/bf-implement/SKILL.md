---
name: bf-implement
description: "Execute the approved plan for the current task and produce an implementation digest. Reads next-task.json, implements the plan, then invokes /create-digest to write implement-task-N-digest.md with what changed and how to verify. Part of the brownfield skill family."
model: opus
---

# Implement (Brownfield)

Execute the approved plan for the current task. Then produce a digest so the user can review what happened and verify the walking skeleton works.

## Steps

1. Read `.aw/brownfield-progress/next-task.json` for the current task. If missing, tell the user to run `/bf-triage` first.

2. Read `.aw/brownfield-progress/tasks.json` and `.aw/brownfield-progress/spec.txt` for full context.

3. Execute the approved plan. Follow it step by step — the plan was already iterated with the user in Plan mode, so implement what was agreed.

4. Run the project's test suite if one exists. Fix any failures before proceeding.

5. **Write an implementation digest.** Invoke the `/create-digest` skill to write a digest to `.aw/digests/implement-task-N-digest.md` (where N is the task id). The source material is everything you just did — the digest should cover:
   - **What was built** — one-line summary of the task that was completed
   - **What changed** — which files were created or modified and why
   - **How to verify** — the exact steps to test in the running app (e.g., launch the app, navigate to a page, run a command). Be specific — don't say "verify it works", say what the user should do and see.
   - **What to look for** — describe the expected behavior in concrete terms. This is the walking skeleton check — the user needs to know what "working" looks like at this stage.
   - **Walking skeleton progression** — where does this task sit in the arc? What was hardcoded or stubbed before that's now real? What's still placeholder that the next task will replace?

   Tell the user the digest is ready: "Digest saved to `.aw/digests/implement-task-N-digest.md`"

6. Use `AskUserQuestion` to confirm:
   - Question: "Is the implementation satisfactory?"
   - Options: `["Yes", "No"]`

   If "Yes": write `.aw/brownfield-progress/implementation-confirmed` (empty file) and stop.

   If "No": use `AskUserQuestion` to ask what needs fixing (free text, no options). Address the feedback, re-run tests, update the digest, then ask again.
