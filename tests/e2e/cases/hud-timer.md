# HUD 与生存计时 E2E 用例

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| HUD-01 | ✅ | P0 | 开局后 startedAt 已写入 | `getState().startedAt > 0` |
| HUD-02 | ✅ | P1 | 1 Hz 刷新：等 2.5s 后时间至少进 2 秒 | `evaluate` 调用前后 `Date.now() - startedAt` 增长 |
| HUD-03 | ✅ | P0 | GAME_OVER 后 finishedAt 写入，时间停止增长 | `forceGameOver` → 等 1.5s → state.finishedAt 不再变 |
| HUD-04 | ✅ | P2 | 时间格式正确（视觉回归） | `expect(canvas).toHaveScreenshot()` 含 `时间: 00:0X` |
| HUD-05 | ✅ | P0 | restart 后 finishedAt 清零 | restart 后 `finishedAt === undefined` |
