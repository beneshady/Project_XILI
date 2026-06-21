// ============================================================================
// Game configuration for the shared core logic.
// ============================================================================

export const BOARD_WIDTH = 9;
export const BOARD_HEIGHT = 10;
export const GRID_SIZE = BOARD_WIDTH;

export const COLORS = {
  board: {
    background: '#f4dfb8',
    grid: '#8b5a2b',
    riverText: '#9b6a37',
    palace: '#b47a3c',
    cell: '#f8e8c8',
    cellHover: '#ead1a5',
  },
  highlight: {
    accessible: 'rgba(70, 150, 95, 0.24)',
    accessibleDot: '#3f9b62',
    threatened: 'rgba(198, 54, 48, 0.28)',
    aura: 'rgba(120, 95, 190, 0.22)',
  },
  entity: {
    player: { fill: '#f7d79b', stroke: '#b7332f', shadow: 'rgba(183, 51, 47, 0.35)', text: '#a32220' },
    soldier: { fill: '#f3d2a4', stroke: '#6f3d25', shadow: 'rgba(111, 61, 37, 0.28)', text: '#34251d' },
    pawn: { fill: '#f3d2a4', stroke: '#6f3d25', shadow: 'rgba(111, 61, 37, 0.28)', text: '#34251d' },
    rook: { fill: '#e7b16f', stroke: '#8f3c2d', shadow: 'rgba(143, 60, 45, 0.32)', text: '#3f2418' },
    knight: { fill: '#edc77d', stroke: '#9a6429', shadow: 'rgba(154, 100, 41, 0.3)', text: '#352315' },
    cannon: { fill: '#e98663', stroke: '#a9362d', shadow: 'rgba(169, 54, 45, 0.36)', text: '#2f1b17' },
    elephant: { fill: '#d7bd83', stroke: '#7f6840', shadow: 'rgba(127, 104, 64, 0.28)', text: '#2d2518' },
    advisor: { fill: '#d9c49c', stroke: '#74614a', shadow: 'rgba(116, 97, 74, 0.28)', text: '#2d241c' },
    general: { fill: '#c8463f', stroke: '#7d211f', shadow: 'rgba(125, 33, 31, 0.38)', text: '#fff3dd' },
  },
  text: {
    primary: '#3f2b1f',
    secondary: '#7a5f45',
    accent: '#b7332f',
    playerSymbol: '#a32220',
    enemySymbol: '#34251d',
  },
  background: '#f8efe0',
  button: {
    normal: '#b98a55',
    hover: '#a67645',
    active: '#8f6037',
    text: '#ffffff',
  },
} as const;

export const ENTITY_SYMBOLS = {
  PLAYER: '帅',
  GENERAL: '将',
  SOLDIER: '兵',
  PAWN: '兵',
  ROOK: '车',
  KNIGHT: '马',
  CANNON: '炮',
  ELEPHANT: '象',
  ADVISOR: '士',
} as const;

export const ENTITY_NAMES = {
  PLAYER: '帅',
  GENERAL: '将',
  SOLDIER: '兵',
  PAWN: '兵',
  ROOK: '车',
  KNIGHT: '马',
  CANNON: '炮',
  ELEPHANT: '象',
  ADVISOR: '士',
} as const;

export const SPAWN_CONFIG = {
  soldierChance: 0.55,
  pawnChance: 0.55,
  knightStartTurn: 5,
  knightMaxCount: 3,
  knightBaseChance: 0.2,
  knightChanceGrowth: 0.05,
  knightMaxChance: 0.5,
  cannonStartTurn: 8,
  cannonMaxCount: 2,
  cannonBaseChance: 0.18,
  cannonChanceGrowth: 0.035,
  cannonMaxChance: 0.42,
  elephantStartTurn: 10,
  elephantMaxCount: 2,
  elephantBaseChance: 0.14,
  elephantChanceGrowth: 0.03,
  elephantMaxChance: 0.35,
  rookStartTurn: 12,
  rookMaxCount: 2,
  rookBaseChance: 0.15,
  rookChanceGrowth: 0.04,
  rookMaxChance: 0.4,
  advisorStartTurn: 14,
  advisorMaxCount: 2,
  advisorBaseChance: 0.12,
  advisorChanceGrowth: 0.025,
  advisorMaxChance: 0.3,
  generalStartTurn: 18,
  generalMaxCount: 1,
  generalBaseChance: 0.1,
  generalChanceGrowth: 0.02,
  generalMaxChance: 0.24,
  maxEnemyBase: 6,
  maxEnemyGrowth: 5,
  maxEnemyCap: 14,
} as const;

export const SCORE_CONFIG = {
  soldierKill: 1,
  pawnKill: 1,
  knightKill: 3,
  cannonKill: 4,
  elephantKill: 4,
  advisorKill: 4,
  rookKill: 5,
  generalKill: 8,
  maxKillStreak: 3,
  deadCleanupInterval: 10,
} as const;

export const SHOP_PRICE = 5;
export const SHOP_OFFER_COUNT = 3;
