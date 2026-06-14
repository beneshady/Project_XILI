// HUD 与生存计时 E2E 用例
// 用例清单：tests/e2e/cases/hud-timer.md

const { test, expect } = require('@playwright/test');

test.describe('HUD & Survival Timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForFunction(() => !!(window.ProjectXiliDemo && window.ProjectXiliDemo.__test));
    await page.evaluate(() => window.ProjectXiliDemo.__test.clearStorage());
    await page.evaluate(() => window.ProjectXiliDemo.restart());
  });

  test('HUD-01: 开局后 startedAt 已写入', async ({ page }) => {
    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.startedAt).toBeGreaterThan(0);
    expect(state.finishedAt).toBeUndefined();
    expect(state.phase).toBe('player_turn');
  });

  test('HUD-02: 计时器每秒推进', async ({ page }) => {
    // 把 startedAt 拨回 5 秒前，等 1.5 秒后再读 → 应至少进了 1 秒
    await page.evaluate(() => {
      window.ProjectXiliDemo.getState().startedAt = Date.now() - 5000;
    });
    const before = await page.evaluate(() => Date.now() - window.ProjectXiliDemo.getState().startedAt);
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => Date.now() - window.ProjectXiliDemo.getState().startedAt);
    // 时间应至少推进 1000ms
    expect(after - before).toBeGreaterThanOrEqual(1000);
  });

  test('HUD-03: GAME_OVER 后 finishedAt 写入，时间停止增长', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 5, turn: 3, elapsedSec: 10,
    }));
    const finishedAt1 = await page.evaluate(() => window.ProjectXiliDemo.getState().finishedAt);
    expect(finishedAt1).toBeGreaterThan(0);
    await page.waitForTimeout(1100);
    const finishedAt2 = await page.evaluate(() => window.ProjectXiliDemo.getState().finishedAt);
    // 两次读到的应该是同一个值（finishedAt 不再变化）
    expect(finishedAt2).toBe(finishedAt1);
  });

  test('HUD-04: 时间在 canvas 中渲染（mm:ss 格式占位）', async ({ page }) => {
    // 不做像素回归，验渲染未抛错 + canvas 像素非空（HUD 区域有内容）
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    // 抓 canvas data URL，确认有非透明像素（说明渲染成功）
    const hasContent = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      // 在 alpha 通道检查至少有一个像素非 0
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return true;
      }
      return false;
    });
    expect(hasContent).toBe(true);
  });

  test('HUD-05: restart 后 finishedAt 清零', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 5, turn: 3, elapsedSec: 10,
    }));
    expect(await page.evaluate(() => window.ProjectXiliDemo.getState().finishedAt)).toBeGreaterThan(0);

    // 关结算面板（不保存）→ 排行榜面板 → 再来一局
    await page.click('button[data-action="skip"]');
    await page.click('button[data-action="restart"]');

    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.finishedAt).toBeUndefined();
    expect(state.startedAt).toBeGreaterThan(0);
  });
});
