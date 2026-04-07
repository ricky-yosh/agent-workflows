---
name: bf-save-progress
description: "Save current session work to .aw/brownfield-progress/progress.txt in the current worktree. Captures decisions (why, not just what) that git diff cannot show. Part of the brownfield skill family. Use when the user says /bf-save-progress, wants to capture session state, or is wrapping up work on a ticket."
model: sonnet
---

# Save Progress (Brownfield)

Capture this session's work into `.aw/brownfield-progress/progress.txt`.

## Steps

1. Read `.aw/brownfield-progress/progress.txt` if it exists — display the last session entry so the user can see what was previously recorded.

2. Read `.aw/brownfield-progress/tasks.json` if it exists — identify which tasks were completed this session.

3. Review the conversation to identify what was accomplished this session.

4. If anything is ambiguous, ask the user: "I saw [X] and [Y] — anything else to capture, or anything I got wrong?"

5. Ask: "Which tasks were completed this session?" Show the remaining (not done) tasks from tasks.json for the user to confirm. Mark confirmed tasks as `"done": true` and write the updated tasks.json back.

6. Update `progress.txt`: read the full existing file, then write back the entire contents with the new entry appended at the end. Do not use a method that overwrites without preserving existing content.

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

7. Confirm what was appended and which tasks were marked done.

8. Run `/create-git-commits` to commit all current changes.

## Principles

- **Decisions over actions.** "Decided to use retry wrapper instead of inline retry because multiple callers share the same handler" is more valuable than "modified upload.ts".
- **Be specific about blockers.** A vague "needs investigation" helps no one next session. Name the symbol, file, or behavior that's unclear.
