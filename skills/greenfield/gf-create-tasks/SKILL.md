---
name: gf-create-tasks
description: "Generate a structured task list (tasks.json) from an existing spec. Tasks follow the walking skeleton philosophy — Task 1 builds the thinnest end-to-end system, each subsequent task replaces a hardcoded seam with real functionality. Writes to .aw/greenfield-progress/tasks.json. Part of the gf (greenfield) skill family."
model: opus
---

# Create Tasks (Long Feature)

Generate a structured task list from the spec. Tasks follow the walking skeleton philosophy — start with the thinnest end-to-end system, then fill in real behavior one task at a time.

## Steps

1. Read `.aw/greenfield-progress/spec.xml` — if missing, tell the user to run `/gf-create-spec` first.

2. Build options from the spec's `<requirements>` sections (or top-level groupings), then ask:

   ```
   AskUserQuestion:
     question: "What scope should I create tasks for?"
     options:
       - "Full spec"
       - "<Section/requirement group 1>"
       - "<Section/requirement group 2>"
       - "..."
   ```

   Always include "Full spec" as the first option. The remaining options should be the natural groupings from the spec — requirement groups, feature areas, or scope sections. The user is in a narrow tmux sidebar, so this must be a single multiple-choice interaction, not a typed response.

3. Generate tasks for the chosen scope. For each task, produce an object with:
   - `id`: sequential number
   - `category`: `"feature"`, `"infrastructure"`, or `"polish"`
   - `description`: concise statement of what the task accomplishes
   - `steps`: array of ordered implementation steps (strings)
   - `approach`: `"direct"` or `"plan"` — how to implement this task
   - `needs_tests`: `true` or `false` — whether this task needs tests
   - `done`: `false`

   **Deciding `approach`:**

   | Signal | Direct | Plan |
   |--------|--------|------|
   | Files touched | 1-2 | 3+ |
   | New abstractions needed | No | Yes |
   | Existing pattern to follow | Yes | No |
   | Ambiguous scope | No | Yes |

   Walking skeleton tasks are almost always `"direct"`. Tasks that introduce new abstractions or touch many files across layers are candidates for `"plan"`.

   **Deciding `needs_tests`:**
   - **true:** Pure logic, data transforms, functions with clear inputs/outputs, error handling
   - **false:** UI layout, config wiring, glue code, file reorganization, docs/copy changes, scaffolding

   Example (for a TODO app):
   ```json
   [
     {
       "id": 1,
       "category": "infrastructure",
       "description": "Walking skeleton — one hardcoded TODO visible in the browser",
       "steps": [
         "Scaffold project (package.json, framework init, entry point)",
         "Create a single route that returns a hardcoded TODO item",
         "Create a minimal page/component that renders it",
         "Verify: run the app, see the TODO in the browser"
       ],
       "approach": "direct",
       "needs_tests": false,
       "done": false
     },
     {
       "id": 2,
       "category": "feature",
       "description": "Real storage — create, list, and persist TODOs end-to-end",
       "steps": [
         "Define the TODO data model/interface",
         "Replace hardcoded data with an in-memory store and add/list operations",
         "Wire a form in the UI to create a TODO through the API",
         "Verify: add a TODO in the browser, see it appear in the list"
       ],
       "approach": "direct",
       "needs_tests": true,
       "done": false
     }
   ]
   ```

4. Write the task list to `.aw/greenfield-progress/tasks.json.draft`.

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

7. Once approved, rename `.aw/greenfield-progress/tasks.json.draft` to `.aw/greenfield-progress/tasks.json` and confirm: "Tasks saved."

## Walking skeleton — build thin, then fill in

A walking skeleton is the thinnest possible end-to-end implementation — just enough to connect all the layers (UI → API → data) with hardcoded or trivial behavior. Task 1 is always the skeleton. Every subsequent task replaces a hardcoded seam with real functionality, so the system is working and verifiable after every single task.

**Do this (walking skeleton):**
1. Hardcoded data visible through the full stack (can run it, can see it)
2. Replace hardcoded data with real storage + one create operation (can use it)
3. Add the next most valuable behavior, end-to-end (can test the integration)

**Not this (horizontal layers):**
1. All models
2. All API endpoints
3. All frontend components
4. Wire everything together (pray it works)

**Within each task too.** The `steps` array inside a task should follow the same principle — the first steps get the thinnest version working, the later steps fill it in. Never have all the "define" steps first and all the "wire" steps last. Get something running, then build on it.

This approach exists because:
- The system is always in a working state — no "big bang" integration at the end
- Each task is independently verifiable: run it, see it work
- The user can course-correct after every task instead of discovering misalignment at the end
- It catches integration issues immediately, not after days of isolated layer work

## Rules

- **Only the `done` field may be modified on existing tasks** — never remove, reorder, or edit `category`, `description`, or `steps` on tasks that already exist. New tasks may be appended.
- Steps should be specific enough that a future session can execute them without re-reading the spec.
- Prefer more smaller tasks over fewer large ones — each task should be completable in one focused session.
