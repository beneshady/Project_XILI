// ============================================================================
// 莫兰迪色系定义
// ----------------------------------------------------------------------------
// 参考微信小游戏《跳一跳》风格：极简、低对比度、柔和色调
// ============================================================================

export const COLORS = {
  // ========== 棋盘 ==========
  board: {
    background: '#f5f3f0',      // 米白色背景
    grid: '#e0ddd8',             // 浅灰网格线
    cell: '#faf8f5',             // 单元格填充
    cellHover: '#e8e6e3',        // 鼠标悬停
  },

  // ========== 高亮 ==========
  highlight: {
    accessible: 'rgba(144, 190, 144, 0.3)',      // 浅薄荷绿，可移动
    threatened: 'rgba(247, 150, 133, 0.4)',      // 浅珊瑚红，威胁范围
    selected: 'rgba(150, 180, 200, 0.4)',        // 浅蓝，选中格
  },

  // ========== 实体颜色 ==========
  entity: {
    // 玩家（王）：莫兰迪蓝色
    player: {
      fill: '#8da4b5',           // 主色
      stroke: '#6d8596',          // 描边
      shadow: 'rgba(109, 133, 150, 0.3)',  // 阴影
    },

    // 兵（经验包）：薄荷绿色
    pawn: {
      fill: '#98c4b8',            // 主色
      stroke: '#78a498',          // 描边
      shadow: 'rgba(120, 164, 152, 0.3)',
    },

    // 车：珊瑚红色
    rook: {
      fill: '#e39b7e',            // 主色
      stroke: '#c37b5e',          // 描边
      shadow: 'rgba(195, 123, 94, 0.3)',
    },

    // 马：暖橙色
    knight: {
      fill: '#e8b07a',            // 主色
      stroke: '#c8905a',          // 描边
      shadow: 'rgba(200, 144, 90, 0.3)',
    },
  },

  // ========== UI 文字 ==========
  text: {
    primary: '#4a4a4a',           // 主要文字
    secondary: '#7a7a7a',         // 次要文字
    accent: '#c97b5e',            // 强调色
    playerSymbol: '#ffffff',      // 玩家符号（白色）
    enemySymbol: '#4a4a4a',       // 敌人符号（深灰）
  },

  // ========== 背景 ==========
  background: '#f8f6f3',         // 整体背景

  // ========== 按钮状态 ==========
  button: {
    normal: '#a8b5c0',
    hover: '#98a5b0',
    active: '#8895a0',
    text: '#ffffff',
  },
};

export const ENTITY_SYMBOLS = {
  PLAYER: '♔',       // 王家
  PAWN: '♟',          // 兵
  ROOK: '♜',          // 车
  KNIGHT: '♞',        // 马
};

export const ENTITY_NAMES = {
  PLAYER: '王',
  PAWN: '兵',
  ROOK: '车',
  KNIGHT: '马',
};
