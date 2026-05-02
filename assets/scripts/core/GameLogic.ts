// ============================================================================
// 游戏核心逻辑（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------
// 合并自 src/core/game.ts + demo.html 完整逻辑：
// - 技能系统（5个技能）
// - 金币系统
// - 高级敌人生成（上限/渐进概率）
// - 马脚绊逻辑
// - 连杀+差异化得分
// - 定期死亡清理
// ----------------------------------------------------------------------------

import {
  Position,
  EntityType,
  Team,
  Entity,
  Cell,
  Grid,
  GamePhase,
  GameState,
  SkillLevels,
} from './Types';
import {
  posEq,
  posKey,
  posClone,
  isValidPos,
  sign,
  generateId,
  randomPos,
  shuffle,
} from './Utils';
import {
  checkSkillTrigger,
  applyIntimidateFreeze,
  applySiegeEffect,
  applyArmor,
  checkCastlingUsed,
  tickCastlingCooldown,
  getAuraRange,
} from './SkillSystem';
import { GRID_SIZE, SPAWN_CONFIG, SCORE_CONFIG } from './GameConfig';

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

export function createGrid(size: number = GRID_SIZE): Grid {
  const grid: Grid = {
    size,
    cells: new Map(),
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell: Cell = {
        position: { x, y },
        entity: null,
        hasCoin: false,
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
  const grid = createGrid(GRID_SIZE);

  const playerPos = randomPos(GRID_SIZE);
  const player = createEntity(EntityType.KING, Team.PLAYER, playerPos);

  const playerCell = grid.cells.get(posKey(playerPos));
  if (playerCell) {
    playerCell.entity = player;
  }

  const skills: SkillLevels = { armor: 0, intimidate: 0, castling: 0, aura: 0, siege: 0 };

  const state: GameState = {
    phase: GamePhase.PLAYER_TURN,
    turn: 1,
    score: 0,
    grid,
    entities: new Map([[player.id, player]]),
    player,
    enemies: [],
    animating: false,
    lastSkillScore: 0,
    skills,
    castlingCooldown: 0,
    siegeTimer: 0,
    frozenEnemies: new Set(),
    killStreak: 0,
  };

  updatePlayerAccessiblePositions(state);

  return state;
}

// ============================================================================
// 获取空格子
// ============================================================================

export function getEmptyCells(state: GameState): Position[] {
  const empty: Position[] = [];
  for (const [, cell] of state.grid.cells) {
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
  for (const cell of state.grid.cells.values()) {
    cell.isPlayerAccessible = false;
  }

  if (!state.player) return;

  const { x, y } = state.player.position;

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

  // 王车易位：冷却就绪时，所有空格可达
  if (state.skills.castling > 0 && state.castlingCooldown <= 0) {
    for (const cell of state.grid.cells.values()) {
      if (!cell.entity || cell.entity === state.player) {
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

function getPawnThreat(entity: Entity, grid: Grid): Position[] {
  // 兵的威胁在 updateThreatMap 中动态计算（需要玩家位置）
  return [];
}

function getRookThreat(entity: Entity, grid: Grid): Position[] {
  const threats: Position[] = [];
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
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
        break;
      }
    }
  }

  return threats;
}

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
  for (const cell of state.grid.cells.values()) {
    cell.isThreatened = false;
  }

  if (!state.player) return;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    let threats: Position[] = [];

    if (enemy.type === EntityType.PAWN) {
      const dx = state.player.position.x - enemy.position.x;
      const dy = state.player.position.y - enemy.position.y;
      const step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y + sign(dy),
      };

      if (isValidPos(step, state.grid.size)) {
        threats.push(step);
      }
    } else if (enemy.type === EntityType.ROOK) {
      threats = getRookThreat(enemy, state.grid);
    } else if (enemy.type === EntityType.KNIGHT) {
      threats = getKnightThreat(enemy, state.grid);
    }

    for (const threat of threats) {
      const cell = state.grid.cells.get(posKey(threat));
      if (cell) {
        cell.isThreatened = true;
      }
    }

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

    let step: Position | null = null;

    if (enemy.type === EntityType.KNIGHT) {
      // 马走"日"字形 + 绊马脚
      const knightMoves = [
        { dx: 1, dy: -2, leg: { dx: 1, dy: -1 } },
        { dx: 2, dy: -1, leg: { dx: 1, dy: -1 } },
        { dx: 2, dy: 1,  leg: { dx: 1, dy: 0 } },
        { dx: 1, dy: 2,  leg: { dx: 1, dy: 1 } },
        { dx: -1, dy: 2,  leg: { dx: -1, dy: 1 } },
        { dx: -2, dy: 1,  leg: { dx: -1, dy: 0 } },
        { dx: -2, dy: -1, leg: { dx: -1, dy: -1 } },
        { dx: -1, dy: -2, leg: { dx: 0, dy: -1 } },
      ];

      let bestMove: Position | null = null;
      let bestDist = Infinity;

      for (const move of knightMoves) {
        const target = {
          x: enemy.position.x + move.dx,
          y: enemy.position.y + move.dy,
        };
        const legPos = {
          x: enemy.position.x + move.leg.dx,
          y: enemy.position.y + move.leg.dy,
        };
        const legCell = state.grid.cells.get(posKey(legPos));

        if (isValidPos(target, state.grid.size) && legCell && !legCell.entity) {
          const dist = Math.abs(target.x - state.player.position.x) +
                       Math.abs(target.y - state.player.position.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestMove = target;
          }
        }
      }

      step = bestMove;
    } else if (enemy.type === EntityType.ROOK && Math.abs(dx) > Math.abs(dy)) {
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
      step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y + sign(dy),
      };
    }

    if (step && !isValidPos(step, state.grid.size)) {
      if (dx !== 0) {
        step = { x: enemy.position.x + sign(dx), y: enemy.position.y };
      } else {
        step = { x: enemy.position.x, y: enemy.position.y + sign(dy) };
      }
      if (!isValidPos(step, state.grid.size)) {
        step = null;
      }
    }

    enemy.nextMove = step || undefined;
  }
}

// ============================================================================
// 敌人生成（高级版：上限/渐进概率）
// ============================================================================

export function spawnEnemies(state: GameState): void {
  const turn = state.turn;
  const cfg = SPAWN_CONFIG;

  const livingEnemies = state.enemies.filter(e => !e.isDead);
  const maxEnemies = Math.min(cfg.maxEnemyBase + Math.floor(turn / cfg.maxEnemyGrowth), cfg.maxEnemyCap);
  if (livingEnemies.length >= maxEnemies) return;

  const livingRooks = livingEnemies.filter(e => e.type === EntityType.ROOK).length;
  const livingKnights = livingEnemies.filter(e => e.type === EntityType.KNIGHT).length;

  const emptyCells = getEmptyCells(state);
  const shuffledEmpty = shuffle(emptyCells);

  let posIndex = 0;

  // 兵：50%概率生成1个
  const pawnCount = Math.random() < cfg.pawnChance ? 1 : 0;
  for (let i = 0; i < pawnCount && posIndex < shuffledEmpty.length; i++) {
    const pos = shuffledEmpty[posIndex++];
    const pawn = createEntity(EntityType.PAWN, Team.ENEMY, pos);
    state.entities.set(pawn.id, pawn);
    state.enemies.push(pawn);
    const cell = state.grid.cells.get(posKey(pos));
    if (cell) cell.entity = pawn;
  }

  // 马：第5回合起，概率线性递增（上限3匹）
  if (turn >= cfg.knightStartTurn && livingKnights < cfg.knightMaxCount) {
    const knightChance = Math.min(cfg.knightBaseChance + (turn - cfg.knightStartTurn) * cfg.knightChanceGrowth, cfg.knightMaxChance);
    if (Math.random() < knightChance && posIndex < shuffledEmpty.length) {
      const pos = shuffledEmpty[posIndex++];
      const knight = createEntity(EntityType.KNIGHT, Team.ENEMY, pos);
      state.entities.set(knight.id, knight);
      state.enemies.push(knight);
      const cell = state.grid.cells.get(posKey(pos));
      if (cell) cell.entity = knight;
    }
  }

  // 车：第12回合起，概率线性递增（上限2辆）
  if (turn >= cfg.rookStartTurn && livingRooks < cfg.rookMaxCount) {
    const rookChance = Math.min(cfg.rookBaseChance + (turn - cfg.rookStartTurn) * cfg.rookChanceGrowth, cfg.rookMaxChance);
    if (Math.random() < rookChance && posIndex < shuffledEmpty.length) {
      const pos = shuffledEmpty[posIndex++];
      const rook = createEntity(EntityType.ROOK, Team.ENEMY, pos);
      state.entities.set(rook.id, rook);
      state.enemies.push(rook);
      const cell = state.grid.cells.get(posKey(pos));
      if (cell) cell.entity = rook;
    }
  }
}

// ============================================================================
// 金币生成
// ============================================================================

export function spawnCoins(state: GameState): void {
  const emptyCells = getEmptyCells(state);
  const shuffledEmpty = shuffle(emptyCells);

  const coinCount = 1 + Math.floor(Math.random() * 2);

  for (let i = 0; i < coinCount && i < shuffledEmpty.length; i++) {
    const pos = shuffledEmpty[i];
    const cell = state.grid.cells.get(posKey(pos));
    if (cell && !cell.hasCoin && !cell.entity) {
      cell.hasCoin = true;
    }
  }
}

// ============================================================================
// 玩家移动（含技能/金币/连杀）
// ============================================================================

export interface MoveResult {
  moved: boolean;
  killedEnemyId?: string;
  killedEnemyType?: EntityType;
  scoreGained: number;
  coinCollected: boolean;
  castlingUsed: boolean;
  skillAcquired: string[];
}

export function handlePlayerMove(state: GameState, targetPos: { x: number; y: number }): MoveResult {
  const result: MoveResult = { moved: false, scoreGained: 0, coinCollected: false, castlingUsed: false, skillAcquired: [] };

  if (state.phase !== GamePhase.PLAYER_TURN || !state.player) return result;

  const targetCell = state.grid.cells.get(posKey(targetPos));
  if (!targetCell || !targetCell.isPlayerAccessible) return result;

  // 检查目标位置是否有敌人（踩死）
  let killedEnemy = false;
  let killedEnemyId: string | undefined;
  let killedEnemyType: EntityType | undefined;

  if (targetCell.entity && targetCell.entity.team === Team.ENEMY) {
    const enemy = targetCell.entity;
    enemy.isDead = true;
    killedEnemy = true;
    killedEnemyId = enemy.id;
    killedEnemyType = enemy.type;

    state.killStreak = Math.min(state.killStreak + 1, SCORE_CONFIG.maxKillStreak);
    const streakMult = state.killStreak;

    let baseScore = 0;
    if (enemy.type === EntityType.PAWN) baseScore = SCORE_CONFIG.pawnKill;
    else if (enemy.type === EntityType.KNIGHT) baseScore = SCORE_CONFIG.knightKill;
    else if (enemy.type === EntityType.ROOK) baseScore = SCORE_CONFIG.rookKill;

    const gained = baseScore * streakMult;
    state.score += gained;
    result.scoreGained = gained;
    result.killedEnemyId = killedEnemyId;
    result.killedEnemyType = killedEnemyType;
  }

  if (!killedEnemy) {
    state.killStreak = 0;
  }

  // 吃金币
  if (targetCell.hasCoin) {
    state.score += SCORE_CONFIG.coinPickup;
    result.scoreGained += SCORE_CONFIG.coinPickup;
    targetCell.hasCoin = false;
    result.coinCollected = true;
  }

  // 从旧位置移除
  const oldCell = state.grid.cells.get(posKey(state.player.position));
  if (oldCell) oldCell.entity = null;

  // 王车易位：远距离移动后进入冷却
  const movedDist = Math.max(
    Math.abs(targetPos.x - state.player.position.x),
    Math.abs(targetPos.y - state.player.position.y)
  );
  result.castlingUsed = checkCastlingUsed(state, movedDist);

  // 移动玩家
  state.player.position = posClone(targetPos);
  targetCell.entity = state.player;

  // 检查技能触发
  result.skillAcquired = checkSkillTrigger(state);

  // 计算敌人移动
  calculateEnemyMoves(state);

  // 切换到敌人回合
  state.phase = GamePhase.ENEMY_TURN;
  state.animating = true;
  result.moved = true;

  return result;
}

// ============================================================================
// 敌人回合执行（含技能/护甲/冻结/威势/围攻）
// ============================================================================

export interface EnemyTurnResult {
  playerDead: boolean;
  armorBlocked: boolean;
  siegeKillId: string | null;
}

export function executeEnemyTurn(state: GameState): EnemyTurnResult {
  const result: EnemyTurnResult = { playerDead: false, armorBlocked: false, siegeKillId: null };

  if (!state.player) return result;

  // 借刀杀人：冻结相邻敌人
  applyIntimidateFreeze(state);

  // 威胁判定
  let playerDead = false;
  let killer: Entity | null = null;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;
    for (const threat of enemy.threatRange || []) {
      if (posEq(threat, state.player!.position)) {
        playerDead = true;
        killer = enemy;
        break;
      }
    }
    if (playerDead) break;
  }

  // 铁甲护身：抵挡致命攻击
  if (playerDead && applyArmor(state)) {
    playerDead = false;
    result.armorBlocked = true;
  }

  if (playerDead) {
    state.player.isDead = true;
    state.phase = GamePhase.GAME_OVER;
    state.isVictory = false;
    state.deathMessage = `被 ${killer?.type || '敌人'} 击杀`;
    result.playerDead = true;
    return result;
  }

  // 移动敌人（跳过冻结 + 将军威势阻挡）
  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;
    if (state.frozenEnemies.has(enemy.id)) continue;

    if (enemy.nextMove) {
      // 将军威势：敌人不会走入玩家附近
      if (state.skills.aura > 0) {
        const auraRange = getAuraRange(state.skills.aura);
        const dist = Math.max(
          Math.abs(enemy.nextMove.x - state.player.position.x),
          Math.abs(enemy.nextMove.y - state.player.position.y)
        );
        if (dist <= auraRange) continue;
      }

      const targetKey = posKey(enemy.nextMove);
      const targetCell = state.grid.cells.get(targetKey);

      if (targetCell && !targetCell.entity) {
        const oldCell = state.grid.cells.get(posKey(enemy.position));
        if (oldCell) oldCell.entity = null;
        targetCell.entity = enemy;
        enemy.position = posClone(enemy.nextMove);
      }
    }
  }

  // 兵临城下
  result.siegeKillId = applySiegeEffect(state);

  // 王车易位冷却递减
  tickCastlingCooldown(state);

  // 再次检查技能触发
  checkSkillTrigger(state);

  // 回合推进
  state.turn++;

  // 定期清理死亡敌人
  if (state.turn % SCORE_CONFIG.deadCleanupInterval === 0) {
    state.enemies = state.enemies.filter(e => !e.isDead);
  }

  state.phase = GamePhase.SPAWNING;
  spawnEnemies(state);
  spawnCoins(state);
  updatePlayerAccessiblePositions(state);
  updateThreatMap(state);
  state.phase = GamePhase.PLAYER_TURN;
  state.animating = false;

  return result;
}

// ============================================================================
// 游戏结束检测
// ============================================================================

export function isGameOver(state: GameState): boolean {
  return state.phase === GamePhase.GAME_OVER;
}

// ============================================================================
// 格式化棋盘 ASCII（调试用）
// ============================================================================

export function formatBoardAscii(state: GameState): string {
  const symbols: Record<string, string> = {
    [EntityType.KING]: 'K',
    [EntityType.PAWN]: 'P',
    [EntityType.ROOK]: 'R',
    [EntityType.KNIGHT]: 'N',
  };

  let board = '';
  for (let y = 0; y < state.grid.size; y++) {
    let row = '';
    for (let x = 0; x < state.grid.size; x++) {
      const cell = state.grid.cells.get(posKey({ x, y }));
      if (cell?.entity) {
        row += symbols[cell.entity.type] || '?';
      } else if (cell?.hasCoin) {
        row += '$';
      } else {
        row += '.';
      }
      row += ' ';
    }
    board += row.trim() + '\n';
  }
  return board;
}
