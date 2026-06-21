// 排行榜系统 E2E —— 剩余用例（LB-02/04/06-10/12/14-18/21-25/28/31）
// 用例清单：tests/e2e/cases/leaderboard.md

const { test, expect } = require('@playwright/test');

test.describe('Leaderboard — extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForFunction(() => !!(window.ProjectXiliDemo && window.ProjectXiliDemo.__test));
    await page.evaluate(() => window.ProjectXiliDemo.__test.clearStorage());
    await page.evaluate(() => window.ProjectXiliDemo.restart());
  });

  // ============================================================
  // 1.1 排行榜按钮入口
  // ============================================================

  test('LB-02: overlay 打开时按钮显示「关闭」', async ({ page }) => {
    await page.click('#leaderboard-button');
    await expect(page.locator('button[data-action="close"]')).toBeVisible();
    await expect(page.locator('button[data-action="restart"]')).toHaveCount(0);
  });

  test('LB-04: 游戏结束状态下点「排行榜」按钮也能打开', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    // 关掉自动弹出的结算面板
    await page.click('button[data-action="skip"]');
    // 此时仍处在排行榜面板（skip 后跳转过去）；先关一下再点排行榜按钮
    await page.click('button[data-action="restart"]').catch(() => {});
    await page.click('#leaderboard-button');
    await expect(page.locator('#leaderboard-overlay')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('排行榜');
  });

  // ============================================================
  // 1.2 结算面板
  // ============================================================

  test('LB-06: 结算面板显示得分/回合/时间', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 33, turn: 14, elapsedSec: 65,
    }));
    const stats = page.locator('.modal .stats .v');
    await expect(stats.nth(0)).toHaveText('33');
    await expect(stats.nth(1)).toHaveText('14');
    await expect(stats.nth(2)).toHaveText('01:05');
  });

  test('LB-07: 名字输入框默认填上次名字', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.seedLastName('上次玩家'));
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    await expect(page.locator('#player-name')).toHaveValue('上次玩家');
  });

  test('LB-08: 名字输入框首次为空，placeholder 显示「匿名」', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    const input = page.locator('#player-name');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', '匿名');
  });

  test('LB-09: 按 Enter 键 = 点「保存成绩」', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 7, turn: 3, elapsedSec: 30,
    }));
    const input = page.locator('#player-name');
    await input.fill('回车测试');
    await input.press('Enter');
    // 应已进入排行榜面板
    await expect(page.locator('.leaderboard-table tr.current')).toContainText('回车测试');
  });

  test('LB-10: maxlength 限制 12 字符', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    await expect(page.locator('#player-name')).toHaveAttribute('maxlength', '12');
  });

  // ============================================================
  // 1.3 保存与上榜
  // ============================================================

  test('LB-12: 排行榜面板显示「本局排名：第 N 名」', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 50, turn: 10, elapsedSec: 60,
    }));
    await page.locator('#player-name').fill('第一名');
    await page.click('button[data-action="save"]');
    await expect(page.locator('.rank-line')).toContainText('第 1 名');
  });

  test('LB-14: 名字 trim：「  神  」→ 保存为「神」', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    await page.locator('#player-name').fill('  神  ');
    await page.click('button[data-action="save"]');
    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    expect(JSON.parse(raw)[0].name).toBe('神');
  });

  test('LB-15: 空名字 → 保存为「匿名」', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    await page.locator('#player-name').fill('');
    await page.click('button[data-action="save"]');
    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    expect(JSON.parse(raw)[0].name).toBe('匿名');
  });

  test('LB-16: 「不保存」→ 进入排行榜面板，不写 storage', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 5 }));
    await page.click('button[data-action="skip"]');
    // 应已进入排行榜面板
    await expect(page.locator('.modal h2')).toContainText('排行榜');
    // storage 未被写入
    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    const arr = raw ? JSON.parse(raw) : [];
    expect(arr).toEqual([]);
  });

  test('LB-17: 不保存 + 满榜 → 显示「未上榜」', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({length: 10}, (_, i) => ({
        name: `top${i}`, score: 100 - i, turn: 1, elapsedSec: 60,
        isVictory: false, timestamp: 1000 + i,
      }));
      window.ProjectXiliDemo.__test.seedLeaderboard(entries);
    });
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({ score: 0 }));
    await page.click('button[data-action="skip"]');
    await expect(page.locator('.rank-line')).toContainText('未上榜');
  });

  test('LB-18: 满榜 + 高分保存 → 上榜 + 最末位被剔除', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({length: 10}, (_, i) => ({
        name: `old${i}`, score: 50 - i, turn: 1, elapsedSec: 60,
        isVictory: false, timestamp: 1000 + i,
      }));
      window.ProjectXiliDemo.__test.seedLeaderboard(entries);
    });
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 9999, turn: 5, elapsedSec: 30,
    }));
    await page.locator('#player-name').fill('新王');
    await page.click('button[data-action="save"]');

    const raw = await page.evaluate(() => window.ProjectXiliDemo.__test.readLeaderboard());
    const arr = JSON.parse(raw);
    expect(arr).toHaveLength(10);
    expect(arr[0].name).toBe('新王');
    // old9（分数 41）应被挤掉
    expect(arr.some(e => e.name === 'old9')).toBe(false);
  });

  // ============================================================
  // 1.4 排行榜面板（排序 / 高亮 / 时间格式）
  // ============================================================

  test('LB-21: 排序：score DESC', async ({ page }) => {
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([
        { name: 'low',  score: 5,  turn: 1, elapsedSec: 60, isVictory: false, timestamp: 1 },
        { name: 'high', score: 50, turn: 1, elapsedSec: 60, isVictory: false, timestamp: 2 },
        { name: 'mid',  score: 25, turn: 1, elapsedSec: 60, isVictory: false, timestamp: 3 },
      ]);
    });
    await page.click('#leaderboard-button');
    const rows = page.locator('.leaderboard-table tbody tr');
    await expect(rows.nth(0)).toContainText('high');
    await expect(rows.nth(1)).toContainText('mid');
    await expect(rows.nth(2)).toContainText('low');
  });

  test('LB-22: 排序：相同 score → time ASC', async ({ page }) => {
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([
        { name: 'slow', score: 10, turn: 1, elapsedSec: 200, isVictory: false, timestamp: 1 },
        { name: 'fast', score: 10, turn: 1, elapsedSec: 30,  isVictory: false, timestamp: 2 },
      ]);
    });
    await page.click('#leaderboard-button');
    const rows = page.locator('.leaderboard-table tbody tr');
    await expect(rows.nth(0)).toContainText('fast');
    await expect(rows.nth(1)).toContainText('slow');
  });

  test('LB-23: 胜利记录显示 🏆 标记', async ({ page }) => {
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([
        { name: 'champion', score: 100, turn: 1, elapsedSec: 60, isVictory: true,  timestamp: 1 },
        { name: 'fallen',   score: 50,  turn: 1, elapsedSec: 60, isVictory: false, timestamp: 2 },
      ]);
    });
    await page.click('#leaderboard-button');
    const rows = page.locator('.leaderboard-table tbody tr');
    await expect(rows.nth(0)).toContainText('🏆');
    await expect(rows.nth(1)).not.toContainText('🏆');
  });

  test('LB-24: 时间格式 mm:ss（< 1 小时）', async ({ page }) => {
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([
        { name: 'a', score: 1, turn: 1, elapsedSec: 65,  isVictory: false, timestamp: 1 },
        { name: 'b', score: 2, turn: 1, elapsedSec: 5,   isVictory: false, timestamp: 2 },
      ]);
    });
    await page.click('#leaderboard-button');
    const cells = page.locator('.leaderboard-table tbody td.time');
    // b 在前（分高），时间 5 秒 → 00:05
    await expect(cells.nth(0)).toHaveText('00:05');
    await expect(cells.nth(1)).toHaveText('01:05');
  });

  test('LB-25: 时间格式 hh:mm:ss（≥ 1 小时）', async ({ page }) => {
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([
        { name: 'long', score: 1, turn: 1, elapsedSec: 3725, isVictory: false, timestamp: 1 },
      ]);
    });
    await page.click('#leaderboard-button');
    await expect(page.locator('.leaderboard-table tbody td.time').first()).toHaveText('01:02:05');
  });

  // ============================================================
  // 1.5 清空榜单（取消分支）
  // ============================================================

  test('LB-28: 取消清空 → 列表保持原样', async ({ page }) => {
    await page.evaluate(() => {
      window.ProjectXiliDemo.__test.seedLeaderboard([
        { name: 'keep', score: 5, turn: 1, elapsedSec: 60, isVictory: false, timestamp: 1 },
      ]);
    });
    await page.click('#leaderboard-button');
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(1);

    page.once('dialog', async (d) => { await d.dismiss(); });
    await page.click('button[data-action="clear"]');

    // 列表仍然有 1 条
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.leaderboard-table tbody tr').first()).toContainText('keep');
  });

  // ============================================================
  // 1.6 流程切换
  // ============================================================

  test('LB-31: 重启后 startedAt / finishedAt 重置', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.forceGameOver({
      score: 1, turn: 1, elapsedSec: 5,
    }));
    await page.click('button[data-action="skip"]');
    await page.click('button[data-action="restart"]');
    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.finishedAt).toBeUndefined();
    expect(state.startedAt).toBeGreaterThan(0);
    expect(state.turn).toBe(1);
  });
});
