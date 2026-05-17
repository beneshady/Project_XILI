// ============================================================================
// Shared game logic.
// ============================================================================

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
import { BOARD_WIDTH, BOARD_HEIGHT, SPAWN_CONFIG, SCORE_CONFIG } from './GameConfig';

const ORTHOGONAL = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const DIAGONAL = [
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

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

export function createGrid(width: number = BOARD_WIDTH, height: number = BOARD_HEIGHT): Grid {
  const grid: Grid = {
    width,
    height,
    size: width,
    cells: new Map(),
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
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

export function createInitialState(): GameState {
  const grid = createGrid();
  const playerPos = randomPos(BOARD_WIDTH, BOARD_HEIGHT);
  const player = createEntity(EntityType.GENERAL, Team.PLAYER, playerPos);

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
  updateThreatMap(state);
  return state;
}

export function getEmptyCells(state: GameState): Position[] {
  const empty: Position[] = [];
  for (const [, cell] of state.grid.cells) {
    if (cell.entity === null) empty.push(posClone(cell.position));
  }
  return empty;
}

function valid(pos: Position, grid: Grid): boolean {
  return isValidPos(pos, grid.width, grid.height);
}

function cellAt(grid: Grid, pos: Position): Cell | undefined {
  return grid.cells.get(posKey(pos));
}

function isEnemyPalace(pos: Position): boolean {
  return pos.x >= 3 && pos.x <= 5 && pos.y >= 0 && pos.y <= 2;
}

function isEnemySide(pos: Position): boolean {
  return pos.y <= 4;
}

export function updatePlayerAccessiblePositions(state: GameState): void {
  for (const cell of state.grid.cells.values()) cell.isPlayerAccessible = false;
  if (!state.player) return;

  const { x, y } = state.player.position;
  const directions = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },  { dx: 0, dy: 0 },  { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
  ];

  for (const dir of directions) {
    const newPos = { x: x + dir.dx, y: y + dir.dy };
    if (valid(newPos, state.grid)) {
      const cell = cellAt(state.grid, newPos);
      if (cell) cell.isPlayerAccessible = true;
    }
  }

  if (state.skills.castling > 0 && state.castlingCooldown <= 0) {
    for (const cell of state.grid.cells.values()) {
      if (!cell.entity || cell.entity === state.player) cell.isPlayerAccessible = true;
    }
  }
}

export function getPlayerAccessiblePositions(state: GameState): Position[] {
  const positions: Position[] = [];
  for (const cell of state.grid.cells.values()) {
    if (cell.isPlayerAccessible) positions.push(posClone(cell.position));
  }
  return positions;
}

export function getThreatRange(entity: Entity, grid: Grid): Position[] {
  switch (entity.type) {
    case EntityType.SOLDIER:
      return getSoldierMoves(entity, grid);
    case EntityType.ROOK:
      return getRookThreat(entity, grid);
    case EntityType.KNIGHT:
      return getKnightMoves(entity, grid);
    case EntityType.CANNON:
      return getCannonThreat(entity, grid);
    case EntityType.ELEPHANT:
      return getElephantMoves(entity, grid);
    case EntityType.ADVISOR:
      return getAdvisorMoves(entity, grid);
    case EntityType.GENERAL:
      return getGeneralThreat(entity, grid);
    default:
      return [];
  }
}

function getSoldierMoves(entity: Entity, grid: Grid): Position[] {
  const moves = [{ x: entity.position.x, y: entity.position.y + 1 }];
  if (entity.position.y >= 5) {
    moves.push(
      { x: entity.position.x - 1, y: entity.position.y },
      { x: entity.position.x + 1, y: entity.position.y }
    );
  }
  return moves.filter(pos => valid(pos, grid));
}

function getRookThreat(entity: Entity, grid: Grid): Position[] {
  const threats: Position[] = [];
  for (const dir of ORTHOGONAL) {
    let pos = posClone(entity.position);
    while (true) {
      pos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
      if (!valid(pos, grid)) break;
      threats.push(posClone(pos));
      if (cellAt(grid, pos)?.entity) break;
    }
  }
  return threats;
}

function getRookMoves(entity: Entity, grid: Grid): Position[] {
  return getSlidingMoves(entity, grid, ORTHOGONAL);
}

function getCannonMoves(entity: Entity, grid: Grid): Position[] {
  return getSlidingMoves(entity, grid, ORTHOGONAL);
}

function getSlidingMoves(entity: Entity, grid: Grid, directions: { dx: number; dy: number }[]): Position[] {
  const moves: Position[] = [];
  for (const dir of directions) {
    let pos = posClone(entity.position);
    while (true) {
      pos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
      if (!valid(pos, grid)) break;
      if (cellAt(grid, pos)?.entity) break;
      moves.push(posClone(pos));
    }
  }
  return moves;
}

function getCannonThreat(entity: Entity, grid: Grid): Position[] {
  const threats: Position[] = [];
  for (const dir of ORTHOGONAL) {
    let pos = posClone(entity.position);
    let hasScreen = false;
    while (true) {
      pos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
      if (!valid(pos, grid)) break;
      const occupied = Boolean(cellAt(grid, pos)?.entity);
      if (!hasScreen) {
        if (occupied) hasScreen = true;
        continue;
      }
      threats.push(posClone(pos));
      if (occupied) break;
    }
  }
  return threats;
}

function getKnightMoves(entity: Entity, grid: Grid): Position[] {
  const moves = [
    { dx: 1, dy: -2, leg: { dx: 0, dy: -1 } },
    { dx: 2, dy: -1, leg: { dx: 1, dy: 0 } },
    { dx: 2, dy: 1, leg: { dx: 1, dy: 0 } },
    { dx: 1, dy: 2, leg: { dx: 0, dy: 1 } },
    { dx: -1, dy: 2, leg: { dx: 0, dy: 1 } },
    { dx: -2, dy: 1, leg: { dx: -1, dy: 0 } },
    { dx: -2, dy: -1, leg: { dx: -1, dy: 0 } },
    { dx: -1, dy: -2, leg: { dx: 0, dy: -1 } },
  ];

  return moves
    .filter(move => !cellAt(grid, {
      x: entity.position.x + move.leg.dx,
      y: entity.position.y + move.leg.dy,
    })?.entity)
    .map(move => ({ x: entity.position.x + move.dx, y: entity.position.y + move.dy }))
    .filter(pos => valid(pos, grid));
}

function getElephantMoves(entity: Entity, grid: Grid): Position[] {
  return DIAGONAL
    .map(dir => ({
      target: { x: entity.position.x + dir.dx * 2, y: entity.position.y + dir.dy * 2 },
      eye: { x: entity.position.x + dir.dx, y: entity.position.y + dir.dy },
    }))
    .filter(move => valid(move.target, grid) && isEnemySide(move.target) && !cellAt(grid, move.eye)?.entity)
    .map(move => move.target);
}

function getAdvisorMoves(entity: Entity, grid: Grid): Position[] {
  return DIAGONAL
    .map(dir => ({ x: entity.position.x + dir.dx, y: entity.position.y + dir.dy }))
    .filter(pos => valid(pos, grid) && isEnemyPalace(pos));
}

function getGeneralMoves(entity: Entity, grid: Grid): Position[] {
  return ORTHOGONAL
    .map(dir => ({ x: entity.position.x + dir.dx, y: entity.position.y + dir.dy }))
    .filter(pos => valid(pos, grid) && isEnemyPalace(pos));
}

function getGeneralThreat(entity: Entity, grid: Grid): Position[] {
  const threats = getGeneralMoves(entity, grid);
  for (const dy of [-1, 1]) {
    let pos = { x: entity.position.x, y: entity.position.y };
    while (true) {
      pos = { x: pos.x, y: pos.y + dy };
      if (!valid(pos, grid)) break;
      threats.push(posClone(pos));
      if (cellAt(grid, pos)?.entity) break;
    }
  }
  return threats;
}

function getLegalMoves(entity: Entity, grid: Grid): Position[] {
  switch (entity.type) {
    case EntityType.SOLDIER:
      return getSoldierMoves(entity, grid);
    case EntityType.ROOK:
      return getRookMoves(entity, grid);
    case EntityType.KNIGHT:
      return getKnightMoves(entity, grid);
    case EntityType.CANNON:
      return getCannonMoves(entity, grid);
    case EntityType.ELEPHANT:
      return getElephantMoves(entity, grid);
    case EntityType.ADVISOR:
      return getAdvisorMoves(entity, grid);
    case EntityType.GENERAL:
      return getGeneralMoves(entity, grid);
    default:
      return [];
  }
}

export function updateThreatMap(state: GameState): void {
  for (const cell of state.grid.cells.values()) cell.isThreatened = false;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;
    const threats = getThreatRange(enemy, state.grid);
    for (const threat of threats) {
      const cell = cellAt(state.grid, threat);
      if (cell) cell.isThreatened = true;
    }
    enemy.threatRange = threats;
  }
}

export function calculateEnemyMoves(state: GameState): void {
  if (!state.player) return;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    const candidates = getLegalMoves(enemy, state.grid)
      .filter(pos => {
        const cell = cellAt(state.grid, pos);
        return cell && (!cell.entity || cell.entity === state.player);
      });

    let bestMove: Position | null = null;
    let bestDist = Infinity;
    for (const candidate of candidates) {
      const dist = Math.abs(candidate.x - state.player.position.x) +
        Math.abs(candidate.y - state.player.position.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestMove = candidate;
      }
    }
    enemy.nextMove = bestMove || undefined;
  }
}

function enemyCount(state: GameState, type: EntityType): number {
  return state.enemies.filter(e => !e.isDead && e.type === type).length;
}

function spawnOne(state: GameState, type: EntityType, candidates: Position[]): boolean {
  const shuffled = shuffle(candidates.filter(pos => !cellAt(state.grid, pos)?.entity));
  if (shuffled.length === 0) return false;
  const pos = shuffled[0];
  const enemy = createEntity(type, Team.ENEMY, pos);
  state.entities.set(enemy.id, enemy);
  state.enemies.push(enemy);
  const cell = cellAt(state.grid, pos);
  if (cell) cell.entity = enemy;
  return true;
}

function allEmpty(state: GameState): Position[] {
  return getEmptyCells(state);
}

function enemySideEmpty(state: GameState): Position[] {
  return getEmptyCells(state).filter(isEnemySide);
}

function palaceEmpty(state: GameState): Position[] {
  return getEmptyCells(state).filter(isEnemyPalace);
}

export function spawnEnemies(state: GameState): void {
  const turn = state.turn;
  const cfg = SPAWN_CONFIG;
  const livingEnemies = state.enemies.filter(e => !e.isDead);
  const maxEnemies = Math.min(cfg.maxEnemyBase + Math.floor(turn / cfg.maxEnemyGrowth), cfg.maxEnemyCap);
  if (livingEnemies.length >= maxEnemies) return;

  if (Math.random() < cfg.soldierChance) {
    spawnOne(state, EntityType.SOLDIER, enemySideEmpty(state));
  }

  if (turn >= cfg.knightStartTurn && enemyCount(state, EntityType.KNIGHT) < cfg.knightMaxCount) {
    const chance = Math.min(cfg.knightBaseChance + (turn - cfg.knightStartTurn) * cfg.knightChanceGrowth, cfg.knightMaxChance);
    if (Math.random() < chance) spawnOne(state, EntityType.KNIGHT, allEmpty(state));
  }

  if (turn >= cfg.cannonStartTurn && enemyCount(state, EntityType.CANNON) < cfg.cannonMaxCount) {
    const chance = Math.min(cfg.cannonBaseChance + (turn - cfg.cannonStartTurn) * cfg.cannonChanceGrowth, cfg.cannonMaxChance);
    if (Math.random() < chance) spawnOne(state, EntityType.CANNON, allEmpty(state));
  }

  if (turn >= cfg.elephantStartTurn && enemyCount(state, EntityType.ELEPHANT) < cfg.elephantMaxCount) {
    const chance = Math.min(cfg.elephantBaseChance + (turn - cfg.elephantStartTurn) * cfg.elephantChanceGrowth, cfg.elephantMaxChance);
    if (Math.random() < chance) spawnOne(state, EntityType.ELEPHANT, enemySideEmpty(state));
  }

  if (turn >= cfg.rookStartTurn && enemyCount(state, EntityType.ROOK) < cfg.rookMaxCount) {
    const chance = Math.min(cfg.rookBaseChance + (turn - cfg.rookStartTurn) * cfg.rookChanceGrowth, cfg.rookMaxChance);
    if (Math.random() < chance) spawnOne(state, EntityType.ROOK, allEmpty(state));
  }

  if (turn >= cfg.advisorStartTurn && enemyCount(state, EntityType.ADVISOR) < cfg.advisorMaxCount) {
    const chance = Math.min(cfg.advisorBaseChance + (turn - cfg.advisorStartTurn) * cfg.advisorChanceGrowth, cfg.advisorMaxChance);
    if (Math.random() < chance) spawnOne(state, EntityType.ADVISOR, palaceEmpty(state));
  }

  if (turn >= cfg.generalStartTurn && enemyCount(state, EntityType.GENERAL) < cfg.generalMaxCount) {
    const chance = Math.min(cfg.generalBaseChance + (turn - cfg.generalStartTurn) * cfg.generalChanceGrowth, cfg.generalMaxChance);
    if (Math.random() < chance) spawnOne(state, EntityType.GENERAL, palaceEmpty(state));
  }
}

export interface MoveResult {
  moved: boolean;
  killedEnemyId?: string;
  killedEnemyType?: EntityType;
  scoreGained: number;
  castlingUsed: boolean;
  skillAcquired: string[];
}

function scoreFor(type: EntityType): number {
  switch (type) {
    case EntityType.SOLDIER:
      return SCORE_CONFIG.soldierKill;
    case EntityType.KNIGHT:
      return SCORE_CONFIG.knightKill;
    case EntityType.CANNON:
      return SCORE_CONFIG.cannonKill;
    case EntityType.ELEPHANT:
      return SCORE_CONFIG.elephantKill;
    case EntityType.ADVISOR:
      return SCORE_CONFIG.advisorKill;
    case EntityType.ROOK:
      return SCORE_CONFIG.rookKill;
    case EntityType.GENERAL:
      return SCORE_CONFIG.generalKill;
    default:
      return 0;
  }
}

export function handlePlayerMove(state: GameState, targetPos: { x: number; y: number }): MoveResult {
  const result: MoveResult = { moved: false, scoreGained: 0, castlingUsed: false, skillAcquired: [] };
  if (state.phase !== GamePhase.PLAYER_TURN || !state.player) return result;

  const targetCell = cellAt(state.grid, targetPos);
  if (!targetCell || !targetCell.isPlayerAccessible) return result;

  let killedEnemy = false;
  if (targetCell.entity && targetCell.entity.team === Team.ENEMY) {
    const enemy = targetCell.entity;
    enemy.isDead = true;
    killedEnemy = true;
    state.killStreak = Math.min(state.killStreak + 1, SCORE_CONFIG.maxKillStreak);
    const gained = scoreFor(enemy.type) * state.killStreak;
    state.score += gained;
    result.scoreGained = gained;
    result.killedEnemyId = enemy.id;
    result.killedEnemyType = enemy.type;
  }

  if (!killedEnemy) state.killStreak = 0;

  const oldCell = cellAt(state.grid, state.player.position);
  if (oldCell) oldCell.entity = null;

  const movedDist = Math.max(
    Math.abs(targetPos.x - state.player.position.x),
    Math.abs(targetPos.y - state.player.position.y)
  );
  result.castlingUsed = checkCastlingUsed(state, movedDist);

  state.player.position = posClone(targetPos);
  targetCell.entity = state.player;
  result.skillAcquired = checkSkillTrigger(state);

  calculateEnemyMoves(state);
  state.phase = GamePhase.ENEMY_TURN;
  state.animating = true;
  result.moved = true;
  return result;
}

export interface EnemyTurnResult {
  playerDead: boolean;
  armorBlocked: boolean;
  siegeKillId: string | null;
}

export function executeEnemyTurn(state: GameState): EnemyTurnResult {
  const result: EnemyTurnResult = { playerDead: false, armorBlocked: false, siegeKillId: null };
  if (!state.player) return result;

  applyIntimidateFreeze(state);
  updateThreatMap(state);

  let playerDead = false;
  let killer: Entity | null = null;
  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;
    for (const threat of enemy.threatRange || []) {
      if (posEq(threat, state.player.position)) {
        playerDead = true;
        killer = enemy;
        break;
      }
    }
    if (playerDead) break;
  }

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

  for (const enemy of state.enemies) {
    if (enemy.isDead || state.frozenEnemies.has(enemy.id) || !enemy.nextMove) continue;

    if (state.skills.aura > 0) {
      const auraRange = getAuraRange(state.skills.aura);
      const dist = Math.max(
        Math.abs(enemy.nextMove.x - state.player.position.x),
        Math.abs(enemy.nextMove.y - state.player.position.y)
      );
      if (dist <= auraRange) continue;
    }

    const targetCell = cellAt(state.grid, enemy.nextMove);
    if (targetCell && !targetCell.entity) {
      const oldCell = cellAt(state.grid, enemy.position);
      if (oldCell) oldCell.entity = null;
      targetCell.entity = enemy;
      enemy.position = posClone(enemy.nextMove);
    }
  }

  result.siegeKillId = applySiegeEffect(state);
  tickCastlingCooldown(state);
  checkSkillTrigger(state);
  state.turn++;

  if (state.turn % SCORE_CONFIG.deadCleanupInterval === 0) {
    state.enemies = state.enemies.filter(e => !e.isDead);
  }

  state.phase = GamePhase.SPAWNING;
  spawnEnemies(state);
  updatePlayerAccessiblePositions(state);
  updateThreatMap(state);
  state.phase = GamePhase.PLAYER_TURN;
  state.animating = false;
  return result;
}

export function isGameOver(state: GameState): boolean {
  return state.phase === GamePhase.GAME_OVER;
}

export function formatBoardAscii(state: GameState): string {
  const symbols: Record<string, string> = {
    [EntityType.GENERAL]: 'G',
    [EntityType.SOLDIER]: 'S',
    [EntityType.ROOK]: 'R',
    [EntityType.KNIGHT]: 'N',
    [EntityType.CANNON]: 'C',
    [EntityType.ELEPHANT]: 'E',
    [EntityType.ADVISOR]: 'A',
  };

  let board = '';
  for (let y = 0; y < state.grid.height; y++) {
    let row = '';
    for (let x = 0; x < state.grid.width; x++) {
      const cell = cellAt(state.grid, { x, y });
      row += cell?.entity ? (symbols[cell.entity.type] || '?') : '.';
      row += ' ';
    }
    board += row.trim() + '\n';
  }
  return board;
}
