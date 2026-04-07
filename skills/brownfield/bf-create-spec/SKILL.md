---
name: bf-create-spec
description: "Collaboratively build an implementation spec. Asks the user what they want to build, interviews them to clarify scope and constraints, and writes spec.txt (including research hints for bf-research). Part of the brownfield skill family."
model: opus
---

# Create Spec (Brownfield)

Collaboratively build an implementation spec.

## Steps

1. Say exactly this and wait — do **not** use `AskUserQuestion` here:

   > **Awaiting braindump.** Tell me what you want to build — stream of consciousness is fine. I'll listen first, then ask questions.

   After the user responds, **reflect back** what you understood in 2-3 sentences. Then continue to Step 2.

2. Read `git log --oneline origin/master..HEAD` — show any commits already on this branch (if any).

3. **Interview the user, one question at a time.**

   Interview the user relentlessly about every aspect of the work until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

   **Rules of the interview:**

   - **One question at a time.** Use `AskUserQuestion` for every question. Always provide options that include your recommendation marked with "(recommended)", plus alternatives and an open-ended escape hatch ("Other — I'll explain").

   - **Explore the codebase first.** Before asking anything, check whether the codebase already answers it. If you can find the relevant code, data model, or pattern — state what you found and move on. Only ask what the code can't tell you.

   - **Provide your recommendation.** Every question must include what you think the answer should be and a brief reason why. This turns each question into a yes/no decision instead of an open-ended prompt.

   - **Walk the design tree.** Start with the highest-level decisions (scope, boundaries), then branch into specifics. Each answer may open new branches — follow them.

   - **Be relentless but not redundant.** Keep going until you can confidently describe *what* should be built, its constraints, and its acceptance criteria. Don't stop at surface-level answers.

   - **Think out loud.** Share your reasoning between questions to keep the user oriented.

   This is a spec — describe *what* should be built, not *how* to implement it. When you've resolved all branches, tell the user: "I have enough to draft the spec."

4. Write `.aw/brownfield-progress/spec.txt.draft` using this format:

```
# Spec: [Title]

## Goal
- What: ...
- Scope: ...
- Acceptance Criteria: ...

## Constraints
[Any behavioral or scope constraints. Leave blank if none.]

## Research Hints
[Files, modules, or areas of the codebase that bf-research should start from. Be specific — name files, classes, or directories if you know them from the interview.]

## Notes
[free-form notes from the discussion]
```

5. Present the spec to the user for review using `AskUserQuestion`:

   ```
   AskUserQuestion:
     question: "Here's the spec. Does it look right?"
     options:
       - "Approved"
       - "Change something"
   ```

   If "Change something", use a follow-up `AskUserQuestion` to find out what. Update the `.draft` file and re-present until approved.

6. Once approved, rename `.aw/brownfield-progress/spec.txt.draft` to `.aw/brownfield-progress/spec.txt`.

7. Confirm: "Spec saved to .aw/brownfield-progress/spec.txt"

## Principles

- **Why over what.** Constraints and scope boundaries prevent re-litigating decisions in future sessions.
- **Spec, not plan.** Describe *what* should be built, not implementation steps. Steps come from `/bf-create-tasks`.
