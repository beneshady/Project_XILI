# 技能系统 E2E 用例

注：核心 spec 表已有 39 项单元测试覆盖，E2E 仅验 UI / 集成路径。

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| SK-01 | ✅ | P1 | 初始 5 个技能等级都为 0 | `getState().skills` 全为 0 |
| SK-02 | ✅ | P1 | 显式授予技能后，对应技能 +1 | 测试钩子调用 `grantSkill` |
| SK-03 | ✅ | P1 | castling 首次获得，cooldown 重置为 0 | 模拟首次获得 → `castlingCooldown === 0` |
| SK-04 | ✅ | P1 | siege 首次获得，timer 初始化为 spec 的 1 级值（3） | 同上 → `siegeTimer === 3` |
| SK-05 | ✅ | P2 | 技能数值越级保护：等级超 maxLevel 时返回上限值 | `getScalingValue(SKILL_SPECS.aura, 'auraRange', 99)` === 2 |
