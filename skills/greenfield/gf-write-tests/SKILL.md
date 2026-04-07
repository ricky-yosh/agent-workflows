---
name: gf-write-tests
description: "Write tests for a batch of tasks BEFORE implementation. Detects the project's test framework and language, then writes tests that cover happy paths, edge cases, and failure modes. All tests should fail initially since there is no implementation yet. Part of the gf (greenfield) skill family. Use when the user says /gf-write-tests or wants to write tests before implementing a feature or task batch."
model: opus
---

# Write Tests (Long Feature)

Write tests for a batch of tasks before implementation. Tests define the contract; implementation satisfies it later. Do not ask unnecessary questions — read the inputs, make decisions, and write the tests.

## Steps

1. Read `.aw/greenfield-progress/spec.xml` and `.aw/greenfield-progress/tasks.json`. If either is missing, tell the user which skill to run first and stop.

2. **Pick the target tasks.** Read `.aw/greenfield-progress/next-task.json`. If it exists, use that task — no confirmation needed (resume already selected it). If it doesn't exist, ask which tasks to target. Accept task numbers (e.g., "tasks 2-4") or "all remaining".

3. **Skip if tests don't make sense.** Tasks that are purely UI layout, config wiring, file reorganization, docs, or copy changes don't need tests. If the selected task has no testable logic, say so in one line and stop. Otherwise proceed — no announcement needed.

4. **Detect the project's test setup.** Find test framework config, existing test files, and their patterns (naming, imports, assertion style). If no test setup exists, ask the user what framework to use. Read existing tests and the source files relevant to the task so you understand the interfaces being tested.

5. **Write the tests.** Tests must:
   - Follow the project's existing test conventions exactly
   - Cover happy paths, edge cases, and failure modes
   - Use strict assertions — `assertEqual(result, 42)` not `assertNotNone(result)`
   - Reference interfaces/functions that don't exist yet — that's the point
   - Not include any implementation code

6. **End with a summary table:**

   | Category | Coverage | Count |
   |---|---|---:|
   | Happy path | ... | N |
   | Edge cases | ... | N |
   | Error handling | ... | N |
   | **Total** | | **N** |

7. Iterate until approved.

## Principles

- **Tests are the spec made executable.** Each acceptance criterion from spec.xml should map to at least one test.
- **Strict assertions.** Loose assertions hide bugs.
- **No implementation code.** Tests define the contract; implementation satisfies it later.
