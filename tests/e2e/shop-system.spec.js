const { test, expect } = require('@playwright/test');

const BOARD_ORIGIN = 28;
const CELL_SIZE = 78;

function boardPoint(pos) {
  return {
    x: BOARD_ORIGIN + pos.x * CELL_SIZE,
    y: BOARD_ORIGIN + pos.y * CELL_SIZE,
  };
}

async function setupShopDuringEnemyTurn(page) {
  return page.evaluate(() => {
    const state = window.ProjectXiliDemo.getState();
    for (const cell of state.grid.cells.values()) {
      cell.entity = null;
      cell.isPlayerAccessible = false;
      cell.isThreatened = false;
    }

    state.turn = 7;
    state.score = 3;
    state.coins = 10;
    state.lastShopScore = 3;
    state.animating = false;
    state.phase = 'enemy_turn';
    state.killStreak = 0;
    state.frozenEnemies.clear();

    const player = state.player;
    player.position = { x: 4, y: 4 };
    player.isDead = false;
    state.entities.clear();
    state.entities.set(player.id, player);
    state.grid.cells.get('4,4').entity = player;
    state.grid.cells.get('5,4').isPlayerAccessible = true;

    const enemy = {
      id: 'shop_test_enemy',
      type: 'soldier',
      team: 'enemy',
      position: { x: 0, y: 0 },
      isDead: false,
      threatRange: [],
      nextMove: { x: 0, y: 1 },
    };
    state.enemies = [enemy];
    state.entities.set(enemy.id, enemy);
    state.grid.cells.get('0,0').entity = enemy;

    const previousPhase = state.phase;
    window.ProjectXiliDemo.__test.setShopOffers(['armor']);
    return {
      previousPhase,
      phase: state.phase,
      turn: state.turn,
      player: { ...state.player.position },
      enemies: state.enemies.map(item => ({
        id: item.id,
        type: item.type,
        position: { ...item.position },
        nextMove: item.nextMove ? { ...item.nextMove } : null,
        isDead: item.isDead,
      })),
    };
  });
}

async function readTurnSnapshot(page) {
  return page.evaluate(() => {
    const state = window.ProjectXiliDemo.getState();
    return {
      phase: state.phase,
      turn: state.turn,
      player: { ...state.player.position },
      enemies: state.enemies.map(item => ({
        id: item.id,
        type: item.type,
        position: { ...item.position },
        nextMove: item.nextMove ? { ...item.nextMove } : null,
        isDead: item.isDead,
      })),
    };
  });
}

test.describe('Shop System', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/demo.html');
    await page.waitForFunction(() => !!window.ProjectXiliDemo?.__test);
    await page.evaluate(() => window.ProjectXiliDemo.restart());
  });

  test('SHOP-01: score award grants equal coins and opens modal at threshold', async ({ page }) => {
    await page.evaluate(() => {
      const t = window.ProjectXiliDemo.__test;
      t.awardScore(3);
      t.openShop();
    });
    await expect(page.locator('.shop-modal')).toBeVisible();
    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.score).toBe(3);
    expect(state.coins).toBe(3);
    expect(state.phase).toBe('shop');
  });

  test('SHOP-02: duplicate offers purchase independently and max disables remainder', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.ProjectXiliDemo.getState();
      s.coins = 10;
      s.skills.aura = 2;
      window.ProjectXiliDemo.__test.setShopOffers(['aura', 'aura']);
    });
    const buttons = page.locator('[data-action="buy"]');
    await buttons.nth(0).click();
    await expect(buttons.nth(1)).toBeDisabled();
    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.skills.aura).toBe(3);
    expect(state.coins).toBe(5);
  });

  test('SHOP-03: zero-buy close returns to player turn and timer excludes pause', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.ProjectXiliDemo.getState();
      s.phase = 'enemy_turn';
      s.score = 3;
      s.startedAt = Date.now() - 5000;
      window.ProjectXiliDemo.__test.openShop(Date.now() - 3000);
    });
    const before = await page.evaluate(() => window.ProjectXiliDemo.__test.getElapsedGameMs());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.ProjectXiliDemo.__test.getElapsedGameMs());
    expect(after - before).toBeLessThan(150);
    const turnBeforeClose = await page.evaluate(() => window.ProjectXiliDemo.getState().turn);
    await page.locator('[data-action="continue"]').click();
    await expect(page.locator('.shop-modal')).toBeHidden();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.ProjectXiliDemo.__test.executeEnemyTurn());
    const state = await page.evaluate(() => {
      const s = window.ProjectXiliDemo.getState();
      return { phase: s.phase, turn: s.turn };
    });
    expect(state).toEqual({ phase: 'player_turn', turn: turnBeforeClose });
  });

  test('SHOP-05: continue after shop does not resume or execute enemy turn', async ({ page }) => {
    const opened = await setupShopDuringEnemyTurn(page);
    expect(opened.previousPhase).toBe('enemy_turn');
    expect(opened.phase).toBe('shop');
    expect(opened.turn).toBe(7);
    expect(opened.enemies).toEqual([{
      id: 'shop_test_enemy',
      type: 'soldier',
      position: { x: 0, y: 0 },
      nextMove: { x: 0, y: 1 },
      isDead: false,
    }]);

    await page.locator('[data-action="continue"]').click();
    await expect(page.locator('.shop-modal')).toBeHidden();

    const closed = await readTurnSnapshot(page);
    expect(closed.phase).toBe('player_turn');
    expect(closed.turn).toBe(opened.turn);
    expect(closed.enemies).toEqual(opened.enemies);

    await page.waitForTimeout(260);
    const settled = await readTurnSnapshot(page);
    expect(settled.phase).toBe('player_turn');
    expect(settled.turn).toBe(opened.turn);
    expect(settled.enemies).toEqual(opened.enemies);

    await page.locator('#game-canvas').click({ position: boardPoint({ x: 5, y: 4 }) });
    const moved = await readTurnSnapshot(page);
    expect(moved.player).toEqual({ x: 5, y: 4 });
    expect(moved.phase).toBe('enemy_turn');
  });

  test('SHOP-04: shop blocks board input and enemy progression', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.setShopOffers(['armor']));
    const before = await page.evaluate(() => {
      const s = window.ProjectXiliDemo.getState();
      return { turn: s.turn, player: { ...s.player.position }, phase: s.phase };
    });
    await page.locator('#game-canvas').click({ position: { x: 100, y: 100 }, force: true });
    await page.evaluate(() => window.ProjectXiliDemo.__test.executeEnemyTurn());
    const after = await page.evaluate(() => {
      const s = window.ProjectXiliDemo.getState();
      return { turn: s.turn, player: { ...s.player.position }, phase: s.phase };
    });
    expect(after).toEqual(before);
  });
});
