---
name: ralph-loop
description: Ralph Wiggum iterative development loop. Feeds the same prompt repeatedly so the AI sees its previous work and iteratively improves. Use for well-defined tasks with clear completion criteria.
---

# Ralph Loop — Iterative AI Development

Ralph Loop implements the Ralph Wiggum technique — an iterative methodology where the same prompt is fed to the AI repeatedly. Each iteration, the AI sees its previous work in files and git history, enabling systematic improvement.

## Commands

### /ralph-loop PROMPT [OPTIONS]

Start an iterative Ralph loop in your current session.

**Options:**
- `--max-iterations <n>` — Auto-stop after N iterations (default: unlimited)
- `--completion-promise "<text>"` — Stop when AI calls `ralph_promise` tool with matching text

**Examples:**
```
/ralph-loop Build a REST API for todos --completion-promise "DONE" --max-iterations 20
/ralph-loop Fix the auth bug --max-iterations 10
/ralph-loop Refactor cache layer --completion-promise "ALL TESTS PASS"
```

### /cancel-ralph
Stop an active Ralph loop immediately.

### /ralph-status
Show current Ralph loop status.

## Completion via Tool

When a completion promise is set, signal completion by calling the `ralph_promise` tool:
```
ralph_promise(promise_text: "DONE")
```
Only call this when the promise statement is genuinely TRUE.

## How It Works

1. `/ralph-loop "your task"` starts the loop
2. AI works on the task
3. When AI finishes (`agent_end` event fires), same prompt is fed back
4. AI sees its previous work in files and iterates
5. Loop stops when: promise fulfilled via `ralph_promise` tool, max iterations reached, or `/cancel-ralph`

## State

Loop state: `.pi/ralph-loop.state.json` — survives restarts (resume with `pi -c`).
