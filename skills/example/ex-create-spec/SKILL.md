---
name: ex-create-spec
description: "Example skill — write a spec from a one-line idea. Demonstrates AskUserQuestion input, .draft file pattern, and digest output."
---

# Create Spec (Example)

Turn a one-line idea into a short spec.

## Step 1: Get the idea

```
AskUserQuestion:
  question: "What do you want to build?"
  options:
    - "A greeting CLI tool"
    - "A number formatter"
    - "Let me type something"
```

## Step 2: Write spec

Write `.aw/test-progress/spec.md.draft`:

```markdown
# <Title>

## Goal
<One sentence based on their choice>

## Requirements
- R1: <requirement>
- R2: <requirement>

## Done When
- <Single acceptance criterion>
```

Then ask:

```
AskUserQuestion:
  question: "Spec look good?"
  options:
    - "Approved"
    - "Revise"
```

## Step 3: Finalize

On approval, rename `.aw/test-progress/spec.md.draft` → `.aw/test-progress/spec.md`.

Say: "Spec saved."
