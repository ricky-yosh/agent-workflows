---
name: bf-create-tasks
description: "Generate a structured task list (tasks.json) for a ticket from an existing spec. Reads spec.txt from .aw/brownfield-progress/ and writes tasks.json in the same directory. Part of the brownfield skill family. Use when the user says /bf-create-tasks, wants to break down a spec into actionable tasks, or needs a task list to track implementation progress."
model: opus
---

# Create Tasks (Brownfield)

Generate a structured task list from the ticket spec.

## Steps

1. Read `.aw/brownfield-progress/spec.txt` — if missing, tell the user to run `/bf-create-spec` first.

2. Ask: "Do you want tasks for the full spec, or a specific section?"

3. Generate tasks from the spec. For each task, produce an object with:
   - `category`: `"feature"`, `"bug"`, or `"todo"`
   - `description`: concise statement of what the task accomplishes
   - `steps`: array of ordered implementation steps (strings)
   - `done`: `false`

   Example:
   ```json
   [
     {
       "category": "feature",
       "description": "Add retry logic to the upload pipeline",
       "steps": [
         "Locate the upload handler in src/upload.ts",
         "Add exponential backoff wrapper using the same pattern as src/download.ts",
         "Wire retry count to existing config"
       ],
       "done": false
     }
   ]
   ```

4. Write the task list to `.aw/brownfield-progress/tasks.json.draft`.

5. Invoke the `/create-digest` skill to write a digest of the task list to `.aw/digests/tasks-digest.md`. The source document is the tasks you just generated — the digest should be a narrative overview of the implementation arc, not a JSON dump.

6. Tell the user the digest is ready for review, then ask:

   ```
   AskUserQuestion:
     question: "How does this task list look?"
     options:
       - "Approved"
       - "Too granular — combine some tasks"
       - "Too coarse — break tasks down more"
       - "Add tasks for something missing"
       - "Remove some tasks"
       - "Other — I'll explain"
   ```

   For any option other than "Approved", use follow-up `AskUserQuestion` calls to drill into what needs changing. Update both the `.draft` file and the digest, and ask again until approved.

7. Once approved, rename `.aw/brownfield-progress/tasks.json.draft` to `.aw/brownfield-progress/tasks.json`.

8. Confirm: "Tasks saved to .aw/brownfield-progress/tasks.json"

## Vertical slices

Structure tasks so the first task produces a bare but working end-to-end slice. Subsequent tasks build on top of it. The idea is to see something running as early as possible before layering in details.

The first task should always be: "Can I run this and see something?" Everything else comes after.

## Rules

- **Only the `done` field may be modified on existing tasks** — never remove, reorder, or edit `category`, `description`, or `steps` on tasks that already exist in the file. New tasks may be appended.
- Steps should be specific enough that a future session can execute them without re-reading the spec.
- Prefer more smaller tasks over fewer large ones — each task should be completable in one focused session.
