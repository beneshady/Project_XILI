// ============================================================================
// 游戏配置常量（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------

export const GRID_SIZE = 8;

// 莫兰迪色系 - 使用十六进制，各平台自行转换格式
export const COLORS = {
  board: {
    background: '#f5f3f0',
    grid: '#e0ddd8',
    cell: '#faf8f5',
    cellHover: '#e8e6e3',
  },
  highlight: {
    accessible: 'rgba(144, 190, 144, 0.3)',
    accessibleDot: '#90be90',
    threatened: 'rgba(247, 150, 133, 0.4)',
    aura: 'rgba(180, 160, 220, 0.25)',
  },
  entity: {
    player: { fill: '#8da4b5', stroke: '#6d8596', shadow: 'rgba(109, 133, 150, 0.3)' },
    pawn: { fill: '#98c4b8', stroke: '#78a498', shadow: 'rgba(120, 164, 152, 0.3)' },
    rook: { fill: '#e39b7e', stroke: '#c37b5e', shadow: 'rgba(195, 123, 94, 0.3)' },
    knight: { fill: '#e8b07a', stroke: '#c8905a', shadow: 'rgba(200, 144, 90, 0.3)' },
    coin: { fill: '#f5d76e', stroke: '#d4b84a', shadow: 'rgba(200, 180, 80, 0.4)' },
  },
  text: {
    primary: '#4a4a4a',
    secondary: '#7a7a7a',
    accent: '#c97b5e',
    playerSymbol: '#ffffff',
    enemySymbol: '#4a4a4a',
  },
  background: '#f8f6f3',
};

export const ENTITY_SYMBOLS = {
  PLAYER: '\u2654',
  PAWN: '\u265F',
  ROOK: '\u265C',
  KNIGHT: '\u265E',
} as const;

export const ENTITY_NAMES = {
  PLAYER: '王',
  PAWN: '兵',
  ROOK: '车',
  KNIGHT: '马',
  COIN: '币',
} as const;

// 敌人生成配置
export const SPAWN_CONFIG = {
  pawnChance: 0.5,
  knightStartTurn: 5,
  knightMaxCount: 3,
  knightBaseChance: 0.2,
  knightChanceGrowth: 0.05,
  knightMaxChance: 0.5,
  rookStartTurn: 12,
  rookMaxCount: 2,
  rookBaseChance: 0.15,
  rookChanceGrowth: 0.04,
  rookMaxChance: 0.4,
  maxEnemyBase: 6,
  maxEnemyGrowth: 5,
  maxEnemyCap: 12,
} as const;

// 得分配置
export const SCORE_CONFIG = {
  pawnKill: 1,
  knightKill: 3,
  rookKill: 5,
  coinPickup: 1,
  maxKillStreak: 3,
  deadCleanupInterval: 10,
} as const;

// 技能分数阈值
export const SKILL_SCORE_THRESHOLD = 5;
