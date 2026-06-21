// 边界与容错 E2E 用例
// 用例清单：tests/e2e/cases/edge-cases.md

const { test, expect } = require('@playwright/test');

test.describe('Edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForFunction(() => !!(window.ProjectXiliDemo && window.ProjectXiliDemo.__test));
    await page.evaluate(() => window.ProjectXiliDemo.__test.clearStorage());
    await page.evaluate(() => window.ProjectXiliDemo.restart());
  });

  test('EDGE-01: localStorage 损坏 JSON → 当作空榜，不崩', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.seedLeaderboardRaw('not json {{{'));
    await page.click('#leaderboard-button');
    await expect(page.locator('.leaderboard-empty')).toContainText('尚无记录');
  });

  test('EDGE-02: schema 错误（缺字段）→ 跳过该条', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.seedLeaderboardRaw(
      JSON.stringify([{ name: 'x' }, { score: 5 }, null, 'foo'])
    ));
    await page.click('#leaderboard-button');
    // 全部条目都不合法 → 列表为空
    await expect(page.locator('.leaderboard-empty')).toContainText('尚无记录');
  });

  test('EDGE-03: 隐私模式（localStorage 抛错）→ 保存按钮点了不崩', async ({ page }) => {
    // 在 page 内 stub localStorage.setItem 抛错
    await page.evaluate(() => {
      const origSet = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(key, value) {
        if (key === 'xili_leaderboard_v1') throw new Error('quota exceeded');
        return origSet(key, value);
      };
    });
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    await page.locator('#player-name').fill('quotaTest');
    await page.click('button[data-action="save"]');
    // 应进入排行榜面板（即便写入失败）
    await expect(page.locator('.modal h2')).toContainText('排行榜');
  });

  test('EDGE-04: 0 分死亡 → 仍能保存上榜', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 0, turn: 1, elapsedSec: 5,
    }));
    await page.locator('#player-name').fill('零分');
    await page.click('button[data-action="save"]');
    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    const arr = JSON.parse(raw);
    expect(arr).toHaveLength(1);
    expect(arr[0].score).toBe(0);
    expect(arr[0].name).toBe('零分');
  });
});
