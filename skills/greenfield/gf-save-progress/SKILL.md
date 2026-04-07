---
name: gf-save-progress
description: "Save current session work to .aw/greenfield-progress/progress.txt. Captures decisions (why, not just what) that git diff cannot show. Updates tasks.json to mark completed tasks. Part of the gf (greenfield) skill family."
model: sonnet
---

# Save Progress (Long Feature)

Capture this session's work into `.aw/greenfield-progress/progress.txt`.

**Bias toward action.** Do all of the following in a single pass — read, infer, write, commit. The user invoked this skill because they want progress saved *now*, not to answer a questionnaire. Only pause to ask if you genuinely cannot determine what was accomplished from the conversation history.

## Steps

1. Read `.aw/greenfield-progress/progress.txt` if it exists (to know the append point) and `.aw/greenfield-progress/tasks.json` if it exists (to know which tasks are not yet done).

2. Review the full conversation to identify: what was accomplished, what decisions were made and why, what the logical next steps are, and any blockers.

3. Infer which tasks in `tasks.json` were completed based on what actually happened in the conversation. You have the full context — use it. Mark those tasks as `"done": true` and write the updated `tasks.json` immediately.

4. If `progress.txt` does not exist, create it. If it does exist, read the full file and append the new entry at the end. Do not overwrite existing content. Use this template:

```
## Session — YYYY-MM-DD

### Accomplished
- ...

### Decisions Made
- ... (capture *why*, not just *what* — this is what git diff cannot show)

### Next Steps
- ...

### Blockers
- ...
```

5. Tell the user what you wrote and which tasks you marked done. If anything was genuinely ambiguous (e.g., the conversation was unclear about whether a task was fully finished), flag it here — otherwise just report what you did.

6. Run `/gf-create-git-commits` to commit all current changes. **Never `git add` anything under `.aw/`** — that directory is ephemeral orchestrator state, not project source.


## Principles

- **Decisions over actions.** "Decided to use event-driven architecture because components need to stay decoupled" is more valuable than "created event bus module".
- **Be specific about blockers.** A vague "needs investigation" helps no one next session. Name the specific thing that's unclear.
- **Progress.txt is the bridge between sessions.** Write it for a version of yourself that has zero context.
