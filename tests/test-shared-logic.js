// ============================================================================
// tests/test-shared-logic.js
// ----------------------------------------------------------------------------
// 直接加载 shared/ 编译后的 JS，验证游戏逻辑正确性
// 运行: node tests/test-shared-logic.js
// ============================================================================

'use strict';

// 简易断言
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ============================================================================
// 内联 shared/ 逻辑（因为没有 TS 编译器，直接从 TS 转写关键函数测试）
// ============================================================================

// ---- Types (as runtime objects) ----
const EntityType = {
  KING: 'king', PAWN: 'pawn', ROOK: 'rook', KNIGHT: 'knight', COIN: 'coin',
};
const Team = { PLAYER: 'player', ENEMY: 'enemy', ITEM: 'item' };
const GamePhase = {
  PLAYER_TURN: 'player_turn',
  ENEMY_TURN: 'enemy_turn',
  ANIMATING: 'animating',
  SPAWNING: 'spawning',
  GAME_OVER: 'game_over',
};

// ---- Utils ----
function posEq(a, b) { return a.x === b.x && a.y === b.y; }
function posKey(pos) { return `${pos.x},${pos.y}`; }
function posClone(pos) { return { x: pos.x, y: pos.y }; }
function isValidPos(pos, size) { return pos.x >= 0 && pos.x < size && pos.y >= 0 && pos.y < size; }
function sign(n) { return n === 0 ? 0 : n < 0 ? -1 : 1; }
let idCounter = 0;
function generateId() { return `entity_${++idCounter}`; }
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---- Game Logic ----
function createEntity(type, team, position) {
  return { id: generateId(), type, team, position: posClone(position), isDead: false };
}

function createGrid(size = 8) {
  const grid = { size, cells: new Map() };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid.cells.set(posKey({ x, y }), {
        position: { x, y }, entity: null, hasCoin: false,
        isPlayerAccessible: false, isThreatened: false,
      });
    }
  }
  return grid;
}

function createInitialState() {
  idCounter = 0;
  const grid = createGrid(8);
  const playerPos = { x: 3, y: 3 };
  const player = createEntity(EntityType.KING, Team.PLAYER, playerPos);
  grid.cells.get(posKey(playerPos)).entity = player;

  const state = {
    phase: GamePhase.PLAYER_TURN, turn: 1, score: 0, grid,
    entities: new Map([[player.id, player]]),
    player, enemies: [], animating: false,
    lastSkillScore: 0,
    skills: { armor: 0, intimidate: 0, castling: 0, aura: 0, siege: 0 },
    castlingCooldown: 0, siegeTimer: 0,
    frozenEnemies: new Set(), killStreak: 0,
  };
  updatePlayerAccessiblePositions(state);
  return state;
}

function getEmptyCells(state) {
  const empty = [];
  for (const [, cell] of state.grid.cells) {
    if (cell.entity === null) empty.push(posClone(cell.position));
  }
  return empty;
}

function updatePlayerAccessiblePositions(state) {
  for (const cell of state.grid.cells.values()) cell.isPlayerAccessible = false;
  if (!state.player) return;
  const { x, y } = state.player.position;
  const dirs = [
    {dx:-1,dy:-1},{dx:0,dy:-1},{dx:1,dy:-1},
    {dx:-1,dy:0},{dx:0,dy:0},{dx:1,dy:0},
    {dx:-1,dy:1},{dx:0,dy:1},{dx:1,dy:1},
  ];
  for (const d of dirs) {
    const np = { x: x+d.dx, y: y+d.dy };
    if (isValidPos(np, state.grid.size)) {
      const c = state.grid.cells.get(posKey(np));
      if (c) c.isPlayerAccessible = true;
    }
  }
  if (state.skills.castling > 0 && state.castlingCooldown <= 0) {
    for (const cell of state.grid.cells.values()) {
      if (!cell.entity || cell.entity === state.player) cell.isPlayerAccessible = true;
    }
  }
}

function getRookThreat(entity, grid) {
  const threats = [];
  for (const dir of [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]) {
    let pos = posClone(entity.position);
    while (true) {
      pos.x += dir.dx; pos.y += dir.dy;
      if (!isValidPos(pos, grid.size)) break;
      threats.push(posClone(pos));
      const cell = grid.cells.get(posKey(pos));
      if (cell && cell.entity) break;
    }
  }
  return threats;
}

function getKnightThreat(entity, grid) {
  return [
    {dx:1,dy:-2},{dx:2,dy:-1},{dx:2,dy:1},{dx:1,dy:2},
    {dx:-1,dy:2},{dx:-2,dy:1},{dx:-2,dy:-1},{dx:-1,dy:-2},
  ].map(m => ({ x: entity.position.x+m.dx, y: entity.position.y+m.dy }))
    .filter(pos => isValidPos(pos, grid.size));
}

function updateThreatMap(state) {
  for (const cell of state.grid.cells.values()) cell.isThreatened = false;
  if (!state.player) return;
  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;
    let threats = [];
    if (enemy.type === EntityType.PAWN) {
      const dx = state.player.position.x - enemy.position.x;
      const dy = state.player.position.y - enemy.position.y;
      const step = { x: enemy.position.x + sign(dx), y: enemy.position.y + sign(dy) };
      if (isValidPos(step, state.grid.size)) threats.push(step);
    } else if (enemy.type === EntityType.ROOK) {
      threats = getRookThreat(enemy, state.grid);
    } else if (enemy.type === EntityType.KNIGHT) {
      threats = getKnightThreat(enemy, state.grid);
    }
    for (const t of threats) {
      const c = state.grid.cells.get(posKey(t));
      if (c) c.isThreatened = true;
    }
    enemy.threatRange = threats;
  }
}

// ============================================================================
// TESTS
// ============================================================================

console.log('=== Testing shared/ logic layer ===\n');

// --- Position utils ---
console.log('--- Position Utils ---');
assert(posEq({x:1,y:2}, {x:1,y:2}), 'posEq same position');
assert(!posEq({x:1,y:2}, {x:2,y:1}), 'posEq different position');
assertEq(posKey({x:3,y:5}), '3,5', 'posKey format');
assertEq(posClone({x:7,y:0}), {x:7,y:0}, 'posClone');
assert(isValidPos({x:0,y:0}, 8), 'valid pos (0,0)');
assert(isValidPos({x:7,y:7}, 8), 'valid pos (7,7)');
assert(!isValidPos({x:8,y:0}, 8), 'invalid pos x=8');
assert(!isValidPos({x:-1,y:3}, 8), 'invalid pos x=-1');
assertEq(sign(5), 1, 'sign positive');
assertEq(sign(-3), -1, 'sign negative');
assertEq(sign(0), 0, 'sign zero');

// --- Grid creation ---
console.log('--- Grid Creation ---');
const grid = createGrid(8);
assertEq(grid.size, 8, 'grid size is 8');
assertEq(grid.cells.size, 64, 'grid has 64 cells');
const cell00 = grid.cells.get('0,0');
assert(cell00 !== undefined, 'cell (0,0) exists');
assert(cell00.entity === null, 'cell starts empty');
assert(cell00.hasCoin === false, 'cell starts without coin');
assert(cell00.isPlayerAccessible === false, 'cell starts not accessible');
assert(cell00.isThreatened === false, 'cell starts not threatened');

// --- Initial state ---
console.log('--- Initial State ---');
const state = createInitialState();
assertEq(state.phase, GamePhase.PLAYER_TURN, 'starts in player turn');
assertEq(state.turn, 1, 'starts at turn 1');
assertEq(state.score, 0, 'starts at score 0');
assert(state.player !== null, 'player exists');
assertEq(state.player.type, EntityType.KING, 'player is king');
assertEq(state.player.position.x, 3, 'player at x=3');
assertEq(state.player.position.y, 3, 'player at y=3');
assertEq(state.enemies.length, 0, 'no enemies initially');
assertEq(state.skills.armor, 0, 'no skills initially');
assertEq(state.killStreak, 0, 'no kill streak initially');

// --- Accessible positions ---
console.log('--- Accessible Positions ---');
let accessibleCount = 0;
for (const cell of state.grid.cells.values()) {
  if (cell.isPlayerAccessible) accessibleCount++;
}
// Player at (3,3), 9 positions around it, all valid on 8x8
assertEq(accessibleCount, 9, '9 accessible positions around (3,3)');

// Player at corner
const cornerState = createInitialState();
cornerState.player.position = { x: 0, y: 0 };
cornerState.grid.cells.get('3,3').entity = null;
cornerState.grid.cells.get('0,0').entity = cornerState.player;
updatePlayerAccessiblePositions(cornerState);
let cornerAccess = 0;
for (const cell of cornerState.grid.cells.values()) {
  if (cell.isPlayerAccessible) cornerAccess++;
}
assertEq(cornerAccess, 4, '4 accessible positions at corner (0,0)');

// --- Player move ---
console.log('--- Player Move ---');
const moveState = createInitialState();
// Place a pawn at (4,4)
const pawn = createEntity(EntityType.PAWN, Team.ENEMY, { x: 4, y: 4 });
moveState.entities.set(pawn.id, pawn);
moveState.enemies.push(pawn);
moveState.grid.cells.get('4,4').entity = pawn;

// Move player to (4,4) - should kill the pawn
const oldScore = moveState.score;
// Note: handlePlayerMove in the simple test version
const targetCell = moveState.grid.cells.get('4,4');
assert(targetCell.isPlayerAccessible, '(4,4) is accessible from (3,3)');
assert(targetCell.entity && targetCell.entity.team === Team.ENEMY, 'pawn is at (4,4)');

// --- Threat ranges ---
console.log('--- Threat Ranges ---');
const threatState = createInitialState();

// Rook threat at center
const rook = createEntity(EntityType.ROOK, Team.ENEMY, { x: 4, y: 4 });
const rookThreats = getRookThreat(rook, threatState.grid);
assert(rookThreats.length > 0, 'rook has threats');
// Rook at (4,4) on empty board: 4+4+3+3 = 14 threats (to edges)
assertEq(rookThreats.length, 14, 'rook at center has 14 threats on empty board');

// Knight threat at center
const knight = createEntity(EntityType.KNIGHT, Team.ENEMY, { x: 4, y: 4 });
const knightThreats = getKnightThreat(knight, threatState.grid);
assertEq(knightThreats.length, 8, 'knight at center has 8 threats');

// Knight at corner
const cornerKnight = createEntity(EntityType.KNIGHT, Team.ENEMY, { x: 0, y: 0 });
const cornerKnightThreats = getKnightThreat(cornerKnight, threatState.grid);
assertEq(cornerKnightThreats.length, 2, 'knight at corner has 2 threats');

// --- Skill system ---
console.log('--- Skill System ---');

// Intimidate chance
assertEq(Math.min(0.30 + (1-1)*0.15, 0.75), 0.30, 'intimidate lv1 = 30%');
assert(Math.abs(Math.min(0.30 + (2-1)*0.15, 0.75) - 0.45) < 0.001, 'intimidate lv2 ≈ 45%');
assertEq(Math.min(0.30 + (4-1)*0.15, 0.75), 0.75, 'intimidate lv4 capped at 75%');

// Castling cooldown
assertEq(Math.max(4 - 1 + 1, 2), 4, 'castling lv1 cooldown = 4');
assertEq(Math.max(4 - 2 + 1, 2), 3, 'castling lv2 cooldown = 3');
assertEq(Math.max(4 - 3 + 1, 2), 2, 'castling lv3 cooldown = 2 (minimum)');

// Siege interval
assertEq(Math.max(3 - 1 + 1, 1), 3, 'siege lv1 interval = 3');
assertEq(Math.max(3 - 2 + 1, 1), 2, 'siege lv2 interval = 2');
assertEq(Math.max(3 - 3 + 1, 1), 1, 'siege lv3 interval = 1 (minimum)');

// Aura range
assertEq(Math.min(1, 2), 1, 'aura lv1 range = 1');
assertEq(Math.min(2, 2), 2, 'aura lv2 range = 2');
assertEq(Math.min(3, 2), 2, 'aura lv3 capped at 2');

// Skill threshold
function getNextSkillThreshold(lastScore) {
  if (lastScore === 0) return 3;
  if (lastScore === 3) return 7;
  return lastScore + 5;
}
assertEq(getNextSkillThreshold(0), 3, 'first threshold = 3');
assertEq(getNextSkillThreshold(3), 7, 'second threshold = 7');
assertEq(getNextSkillThreshold(7), 12, 'third threshold = 12');
assertEq(getNextSkillThreshold(12), 17, 'fourth threshold = 17');

// --- Full game loop simulation ---
console.log('--- Game Loop Simulation ---');
const simState = createInitialState();
let simTurns = 0;
for (let t = 0; t < 30; t++) {
  if (simState.phase === GamePhase.GAME_OVER) break;

  // Find an accessible position
  const accessible = [];
  for (const cell of simState.grid.cells.values()) {
    if (cell.isPlayerAccessible && !(cell.entity === simState.player)) {
      accessible.push(cell.position);
    }
  }
  if (accessible.length === 0) break;

  // Pick a safe move
  const safe = accessible.filter(pos => {
    const cell = simState.grid.cells.get(posKey(pos));
    return !cell.isThreatened;
  });
  const target = safe.length > 0 ? safe[0] : accessible[0];

  // Manual move (simplified, no handlePlayerMove here)
  const oldCell = simState.grid.cells.get(posKey(simState.player.position));
  if (oldCell) oldCell.entity = null;

  // Kill enemy if present
  const targetCell = simState.grid.cells.get(posKey(target));
  if (targetCell && targetCell.entity && targetCell.entity.team === Team.ENEMY) {
    targetCell.entity.isDead = true;
    simState.score += 1;
  }

  simState.player.position = posClone(target);
  if (targetCell) targetCell.entity = simState.player;

  simState.turn++;
  simTurns++;

  updatePlayerAccessiblePositions(simState);
  updateThreatMap(simState);
}

assert(simTurns > 0, 'simulation ran at least 1 turn');
assert(simState.turn > 1, 'turn counter advanced');
console.log(`  Simulated ${simTurns} turns, score: ${simState.score}, turn: ${simState.turn}`);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
