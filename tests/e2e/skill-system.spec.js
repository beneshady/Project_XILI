// 技能系统 E2E 用例
// 用例清单：tests/e2e/cases/skill-system.md

const { test, expect } = require('@playwright/test');

test.describe('Skill System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
    await page.waitForFunction(() => !!(window.ProjectXiliDemo && window.ProjectXiliDemo.__test));
    await page.evaluate(() => window.ProjectXiliDemo.__test.clearStorage());
    await page.evaluate(() => window.ProjectXiliDemo.restart());
  });

  test('SK-01: 初始 5 个技能等级都为 0', async ({ page }) => {
    const skills = await page.evaluate(() => window.ProjectXiliDemo.getState().skills);
    expect(skills).toEqual({
      armor: 0,
      intimidate: 0,
      castling: 0,
      aura: 0,
      siege: 0,
    });
  });

  test('SK-02: grantSkill 后对应技能 +1', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.grantSkill('armor'));
    const skills = await page.evaluate(() => window.ProjectXiliDemo.getState().skills);
    expect(skills.armor).toBe(1);
    // 其它技能不受影响
    expect(skills.intimidate).toBe(0);
    expect(skills.castling).toBe(0);
    expect(skills.aura).toBe(0);
    expect(skills.siege).toBe(0);
  });

  test('SK-03: castling 首次获得，cooldown 重置为 0', async ({ page }) => {
    // 先把 cooldown 拨成非 0，验证 grant 会重置
    await page.evaluate(() => { window.ProjectXiliDemo.getState().castlingCooldown = 99; });
    await page.evaluate(() => window.ProjectXiliDemo.__test.grantSkill('castling'));
    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.skills.castling).toBe(1);
    expect(state.castlingCooldown).toBe(0);
  });

  test('SK-04: siege 首次获得，timer 初始化为 spec 1 级值（3）', async ({ page }) => {
    await page.evaluate(() => window.ProjectXiliDemo.__test.grantSkill('siege'));
    const state = await page.evaluate(() => window.ProjectXiliDemo.getState());
    expect(state.skills.siege).toBe(1);
    expect(state.siegeTimer).toBe(3);
  });

  test('SK-05: getScalingValue 越级时返回上限值', async ({ page }) => {
    const v = await page.evaluate(() => {
      const t = window.ProjectXiliDemo.__test;
      return t.getScalingValue(t.SKILL_SPECS.aura, 'auraRange', 99);
    });
    expect(v).toBe(2); // aura.scaling.auraRange = [1, 1, 2]
  });
});
