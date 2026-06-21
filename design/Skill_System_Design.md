# 技能系统设计文档 (Skill System Design)

**版本**: v0.3
**日期**: 2026-06-15
**状态**: 框架已落地，技能持续扩展中

---

## 1. 概述

本文档定义「回合制象棋肉鸽」游戏的技能系统设计与实现规范。

### 1.1 设计目标

- 丰富玩家决策空间，增加局内策略深度
- 提供「Roll 技能」体验，增强 roguelike 随机性
- 保持象棋主题一致性，技能与棋子流派挂钩
- 数据驱动，新增技能不需要改动逻辑/类型层

### 1.2 技能触发时机

| 时机 | 描述 |
|------|------|
| **商店购买** | 达到 3 / 7 / +5 积分阈值后进入商店，消耗金币购买候选技能 |
| **局前选择** | （规划中）开局时可选携带 1-2 个被动技能 |

---

## 2. 技术框架（已实现）

### 2.1 数据模型

技能采用 **数据驱动** 的 `SkillSpec`，所有静态信息（名称、描述、流派、数值曲线）集中在 [src/core/SkillSpecs.ts](src/core/SkillSpecs.ts) 的 `SKILL_SPECS` 表，逻辑行为在 [src/core/SkillSystem.ts](src/core/SkillSystem.ts)。

```typescript
// src/core/types.ts
export enum SkillType {
  DAMAGE   = 'damage',
  MOVEMENT = 'movement',
  DEFENSE  = 'defense',
  UTILITY  = 'utility',
}

export enum Faction {
  GENERAL  = 'general',   // 帅
  ROOK     = 'rook',      // 车
  KNIGHT   = 'knight',    // 马
  CANNON   = 'cannon',    // 炮
  ELEPHANT = 'elephant',  // 相
  SOLDIER  = 'soldier',   // 兵
}

export interface SkillSpec {
  id:       string;
  name:     string;
  desc:     string;
  flavor:   string;
  types:    SkillType[];        // 多值：一个技能可同时属于多个类型
  faction:  Faction;            // 单值：每个技能归属一个流派
  icon:     string;
  maxLevel: number;
  scaling:  Record<string, number[]>;  // key=数值名, value=每级的值（索引0=1级）
}
```

### 2.2 数值曲线约定

- 使用 `number[]` 数组而非公式
- `scaling.foo[0]` = 1 级数值，`scaling.foo[1]` = 2 级数值，依此类推
- 数组长度应等于 `maxLevel`；越级时取上限（由 `getScalingValue` 保证）
- 数值内容当前主要是 **距离/范围/次数/概率/冷却**，**尚不涉及伤害值**

### 2.3 辅助 API

```typescript
// src/core/SkillSpecs.ts

/** 取技能在指定等级的某项数值，越级自动 clamp 到 maxLevel */
function getScalingValue(spec: SkillSpec, valueName: string, level: number): number;

/** 取指定流派的所有技能（用于"派系卡组"等扩展） */
function getSkillsByFaction(faction: Faction): SkillSpec[];
```

### 2.4 新增技能流程

1. 在 [src/core/SkillSpecs.ts](src/core/SkillSpecs.ts) 的 `SKILL_SPECS` 表加一条
2. 若该技能需要触发行为：在 [src/core/SkillSystem.ts](src/core/SkillSystem.ts) 加 `applyXxx` 函数，并在 `GameLogic.ts` 适当的回合钩子处调用
3. 若需引入新的运行时状态字段（如冷却计数器），同步加到 `GameState`
4. `node sync-shared.js` 把 `src/core/` 同步到 `shared/` 与 `assets/scripts/core/`
5. `node tests/test-shared-logic.js` 跑核心逻辑回归

> **不要** 在 `demo.html`、`src/render/`、`assets/scripts/`（除 `core/` 同步副本外）写技能业务规则。

---

## 3. 已落地技能（5 个 · 帅流派）

当前阶段所有已实现技能都归 `Faction.GENERAL`（玩家本体的「帅」流派）。

> 编码以 [src/core/SkillSpecs.ts](src/core/SkillSpecs.ts) 为单一真源；本节是它的可读视图。

### 3.1 铁甲护身 (armor)

| 字段 | 值 |
|---|---|
| **类型** | `DEFENSE` |
| **流派** | 帅 (General) |
| **图标** | 🛡 |
| **最大等级** | 5 |
| **数值** | `armorLayers = [1, 1, 2, 2, 3]` |
| **效果** | 抵挡一次致命攻击；护甲层数按等级叠加 |
| **闪文** | 为自身披上一层护甲。当受到会造成死亡的攻击时，护甲自动消耗一层将其抵挡，免于一死。 |
| **实现** | `applyArmor()`，在玩家被踩死前消耗一层 |

### 3.2 借刀杀人 (intimidate)

| 字段 | 值 |
|---|---|
| **类型** | `UTILITY` |
| **流派** | 帅 (General) |
| **图标** | 😨 |
| **最大等级** | 5 |
| **数值** | `freezeChance = [0.30, 0.45, 0.60, 0.75, 0.75]` |
| **效果** | 每轮敌人行动前，相邻（切比雪夫距离 ≤ 1）敌人按概率被冻结 |
| **闪文** | 玩家的气势令相邻的敌人心生胆怯。每轮敌人行动前，紧靠你的敌人有一定概率被吓住，该回合无法移动。 |
| **实现** | `applyIntimidateFreeze()`，每回合开始时填充 `state.frozenEnemies` |

### 3.3 王车易位 (castling)

| 字段 | 值 |
|---|---|
| **类型** | `MOVEMENT` |
| **流派** | 帅 (General) |
| **图标** | ⚡ |
| **最大等级** | 5 |
| **数值** | `cooldown = [4, 3, 2, 2, 2]` |
| **效果** | 冷却就绪时，本回合可无视九宫格限制，传送到棋盘上任意空格 |
| **闪文** | 传承自象棋的特殊走法。冷却就绪时，本回合可以无视距离限制，直接传送到棋盘上任意一个空格。传送后进入冷却。 |
| **实现** | `checkCastlingUsed()` 在移动距离 > 1 时进入冷却；`tickCastlingCooldown()` 每回合 -1 |

### 3.4 将军威势 (aura)

| 字段 | 值 |
|---|---|
| **类型** | `UTILITY` |
| **流派** | 帅 (General) |
| **图标** | 👑 |
| **最大等级** | 3 |
| **数值** | `auraRange = [1, 1, 2]` |
| **效果** | 敌人在 AI 计算移动时主动避开玩家周围 `auraRange` 格的位置 |
| **闪文** | 散发出令敌人不敢靠近的王者气场。敌人计算移动路线时，会主动避开你周围的格子。 |
| **实现** | `GameLogic.ts` 敌人 nextMove 阶段读取 `getScalingValue(SKILL_SPECS.aura, 'auraRange', lv)` 排除候选 |

### 3.5 兵临城下 (siege)

| 字段 | 值 |
|---|---|
| **类型** | `DAMAGE` |
| **流派** | 帅 (General) |
| **图标** | ⚔ |
| **最大等级** | 5 |
| **数值** | `interval = [3, 2, 1, 1, 1]`（回合） |
| **效果** | 每隔 `interval` 回合，自动击杀场上一名随机小兵；无小兵时跳过 |
| **闪文** | 来自四面八方的力量汇聚，定期自动击杀场上一名随机小兵。无小兵时该次效果跳过。 |
| **实现** | `applySiegeEffect()`，依赖 `state.siegeTimer` 计时 |

---

## 4. 技能获取与成长

### 4.1 商店系统（当前实现）

- 触发：得分达到下一商店阈值时，由安全流程点打开商店
- 行为：商店随机生成最多 3 个候选，允许重复；每个候选统一价格 5 金币
- 玩家可购买任意数量或零购买关闭；每个候选只能购买一次
- 同名技能再次购买会升级，但不会超过 `SkillSpec.maxLevel`
- 具体规则见 [design/gdd/shop-system.md](gdd/shop-system.md)

### 4.2 阈值阶梯

```
lastShopScore: 0 → 下一阈值: 3
lastShopScore: 3 → 下一阈值: 7
lastShopScore: N (N>=7) → 下一阈值: N + 5
```

由 `getNextShopThreshold(lastScore)` 实现。

### 4.3 候选生成

候选从未满级技能池中均匀随机生成，允许重复。候选不足时少于 3 个；全部满级时跳过商店但仍推进阈值。

---

## 5. 流派系统（规划中）

### 5.1 流派定义

`Faction` 枚举已落地 6 个流派：帅 / 车 / 马 / 炮 / 相 / 兵。当前只有「帅」有技能。

### 5.2 设计意图

- 每个流派对应一种棋子风格的玩法主题
- 玩家局内逐渐倾向某个流派 → 形成构筑（build）
- 通过 `getSkillsByFaction(faction)` 可快速取出流派子集，用于：
  - 流派加权 Roll
  - 流派套装效果
  - 流派专属升级

### 5.3 流派 → 候选技能映射（草案）

下表的技能 **尚未实现**，仅作为后续 SkillSpec 扩展的候选清单（沿用旧版设计文档中的设计）：

| 流派 | 候选技能 | 备注 |
|---|---|---|
| 车 (ROOK) | 弃車保帅、棋盘扩张 | 高风险高回报 / 空间控制 |
| 马 (KNIGHT) | 双将模式 | 操作深度 |
| 相 (ELEPHANT) | 铜墙铁壁、局势逆转 | 防御 / 反制 |
| 兵 (SOLDIER) | 过河卒子、招兵买马 | 机动 / 召唤 |
| 帅 (GENERAL) | ✅ 已落地 5 个 | 见 §3 |

每个候选技能在实现时需走 §2.4 流程，并填齐 `types/faction/scaling`。

---

## 6. 能量系统（规划中）

**当前状态**：未实现，所有已落地技能为被动或冷却驱动，无能量消耗。

### 6.1 设计意图（若将来引入主动技能）

- 最大能量：5 点
- 获取：每击败 1 个敌人 +1 点
- 主动技能（如「招兵买马」「弃車保帅」）会消耗能量

引入能量系统时，需要：
1. `GameState` 加 `energy: number` 字段
2. `SkillSpec` 加可选 `cost?: number` 字段
3. 在击杀逻辑里加充能
4. UI 显示能量条

---

## 7. 当前已知的非数据驱动部分

为了规范后续扩展，列出 **目前 SkillSpec 未覆盖的字段**（这些仍硬编码在逻辑层）：

| 行为 | 当前位置 | 是否应数据化 |
|---|---|---|
| `grantSkill` 中 castling 首次获得重置冷却 | `SkillSystem.ts` | 商店购买沿用此特例 |
| `grantSkill` 中 siege 首次获得初始化 timer | `SkillSystem.ts` | 商店购买沿用此特例 |
| 切比雪夫距离判定（intimidate / aura） | `SkillSystem.ts` / `GameLogic.ts` | 距离度量未来可加入 spec |
| 描述模板 `descStack(level)` | `SkillDefs` in `SkillSystem.ts` | 已部分迁移到 `getScalingValue` |

---

## 8. 验证

任何技能改动后必跑：

```bash
node sync-shared.js              # src/core → shared / assets/scripts/core
node tests/test-shared-logic.js  # 核心逻辑回归
```

UI / 玩法手感需在 `demo.html` 浏览器中手动验证。

---

## 9. 待确认问题

1. **三选一 Roll**：是否在本迭代引入？
2. **流派扩展顺序**：先做哪个流派的 3-5 个技能？建议「车」或「兵」（与现有敌人类型呼应）
3. **能量系统**：何时引入？是否与「招兵买马」「弃車保帅」一起做
4. **技能等级上限的 UI 表现**：Roll 出已满级技能时的处理（重 roll / 转化为分数 / 等价道具）

---

## 10. 历史版本

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1 | 2026-04-05 | 初稿，列出 10 个候选技能（未实现） |
| v0.2 | 2026-06-09 | 重写：以已落地的数据驱动 `SkillSpec` 框架为骨架，5 个帅流派技能为已实现集合，旧候选技能下放到 §5 流派草案 |

---

*实现以代码为准；本文档是 `SKILL_SPECS` 表的可读视图与扩展规范。*
