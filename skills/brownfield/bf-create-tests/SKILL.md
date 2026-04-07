---
name: bf-create-tests
description: "Write tests for a batch of tasks BEFORE implementation. Detects the project's test framework and conventions, then writes tests covering happy paths, edge cases, and failure modes. All tests should fail initially since there's no implementation yet. Part of the brownfield skill family. Use when the user says /bf-create-tests or wants to write tests before implementing a task batch."
model: opus
---

# Create Tests (Brownfield)

Write tests for a batch of tasks before implementation. Tests define the contract; implementation satisfies it later.

## Steps

1. Read `.aw/brownfield-progress/spec.txt` and `.aw/brownfield-progress/tasks.json` — if either is missing, tell the user which skill to run first.

2. **Pick the target tasks.** Read `.aw/brownfield-progress/next-task.json` — if it exists, default to the task listed there (written by `/bf-triage`). Confirm with the user: "Triage picked Task N — writing tests for that. Want a different task instead?" If `next-task.json` doesn't exist, fall back to asking: "Which tasks are you writing tests for?" Show the remaining (not-done) tasks by number. Accept task numbers (e.g., "tasks 3-5"), a group reference, or "all remaining".

3. **Decide if tests make sense.** Read the selected tasks carefully and assess whether unit/integration tests would provide real value. Tests make sense when there is testable logic — data transformations, business rules, state machines, validation, parsing, calculations, model layer changes, API contracts. Tests do NOT make sense for tasks that are purely: UI/visual layout with no logic, configuration/wiring with no logic, build setting changes, documentation, copy/string changes, or simple glue code that delegates entirely to already-tested code. When borderline, lean toward writing tests.

   If tests do not make sense, output exactly this and stop:

   > Does writing tests for this task make sense? **No**

   If tests do make sense, continue to step 4. Your first output line must be:

   > Does writing tests for this task make sense? **Yes**

4. Scope test coverage to only the selected tasks. Read the task descriptions and steps to understand what behavior needs testing. If prior tasks are already done, you can reference classes and methods they introduced — tests for later tasks build on earlier work.

5. **Detect the test framework.** Look at the project's existing test files to identify what test framework, assertion library, and conventions are used. Follow the same patterns — file naming, directory structure, import style, assertion style.

6. Write the test code. Tests must:
   - Use the **project's existing test framework and conventions**
   - Cover **happy paths** — expected input produces expected output
   - Cover **edge cases** — boundary values, empty/nil/undefined, large input
   - Cover **failure modes** — invalid input, missing dependencies, error states
   - Use strict assertions — exact value comparisons, not just existence checks
   - Use descriptive test names that convey the scenario and expected result
   - **Not include any implementation code**

7. After presenting the tests, include this summary table:

   ```
   ### Summary

   | Test category | Coverage | Count |
   |---|---|---:|
   | Happy path tests | <what's covered> | <number> |
   | Edge case tests | <what's covered> | <number> |
   | Error handling tests | <what's covered> | <number> |
   | Regression tests | <what's covered or "N/A"> | <number> |
   | **Total** | | **<total>** |
   ```

   The "Coverage" column briefly describes what that category covers for these specific tasks. The "Count" column is the number of test functions in that category. Only include the Regression tests row if there are regression-specific tests; otherwise show "N/A" with count 0.

8. Iterate until approved.
