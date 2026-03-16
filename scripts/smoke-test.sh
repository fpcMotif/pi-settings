#!/usr/bin/env bash
set -u

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/.bun/bin:/opt/zerobrew/prefix/bin:$(npm config get prefix 2>/dev/null)/bin:$PATH"

SETTINGS_FILE="$HOME/.pi/agent/settings.json"
AGENTS_FILE="$HOME/.pi/agent/AGENTS.md"
MCP_FILE="$HOME/.pi/agent/mcp.json"

pass_count=0
warn_count=0
fail_count=0

pass() {
  printf 'PASS  %s\n' "$1"
  pass_count=$((pass_count + 1))
}

warn() {
  printf 'WARN  %s\n' "$1"
  warn_count=$((warn_count + 1))
}

fail() {
  printf 'FAIL  %s\n' "$1"
  fail_count=$((fail_count + 1))
}

have() {
  command -v "$1" >/dev/null 2>&1
}

version_of() {
  "$@" 2>/dev/null | /usr/bin/head -n 1
}

printf '== Pi power stack smoke test ==\n\n'

for file in "$SETTINGS_FILE" "$AGENTS_FILE" "$MCP_FILE"; do
  if [ -f "$file" ]; then
    pass "Found $(basename "$file")"
  else
    fail "Missing $file"
  fi
done

printf '\n== CLI versions ==\n'
if have pi; then
  pass "pi: $(pi --version)"
else
  fail 'pi not found on PATH'
fi

if have mgrep; then
  pass "mgrep: $(version_of mgrep --version)"
else
  fail 'mgrep not found on PATH'
fi

if have agent-browser; then
  pass "agent-browser: $(agent-browser --version)"
else
  fail 'agent-browser not found on PATH'
fi

if have parallel-cli; then
  pass "parallel-cli: $(parallel-cli --version)"
  parallel_auth_json="$(parallel-cli auth --json 2>/dev/null || true)"
  if printf '%s' "$parallel_auth_json" | /usr/bin/python3 - <<'PY'
import json, sys
raw = sys.stdin.read().strip()
if not raw:
    raise SystemExit(1)
obj = json.loads(raw)
raise SystemExit(0 if obj.get('authenticated') else 1)
PY
  then
    pass 'parallel-cli is authenticated'
  else
    warn 'parallel-cli is installed but not authenticated; run: parallel-cli login'
  fi
else
  warn 'parallel-cli not found; install with: npm install -g parallel-web-cli'
fi

if have gh; then
  if gh auth status >/dev/null 2>&1; then
    pass 'gh is authenticated'
  else
    warn 'gh is installed but not authenticated'
  fi
else
  warn 'gh not found on PATH'
fi

printf '\n== Config checks ==\n'
/usr/bin/python3 - <<'PY'
import json, pathlib, sys
settings = pathlib.Path.home() / '.pi' / 'agent' / 'settings.json'
mcp = pathlib.Path.home() / '.pi' / 'agent' / 'mcp.json'
required_packages = {
    'https://github.com/emilkowalski/skill',
    'npm:pi-design-deck',
    'npm:pi-subagents',
    'npm:pi-mcp-adapter',
    'npm:glimpseui',
    'git:github.com/HazAT/pi-parallel',
}
try:
    settings_data = json.loads(settings.read_text())
    packages = set(settings_data.get('packages', []))
    missing = sorted(required_packages - packages)
    if missing:
        print('FAIL  Missing packages in settings.json: ' + ', '.join(missing))
    else:
        print('PASS  settings.json contains the expected package set')
    prefix = settings_data.get('shellCommandPrefix', '')
    if '/usr/bin:/bin:/usr/sbin:/sbin' in prefix and '$(npm config get prefix)/bin' in prefix:
        print('PASS  shellCommandPrefix includes system bins and npm global bins')
    else:
        print('FAIL  shellCommandPrefix is missing system bins or npm global bins')
except Exception as exc:
    print(f'FAIL  Could not parse settings.json: {exc}')

try:
    mcp_data = json.loads(mcp.read_text())
    deepwiki = (mcp_data.get('mcpServers') or {}).get('deepwiki') or {}
    if deepwiki.get('url') == 'https://mcp.deepwiki.com/mcp':
        print('PASS  deepwiki MCP URL is configured')
    else:
        print('FAIL  deepwiki MCP URL is missing or incorrect')
    tools = deepwiki.get('directTools') or []
    expected_tools = {'read_wiki_structure', 'read_wiki_contents', 'ask_question'}
    if expected_tools.issubset(set(tools)):
        print('PASS  deepwiki direct tools are configured')
    else:
        print('WARN  deepwiki direct tools are not fully configured')
except Exception as exc:
    print(f'FAIL  Could not parse mcp.json: {exc}')
PY

printf '\n== DeepWiki MCP handshake ==\n'
/usr/bin/python3 - <<'PY'
import json, urllib.request
url = 'https://mcp.deepwiki.com/mcp'
body = {
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'initialize',
    'params': {
        'protocolVersion': '2025-03-26',
        'capabilities': {},
        'clientInfo': {'name': 'pi-smoke-test', 'version': '0.1.0'},
    },
}
try:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = resp.read().decode('utf-8', errors='ignore')
    wanted = ['read_wiki_structure', 'read_wiki_contents', 'ask_question']
    if all(name in payload for name in wanted):
        print('PASS  DeepWiki MCP is reachable and advertises the expected public tools')
    else:
        print('WARN  DeepWiki MCP responded, but expected tool names were not all present')
except Exception as exc:
    print(f'FAIL  DeepWiki MCP handshake failed: {exc}')
PY

printf '\n== Installed Pi packages ==\n'
if have pi; then
  pi list || true
fi

printf '\n== Summary ==\n'
printf 'PASS=%s WARN=%s FAIL=%s\n' "$pass_count" "$warn_count" "$fail_count"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
