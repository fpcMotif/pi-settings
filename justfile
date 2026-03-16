set dotenv-load := true

ext := "~/.pi/agent/extensions"

default:
    @just --list

# Plain pi (no extensions)
pi:
    pi

# Minimal footer: model + context meter
minimal:
    pi -e {{ext}}/disler/minimal.ts

# Tool counter: two-line footer with tokens, cost, per-tool tally
tool-counter:
    pi -e {{ext}}/disler/tool-counter.ts

# Damage control: safety interceptor (blocks dangerous commands)
damage-control:
    pi -e {{ext}}/disler/damage-control.ts -e {{ext}}/disler/minimal.ts

# Minimal + damage control (recommended daily driver)
safe:
    pi -e {{ext}}/disler/minimal.ts -e {{ext}}/disler/damage-control.ts

# Tool counter + damage control (full info + safety)
full:
    pi -e {{ext}}/disler/tool-counter.ts -e {{ext}}/disler/damage-control.ts

# Lazygit shell integration
lazygit:
    pi -e {{ext}}/lazygit-shell.ts -e {{ext}}/disler/minimal.ts

# Ralph loop + minimal
ralph:
    pi -e {{ext}}/ralph-loop/index.ts -e {{ext}}/disler/minimal.ts

# Everything stacked: tool-counter + damage-control + lazygit + ralph
max:
    pi -e {{ext}}/disler/tool-counter.ts -e {{ext}}/disler/damage-control.ts -e {{ext}}/lazygit-shell.ts -e {{ext}}/ralph-loop/index.ts
