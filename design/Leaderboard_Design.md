# 排行榜与生存计时设计 (Leaderboard & Survival Timer)

**版本**: v0.1
**日期**: 2026-06-09
**状态**: 设计草案（待实现）

---

## 1. 概述

### 1.1 目标

为「XILI 肉鸽象棋」加入两个互相联动的功能：

1. **生存计时**：从对局开始到死亡的实时秒数（wall-clock）
2. **本地排行榜**：保存历史成绩，按规则排序展示

### 1.2 核心动机

- 给玩家提供 **跨局对比** 的目标（"上次玩到 X 分，这次能不能突破"）
- 引入轻度竞速维度，但 **不破坏回合制策略本质**
- 零成本、零依赖、零联网——纯浏览器 `localStorage`

### 1.3 非目标

- ❌ 云端 / 全球排行榜（无后端）
- ❌ 多账号系统
- ❌ 防作弊（本地存储天然可改，不投入精力）
- ❌ 社交分享 / 截图导出（可后续扩展）

---

## 2. 决策摘要

| 决策项 | 结论 | 备注 |
|---|---|---|
| 时间度量 | **wall-clock 实时秒** | 与"生存"语义一致 |
| 排名公式 | `score DESC → elapsedSec ASC → timestamp ASC` | 同分时用时更短者更高；再同则先达成者更高 |
| 存储位置 | `localStorage` | 单 key：`xili_leaderboard_v1` |
| 榜单容量 | **Top 10** | 超出后自动剔除排名最末者 |
| 玩家名 | **游戏结束后弹窗输入** | 默认填充上次使用过的名字 |
| 计时暂停 | **不暂停** | 玩家挂机/思考都算入时间；这是"生存时间"的一致语义 |
| 多榜单 | 暂不分榜 | 同一份榜，胜利/失败都收录 |

---

## 3. 数据模型

### 3.1 单条记录

```typescript
// 新增 src/core/Leaderboard.ts
export interface LeaderboardEntry {
  name:        string;     // 玩家输入，最长 12 字符
  score:       number;     // state.score 终值
  turn:        number;     // state.turn 终值（参考信息，不参与排序）
  elapsedSec:  number;     // 秒，整数
  isVictory:   boolean;    // state.isVictory ?? false
  timestamp:   number;     // Date.now()，毫秒
}
```

### 3.2 存储格式

```typescript
// localStorage key: 'xili_leaderboard_v1'
// value: JSON.stringify(LeaderboardEntry[])
// 长度不超过 10，已按排名排序好
```

**版本化 key**：将来字段调整时改成 `_v2`，避免读写不兼容数据。
读取时若 JSON.parse 失败或 schema 不对，**静默重置**为空数组（不弹错）。

### 3.3 GameState 扩展

```typescript
// types.ts
export interface GameState {
  // ... 现有字段
  startedAt:   number;     // Date.now()，对局开始时刻；用于计算 elapsedSec
  finishedAt?: number;     // Date.now()，对局结束时刻（GAME_OVER 触发时写入）
}
```

`startedAt` 在 `createInitialState()` 中赋值 `Date.now()`。
`finishedAt` 在 `phase` 切到 `GAME_OVER` 时赋值。

---

## 4. 模块划分

### 4.1 核心层（[src/core/Leaderboard.ts](src/core/Leaderboard.ts)）

```typescript
// 纯函数，无平台依赖；存储 I/O 由 storage 适配器注入

export interface LeaderboardStorage {
  read():  string | null;
  write(value: string): void;
}

export const MAX_ENTRIES = 10;

/** 插入新成绩，返回排序后的最新榜单（已截断到 MAX_ENTRIES） */
export function insertEntry(
  storage: LeaderboardStorage,
  entry: LeaderboardEntry,
): LeaderboardEntry[];

/** 读取榜单，已排序 */
export function loadLeaderboard(storage: LeaderboardStorage): LeaderboardEntry[];

/** 清空 */
export function clearLeaderboard(storage: LeaderboardStorage): void;

/** 排序比较器：score DESC → elapsedSec ASC → timestamp ASC */
export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number;

/** 计算给定记录的当前排名（1-based）；未上榜返回 null */
export function getRank(
  entries: LeaderboardEntry[],
  entry: LeaderboardEntry,
): number | null;
```

**单一职责**：核心层只做"排序、截断、序列化"；不碰 `localStorage` 直接 API（由 storage 适配器接入），便于 Node 单测。

### 4.2 适配层（demo / Cocos 各自实现）

```typescript
// web-demo / Cocos 侧
const browserStorage: LeaderboardStorage = {
  read()  { return localStorage.getItem('xili_leaderboard_v1'); },
  write(v){ localStorage.setItem('xili_leaderboard_v1', v); },
};
```

### 4.3 计时

计时只是 `Date.now() - state.startedAt`，**不需要 setInterval**。
渲染层每帧（或每秒）从 `state.startedAt` 计算当前秒数展示即可。

---

## 5. 用户流程

### 5.1 对局中（HUD）

顶部状态栏在现有"分数 / 回合"基础上加一项「时间」：

```
分数: 24    回合: 18    时间: 03:42
```

格式 `mm:ss`，超过 60 分钟改 `hh:mm:ss`。
游戏结束后停止刷新（用 `finishedAt - startedAt` 算）。

### 5.2 游戏结束流程

```
玩家死亡 / 胜利
  ↓
phase = GAME_OVER, finishedAt = Date.now()
  ↓
  弹出结算面板（覆盖在棋盘上）：
  ┌──────────────────────────┐
  │  游戏结束（或：胜利！）  │
  │                          │
  │  得分:  24               │
  │  回合:  18               │
  │  时间:  03:42            │
  │                          │
  │  这次排名: 第 3 名 🥉    │ ← 若上榜
  │                          │
  │  你的名字: [_______]     │ ← 默认填充 localStorage 缓存的上次名字
  │                          │
  │  [保存成绩]  [不保存]    │
  └──────────────────────────┘
  ↓
点「保存」→ insertEntry → 显示排行榜面板
点「不保存」→ 跳过保存，仍显示排行榜面板（高亮"你的本局成绩"行但不入榜）
```

**名字缓存**：用第二个 key `xili_last_player_name` 保存上次使用过的名字。

### 5.3 排行榜面板

```
┌───────────────────────────────────┐
│  🏆 排行榜 (Top 10)               │
│                                   │
│  #   名字         分数  时间      │
│  1   神之一手     42    02:15     │
│  2   苏轼         38    04:20     │
│ ▶3   你          24    03:42  ◀本局│
│  4   匿名        20    05:10     │
│  ...                              │
│                                   │
│  [再来一局]      [清空榜单]       │
└───────────────────────────────────┘
```

「清空榜单」需二次确认（避免误触）。

### 5.4 入口

主菜单（或暂停菜单）加一个「查看排行榜」按钮。MVP 阶段也可省略——只在结算时显示。

---

## 6. 排名公式细节

### 6.1 比较器

```typescript
function compareEntries(a, b): number {
  if (a.score !== b.score)         return b.score - a.score;        // 分数高在前
  if (a.elapsedSec !== b.elapsedSec) return a.elapsedSec - b.elapsedSec; // 时间短在前
  return a.timestamp - b.timestamp;                                  // 同分同时间：先达成的在前
}
```

### 6.2 边界与一致性

| 情境 | 行为 |
|---|---|
| 玩家 0 分死亡 | 也允许入榜，按规则排序（垫底） |
| 名字为空 | 替换为「匿名」 |
| 名字超 12 字符 | 截断 |
| 时间 < 1 秒 | 仍写真实值（不做下限） |
| `score / elapsedSec` 全等且 `timestamp` 也撞了（理论上几乎不会） | 维持插入顺序 |
| localStorage 写入失败（隐私模式） | 静默失败，本次成绩不持久化，UI 提示"无法保存到本地" |
| 旧版本 JSON parse 失败 | 当作空榜，**不删原 key**（用户后续可手动清理） |

### 6.3 暂未做的反作弊

`localStorage` 任意可改 → **不做防作弊**，是设计决策。
若将来联网，公式（score-major、time-minor）仍可沿用，只是 storage 适配器换成 HTTP。

---

## 7. 验证

### 7.1 单元测试（[tests/test-shared-logic.js](tests/test-shared-logic.js) 加用例）

- `compareEntries` 三层规则的所有组合（共 9 个对照组）
- `insertEntry`：插到第 1 名 / 中间 / 末位 / 不上榜
- 容量限制：插第 11 条时最末位被剔除
- `getRank`：上榜返回 1-based 名次；未上榜返回 null
- 注入 mock storage，验证 read/write 调用次数与序列化格式

### 7.2 手动验证

- 浏览器打开 `demo.html`：玩一局看 HUD 时间是否走动
- 死亡 → 结算 → 输入名字 → 看榜单是否插入到正确位置
- 玩 11+ 局：榜单严格保持 10 条
- 隐私模式打开页面：保存按钮点了不崩，提示文案出现
- 改 localStorage 里的 JSON 故意写坏 → 刷新页面应当当空榜处理

### 7.3 验收标准

- [ ] `Leaderboard.ts` 在 `src/core/`，纯函数，零平台依赖
- [ ] `GameState.startedAt / finishedAt` 加入
- [ ] HUD 显示「时间」字段，格式 `mm:ss`
- [ ] 结算面板支持输入名字 + 保存 / 不保存
- [ ] 排行榜面板显示 Top 10，本局高亮
- [ ] 排序规则：`score DESC → elapsedSec ASC → timestamp ASC`
- [ ] `localStorage` key = `xili_leaderboard_v1`，名字 key = `xili_last_player_name`
- [ ] `sync-shared.js` 把 `Leaderboard.ts` 同步到 `shared/` 与 `assets/scripts/core/`
- [ ] 9 个 compareEntries 用例 + 4 个 insertEntry 用例通过

---

## 8. 实现拆分（建议 US 划分）

可以拆成 2 个 US 串行做：

### US-A：核心 + 计时
- 新增 `src/core/Leaderboard.ts`（纯逻辑 + 单元测试）
- `GameState` 加 `startedAt / finishedAt`
- HUD 加时间显示
- 加进 `sync-shared.js`

### US-B：UI 流程
- 结算面板（输入名字 + 保存按钮）
- 排行榜面板（Top 10 + 本局高亮）
- 「清空榜单」二次确认
- 名字缓存

---

## 9. 待确认问题（实现前可再讨论）

1. ~~**胜利和失败是否要分榜？**~~ → **共榜**，用 `isVictory` 字段标记。
2. ~~**HUD 时间是否每秒刷一次？**~~ → **加 1 Hz 的轻量 timer 只更新文字 DOM**，不重绘 canvas；游戏结束后停 timer。
3. ~~**是否在主菜单也开排行榜入口？**~~ → **不做**，只在结算时弹。
4. ~~**名字过滤敏感词？**~~ → **不过滤**。

---

## 10. 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| 玩家挂机刷时间会被记入 | 排行榜失真 | 接受——单机本就无防作弊 |
| 实时计时鼓励抢节奏，与策略支柱冲突 | 弱化思考 | 通过 UI 文案降权（「时间仅供参考」），核心反馈仍以分数为主 |
| `localStorage` 5 MB 上限被吃满 | 极小概率 | Top 10 容量约 1 KB，永远碰不到 |
| 跨浏览器/设备无法迁移成绩 | 体验缺失 | 后续可加"导出 JSON / 导入 JSON" |

---

## 11. 后续可扩展

- 导出 / 导入 JSON 榜单
- 多榜（按胜利 / 按生存回合数 / 按某技能构筑等）
- 成就系统（首杀车、连击 10、5 分钟内 30 分等）
- 云榜（接 REST API 后将 storage 适配器换成 HTTP；公式不变）

---

*本设计文档遵循 [docs/CORE_INSTRUCTIONS.MD](docs/CORE_INSTRUCTIONS.MD) 的「核心逻辑放 `src/core/`，平台适配单独写」原则。*