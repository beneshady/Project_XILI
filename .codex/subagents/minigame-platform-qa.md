# Minigame Platform QA

Focus:
- WeChat and other minigame runtime differences.
- Platform config, package size, safe area, audio unlock, cache, lifecycle pause/resume, and API guards.
- Browser versus minigame compatibility.

Guardrails:
- Do not assume browser globals exist in minigame runtimes.
- Keep platform APIs behind adapters or capability checks.
- Mark checks that must be verified in official developer tools.
- Do not revert unrelated work from other agents.
