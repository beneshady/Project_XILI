// ============================================================================
// tests/harness.node.js
// ----------------------------------------------------------------------------
// 纯 Node.js 环境的回合 harness：
//   - 仅 require('../js/GameLogic.js')，禁止 require 任何渲染文件
//   - 用种子 RNG 复现同一局，跑完 N 个回合或玩家死亡
//   - 所有事件进 state.log，最后打印文本日志
//
// 运行：
//   node tests/harness.node.js
//   node tests/harness.node.js --seed 42 --turns 60 --ascii
// ============================================================================

'use strict';

// ---- 沙箱校验：harness 启动前先冻结所有前端全局，确保 GameLogic 无 DOM 依赖
const FORBIDDEN_GLOBALS = ['window', 'document', 'requestAnimationFrame', 'wx', 'HTMLCanvasElement'];
for (const name of FORBIDDEN_GLOBALS) {
  if (typeof globalThis[name] !== 'undefined') {
    throw new Error(`[Harness] global "${name}" already exists; environment is not clean`);
  }
}

const GameLogic = require('../js/GameLogic.js');

// ---- 命令行参数 ----
function parseArgs(argv) {
  const out = { seed: 42, turns: 40, ascii: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed')    out.seed  = Number(argv[++i]);
    else if (a === '--turns') out.turns = Number(argv[++i]);
    else if (a === '--ascii') out.ascii = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
  }
  return out;
}

// ---- 简单策略：优先吃子 > 吃金币 > 走非威胁格 > 任意可达 ----
function pickMove(state) {
  const { grid, player, rng } = state;
  const accessible = [];
  for (const cell of grid.cells.values()) {
    if (cell.isPlayerAccessible && !(cell.entity === player)) {
      accessible.push(cell);
    }
  }
  if (accessible.length === 0) return null;

  const captures = accessible.filter(c => c.entity && c.entity.team === GameLogic.Team.ENEMY && !c.isThreatened);
  if (captures.length > 0) return captures[Math.floor(rng() * captures.length)].position;

  const coins = accessible.filter(c => c.hasCoin && !c.isThreatened);
  if (coins.length > 0) return coins[Math.floor(rng() * coins.length)].position;

  const safe = accessible.filter(c => !c.isThreatened && !c.entity);
  if (safe.length > 0) return safe[Math.floor(rng() * safe.length)].position;

  const pool = accessible.filter(c => !c.entity || c.entity.team === GameLogic.Team.ENEMY);
  if (pool.length > 0) return pool[Math.floor(rng() * pool.length)].position;

  return accessible[0].position;
}

// ---- 主程序 ----
function main() {
  const args = parseArgs(process.argv);
  console.log(`[Harness] seed=${args.seed} turns=${args.turns} ascii=${args.ascii}`);
  console.log('='.repeat(72));

  const state = GameLogic.createInitialState({ seed: args.seed });

  if (args.ascii) {
    console.log(GameLogic.formatBoardAscii(state));
    console.log('-'.repeat(72));
  }

  let playedTurns = 0;
  for (let t = 0; t < args.turns; t++) {
    if (GameLogic.isGameOver(state)) break;

    const target = pickMove(state);
    if (!target) {
      console.log(`[Harness] turn ${state.turn}: no accessible move, aborting`);
      break;
    }

    const ok = GameLogic.handlePlayerMove(state, target);
    if (!ok) {
      console.log(`[Harness] turn ${state.turn}: handlePlayerMove rejected (${target.x},${target.y})`);
      break;
    }

    GameLogic.executeEnemyTurn(state);
    playedTurns++;

    if (args.ascii) {
      console.log(GameLogic.formatBoardAscii(state));
      console.log('-'.repeat(72));
    }
  }

  // ---- 输出日志 ----
  console.log('='.repeat(72));
  console.log('[Harness] event log:');
  for (const line of state.log) console.log('  ' + line);

  // ---- 最终汇总 ----
  console.log('='.repeat(72));
  const unlockedSkills = Object.entries(state.skills)
    .filter(([, lv]) => lv > 0)
    .map(([id, lv]) => `${id} Lv.${lv}`)
    .join(', ') || '(none)';

  console.log('[Harness] summary:');
  console.log(`  played turns : ${playedTurns}`);
  console.log(`  final turn   : ${state.turn}`);
  console.log(`  final phase  : ${state.phase}`);
  console.log(`  final score  : ${state.score}`);
  console.log(`  kill streak  : ${state.killStreak}`);
  console.log(`  enemies alive: ${state.enemies.filter(e => !e.isDead).length}`);
  console.log(`  unlocked     : ${unlockedSkills}`);
  console.log(`  game over    : ${GameLogic.isGameOver(state)}`);
  if (state.deathMessage) {
    console.log(`  death reason : ${state.deathMessage}`);
  }
  console.log(`  event count  : ${state.log.length}`);

  return GameLogic.isGameOver(state) ? 0 : 0; // harness 本身不以胜负判定成功
}

try {
  process.exitCode = main();
} catch (err) {
  console.error('[Harness] FAILED:', err);
  process.exitCode = 1;
}
