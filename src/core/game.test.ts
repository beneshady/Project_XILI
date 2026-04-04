// ============================================================================
// 游戏逻辑测试工具
// ============================================================================
// 在浏览器控制台中运行：
// import { testHarness } from './src/core/game.test.js';
// testHarness();
// ============================================================================

import {
  createInitialState,
  getPlayerAccessiblePositions,
  getEmptyCells,
  handlePlayerMove,
  executeEnemyTurn,
  isGameOver,
  updateThreatMap,
} from './game';
import { posKey } from './utils';

// ============================================================================
// 可视化辅助函数
// ============================================================================

function renderBoard(state: any): string {
  let output = '\n';
  output += `  回合: ${state.turn}  分数: ${state.score}  阶段: ${state.phase}\ne\n`;
  output += '  +------------------------+\n';

  for (let y = 0; y < 8; y++) {
    output += `  |`;
    for (let x = 0; x < 8; x++) {
      const key = `${x},${y}`;
      const cell = state.grid.cells.get(key);
      let char = '·'; // 空格子

      if (cell?.entity) {
        const entity = cell.entity;
        if (entity.team === 'player') {
          char = '♔'; // 玩家（王）
        } else if (entity.type === 'pawn') {
          char = '♟'; // 兵
        } else if (entity.type === 'rook') {
          char = '♜'; // 车
        } else if (entity.type === 'knight') {
          char = '♞'; // 马
        }
      } else if (cell?.isThreatened) {
        char = '×'; // 威胁范围
      } else if (cell?.isPlayerAccessible) {
        char = '○'; // 玩家可移动范围
      }

      output += ` ${char} `;
    }
    output += '|\n';
  }

  output += '  +------------------------+\n';
  output += '  图例: ♔=玩家 ♟=兵 ♜=车 ♞=马 ×=威胁 ○=可移动 ·=空\n\n';

  // 敌人信息
  if (state.enemies.length > 0) {
    output += '  敌人列表:\n';
    for (const enemy of state.enemies) {
      if (enemy.isDead) continue;
      const typeName = enemy.type.toUpperCase();
      output += `    ${typeName} at (${enemy.position.x},${enemy.position.y})\n`;
    }
    output += '\n';
  }

  return output;
}

// ============================================================================
// 简单交互式测试
// ============================================================================

export function testHarness() {
  console.log('=== 肉鸽象棋游戏逻辑测试 ===\n');

  // 初始化游戏
  const state = createInitialState();
  console.log('游戏初始化完成！');
  console.log(renderBoard(state));

  // 测试：获取玩家可移动范围
  const accessible = getPlayerAccessiblePositions(state);
  console.log(`玩家可移动范围 (${accessible.length} 个格子):`);
  console.log(accessible.map(p => `(${p.x},${p.y})`).join(', '));
  console.log('');

  // 测试：获取空格子
  const empty = getEmptyCells(state);
  console.log(`空格子数量: ${empty.length}`);

  // 导出测试函数到全局
  (window as any).gameState = state;
  (window as any).renderBoard = renderBoard;
  (window as any).getPlayerAccessiblePositions = getPlayerAccessiblePositions;
  (window as any).getEmptyCells = getEmptyCells;
  (window as any).handlePlayerMove = handlePlayerMove;
  (window as any).executeEnemyTurn = executeEnemyTurn;
  (window as any).isGameOver = isGameOver;
  (window as any).posKey = posKey;

  console.log('\n=== 可用命令 ===');
  console.log('renderBoard(gameState)              - 显示当前棋盘');
  console.log('handlePlayerMove(gameState, {x, y})  - 玩家移动到 (x,y)');
  console.log('executeEnemyTurn(gameState)        - 执行敌人回合');
  console.log('isGameOver(gameState)               - 检查游戏是否结束');
  console.log('');
  console.log('示例: handlePlayerMove(gameState, {x: 4, y: 4})');
  console.log('然后: renderBoard(gameState)');
  console.log('');
  console.log('提示：玩家可移动范围显示为 ○');
}

// ============================================================================
// 自动化测试套件
// ============================================================================

export function runAutomatedTests() {
  console.log('=== 运行自动化测试 ===\n');

  let passed = 0;
  let failed = 0;

  // 测试 1: 游戏初始化
  {
    const state = createInitialState();
    if (state.player && state.enemies.length === 0 && state.score === 0) {
      console.log('✓ 测试 1: 游戏初始化 - 通过');
      passed++;
    } else {
      console.log('✗ 测试 1: 游戏初始化 - 失败');
      failed++;
    }
  }

  // 测试 2: 玩家可移动范围
  {
    const state = createInitialState();
    const accessible = getPlayerAccessiblePositions(state);
    if (accessible.length <= 9 && accessible.length >= 1) {
      console.log('✓ 测试 2: 玩家可移动范围 - 通过');
      passed++;
    } else {
      console.log('✗ 测试 2: 玩家可移动范围 - 失败');
      failed++;
    }
  }

  // 测试 3: 空格子检测
  {
    const state = createInitialState();
    const empty = getEmptyCells(state);
    if (empty.length === 63) { // 8x8 - 1个玩家
      console.log('✓ 测试 3: 空格子检测 - 通过');
      passed++;
    } else {
      console.log('✗ 测试 3: 空格子检测 - 失败');
      failed++;
    }
  }

  // 测试 4: 威胁范围计算
  {
    const state = createInitialState();
    updateThreatMap(state);
    let hasThreat = false;
    for (const cell of state.grid.cells.values()) {
      if (cell.isThreatened) {
        hasThreat = true;
        break;
      }
    }
    if (!hasThreat) { // 初始没有敌人，应该没有威胁
      console.log('✓ 测试 4: 威胁范围计算 - 通过');
      passed++;
    } else {
      console.log('✗ 测试 4: 威胁范围计算 - 失败');
      failed++;
    }
  }

  console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
  return { passed, failed };
}
