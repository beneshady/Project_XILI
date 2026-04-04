// ============================================================================
// 类型定义
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
}

export enum Team {
  PLAYER = 'player',
  ENEMY = 'enemy',
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

export interface AnimationAction {
  type: 'move' | 'die';
  entityId: string;
  from?: Position;
  to?: Position;
}

export interface GameState {
  phase: GamePhase;
  turn: number;
  score: number;
  grid: Grid;
  entities: Map<string, Entity>;
  player: Entity | null;
  enemies: Entity[];

  // 动画状态
  animating: boolean;
  animationQueue: AnimationAction[];

  // 游戏结果
  isVictory?: boolean;
  deathMessage?: string;
}
