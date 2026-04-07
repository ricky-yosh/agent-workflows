---
name: gf-testing-notes
description: "Generate readable testing notes after a feature is complete. Compares spec against implementation to produce a concise list of what was built, how to test it, and any scope gaps. Writes testing-notes.md to .aw/greenfield-progress/. Part of the gf (greenfield) skill family."
model: sonnet
---

# Testing Notes (Long Feature)

Generate concise testing notes for the completed feature.

The audience is a person who needs to test this. They are busy. Every sentence should help them test or understand a decision — nothing else.

## Steps

1. Read these sources (skip any that don't exist):
   - `.aw/greenfield-progress/spec.xml` — what was planned
   - `.aw/greenfield-progress/tasks.json` — what tasks were defined
   - `.aw/greenfield-progress/progress.txt` — decisions made along the way
   - `git log --oneline` — what was committed

2. **Build testing notes.** From the gathered context, produce a complete document covering:

   - **What was built** — each distinct piece of functionality, grouped logically
   - **How to test it** — observable behaviors to verify. Frame as what the user should see, not what the code does
   - **Edge cases** — conditions that aren't obvious from the feature name
   - **How to run it** — commands to start, build, or test the project
   - **Scope gaps** — compare what the spec asked for against what was implemented. For each gap, infer the most likely reason (deferred, out of scope, blocked) from progress.txt and commit history

   Format:
   ```
   # Testing Notes: [Feature Title]

   ## Setup
   [How to get the project running — install, build, start commands]

   ## What to Test
   1. [Feature or area]
      a. [Specific testable behavior]
      b. [Another behavior]
   2. [Another feature or edge case]

   ## Scope Notes
   [Anything intentionally not implemented, with reasons]
   ```

3. **Write the digest immediately.** Use the `/create-digest` skill to write the testing notes to `.aw/digests/testing-digest.md`. Also write to `.aw/greenfield-progress/testing-notes.md`.

   No `.draft` file. No review loop. This is a final wrap-up step — produce the artifact in one pass.

4. Confirm: "Testing notes saved to `.aw/greenfield-progress/testing-notes.md` and `.aw/digests/testing-digest.md`"

## Principles

- **Precision over completeness.** Only include what helps someone test. Don't restate obvious things.
- **No code references.** Describe behaviors, not file names or class names.
- **Scope gaps need reasons.** "Not implemented" wastes time. Always include why and where it will happen.
