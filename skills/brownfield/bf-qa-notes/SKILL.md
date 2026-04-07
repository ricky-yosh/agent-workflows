---
name: bf-qa-notes
description: "Generate QA/handoff testing notes after a feature is complete. Compares spec against implementation to draft precise, concise notes — what was built, how to test it, and what was intentionally not implemented. Part of the brownfield skill family. Use when the user says /bf-qa-notes, 'write QA notes', or is handing off a completed feature."
model: sonnet
---

# QA Notes (Brownfield)

Generate concise QA/handoff testing notes for a completed feature.

The audience is the person who will test or review. They are busy. Every sentence should help them test or understand a decision — nothing else. No filler, no developer context, no implementation details.

## Step 1 — Gather context

Read these sources (skip any that don't exist):

1. **Spec**: `.aw/brownfield-progress/spec.txt`
2. **Progress**: `.aw/brownfield-progress/progress.txt` — especially "Decisions Made" sections
3. **Commits**: `git log --oneline origin/main..HEAD` (adjust base branch as needed). If the branch is already merged, find the merge commit: `git log --oneline --grep="TICKET_KEY" main` and inspect individual commits.
4. **Diff summary**: `git diff --stat origin/main..HEAD` if on the branch, otherwise reconstruct from commit messages.

## Step 2 — Draft QA notes

From the gathered context, build a numbered list covering:

- **What was built** — each distinct piece of functionality, grouped logically. Use sub-items (a, b, c) for related behaviors within a feature.
- **How to test it** — observable behaviors the tester should verify. Frame these as what the user should see or not see, not what the code does.
- **Edge cases** — conditions that aren't obvious from the feature name.

Keep it tight. The format:

```
QA Notes:
1. [Feature or area]
   a. [Specific testable behavior]
   b. [Another behavior]
2. [Another feature or edge case]
3. [Scope note if applicable — see Step 3]
```

## Step 3 — Identify scope gaps

This is the critical step. Compare what the spec asked for against what was actually implemented (commits + diff). Look for:

- Features mentioned in the spec with no corresponding code changes
- Areas mentioned in the spec that weren't touched
- Acceptance criteria that aren't fully covered

For each gap found, ask the user **one at a time**:

> "The spec mentions [X], but I don't see changes for that. Why wasn't this implemented?"

Wait for the answer before asking about the next gap. Record each answer as a numbered item in the QA notes.

If no gaps are found, skip to Step 3.5.

## Step 3.5 — Ask about edge cases

After all gaps have been addressed, ask the user:

> "Any edge cases or specific test conditions the tester should know about?"

Add these to the draft. If the user says no, move on.

## Step 4 — Present draft for review

Show the complete QA notes to the user exactly as they will appear. Ask:

> "Here are the QA notes. Any changes?"

Apply any edits the user requests. Do not finalize until the user approves.

## Step 5 — Save notes

Write the approved notes to `.aw/brownfield-progress/qa-notes.md`.

Confirm: "QA notes saved to `.aw/brownfield-progress/qa-notes.md`"

## Principles

- **Precision over completeness.** Only include what helps the tester. If something is obvious from the feature description, don't restate it.
- **Testers don't care about code.** Never mention file names, class names, or implementation details. Describe behaviors.
- **Scope gaps need reasons.** A bare "not implemented" wastes the tester's time with questions. Always include who decided, why, and where it will happen.
- **Ask, don't assume.** If you're unsure why something wasn't implemented, ask. Don't guess at the reason — a wrong reason is worse than no reason.
