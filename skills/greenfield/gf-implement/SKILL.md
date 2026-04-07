---
name: gf-implement
description: "Implement the current task from next-task.json directly — no plan mode. Reads the task, writes tests if needed, implements, and verifies. Use for tasks marked 'direct'. Part of the gf (greenfield) skill family. Use when the user says /gf-implement."
model: opus
---

# Implement (Long Feature)

Implement the current task directly. No plan mode, no ceremony — just build it.

## Steps

1. Read `.aw/greenfield-progress/next-task.json`. If missing, tell the user to run `/gf-resume` first. Confirm `approach` is `"direct"`. If it's `"plan"`, tell the user this task was flagged for the full plan loop and stop.

2. Read `.aw/greenfield-progress/spec.xml` and `.aw/greenfield-progress/tasks.json` for full context on what this task requires.

3. Read the source files the task will touch. Understand the existing code before writing anything.

4. **If `needs_tests` is true:** Write tests first following the project's existing test conventions. Tests should cover happy paths, edge cases, and failure modes. Use strict assertions. Then implement the code to make the tests pass.

5. **If `needs_tests` is false:** Implement the task directly.

6. Run the project's test suite to verify nothing is broken. Fix any failures.

7. **Write an implementation digest.** Invoke the `/create-digest` skill to write a digest to `.aw/digests/implement-task-N-digest.md` (where N is the task id). The source material is everything you just did — the digest should cover:
   - **What was built** — one-line summary of the task that was completed
   - **What changed** — which files were created or modified and why
   - **How to verify** — the exact command to run the app, URL to open, or action to take (e.g., "Run `npm run dev` and open http://localhost:3000"). Be specific — don't say "verify it works", say what the user should see.
   - **What to look for** — describe the expected behavior in concrete terms (e.g., "You should see a list of 3 hardcoded TODOs. Clicking one should toggle its completed state."). This is the walking skeleton check — the user needs to know what "working" looks like.
   - **Walking skeleton progression** — where does this task sit in the arc? What was hardcoded before that's now real? What's still hardcoded that the next task will replace?

   Tell the user the digest is ready: "Digest saved to `.aw/digests/implement-task-N-digest.md`"
