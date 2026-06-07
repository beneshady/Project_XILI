# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For project identity, architecture, and coding principles, see `docs/CORE_INSTRUCTIONS.MD`. This file contains only Claude Code-specific rules.

**Do not modify `AGENTS.md` — that is Codex's file.**

## Commands

```bash
# Play the game - open in browser
demo.html

# Run logic tests
tests/game_logic_test.html   # Unit tests (open in browser)
tests/harness.html          # Console-based tests
```

No build step required - the game runs directly in the browser.

## Claude Code Working Notes

- Claude Code operates primarily via browser-based verification.
- When modifying `src/core/`, the sync step (`node sync-shared.js`) may not be applicable in CC's runtime; flag this in output.
- For UI changes, verify with browser preview or screenshots.
- If verification environment is unavailable, explicitly state what was not verified and why.

## 文档渐进式披露 / Progressive Disclosure

Read docs progressively — only load what the current task requires:

1. **Always read**: `docs/CORE_INSTRUCTIONS.MD` (project overview, architecture, coding principles)
2. **By scenario**:
   - Assigned a US task → `docs/DEV_FLOW_FEISHU.md` → `docs/us/US-XXX_*.md`
   - Modifying core logic → `docs/CORE_LOGIC_SYNC.md` → `docs/architecture/SDD-Core-Logic.md`
   - Changing rendering/UI → `docs/architecture/SDD-Core-Logic.md`
   - Updating Feishu tracker → `docs/DEV_FLOW_FEISHU.md`
3. **As needed**: dive deeper based on the specific task
