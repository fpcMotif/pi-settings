# Pi Power Stack

Personal Pi setup for high-agency software work across:
- frontend
- terminal/TUI
- Swift/macOS

## Quick start

```bash
git clone https://github.com/fpcMotif/pi-settings ~/.pi/agent
cd ~/.pi/agent
./setup.sh
```

Then restart Pi and run:

```bash
~/.pi/agent/scripts/smoke-test.sh
```

## Installed package stack

- `https://github.com/emilkowalski/skill` — design engineering taste + motion guidance
- `npm:pi-design-deck` — visual option decks for UI decisions
- `npm:pi-subagents` — scout/planner/worker/reviewer delegation
- `npm:pi-mcp-adapter` — MCP support without ballooning context
- `npm:glimpseui` — native macOS windows for MCP/design UIs
- `git:github.com/HazAT/pi-parallel` — parallel.ai web tools

## Key local files

- `settings.json` — defaults + package list + shell PATH fixups
- `AGENTS.md` — workflow rules for future sessions
- `mcp.json` — official DeepWiki MCP wiring
- `scripts/smoke-test.sh` — exact setup verification

## Important notes

### agent-browser
Updated to the latest version available during setup.

### DeepWiki MCP
Configured against the official public endpoint:
- `https://mcp.deepwiki.com/mcp`

Direct tools configured:
- `read_wiki_structure`
- `read_wiki_contents`
- `ask_question`

If direct tools do not show up immediately, restart Pi once after the metadata cache is populated.

### parallel.ai
The upstream `pi-parallel` README points to `@parallel-web/cli`, but the working public npm package is currently:
- `parallel-web-cli`

Installed binary:
- `parallel-cli`

Next step if you want live web research:
```bash
parallel-cli login
```

## Smoke test

```bash
~/.pi/agent/scripts/smoke-test.sh
```
