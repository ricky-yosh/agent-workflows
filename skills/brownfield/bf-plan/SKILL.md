---
name: bf-plan
description: "Create an implementation plan for a batch of tasks using Claude Code Plan mode. Reads research.txt, spec.txt, and tasks.json, identifies the established patterns in the target area, and enters Plan mode with that context injected. Ensures the plan follows the codebase's existing architecture. Part of the brownfield skill family. Use when the user says /bf-plan or wants to plan a batch of tasks before implementing."
model: opus
---

# Create Plan (Brownfield)

Enter Plan mode for a batch of tasks, ensuring the implementation follows the established patterns in the target codebase area.

## Why this exists

Brownfield codebases have established patterns. Different areas might use different architectural approaches — one module might use event-driven patterns while another uses direct function calls. When implementing a feature, the code must follow whatever pattern the surrounding area uses — not introduce a new one. This skill makes sure the plan identifies and follows the right pattern before any code is written.

## Steps

1. Read context files:
   - `.aw/brownfield-progress/research.txt` — for patterns in use, key classes
   - `.aw/brownfield-progress/spec.txt` — for constraints and scope
   - `.aw/brownfield-progress/tasks.json` — for the task list

   If research.txt or spec.txt are missing, tell the user which skill to run first.

2. **Identify the task scope.** Read `.aw/brownfield-progress/next-task.json` — if it exists, default to the task listed there (written by `/bf-triage`). Confirm with the user: "Triage picked Task N — planning for that. Want a different task instead?" If `next-task.json` doesn't exist, fall back to the first not-done task in tasks.json. The user can request multiple (e.g., "tasks 3-4"), but the default is one.

   **Scope constraint:** Plan ONLY for the identified task(s). Do not outline, summarize, or propose approaches for other tasks in tasks.json. They exist but are irrelevant to this plan.

3. **Explore the target area.** Based on the identified task and research.txt, read the concrete files that represent the pattern to follow. Don't just reference research.txt abstractly — open the actual files so Plan mode has real code examples in context. Focus on:
   - The architectural pattern in use (MVC, MVVM, event-driven, etc.)
   - How similar features in the area are structured
   - The specific classes/modules/functions the new code should mirror
   - Integration points where the new code connects to existing code

4. **If the area has conflicting patterns**, surface them and ask the user which to follow. For example: "This area uses both callback-based and promise-based patterns — the newer files use promises. Which should this feature use?"

5. **Enter Plan mode** with all this context loaded. The plan covers only the identified task(s) — it should be detailed enough to implement without referencing other tasks. The plan should:
   - Name the pattern being followed and the specific file(s) that exemplify it
   - List what files to modify and what new files to create
   - Describe how each piece connects to existing code
   - Call out anything that should NOT be done (anti-patterns, patterns from other areas that don't belong here)

6. **Exit Plan mode**, then use `AskUserQuestion` to get approval:
   - Question: "Does this plan look good?"
   - Options: `["Looks good", "No"]`

   If "Looks good": done.

   If "No": use `AskUserQuestion` to ask for the reason (free text, no options). Then re-enter Plan mode with the feedback and repeat from step 5.

## What the plan should look like

The plan is Claude Code's built-in Plan mode output — not a separate artifact file. It should read like an implementation guide that a developer can follow step by step. The key addition this skill provides is the pattern context: every plan must anchor itself to concrete existing code.

Example of what "pattern anchoring" looks like in a plan:

> **Pattern:** Follow `UserListController` + `UserListDataSource` pattern
> - New `CategoryPickerController` mirrors `UserListController` (same event setup, same lifecycle hooks)
> - New `CategoryPickerDataSource` mirrors `UserListDataSource` (same data interface, same reload pattern)
> - Wire via event emitter, same as `UserListController.onUpdate`

## Each task is a vertical slice

Every task in the plan should be a skinny, end-to-end integration — not a horizontal layer. A good task touches all the layers it needs (model, view, controller, wiring) but does the minimum at each layer to produce something the user can see and test. This means after completing any single task, the feature should be in a testable state, even if incomplete.

Bad: "Task 1: Create all model classes. Task 2: Create all views. Task 3: Wire everything together."

Good: "Task 1: Add the entry point that opens an empty view. Task 2: Populate the view with data from the existing data source. Task 3: Add edit/save functionality."

## User testing steps

The final section of every plan must be a **"How to test"** checklist — simple, concrete steps the user can take to verify each task works after it's implemented. These steps should be actions anyone can perform in the running app, not things that require reading code.

Write these from the user's perspective: launch the app, navigate somewhere, click something, observe something. Each task gets its own mini-checklist so the user can verify incrementally as tasks are completed.
