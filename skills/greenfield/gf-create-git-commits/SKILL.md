---
name: gf-create-git-commits
description: "Creates well-structured git commits from current changes. Analyzes staged or unstaged changes and splits them into coherent logical commits grouped by intention. Part of the gf (greenfield) skill family. Use when the user says /gf-create-git-commits, asks to commit their work, or wants to save progress as git commits during a long feature build."
model: opus
---

# Git Commit Strategy (Long Feature)

## Commit Message Format

The commit message is a single `-m` string. One sentence. Nothing else.

No body. No bullet points. No trailers. No "Co-Authored-By". No heredocs.

```
git commit -m "Brief description of the change"
```

**Examples:**
```
git commit -m "Add project skeleton with Express server and folder structure"
git commit -m "Create user model with in-memory store and basic CRUD"
git commit -m "Wire up login endpoint to auth service"
```

**Anti-examples — do NOT do this:**
```
# WRONG: heredoc with trailer
git commit -m "$(cat <<'EOF'
Some change

Co-Authored-By: ...
EOF
)"

# WRONG: multi-line body
git commit -m "Some change

Added X, Y, and Z"
```

## Commit Splitting

Split commits by **intention** — what the change is trying to accomplish, not just which files it touches. Read the diffs carefully to understand what each hunk does, then group hunks that serve the same purpose into one commit.

Think about it like telling a story: each commit is one sentence in the narrative of the feature. "First I set up the project, then I added the data model, then I wired up the API."

**How to split:** Use `git add -p` or `git add <specific-files>` to stage subsets, then commit each group separately. A single file can be split across commits if different hunks serve different intentions.

**When NOT to split:** If all changes serve the same intention and are tightly coupled, one commit is fine.

## Workflow

This skill creates commits directly — the user can always `git reset` if they don't like the result. Do not ask for confirmation. Do not push to any remote. Just commit locally.

1. Check `git diff --staged` for staged changes. If nothing is staged, check `git diff` for unstaged changes and work with those instead.
2. Read every hunk carefully — understand what each change does
3. Identify the distinct intentions across all changes
4. For each intention group: stage the relevant files/hunks with `git add` or `git add -p`, then `git commit -m "..."`
5. After all commits, run `git log --oneline -n <N>` to show the result

Do not add, stage, or commit files that aren't part of the user's changes (e.g., don't touch unrelated files). Do not run `git push`.
