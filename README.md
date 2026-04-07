# aw — Agentic Workflows

Orchestrate AI coding agents through multi-step workflows.

A tmux-based TUI that drives Claude Code (or Codex) through YAML-defined workflows. The left pane shows a sidebar with workflow phases, steps, and task progress; the right pane runs the real agent CLI with its full interactive experience. Steps auto-advance on completion, context is cleared between phases, and looping phases repeat until all tasks are done.

## How It Works

`aw` splits your terminal into two tmux panes:

- **Left pane** — an Ink-based sidebar showing workflow phases, steps, and task checklists. You navigate and trigger steps from here.
- **Right pane** — the actual agent CLI (Claude Code, Codex, etc.) running interactively.

When you hit Enter on a step, `aw` sends the step's skill or prompt to the agent. A Stop hook writes a signal file when the agent finishes responding, and `aw` auto-advances to the next step. Between phases, the agent session is cleared so each phase starts with fresh context.

For looping phases (like a build loop), `aw` reads `tasks.json` from the progress directory and restarts the phase until all tasks are marked done.

## Quick Start

### Prerequisites

- **tmux** - `brew install tmux`
- **Claude Code** - `brew install claude-code` (or npm)
- **Node.js** >= 18

### Install

```bash
npm install
npm run build
```

### Stop hook

`aw` auto-configures the Stop hook in your project's `.claude/settings.local.json` on first launch. No manual setup needed.

If you prefer a global configuration instead (so you don't get a project-level settings file), add this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "mkdir -p \"$PWD/.aw\" && touch \"$PWD/.aw/stop-signal\""
          }
        ]
      }
    ]
  }
}
```

### Shell function (optional)

Add to your `~/.zshrc` for easy launching:

```bash
function aw() {
  local cmd="node /path/to/agentic-workflows/dist/index.js"
  if [ -n "$TMUX" ]; then
    eval "$cmd"
  else
    tmux kill-session -t aw 2>/dev/null
    tmux new-session -s aw "zsh -ic 'aw'"
  fi
}
```

### Add to .gitignore

```
.aw/
```

## Workflows

Workflows are YAML files in `workflows/`. Each workflow defines phases containing steps. Steps reference skills (slash commands) that are sent to the agent.

```yaml
name: my-workflow
description: What this workflow does
agent: claude
progress_dir: my-progress
phases:
  - name: Define
    steps:
      - name: Create Spec
        skill: /my-create-spec
        type: think
        outputs:
          - spec.xml
  - name: Build
    loop: true
    steps:
      - name: Triage
        skill: /my-triage
        type: think
      - name: Implement
        skill: /my-implement
        type: code
        permissions: code
```

### Step options

| Field | Description |
|-------|-------------|
| `skill` | Slash command to send to the agent (e.g., `/lf-resume`) |
| `type` | `think`, `code`, or `input` — controls step styling |
| `outputs` | Files the step must produce before advancing (e.g., `spec.xml`) |
| `permissions` | Agent permission level: `default`, `code`, or `auto` |
| `parallel` | Run this step concurrently with adjacent parallel steps |
| `skip_when` | Skip based on a field value in a prior step's output JSON |
| `command` | Raw shell command instead of an agent skill |

### Looping phases

Set `loop: true` on a phase. After the last step completes, `aw` checks `tasks.json` in the progress directory. If incomplete tasks remain, the phase restarts with a fresh agent session.

## Skills

Skills are directories containing a `SKILL.md` file. Workflows reference them by slash command name. The tool ships with example skills in `skills/greenfield/` and `skills/brownfield/` — see [skills/SKILL-GUIDELINES.md](skills/SKILL-GUIDELINES.md) for authoring conventions.

### Linking skills globally

Use `scripts/link-skill.sh` to symlink skills into `~/.claude/skills/` so they're available from any repo:

```bash
./scripts/link-skill.sh                    # List available skills
./scripts/link-skill.sh my-skill           # Link a skill
./scripts/link-skill.sh --list             # Show linked skills
./scripts/link-skill.sh --unlink my-skill  # Remove a link
```

## Key Bindings

| Key | Action |
|-----|--------|
| Up/Down | Navigate steps |
| Enter | Run selected step |
| c | Send "continue" to the agent |
| i | Focus the agent pane (type directly) |
| Esc | Cancel running step |
| t | Cycle through tasks |
| r | Reset workflow |
| w | Switch workflow |
| d | Regenerate docs |
| l | Link/unlink skills |
| q | Quit |

## Example Workflows

The project includes two example workflows:

- **`workflows/greenfield.yaml`** — Full greenfield feature development: spec, tasks, TDD build loop, testing notes.
- **`workflows/brownfield.yaml`** — Brownfield workflow for existing codebases with ticket-driven development.

These demonstrate the workflow YAML format and how to chain skills together. Create your own workflows in `workflows/` tailored to your development process.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run docs` | Generates `.aw/docs/index.html` — a visual workflow index page |
| `scripts/link-skill.sh` | Symlinks skills into `~/.claude/skills/` for global availability |
