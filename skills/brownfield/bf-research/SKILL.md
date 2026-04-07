---
name: bf-research
description: "Research how an area of the codebase works. Reads spec.txt for the goal and research hints, explores the relevant code, and writes research.txt. Part of the brownfield skill family. Use when the user says /bf-research or wants to understand a codebase area before implementation."
model: opus
---

# Research (Brownfield)

Explore an area of the codebase and document how it works.

## Steps

1. Read `.aw/brownfield-progress/spec.txt` — if missing, tell the user to run `/bf-create-spec` first. Use the **Goal** section to understand what's being built and the **Research Hints** section as starting points for exploration. If Research Hints is blank, infer starting points from the goal and scope.

2. Starting from the files and modules listed, explore the relevant code. Trace through the layers of the feature area — from entry points (UI, CLI, API handlers) through business logic to data storage. Focus on the layers where the feature's core logic lives; skip shared infrastructure or low-level plumbing that doesn't vary between features.

   Document what's relevant from:
   - What this area does and how it's structured
   - Key files, entry points, and how data flows through them
   - Where data lives (database, models, config, state)
   - How components are connected (events, callbacks, state management, dependency injection)
   - Patterns used consistently in nearby similar features

3. Write `.aw/brownfield-progress/research.txt.draft`. Include the sections that are relevant to the area — not every section applies to every feature. Area Overview, Key Files, and Observations should always be included. The rest are optional.

```
# Research: [Feature Area]

## Area Overview
[What this part of the codebase does and how it's structured]

## Key Files
[Most relevant files with a one-line description of each]

## Data Flow
[How data moves through this area — source to display/output]

## Patterns in Use
[Patterns that appear consistently in nearby code]

## Observations
[Anything surprising or worth noting]
```

4. Present the findings to the user for review using `AskUserQuestion`:

   ```
   AskUserQuestion:
     question: "Here's the research. Does it look right?"
     options:
       - "Approved"
       - "Dig deeper into something"
       - "Something's missing"
   ```

   If anything other than "Approved", use a follow-up `AskUserQuestion` to find out what. Explore further, update the `.draft` file, and re-present until approved.

5. Once approved:
   1. Rename `.aw/brownfield-progress/research.txt.draft` to `.aw/brownfield-progress/research.txt`.
   2. Write a digest to `.aw/digests/research-digest.md` — see `/create-digest` for voice and structure.
   3. Confirm: "Research saved to `.aw/brownfield-progress/research.txt`. Digest at `.aw/digests/research-digest.md`"
