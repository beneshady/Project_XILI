# Playwright Game Test

Use when adding or changing automated browser tests for the game.

Rules:
- Prefer deterministic game state setup over random click paths.
- Expose stable selectors or debug state in the Web test harness.
- Test player input, state transitions, score changes, game over, and visual smoke checks.
- Save screenshots for important gameplay states and failures.
- Keep Playwright tests focused; core rules should remain covered by unit tests.

Verification:
- Run `pnpm test:e2e` when configured.
- If Playwright is not installed, document the missing dependency and provide the exact command to install it.
- Preserve traces and HTML reports under `reports/` or Playwright's configured output folder.
