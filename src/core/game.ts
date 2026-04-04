// ============================================================================
// 游戏核心逻辑
// ----------------------------------------------------------------------------

import {
  EntityType,
  Team,
  Entity,
  Cell,
  Grid,
  GamePhase,
  GameState,
  AnimationAction,
} from './types';
import {
  posEq,
  posKey,
  posClone,
  isValidPos,
  sign,
  generateId,
  randomPos,
  getAllPositions,
  euclideanDistanceSquared,
} from './utils';

// ============================================================================
// 实体工厂
// ============================================================================

export function createEntity(
  type: EntityType,
  team: Team,
  position: { x: number; y: number }
): Entity {
  return {
    id: generateId(),
    type,
    team,
    position: posClone(position),
    isDead: false,
  };
}

// ============================================================================
// 棋盘初始化
// ============================================================================

export function createGrid(size: number = 8): Grid {
  const grid: Grid = {
    size,
    cells: new Map(),
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell: Cell = {
        position: { x, y },
        entity: null,
        isPlayerAccessible: false,
        isThreatened: false,
      };
      grid.cells.set(posKey({ x, y }), cell);
    }
  }

  return grid;
}

// ============================================================================
// 游戏状态初始化
// ============================================================================

export function createInitialState(): GameState {
  const grid = createGrid(8);

  // 创建玩家（王），随机位置
  const playerPos = randomPos(8);
  const player = createEntity(EntityType.KING, Team.PLAYER, playerPos);

  // 将玩家放置到棋盘上
  const playerCell = grid.cells.get(posKey(playerPos));
  if (playerCell) {
    playerCell.entity = player;
  }

  const state: GameState = {
    phase: GamePhase.PLAYER_TURN,
    turn: 1,
    score: 0,
    grid,
    entities: new Map([[player.id, player]]),
    player,
    enemies: [],
    animating: false,
    animationQueue: [],
  };

  // 计算玩家可移动范围
  updatePlayerAccessiblePositions(state);

  return state;
}

// ============================================================================
// 获取空格子
// ============================================================================

export function getEmptyCells(state: GameState): Position[] {
  const empty: Position[] = [];
  for (const [key, cell] of state.grid.cells) {
    if (cell.entity === null) {
      empty.push(posClone(cell.position));
    }
  }
  return empty;
}

// ============================================================================
// 玩家可移动范围计算
// ============================================================================

export function updatePlayerAccessiblePositions(state: GameState): void {
  // 清除所有可访问标记
  for (const cell of state.grid.cells.values()) {
    cell.isPlayerAccessible = false;
  }

  if (!state.player) return;

  const { x, y } = state.player.position;

  // 获取周围 8 个方向（包括斜向）
  const directions = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },  { dx: 0, dy: 0 },  { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
  ];

  for (const dir of directions) {
    const newPos = { x: x + dir.dx, y: y + dir.dy };

    if (isValidPos(newPos, state.grid.size)) {
      const key = posKey(newPos);
      const cell = state.grid.cells.get(key);
      if (cell) {
        cell.isPlayerAccessible = true;
      }
    }
  }
}

export function getPlayerAccessiblePositions(state: GameState): Position[] {
  const positions: Position[] = [];
  for (const cell of state.grid.cells.values()) {
    if (cell.isPlayerAccessible) {
      positions.push(posClone(cell.position));
    }
  }
  return positions;
}

// ============================================================================
// 威胁范围计算
// ============================================================================

export function getThreatRange(entity: Entity, grid: Grid): Position[] {
  switch (entity.type) {
    case EntityType.PAWN:
      return getPawnThreat(entity, grid);
    case EntityType.ROOK:
      return getRookThreat(entity, grid);
    case EntityType.KNIGHT:
      return getKnightThreat(entity, grid);
    default:
      return [];
  }
}

// 兵的威胁范围：向玩家方向移动一格
function getPawnThreat(entity: Entity, grid: Grid): Position[] {
  // 这个函数需要传入玩家位置，暂时返回空
  // 实际使用时在 updateThreatMap 中计算
  return [];
}

// 车的威胁范围：十字直线，直到碰到障碍
function getRookThreat(entity: Entity, grid: Grid): Position[] {
  const threats: Position[] = [];
  const directions = [
    { dx: 0, dy: -1 }, // 上
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
    { dx: 1, dy: 0 },  // 右
  ];

  for (const dir of directions) {
    let pos = posClone(entity.position);

    while (true) {
      pos.x += dir.dx;
      pos.y += dir.dy;

      if (!isValidPos(pos, grid.size)) break;

      threats.push(posClone(pos));

      const cell = grid.cells.get(posKey(pos));
      if (cell && cell.entity) {
        // 碰到实体则停止（但该格在威胁内）
        break;
      }
    }
  }

  return threats;
}

// 马的威胁范围：日字跳跃，8个可能位置
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
    .filter(pos => isValidPos(pos, grid.size));
}

// ============================================================================
// 更新威胁地图
// ============================================================================

export function updateThreatMap(state: GameState): void {
  // 清除所有威胁标记
  for (const cell of state.grid.cells.values()) {
    cell.isThreatened = false;
  }

  if (!state.player) return;

  // 对每个活着的敌人计算威胁范围
  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    let threats: Position[] = [];

    if (enemy.type === EntityType.PAWN) {
      // 兵：向玩家方向移动一格
      const dx = state.player.position.x - enemy.position.x;
      const dy = state.player.position.y - enemy.position.y;
      const step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y + sign(dy),
      };

      if (isValidPos(step, state.grid.size)) {
        threats.push(step);
      }
    } else {
      // 车/马：使用真实棋子规则
      threats = getThreatRange(enemy, state.grid);
    }

    // 标记威胁格子
    for (const threat of threats) {
      const cell = state.grid.cells.get(posKey(threat));
      if (cell) {
        cell.isThreatened = true;
      }
    }

    // 保存威胁范围到实体
    enemy.threatRange = threats;
  }
}

// ============================================================================
// AI 决策：计算敌人下一步移动
// ============================================================================

export function calculateEnemyMoves(state: GameState): void {
  if (!state.player) return;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    const dx = state.player.position.x - enemy.position.x;
    const dy = state.player.position.y - enemy.position.y;

    let step: Position;

    if (enemy.type === EntityType.ROOK && Math.abs(dx) > Math.abs(dy)) {
      // 车：优先移动差距大的轴
      step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y,
      };
    } else if (enemy.type === EntityType.ROOK && Math.abs(dx) < Math.abs(dy)) {
      step = {
        x: enemy.position.x,
        y: enemy.position.y + sign(dy),
      };
    } else {
      // 普通移动：向玩家方向移动一格
      step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y + sign(dy),
      };
    }

    // 确保不越界
    if (!isValidPos(step, state.grid.size)) {
      // 如果越界，尝试只移动一个坐标
      if (dx !== 0) {
        step = { x: enemy.position.x + sign(dx), y: enemy.position.y };
      } else {
        step = { x: enemy.position.x, y: enemy.position.y + sign(dy) };
      }
    }

    enemy.nextMove = step;
  }
}

// ============================================================================
// 敌人生成
// ============================================================================

export function spawnEnemies(state: GameState): void {
  const turn = state.turn;
  const emptyCells = getEmptyCells(state);
  const shuffledEmpty = [...emptyCells].sort(() => Math.random() - 0.5);

  let posIndex = 0;

  // 兵：始终生成 1-2 个
  const pawnCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < pawnCount && posIndex < shuffledEmpty.length; i++) {
    const pos = shuffledEmpty[posIndex++];
    const pawn = createEntity(EntityType.PAWN, Team.ENEMY, pos);
    state.entities.set(pawn.id, pawn);
    state.enemies.push(pawn);

    // 放置到棋盘
    const cell = state.grid.cells.get(posKey(pos));
    if (cell) {
      cell.entity = pawn;
    }
  }

  // 马：第 5 回合起，每回合 50% 概率生成 1 个
  if (turn >= 5 && Math.random() < 0.5 && posIndex < shuffledEmpty.length) {
    const pos = shuffledEmpty[posIndex++];
    const knight = createEntity(EntityType.KNIGHT, Team.ENEMY, pos);
    state.entities.set(knight.id, knight);
    state.enemies.push(knight);

    const cell = state.grid.cells.get(posKey(pos));
    if (cell) {
      cell.entity = knight;
    }
  }

  // 车：第 10 回合起，每回合 50% 概率生成 1 个
  if (turn >= 10 && Math.random() < 0.5 && posIndex < shuffledEmpty.length) {
    const pos = shuffledEmpty[posIndex++];
    const rook = createEntity(EntityType.ROOK, Team.ENEMY, pos);
    state.entities.set(rook.id, rook);
    state.enemies.push(rook);

    const cell = state.grid.cells.get(posKey(pos));
    if (cell) {
      cell.entity = rook;
    }
  }
}

// ============================================================================
// 玩家移动
// ============================================================================

export function handlePlayerMove(state: GameState, targetPos: { x: number; y: number }): void {
  if (state.phase !== GamePhase.PLAYER_TURN) {
    console.error('Cannot move: not player turn');
    return;
  }

  if (!state.player) {
    console.error('Cannot move: no player entity');
    return;
  }

  // 验证目标位置是否在可移动范围内
  const targetCell = state.grid.cells.get(posKey(targetPos));
  if (!targetCell || !targetCell.isPlayerAccessible) {
    console.error('Cannot move: target position not accessible');
    return;
  }

  const animAction: AnimationAction = {
    type: 'move',
    entityId: state.player.id,
    from: posClone(state.player.position),
    to: posClone(targetPos),
  };

  // 检查目标位置是否有敌人（踩死）
  if (targetCell.entity && targetCell.entity.team === Team.ENEMY) {
    const enemy = targetCell.entity;
    enemy.isDead = true;
    state.score++;

    animAction.type = 'die';
    animAction.entityId = enemy.id;
  }

  // 更新棋盘：移除旧位置的实体
  const oldCell = state.grid.cells.get(posKey(state.player.position));
  if (oldCell) {
    oldCell.entity = null;
  }

  // 移动玩家
  state.player.position = posClone(targetPos);
  targetCell.entity = state.player;

  // 计算敌人移动
  calculateEnemyMoves(state);

  // 切换到敌人回合
  state.phase = GamePhase.ENEMY_TURN;
  state.animating = true;
  state.animationQueue.push(animAction);
}

// ============================================================================
// 敌人回合执行
// ============================================================================

export function executeEnemyTurn(state: GameState): void {
  if (!state.player) return;

  // 检查玩家是否在威胁范围内
  let playerDead = false;
  let killer: Entity | null = null;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    // 检查威胁范围
    for (const threat of enemy.threatRange || []) {
      if (posEq(threat, state.player.position)) {
        playerDead = true;
        killer = enemy;
        break;
      }
    }

    if (playerDead) break;

    // 执行敌人移动
    if (enemy.nextMove) {
      // 从旧位置移除
      const oldCell = state.grid.cells.get(posKey(enemy.position));
      if (oldCell) {
        oldCell.entity = null;
      }

      // 移动到新位置
      const newCell = state.grid.cells.get(posKey(enemy.nextMove));
      if (newCell) {
        newCell.entity = enemy;
        enemy.position = posClone(enemy.nextMove);
      }
    }
  }

  if (playerDead) {
    state.player.isDead = true;
    state.phase = GamePhase.GAME_OVER;
    state.isVictory = false;
    state.deathMessage = `被 ${killer?.type || '敌人'} 击杀于 ${state.player.position.x},${state.player.position.y}`;
    return;
  }

  // 玩家存活：进入下一回合
  state.turn++;
  state.phase = GamePhase.SPAWNING;
  spawnEnemies(state);
  updatePlayerAccessiblePositions(state);
  updateThreatMap(state);
  state.phase = GamePhase.PLAYER_TURN;
  state.animating = false;
}

// ============================================================================
// 游戏结束检测
// ============================================================================

export function isGameOver(state: GameState): boolean {
  return state.phase === GamePhase.GAME_OVER;
}
