# aw — Agentic Workflows

tmux-based TUI orchestrator. User sits in a sidebar pane, Claude runs in the right pane. The goal is to minimize user typing.

## Key directories

- `workflows/` — YAML workflow definitions (steps, agents, outputs)
- `skills/` — Skill markdown files grouped by workflow family (`brownfield/`, `greenfield/`)
- `.aw/digests/` — Markdown digests written by skills during execution
- `.aw/greenfield-progress/` — Greenfield workflow progress files
- `.aw/brownfield-progress/` — Brownfield workflow progress files
- `scripts/` — Build scripts (docs generator, etc.)
- `design/` — Design system references and mockups
- `src/` — TypeScript source (agents, workflows, components)

## How it connects

YAML workflows define steps → steps invoke skills → skills write output to progress dirs and digests to `.aw/digests/`.

## Build docs

```
node scripts/generate-docs.js
```

## Rules

- When editing skills in `skills/`, read `skills/SKILL-GUIDELINES.md` first.
- Skills use `AskUserQuestion` for input, never plain chat questions.
- Interactive skills write `.draft` files until approved, then rename to final.
