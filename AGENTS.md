# Pi Power Stack

Use this setup as a fast, elegant coding cockpit for frontend, TUI, and Swift/macOS work.

## Default workflow

1. **Understand code semantically first**
   - Use `mgrep` when the user asks how something works, where logic lives, or which files matter.
   - Use `rg` only after `mgrep` narrows the area.

2. **Use the right research lane**
   - For **public repo/library docs**, prefer **DeepWiki MCP** first.
   - For **open-web/current info**, prefer **parallel_search` / `parallel_extract` / `parallel_research`** when authenticated.
   - If parallel tools are unavailable or unauthenticated, say so plainly and fall back.

3. **Use browsers for reality checks**
   - Use `agent-browser` for login flows, screenshots, visual QA, repro steps, and interaction testing.
   - Re-snapshot after every meaningful DOM change.

4. **Split big work into roles**
   - Use `pi-subagents` for scout → planner → worker → reviewer style tasks.
   - Keep the main thread focused on strategy, synthesis, and decision making.

5. **Design before polishing**
   - For UI direction work, load `emil-design-eng`.
   - When comparing multiple product or component directions, use **Design Deck**.

## Product taste rules

### Frontend
- Prefer crisp, keyboard-friendly, low-latency interactions.
- Animate only when it improves clarity.
- Favor `transform` and `opacity` over layout-changing properties.

### TUI
- Bias toward dense information, visible state, strong shortcuts, and minimal latency.
- Avoid ornamental motion. Terminal workflows should feel immediate.

### Swift / macOS
- Prefer native patterns, accessibility, reduced motion support, and clean menu/toolbar integration.
- Match platform expectations before adding custom chrome.

## Tool preferences

- **Code search:** `mgrep` → `rg`
- **Public docs:** DeepWiki MCP
- **Web research:** parallel.ai tools
- **Visual testing:** agent-browser
- **Design optioning:** Design Deck + `emil-design-eng`
- **Large tasks:** pi-subagents

## Output style

- Be concise.
- Prefer simple, testable implementations.
- Call out blockers early, especially auth/config blockers.
