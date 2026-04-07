# Skill Guidelines for aw

Read this file before creating or editing any skill in this project.

## Context

aw is a tmux-based TUI orchestrator. The user sits in a narrow sidebar pane on the left. Claude Code runs in the right pane. The user navigates and triggers steps from the sidebar — they should rarely need to type directly in the Claude pane.

**The whole point of aw is to reduce the amount of time the user spends typing.**

Every skill must respect this. A skill that blocks on typed input defeats the purpose of the tool.

## Rules

### 1. Always use `AskUserQuestion` for user input

Never ask questions as plain chat text and wait for the user to type a response. Use the `AskUserQuestion` tool instead — it creates a structured prompt that's visible and easy to respond to.

Bad:
```
What framework would you like to use? Please type your choice.
```

Good:
```
Use AskUserQuestion with:
  question: "What framework would you like to use?"
  options: ["React", "Vue", "Svelte"]
```

### 2. Prefer defaults over questions

If a reasonable default exists, use it and state what you chose. Don't ask for confirmation unless the choice is irreversible or high-stakes.

Bad:
```
Should I use TypeScript or JavaScript?
```

Good:
```
Using TypeScript (project already has tsconfig.json).
```

### 3. When you must ask, use multiple choice

Open-ended questions require typing. Multiple choice requires a single keypress. When using `AskUserQuestion`, always provide `options` when possible.

### 4. Minimize back-and-forth

Batch related questions into a single interaction rather than asking one at a time across multiple turns. Each turn requires the user to wait for Claude to finish, read the question, and respond — that adds up fast in a tmux workflow.

### 5. Don't enter Plan mode unless the skill explicitly requires it

Plan mode changes the interaction model and requires the user to manually approve/exit. Only use it when the skill's purpose is to create a plan (e.g., `/gf-plan`, `/bf-plan`). Implementation skills should execute directly.

### 6. Progress directories

Each workflow family has a hardcoded progress directory under `.aw/`:

| Workflow | Progress directory |
|---|---|
| Greenfield (`gf-*` skills) | `.aw/greenfield-progress/` |
| Brownfield (`bf-*` skills) | `.aw/brownfield-progress/` |

All skill output files (specs, tasks, research, notes) go in the corresponding progress directory. Digests go in `.aw/digests/` (shared across all workflows).

### 7. Use `.draft` for interactive output files

The workflow runner detects step completion by checking if the declared output files exist. Interactive skills that go back and forth with the user (spec creation, task creation) must not write the final output file until the user approves — otherwise the runner advances mid-conversation.

**Pattern:** Write to `filename.draft` during iteration. Rename to the final filename only after approval.

```
# During brainstorming / review loop:
Write to .aw/greenfield-progress/spec.xml.draft

# After user approves:
Rename spec.xml.draft → spec.xml
```

Non-interactive skills (save-progress, resume, research) that write once at the end don't need this — just write the final file directly.

### 8. Write digests, not terminal novels

Some skills produce artifacts the user will want to reference later — specs, research findings, test notes, plans. Don't dump these as terminal output. Write them to `.aw/digests/` as markdown files the user can open anytime.

**Skills that must produce a digest:**
- **Spec creation** → `spec-digest.md`
- **Task creation** → `tasks-digest.md`
- **Codebase research** → `research-digest.md`
- **Testing notes** → `testing-digest.md`
- **Plan** → `plan-digest.md`
- **Implementation** → `implement-task-N-digest.md` (one per task)

**How to write digests:** Invoke the `/create-digest` skill (`skills/generic/create-digest/SKILL.md`). It defines the voice, structure, and process for all digests. Do not inline your own digest style — use the skill.

After writing a digest, tell the user where it is. One line, no summary in the terminal.

> Digest saved to `.aw/digests/spec-digest.md`

### 9. Final wrap-up steps should produce digests directly

Skills that run at the end of a workflow (testing notes, save-progress, etc.) are summarizing work that's already done. They should **not** use the `.draft` pattern or multi-round review loops — just gather context, produce the digest, and write the final file in one pass.

This saves tokens and avoids unnecessary back-and-forth on steps where the user just wants the artifact produced. If something needs correcting, the user can re-run the step or edit the file — that's cheaper than gating every wrap-up on approval.

### 10. Use output files to gate on user input

The runner detects step completion via stop-hook debounce (2 seconds of quiet). If your skill needs to wait for user input (via `AskUserQuestion`), the debounce may fire before the user answers, causing the runner to advance prematurely.

**Fix:** Declare an output file for the step and only write it after the user responds. The runner won't advance until all output files exist, bypassing the debounce.

```yaml
- name: Review
  skill: /my-review-skill
  type: think
  outputs:
    - review-confirmed    # skill writes this only after user confirms
```

This is the same `.draft` pattern (guideline 7) applied to user-gated steps: don't write the completion signal until the gate passes.

## Summary

| Do | Don't |
|----|-------|
| Use `AskUserQuestion` with options | Print a question and wait for typed input |
| Pick sensible defaults automatically | Ask for confirmation on obvious choices |
| Batch questions together | Ask one question per turn |
| Explain what you chose and why | Block progress waiting for input |
| Execute directly for implementation steps | Enter Plan mode unless the skill is a planning skill |
| Write digests to `.aw/digests/` | Dump long summaries into terminal output |
