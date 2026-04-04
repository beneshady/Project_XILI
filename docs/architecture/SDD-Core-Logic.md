# SDD 核心逻辑架构文档
## Shotgun King 风格肉鸽象棋游戏

**项目代号**: XILI Chess Roguelike
**技术栈**: HTML5 Canvas + 纯 JavaScript (ES6+)
**开发模式**: MVP → Demo → Full Game

---

## 1. 数据模型设计

### 1.1 坐标系统

```typescript
interface Position {
  x: number; // 0-7, 列索引
  y: number; // 0-7, 行索引
}

// 坐标工具函数
function posEq(a: Position, b: Position): boolean
function posKey(pos: Position): string  // "x,y" 形式用于 Map/Set
function posFromKey(key: string): Position
```

### 1.2 棋盘 (Grid)

```typescript
interface Grid {
  size: number;  // 固定为 8
  cells: Map<string, Cell>;  // key = "x,y"
}

interface Cell {
  position: Position;
  entity: Entity | null;  // 该格子上的实体（null 表示空）
  isPlayerAccessible: boolean;  // 玩家是否可到达（九宫格内）
  isThreatened: boolean;  // 是否在敌人威胁范围内
}
```

### 1.3 实体 (Entity)

```typescript
enum EntityType {
  KING = 'king',        // 玩家
  PAWN = 'pawn',        // 兵（经验包）
  ROOK = 'rook',        // 车
  KNIGHT = 'knight',    // 马
}

enum Team {
  PLAYER = 'player',
  ENEMY = 'enemy',
}

interface Entity {
  id: string;  // 唯一标识
  type: EntityType;
  team: Team;
  position: Position;
  isDead: boolean;

  // 敌人特有属性
  threatRange?: Position[];  // 该实体能威胁的所有格子
  nextMove?: Position;       // 该实体下一步将移动到的格子（AI 决策）
}

// 实体工厂
function createEntity(type: EntityType, team: Team, pos: Position): Entity
```

### 1.4 游戏状态 (GameState)

```typescript
enum GamePhase {
  PLAYER_TURN = 'player_turn',    // 玩家回合（等待操作）
  ENEMY_TURN = 'enemy_turn',      // 敌人回合（动画中）
  SPAWNING = 'spawning',          // 生成新敌人
  GAME_OVER = 'game_over',        // 游戏结束
}

interface GameState {
  phase: GamePhase;
  turn: number;  // 当前回合数
  score: number;  // 得分（击杀敌人数）
  grid: Grid;
  entities: Map<string, Entity>;  // id -> Entity
  player: Entity | null;
  enemies: Entity[];

  // 动画状态
  animating: boolean;
  animationQueue: AnimationAction[];

  // 游戏结果
  isVictory?: boolean;
  deathMessage?: string;
}
```

---

## 2. 回合状态机

### 2.1 状态流转图

```
[初始]
   ↓
[PLAYER_TURN]
   ├─ 用户选择格子
   │   ├─ 移动 → [ANIMATING] → [ENEMY_TURN]
   │   └─ 无效操作 → [PLAYER_TURN]
   │
[ENEMY_TURN]
   ├─ 计算所有敌人下一步 → [ANIMATING]
   ├─ 执行敌人移动动画
   └─ 动画完成 → 检测玩家生死
       ├─ 玩家存活 → [SPAWNING]
       └─ 玩家死亡 → [GAME_OVER]

[SPAWNING]
   ├─ 在空格子生成新敌人
   ├─ 刷新威胁范围
   └─ [PLAYER_TURN] (turn++)

[GAME_OVER]
   └─ 显示结果，等待重开
```

### 2.2 核心状态函数

```typescript
// ========== 玩家回合 ==========

function getPlayerAccessiblePositions(state: GameState): Position[]
// 返回玩家周围九宫格内所有合法位置（不能越界、不能踩自己）

function handlePlayerMove(state: GameState, targetPos: Position): void
// 1. 验证目标位置是否在可移动范围内
// 2. 检查是否踩到敌人（敌人死亡）
// 3. 更新玩家位置
// 4. 计算所有敌人的威胁范围和下一步
// 5. 添加敌人移动动画到队列
// 6. 切换到 ENEMY_TURN

// ========== 敌人回合 ==========

function calculateEnemyMoves(state: GameState): void
// 对每个敌人：
//   - 计算 AI 决策（向玩家方向移动一格）
//   - 预计算 nextMove
//   - 更新威胁范围

function executeEnemyTurn(state: GameState): void
// 1. 执行所有敌人移动
// 2. 检测玩家是否被踩死
// 3. 如果玩家存活，生成新敌人
// 4. 刷新威胁范围
// 5. 进入下一回合

// ========== 威胁范围 ==========

function updateThreatMap(state: GameState): void
// 1. 清空所有格子的威胁标记
// 2. 对每个活着的敌人：
//    - 计算其根据棋子规则的攻击范围
//    - 标记这些格子为 threatened
```

---

## 3. 敌人威胁范围计算逻辑

### 3.1 总体思路

威胁范围 = 该实体"如果移动一步"所能到达/攻击的所有格子

**关键区分**：
- **棋子规则的攻击范围**（车/马的真实走法）
- **AI 实际移动范围**（所有敌人每次只移动一格，向玩家逼近）

### 3.2 各棋子威胁范围计算

```typescript
function getThreatRange(entity: Entity, grid: Grid): Position[] {
  switch (entity.type) {
    case EntityType.PAWN:
      // 兵：只能向玩家方向移动一格（不攻击，只能碰撞）
      return getPawnThreat(entity, grid);

    case EntityType.ROOK:
      // 车：十字方向，无距离限制（真实象棋规则）
      return getRookThreat(entity, grid);

    case EntityType.KNIGHT:
      // 马：日字跳跃，8个可能位置（真实象棋规则）
      return getKnightThreat(entity, grid);

    default:
      return [];
  }
}
```

### 3.3 兵的威胁范围

兵是"经验包"，威胁范围简单：

```typescript
function getPawnThreat(entity: Entity, grid: Grid): Position[] {
  const targets: Position[] = [];
  const player = entity;  // 实际上应该传入玩家位置

  // 计算向玩家的方向向量
  const dx = player.position.x - entity.position.x;
  const dy = player.position.y - entity.position.y;

  // 归一化方向（每次只移动一格）
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);

  const newPos = {
    x: entity.position.x + stepX,
    y: entity.position.y + stepY,
  };

  // 检查边界
  if (isValidPos(newPos, grid.size)) {
    targets.push(newPos);
  }

  return targets;
}
```

### 3.4 车的威胁范围

车按真实象棋规则：上下左右直线，直到碰到障碍：

```typescript
function getRookThreat(entity: Entity, grid: Grid): Position[] {
  const targets: Position[] = [];
  const directions = [
    { dx: 0, dy: -1 },  // 上
    { dx: 0, dy: 1 },   // 下
    { dx: -1, dy: 0 },  // 左
    { dx: 1, dy: 0 },   // 右
  ];

  for (const dir of directions) {
    let pos = { ...entity.position };

    while (true) {
      pos.x += dir.dx;
      pos.y += dir.dy;

      // 越界则停止
      if (!isValidPos(pos, grid.size)) break;

      // 碰到其他实体则停止（但该格在威胁内）
      targets.push({ ...pos });

      if (grid.cells.get(posKey(pos))?.entity) {
        break;
      }
    }
  }

  return targets;
}
```

### 3.5 马的威胁范围

马按日字规则，8个可能位置：

```typescript
function getKnightThreat(entity: Entity, grid: Grid): Position[] {
  const moves = [
    { dx: 1, dy: -2 }, { dx: 2, dy: -1 },
    { dx: 2, dy: 1 },  { dx: 1, dy: 2 },
    { dx: -1, dy: 2 }, { dx: -2, dy: 1 },
    { dx: -2, dy: -1 }, { dx: -1, dy: -2 },
  ];

  return moves
    .map(m => ({
      x: entity.position.x + m.dx,
      y: entity.position.y + m.dy,
    }))
    .filter(pos => isValidPos(pos, grid.size));  // 过滤越界
}
```

---

## 4. AI 决策逻辑

所有敌人遵循统一的移动逻辑（与威胁范围不同）：

```typescript
function calculateEnemyNextMove(enemy: Entity, player: Entity): Position {
  // 计算向玩家的方向
  const dx = player.position.x - enemy.position.x;
  const dy = player.position.y - enemy.position.y;

  // 归一化方向（每次只移动一格）
  const step: Position = {
    x: enemy.position.x + Math.sign(dx),
    y: enemy.position.y + Math.sign(dy),
  };

  // 智能敌人（车/马）会有简单策略：
  // - 如果 x 差距大，优先移动 x
  // - 如果 y 差距大，优先移动 y

  if (enemy.type === EntityType.ROOK && Math.abs(dx) > Math.abs(dy)) {
    // 车：优先移动差距大的轴
    return {
      x: enemy.position.x + Math.sign(dx),
      y: enemy.position.y,
    };
  }

  return step;
}
```

---

## 5. 工具函数集合

```typescript
// 坐标验证
function isValidPos(pos: Position, size: number): boolean;

// 距离计算（曼哈顿距离）
function manhattanDistance(a: Position, b: Position): number;

// 欧几里得距离（用于马日字判断）
function euclideanDistance(a: Position, b: Position): number;

// 检查位置是否为空
function isEmptyCell(grid: Grid, pos: Position): boolean;

// 获取某个位置的所有敌人
function getEnemiesAt(state: GameState, pos: Position): Entity[];
```

---

## 6. 开发阶段规划

### Phase 1: Harness（纯逻辑测试）
- [ ] 实现所有数据模型
- [ ] 实现威胁范围计算
- [ ] 实现 AI 决策
- [ ] 实现回合状态机
- [ ] 编写单元测试（使用 console.log 输出棋盘状态）

### Phase 2: Canvas 渲染
- [ ] 莫兰迪色系定义
- [ ] 基础绘制函数（圆角矩形、圆形、文字）
- [ ] 棋盘渲染
- [ ] 实体渲染
- [ ] 威胁范围高亮
- [ ] 玩家可移动范围高亮

### Phase 3: Demo 整合
- [ ] 鼠标/触摸输入处理
- [ ] 游戏循环
- [ ] 简单动画（移动、死亡）
- [ ] 得分显示
- [ ] 游戏结束画面

---

## 7. 游戏规则确认

### 7.1 敌人生成规则

**初始配置**：
- 第一回合：无初始敌人
- 玩家出生位置：随机空格

**每回合生成**：
- **兵（Pawn）**：1-2 个，随机空格
- **马（Knight）**：第 5 回合开始，每回合 0-1 个
- **车（Rook）**：第 10 回合开始，每回合 0-1 个

**生成逻辑**：
```typescript
function spawnEnemies(state: GameState): void {
  const turn = state.turn;

  // 兵：始终生成 1-2 个
  spawnRandomEnemies(state, EntityType.PAWN, 1 + Math.floor(Math.random() * 2));

  // 马：第 5 回合起，每回合 0-1 个
  if (turn >= 5) {
    if (Math.random() < 0.5) {
      spawnRandomEnemies(state, EntityType.KNIGHT, 1);
    }
  }

  // 车：第 10 回合起，每回合 0-1 个
  if (turn >= 10) {
    if (Math.random() < 0.5) {
      spawnRandomEnemies(state, EntityType.ROOK, 1);
    }
  }
}
```

### 7.2 胜利条件

**当前模式**：无限生存
- 没有固定目标分值
- 目标：尽可能存活更多回合
- 失败条件：玩家被任何敌人踩到位置（车/马威胁范围内也算被"杀"）

**可能的扩展（未来）**：
- 成就系统（存活 20 回合、100 回合等）
- 排行榜（最高存活回合数）

---
