// ============================================================================
// Shared core type definitions.
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export enum EntityType {
  GENERAL = 'general',
  SOLDIER = 'soldier',
  ROOK = 'rook',
  KNIGHT = 'knight',
  CANNON = 'cannon',
  ELEPHANT = 'elephant',
  ADVISOR = 'advisor',

  // Backward-compatible aliases used by older tests/docs.
  KING = 'general',
  PAWN = 'soldier',
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
  isPlayerAccessible: boolean;
  isThreatened: boolean;
}

export interface Grid {
  width: number;
  height: number;
  size: number;
  cells: Map<string, Cell>;
}

export enum GamePhase {
  PLAYER_TURN = 'player_turn',
  ENEMY_TURN = 'enemy_turn',
  ANIMATING = 'animating',
  SPAWNING = 'spawning',
  GAME_OVER = 'game_over',
}

export type SkillId = 'armor' | 'intimidate' | 'castling' | 'aura' | 'siege';

export const SKILL_IDS: SkillId[] = ['armor', 'intimidate', 'castling', 'aura', 'siege'];

// ----------------------------------------------------------------------------
// 数据驱动技能定义（SkillSpec）
// ----------------------------------------------------------------------------

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
  types:    SkillType[];
  faction:  Faction;
  icon:     string;
  maxLevel: number;
  /** key=数值名, value=每级的值（索引 0 = 1 级） */
  scaling:  Record<string, number[]>;
}

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
  animating: boolean;
  lastSkillScore: number;
  skills: SkillLevels;
  castlingCooldown: number;
  siegeTimer: number;
  frozenEnemies: Set<string>;
  killStreak: number;
  isVictory?: boolean;
  deathMessage?: string;
}
