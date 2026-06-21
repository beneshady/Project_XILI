// 排行榜系统 E2E 测试 —— 第一批 10 条 P0 用例
// 用例清单：tests/e2e/cases/leaderboard.md
// 运行：npm run test:e2e

const { test, expect } = require('@playwright/test');

test.describe('Leaderboard P0', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForFunction(() => !!(window.ProjectXiliDemo && window.ProjectXiliDemo.__test));
    // 干净起点：清 storage + 重启游戏（保证 startedAt 等是新的）
    await page.evaluate(() => window.ProjectXiliDemo.__test.clearStorage());
    await page.evaluate(() => window.ProjectXiliDemo.restart());
  });

  test('LB-01: 游戏中点「排行榜」按钮 → overlay 出现', async ({ page }) => {
    await page.click('#leaderboard-button');
    const overlay = page.locator('#leaderboard-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('h2')).toContainText('排行榜');
  });

  test('LB-03: 点「关闭」→ overlay 隐藏，游戏未重启', async ({ page }) => {
    const turnBefore = await page.evaluate(() => window.ProjectXiliDemo.getState().turn);
    const startedBefore = await page.evaluate(() => window.ProjectXiliDemo.getState().startedAt);

    await page.click('#leaderboard-button');
    await expect(page.locator('#leaderboard-overlay')).toBeVisible();

    await page.click('button[data-action="close"]');
    await expect(page.locator('#leaderboard-overlay')).toBeHidden();

    const turnAfter = await page.evaluate(() => window.ProjectXiliDemo.getState().turn);
    const startedAfter = await page.evaluate(() => window.ProjectXiliDemo.getState().startedAt);
    expect(turnAfter).toBe(turnBefore);
    expect(startedAfter).toBe(startedBefore);
  });

  test('LB-05: GAME_OVER 自动弹出结算面板', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 10, turn: 5, elapsedSec: 30,
    }));
    await expect(page.locator('#player-name')).toBeVisible();
    await expect(page.locator('button[data-action="save"]')).toBeVisible();
    await expect(page.locator('button[data-action="skip"]')).toBeVisible();
  });

  test('LB-11: 保存 → 排行榜显示本局高亮', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 42, turn: 18, elapsedSec: 222,
    }));

    const input = page.locator('#player-name');
    await input.fill('神之一手');
    await page.click('button[data-action="save"]');

    const currentRow = page.locator('.leaderboard-table tr.current');
    await expect(currentRow).toBeVisible();
    await expect(currentRow).toContainText('神之一手');
    await expect(currentRow.locator('td.score')).toHaveText('42');
    await expect(currentRow.locator('td.time')).toHaveText('03:42');
  });

  test('LB-13: 保存后 localStorage 写入正确 JSON', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 25, turn: 12, elapsedSec: 90, isVictory: true,
    }));
    await page.locator('#player-name').fill('选手 A');
    await page.click('button[data-action="save"]');

    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    expect(raw).not.toBeNull();
    const arr = JSON.parse(raw);
    expect(arr).toHaveLength(1);
    const e = arr[0];
    // 验所有 7 个字段
    expect(e.name).toBe('选手 A');
    expect(e.score).toBe(25);
    expect(e.turn).toBe(12);
    expect(e.elapsedSec).toBe(90);
    expect(e.isVictory).toBe(true);
    expect(typeof e.timestamp).toBe('number');
    expect(e.timestamp).toBeGreaterThan(0);
  });

  test('LB-19: 空榜单显示「尚无记录」', async ({ page }) => {
    await page.click('#leaderboard-button');
    await expect(page.locator('.leaderboard-empty')).toContainText('尚无记录');
  });

  test('LB-20: Top 10 截断 —— 12 条只显示 10 条', async ({ page }) => {
    // 灌入 12 条不同分数的记录
    await page.evaluate(() => {
      const entries = [];
      for (let i = 0; i < 12; i++) {
        entries.push({
          name: `p${i}`,
          score: i,            // 分数 0..11
          turn: 1,
          elapsedSec: 60,
          isVictory: false,
          timestamp: 1000 + i,
        });
      }
      window.ProjectXiliDemo.__test.seedLeaderboard(entries);
    });

    await page.click('#leaderboard-button');
    const rows = page.locator('.leaderboard-table tbody tr');
    await expect(rows).toHaveCount(10);
    // 头部是 p11（分最高），尾部应是 p2（p0 / p1 被剔除）
    await expect(rows.first()).toContainText('p11');
    await expect(rows.last()).toContainText('p2');
  });

  test('LB-26+27: 「清空榜单」二次确认 + 真实清空', async ({ page }) => {
    // 灌一条进去
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([{
        name: 'gone', score: 5, turn: 1, elapsedSec: 60,
        isVictory: false, timestamp: 1,
      }]);
    });
    await page.click('#leaderboard-button');
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(1);

    // 拦截 confirm
    let dialogType = null;
    page.once('dialog', async (d) => {
      dialogType = d.type();
      await d.accept();
    });
    await page.click('button[data-action="clear"]');

    // 确实弹了 confirm
    expect(dialogType).toBe('confirm');
    // 列表变空
    await expect(page.locator('.leaderboard-empty')).toContainText('尚无记录');
    // storage 被清空（应为 [] 或 null）
    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    const parsed = raw ? JSON.parse(raw) : [];
    expect(parsed).toEqual([]);
  });

  test('LB-29: overlay 打开时棋盘点击被屏蔽', async ({ page }) => {
    const turnBefore = await page.evaluate(() => window.ProjectXiliDemo.getState().turn);
    await page.click('#leaderboard-button');
    await expect(page.locator('#leaderboard-overlay')).toBeVisible();

    // 在 canvas 中央点一下
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // 给事件处理一点时间
    await page.waitForTimeout(100);

    const turnAfter = await page.evaluate(() => window.ProjectXiliDemo.getState().turn);
    expect(turnAfter).toBe(turnBefore);
  });

  test('LB-30: 结算后点「再来一局」→ overlay 关闭 + 游戏重启', async ({ page }) => {
    const startedBefore = await page.evaluate(() => window.ProjectXiliDemo.getState().startedAt);

    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 5, turn: 3, elapsedSec: 10,
    }));
    await page.locator('#player-name').fill('A');
    await page.click('button[data-action="save"]');

    // 此时是排行榜面板，按钮应是「再来一局」
    const restartBtn = page.locator('button[data-action="restart"]');
    await expect(restartBtn).toBeVisible();
    await restartBtn.click();

    // overlay 隐藏
    await expect(page.locator('#leaderboard-overlay')).toBeHidden();

    // 游戏已重启
    const stateAfter = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(stateAfter.turn).toBe(1);
    expect(stateAfter.score).toBe(0);
    expect(stateAfter.phase).toBe('player_turn');
    expect(stateAfter.finishedAt).toBeUndefined();
    expect(stateAfter.startedAt).toBeGreaterThanOrEqual(startedBefore);
  });
});
