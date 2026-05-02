// ============================================================================
// 类型定义（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------

export interface Position {
  x: number; // 0-7, 列索引
  y: number; // 0-7, 行索引
}

export enum EntityType {
  KING = 'king',
  PAWN = 'pawn',
  ROOK = 'rook',
  KNIGHT = 'knight',
  COIN = 'coin',
}

export enum Team {
  PLAYER = 'player',
  ENEMY = 'enemy',
  ITEM = 'item',
}

export interface Entity {
  id: string;
  type: EntityType;
  team: Team;
  position: Position;
  isDead: boolean;
  threatRange?: Position[];
  nextMove?: Position;
}

export interface Cell {
  position: Position;
  entity: Entity | null;
  hasCoin: boolean;
  isPlayerAccessible: boolean;
  isThreatened: boolean;
}

export interface Grid {
  size: number; // 固定为 8
  cells: Map<string, Cell>;
}

export enum GamePhase {
  PLAYER_TURN = 'player_turn',
  ENEMY_TURN = 'enemy_turn',
  ANIMATING = 'animating',
  SPAWNING = 'spawning',
  GAME_OVER = 'game_over',
}

// 技能ID
export type SkillId = 'armor' | 'intimidate' | 'castling' | 'aura' | 'siege';

export const SKILL_IDS: SkillId[] = ['armor', 'intimidate', 'castling', 'aura', 'siege'];

export interface SkillLevels {
  armor: number;
  intimidate: number;
  castling: number;
  aura: number;
  siege: number;
}

export interface GameState {
  phase: GamePhase;
  turn: number;
  score: number;
  grid: Grid;
  entities: Map<string, Entity>;
  player: Entity | null;
  enemies: Entity[];

  // 输入锁定（动画/tween 期间为 true）
  animating: boolean;

  // 技能系统
  lastSkillScore: number;
  skills: SkillLevels;
  castlingCooldown: number;
  siegeTimer: number;
  frozenEnemies: Set<string>;
  killStreak: number;

  // 游戏结果
  isVictory?: boolean;
  deathMessage?: string;
}
