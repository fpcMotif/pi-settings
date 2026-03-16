#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/.bun/bin:/opt/zerobrew/prefix/bin:$(npm config get prefix 2>/dev/null)/bin:$PATH"

cd "$(dirname "$0")"

printf '== Pi power stack bootstrap ==\n\n'

printf '-> Installing local extension dependencies\n'
npm install

printf '\n-> Updating agent-browser\n'
bun add -g agent-browser@latest

printf '\n-> Installing Pi packages\n'
pi install https://github.com/emilkowalski/skill
pi install npm:pi-design-deck
pi install npm:pi-subagents
pi install npm:pi-mcp-adapter
pi install npm:glimpseui
pi install git:github.com/HazAT/pi-parallel

printf '\n-> Priming DeepWiki MCP metadata cache\n'
pi -p "/mcp reconnect deepwiki" || true

printf '\n-> Installing parallel CLI\n'
npm install -g parallel-web-cli

printf '\n== Next steps ==\n'
printf '1. Restart pi (or run /reload).\n'
printf '2. Authenticate parallel.ai if you want web research: parallel-cli login\n'
printf '3. Run the smoke test: ~/.pi/agent/scripts/smoke-test.sh\n'
