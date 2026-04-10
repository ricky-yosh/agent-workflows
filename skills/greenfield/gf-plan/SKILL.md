---
name: gf-plan
description: "Research the task, form a recommended approach, ask the user to confirm or redirect via AskUserQuestion, then enter Plan mode. Part of the gf (greenfield) skill family."
model: opus
---

# Create Plan (Greenfield)

Research the task, surface a recommended approach, confirm with the user, then enter Plan mode.

## Steps

1. Read context files:
   - `.aw/greenfield-progress/spec.xml` — for requirements and constraints
   - `.aw/greenfield-progress/tasks.json` — for the task list
   - `.aw/greenfield-progress/progress.txt` — for prior decisions and context

   If spec.xml is missing, tell the user to run `/gf-create-spec` first.

2. **Identify the task scope.** Read `.aw/greenfield-progress/next-task.json` — if it exists, default to the task listed there (written by `/gf-resume`). If `next-task.json` doesn't exist, fall back to the first not-done task in tasks.json. The user can request multiple (e.g., "tasks 3-4"), but the default is one.

   **Scope constraint:** Plan ONLY for the identified task(s). Do not outline, summarize, or propose approaches for other tasks in tasks.json.

3. **Research the codebase.** Read the actual files relevant to this task — understand what patterns are already in use, what files will be touched, and how things connect. Look for:
   - Existing patterns this task should follow
   - Potential approaches and their tradeoffs
   - Any constraints or risks the spec doesn't spell out

4. **Form a recommendation.** Based on your research, identify the simplest approach consistent with the spec and existing patterns. Note the rationale in one sentence. If there's a meaningful alternative worth surfacing, note that too.

5. **Ask the user to confirm the approach** using `AskUserQuestion`:
   ```
   question: "Recommended approach for Task N: <one-sentence summary>. Proceed?"
   options:
     - "Yes — plan it"
     - "Different approach: ___"
   ```
   - The recommended option should come first so the user can accept with a single keypress.
   - If the user picks a different approach, note it and use it in the plan.

6. **Enter Plan mode** with a complete, grounded plan for the confirmed approach. The plan covers only the identified task(s) and must be detailed enough to implement without referencing other tasks. It should:
   - Reference established patterns from the existing codebase
   - List what files to create and what existing files to modify
   - Describe how each piece connects to what's already built
   - Call out anything that should NOT be done (patterns to avoid)
   - End with a **How to test** checklist (see below)

7. After presenting the plan, use `AskUserQuestion`:
   ```
   question: "Ready to implement, or want to adjust the plan?"
   options:
     - "Looks good — implement it"
     - "Change something: ___"
   ```
   If the user wants a change, revise and re-present. Otherwise, proceed.

## What the plan should look like

The plan is Claude Code's built-in Plan mode output. It should read like an implementation guide. The key is grounding every decision in the architecture doc and existing code:

> **Pattern:** Follow the event-driven pattern from the existing codebase
> - New `OrderProcessor` emits events through the existing `EventBus`
> - New `OrderView` subscribes to order events, same pattern as `UserView`
> - Data flows: API → Processor → EventBus → View

## Each task is a vertical slice

Every task in the plan should be a skinny, end-to-end integration — not a horizontal layer. A good task touches all the layers it needs (data, logic, UI, wiring) but does the minimum at each layer to produce something the user can see and test. This means after completing any single task, the feature should be in a testable state, even if incomplete.

Bad: "Task 1: Create all data models. Task 2: Build all UI components. Task 3: Wire everything together."

Good: "Task 1: Render a hardcoded list on screen. Task 2: Replace hardcoded data with API fetch. Task 3: Add create/edit flow."

## User testing steps

The final section of every plan must be a **"How to test"** checklist — simple, concrete steps the user can take to verify each task works after it's implemented. These steps should be actions anyone can perform in the running application, not things that require reading code.

Write these from the user's perspective: launch the app, navigate somewhere, interact with something, observe something. Each task gets its own mini-checklist so the user can verify incrementally as tasks are completed.

Example:

> ### How to test
>
> **After Task 1 (hardcoded list renders):**
> - Run `npm start` and open `http://localhost:3000/orders`
> - Verify: a list of three placeholder orders appears
> - Verify: each order shows an ID, date, and total
>
> **After Task 2 (live data from API):**
> - Restart the dev server and open the orders page
> - Verify: orders from the database appear instead of placeholders
> - Verify: refreshing the page shows up-to-date data
>
> **After Task 3 (create/edit flow):**
> - Click "New Order" and fill in the form
> - Verify: the new order appears in the list after saving
> - Click an existing order, change the total, save
> - Verify: the updated total is reflected in the list

## Principles

- **Research, then recommend.** Don't ask open-ended questions — explore the code first, form a view, and present it as the default option.
- **One keypress to proceed.** The recommended approach is always the first option so the user can confirm without typing.
- **Ground in reality.** Reference actual files and actual patterns, not abstract ideas.
- **Plan, not spec.** This is *how* to implement, not *what* to implement. The spec already covers what.
