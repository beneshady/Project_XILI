'use strict';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${message}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 10;
const EntityType = {
  GENERAL: 'general',
  SOLDIER: 'soldier',
  ROOK: 'rook',
  KNIGHT: 'knight',
  CANNON: 'cannon',
  ELEPHANT: 'elephant',
  ADVISOR: 'advisor',
  KING: 'general',
  PAWN: 'soldier',
};
const Team = { PLAYER: 'player', ENEMY: 'enemy' };

function posKey(pos) { return `${pos.x},${pos.y}`; }
function isValidPos(pos, width, height = width) {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}
function createEntity(type, team, position) {
  return { id: `${type}_${position.x}_${position.y}`, type, team, position, isDead: false };
}
function createGrid(width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const grid = { width, height, size: width, cells: new Map() };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid.cells.set(posKey({ x, y }), { position: { x, y }, entity: null, isPlayerAccessible: false, isThreatened: false });
    }
  }
  return grid;
}
function place(grid, entity) {
  grid.cells.get(posKey(entity.position)).entity = entity;
}
function valid(pos, grid) { return isValidPos(pos, grid.width, grid.height); }
function cellAt(grid, pos) { return grid.cells.get(posKey(pos)); }
function isEnemyPalace(pos) { return pos.x >= 3 && pos.x <= 5 && pos.y >= 0 && pos.y <= 2; }
function isEnemySide(pos) { return pos.y <= 4; }

function getRookThreat(entity, grid) {
  const threats = [];
  for (const dir of [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]) {
    let pos = { ...entity.position };
    while (true) {
      pos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
      if (!valid(pos, grid)) break;
      threats.push({ ...pos });
      if (cellAt(grid, pos).entity) break;
    }
  }
  return threats;
}

function getCannonThreat(entity, grid) {
  const threats = [];
  for (const dir of [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }]) {
    let pos = { ...entity.position };
    let hasScreen = false;
    while (true) {
      pos = { x: pos.x + dir.dx, y: pos.y + dir.dy };
      if (!valid(pos, grid)) break;
      const occupied = Boolean(cellAt(grid, pos).entity);
      if (!hasScreen) {
        if (occupied) hasScreen = true;
        continue;
      }
      threats.push({ ...pos });
      if (occupied) break;
    }
  }
  return threats;
}

function getKnightMoves(entity, grid) {
  return [
    { dx: 1, dy: -2, leg: { dx: 0, dy: -1 } },
    { dx: 2, dy: -1, leg: { dx: 1, dy: 0 } },
    { dx: 2, dy: 1, leg: { dx: 1, dy: 0 } },
    { dx: 1, dy: 2, leg: { dx: 0, dy: 1 } },
    { dx: -1, dy: 2, leg: { dx: 0, dy: 1 } },
    { dx: -2, dy: 1, leg: { dx: -1, dy: 0 } },
    { dx: -2, dy: -1, leg: { dx: -1, dy: 0 } },
    { dx: -1, dy: -2, leg: { dx: 0, dy: -1 } },
  ]
    .filter(m => !cellAt(grid, { x: entity.position.x + m.leg.dx, y: entity.position.y + m.leg.dy }).entity)
    .map(m => ({ x: entity.position.x + m.dx, y: entity.position.y + m.dy }))
    .filter(pos => valid(pos, grid));
}

function getElephantMoves(entity, grid) {
  return [{ dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }]
    .map(d => ({ target: { x: entity.position.x + d.dx * 2, y: entity.position.y + d.dy * 2 }, eye: { x: entity.position.x + d.dx, y: entity.position.y + d.dy } }))
    .filter(m => valid(m.target, grid) && isEnemySide(m.target) && !cellAt(grid, m.eye).entity)
    .map(m => m.target);
}

function getAdvisorMoves(entity, grid) {
  return [{ dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }]
    .map(d => ({ x: entity.position.x + d.dx, y: entity.position.y + d.dy }))
    .filter(pos => valid(pos, grid) && isEnemyPalace(pos));
}

function getSoldierMoves(entity, grid) {
  const moves = [{ x: entity.position.x, y: entity.position.y + 1 }];
  if (entity.position.y >= 5) {
    moves.push({ x: entity.position.x - 1, y: entity.position.y }, { x: entity.position.x + 1, y: entity.position.y });
  }
  return moves.filter(pos => valid(pos, grid));
}

console.log('=== Testing Chinese chess logic layer ===\n');

console.log('--- Board ---');
const grid = createGrid();
assertEq(grid.width, 9, 'board width is 9');
assertEq(grid.height, 10, 'board height is 10');
assertEq(grid.cells.size, 90, 'board has 90 intersections');
assert(isValidPos({ x: 8, y: 9 }, BOARD_WIDTH, BOARD_HEIGHT), '(8,9) is valid');
assert(!isValidPos({ x: 9, y: 0 }, BOARD_WIDTH, BOARD_HEIGHT), '(9,0) is invalid');
assert(!isValidPos({ x: 0, y: 10 }, BOARD_WIDTH, BOARD_HEIGHT), '(0,10) is invalid');

console.log('--- Rook ---');
const rook = createEntity(EntityType.ROOK, Team.ENEMY, { x: 4, y: 4 });
assertEq(getRookThreat(rook, grid).length, 17, 'rook at center threatens 17 intersections');

console.log('--- Cannon ---');
const cannonGrid = createGrid();
const cannon = createEntity(EntityType.CANNON, Team.ENEMY, { x: 4, y: 4 });
place(cannonGrid, cannon);
place(cannonGrid, createEntity(EntityType.SOLDIER, Team.ENEMY, { x: 4, y: 6 }));
place(cannonGrid, createEntity(EntityType.SOLDIER, Team.PLAYER, { x: 4, y: 8 }));
assert(getCannonThreat(cannon, cannonGrid).some(p => p.x === 4 && p.y === 8), 'cannon threatens after one screen');
assert(!getCannonThreat(cannon, cannonGrid).some(p => p.x === 4 && p.y === 5), 'cannon does not threaten before screen');

console.log('--- Knight ---');
const knightGrid = createGrid();
const knight = createEntity(EntityType.KNIGHT, Team.ENEMY, { x: 4, y: 4 });
assertEq(getKnightMoves(knight, knightGrid).length, 8, 'unblocked knight has 8 moves');
place(knightGrid, createEntity(EntityType.SOLDIER, Team.ENEMY, { x: 5, y: 4 }));
assert(!getKnightMoves(knight, knightGrid).some(p => p.x === 6 && p.y === 3), 'blocked horse leg removes upper-right long move');
assert(!getKnightMoves(knight, knightGrid).some(p => p.x === 6 && p.y === 5), 'blocked horse leg removes lower-right long move');

console.log('--- Elephant / Advisor / Soldier ---');
const elephantGrid = createGrid();
const elephant = createEntity(EntityType.ELEPHANT, Team.ENEMY, { x: 2, y: 4 });
assert(!getElephantMoves(elephant, elephantGrid).some(p => p.y === 6), 'elephant cannot cross river');
place(elephantGrid, createEntity(EntityType.SOLDIER, Team.ENEMY, { x: 3, y: 3 }));
assert(!getElephantMoves(elephant, elephantGrid).some(p => p.x === 4 && p.y === 2), 'elephant eye blocks diagonal');

const advisor = createEntity(EntityType.ADVISOR, Team.ENEMY, { x: 4, y: 1 });
assertEq(getAdvisorMoves(advisor, grid).length, 4, 'advisor in palace has 4 diagonal palace moves');

const soldierBeforeRiver = createEntity(EntityType.SOLDIER, Team.ENEMY, { x: 4, y: 3 });
assertEq(getSoldierMoves(soldierBeforeRiver, grid), [{ x: 4, y: 4 }], 'soldier before river moves forward only');
const soldierAfterRiver = createEntity(EntityType.SOLDIER, Team.ENEMY, { x: 4, y: 5 });
assertEq(getSoldierMoves(soldierAfterRiver, grid).length, 3, 'soldier after river can move forward and sideways');

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
