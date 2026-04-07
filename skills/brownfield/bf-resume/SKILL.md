---
name: bf-resume
description: "Resume work on a ticket by loading context from .aw/brownfield-progress/ files. Reads research.txt, tasks.json, progress.txt, and recent git log to summarize where you left off and suggest next steps. Part of the brownfield skill family. Use when the user says /bf-resume, wants to pick up where they left off, or starts a new session on a ticket."
model: sonnet
---

# Resume (Brownfield)

Reload session context from the worktree's progress files.

## Steps

1. Read `.aw/brownfield-progress/research.txt` — if missing, note it and continue with what's available.
2. Read `.aw/brownfield-progress/progress.txt` — if missing, note it.
3. Read `git log --oneline origin/master..HEAD` — list commits made on this branch.
4. Read `.aw/brownfield-progress/tasks.json` if it exists.

5. Present a structured summary:

   **Ticket & Objective** (from research)
   - Feature area and what it does
   - Key patterns in use (the pattern reference — surface this upfront so it's ready when implementation starts)

   **Last Session** (from progress.txt)
   - What was accomplished
   - Decisions made (and why)
   - Blockers (if any)

   **Commits so far** (from git log)
   - List commits on this branch

   **Task status** (from tasks.json, if present)
   - Done vs remaining count by category

   **Next Steps**
   - From the last progress entry, or inferred from the tasks if progress.txt is empty

6. End with: "Ready. Next step: `/bf-triage`."
