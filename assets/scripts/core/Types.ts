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
