# Rollback Instructions

Everything added by the disler-inspired setup can be removed cleanly.

## Quick Rollback (restore original state)

```bash
cd ~/.pi/agent
cp settings.json.bak settings.json
rm -rf extensions/disler/
rm -rf agents/
rm -rf themes/
rm -f damage-control-rules.yaml
rm -f justfile
rm -f ROLLBACK.md
```

## Full Rollback (from backup tarball)

```bash
cd ~/.pi/agent
tar xzf pre-setup-backup-20260315.tar.gz
rm -rf extensions/disler/ agents/ themes/
rm -f damage-control-rules.yaml justfile ROLLBACK.md
```

## What was NOT touched (safe)

- `settings.json` — original backed up as `settings.json.bak`
- `extensions/lazygit-shell.ts` — your existing extension, untouched
- `extensions/ralph-loop/` — your existing extension, untouched
- `skills/` — all symlinks untouched
- `sessions/` — all sessions untouched
- `auth.json` — untouched
