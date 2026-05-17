# Cocos JS Workflow

Use when editing Cocos Creator JavaScript or TypeScript gameplay and UI scripts.

Rules:
- Inspect nearby components, scene usage, and core logic before changing public fields.
- Prefer existing lifecycle patterns such as `onLoad`, `start`, `update`, `onEnable`, and `onDisable`.
- Do not casually rename serialized fields, scene nodes, prefab references, or resource paths.
- Avoid editing `.meta` files unless the task is explicitly about asset metadata.
- Keep platform APIs behind adapters or capability checks.
- Keep gameplay rules in pure logic modules where possible; Cocos components should adapt input, rendering, UI, and lifecycle.

Verification:
- Run the smallest relevant logic test.
- If build scripts exist, run the smallest relevant Cocos or Web build.
- For visible UI changes, capture browser or preview screenshots when feasible.
