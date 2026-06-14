# 视觉回归 E2E 用例

注：跨平台像素 diff 难处理，CI 用同一镜像。基准图存放在 `tests/e2e/__screenshots__/`，由 Playwright 自动管理。

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| VR-01 | ⬜ | P2 | 初始棋盘截图 | `expect(canvas).toHaveScreenshot('initial-board.png')` |
| VR-02 | ⬜ | P2 | 结算面板布局 | `expect(modal).toHaveScreenshot('result-modal.png')` |
| VR-03 | ⬜ | P2 | 排行榜满榜面板布局 | `expect(modal).toHaveScreenshot('leaderboard-full.png')` |
| VR-04 | ⬜ | P2 | GAME_OVER HUD 截图 | 验 canvas HUD 在 GAME_OVER 时的渲染 |
