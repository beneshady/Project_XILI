'use strict';

// Tests for src/core/Leaderboard.ts
// Run: node tests/test-leaderboard.js

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { stripTypeScriptTypes } = require('module');

const root = path.resolve(__dirname, '..');

function loadTsModule(relPath) {
  const abs = path.join(root, relPath);
  const src = fs.readFileSync(abs, 'utf8');
  let code = stripTypeScriptTypes(src, { mode: 'transform' });
  // Strip ESM import/export to allow CommonJS eval; this file has no cross-module imports.
  code = code.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/g, '');
  code = code.replace(/export\s+(?=(const|let|var|function|class|interface|enum)\b)/g, '');
  const m = new Module(abs);
  m.filename = abs;
  m.paths = Module._nodeModulePaths(path.dirname(abs));
  const wrapped = `(function (module, exports, require) {\n${code}\nmodule.exports = { compareEntries, normalizeName, loadLeaderboard, insertEntry, clearLeaderboard, getRank, formatElapsed, MAX_ENTRIES, MAX_NAME_LENGTH, ANONYMOUS_NAME };\n})`;
  const fn = eval(wrapped);
  fn(m, m.exports, require);
  return m.exports;
}

const LB = loadTsModule('src/core/Leaderboard.ts');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error(`  FAIL: ${msg}`); }
}
function assertEq(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${msg}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

function entry(score, elapsedSec, timestamp, name = 'p', turn = 1, isVictory = false) {
  return { name, score, turn, elapsedSec, isVictory, timestamp };
}

function makeMockStorage(initial = null) {
  let store = initial;
  return {
    read()  { return store; },
    write(v) { store = v; },
    _peek() { return store; },
    _set(v) { store = v; },
  };
}

// ---------------------------------------------------------------------------
console.log('--- compareEntries: 3-layer rule ---');

// Layer 1: score DESC
assert(LB.compareEntries(entry(20, 10, 1), entry(10, 5, 2)) < 0, 'higher score wins regardless of time');
assert(LB.compareEntries(entry(10, 5, 1), entry(20, 10, 2)) > 0, 'lower score loses regardless of time');

// Layer 2: same score → elapsedSec ASC
assert(LB.compareEntries(entry(10, 5, 1), entry(10, 10, 2)) < 0, 'same score: less time wins');
assert(LB.compareEntries(entry(10, 10, 1), entry(10, 5, 2)) > 0, 'same score: more time loses');

// Layer 3: same score + same time → timestamp ASC (earlier first)
assert(LB.compareEntries(entry(10, 5, 100), entry(10, 5, 200)) < 0, 'same score+time: earlier ts wins');
assert(LB.compareEntries(entry(10, 5, 200), entry(10, 5, 100)) > 0, 'same score+time: later ts loses');

// Identical
assertEq(LB.compareEntries(entry(10, 5, 100), entry(10, 5, 100)), 0, 'identical → 0');

// Mixed: even if A has way less time, lower score still loses
assert(LB.compareEntries(entry(5, 1, 1), entry(6, 999, 2)) > 0, 'score dominates time');

// ---------------------------------------------------------------------------
console.log('--- normalizeName ---');

assertEq(LB.normalizeName('  '), LB.ANONYMOUS_NAME, 'whitespace-only → 匿名');
assertEq(LB.normalizeName(''), LB.ANONYMOUS_NAME, 'empty → 匿名');
assertEq(LB.normalizeName('  hi  '), 'hi', 'trimmed');
assertEq(LB.normalizeName('a'.repeat(20)), 'a'.repeat(LB.MAX_NAME_LENGTH), 'truncated to MAX_NAME_LENGTH');
assertEq(LB.normalizeName('神之一手'), '神之一手', 'unicode preserved');

// ---------------------------------------------------------------------------
console.log('--- loadLeaderboard: safe parse ---');

assertEq(LB.loadLeaderboard(makeMockStorage(null)), [], 'null → empty');
assertEq(LB.loadLeaderboard(makeMockStorage('not json')), [], 'bad JSON → empty');
assertEq(LB.loadLeaderboard(makeMockStorage('{}')), [], 'non-array → empty');
assertEq(LB.loadLeaderboard(makeMockStorage('[{"name":"x"}]')), [], 'wrong-shape entries dropped');

const validJson = JSON.stringify([entry(10, 5, 1, 'a')]);
const loaded = LB.loadLeaderboard(makeMockStorage(validJson));
assertEq(loaded.length, 1, 'one valid entry loaded');
assertEq(loaded[0].name, 'a', 'name preserved');

// ---------------------------------------------------------------------------
console.log('--- insertEntry: ordering and persistence ---');

const s1 = makeMockStorage(null);
LB.insertEntry(s1, entry(10, 5, 100, 'a'));
LB.insertEntry(s1, entry(20, 10, 200, 'b'));
LB.insertEntry(s1, entry(15, 3, 300, 'c'));
const after = LB.loadLeaderboard(s1);
assertEq(after.map(e => e.name), ['b', 'c', 'a'], 'sorted by score DESC then time ASC');

// Same score → time wins
const s2 = makeMockStorage(null);
LB.insertEntry(s2, entry(10, 10, 100, 'slow'));
LB.insertEntry(s2, entry(10, 5,  200, 'fast'));
assertEq(LB.loadLeaderboard(s2).map(e => e.name), ['fast', 'slow'], 'same score: faster on top');

// ---------------------------------------------------------------------------
console.log('--- MAX_ENTRIES truncation ---');

const sCap = makeMockStorage(null);
for (let i = 0; i < 12; i++) {
  LB.insertEntry(sCap, entry(i, 0, i + 1, `p${i}`));
}
const capped = LB.loadLeaderboard(sCap);
assertEq(capped.length, LB.MAX_ENTRIES, 'truncated to MAX_ENTRIES');
assertEq(capped[0].name, 'p11', 'top is highest score');
assertEq(capped[capped.length - 1].name, 'p2', 'bottom score 2 (0 and 1 dropped)');

// Inserting a low-scoring entry into a full board should leave it OFF the board
const lateLow = entry(-1, 0, 9999, 'late');
LB.insertEntry(sCap, lateLow);
const cappedAfter = LB.loadLeaderboard(sCap);
assertEq(cappedAfter.length, LB.MAX_ENTRIES, 'still MAX_ENTRIES after low-score insert');
assert(!cappedAfter.some(e => e.name === 'late'), 'low-score entry did not make it');

// ---------------------------------------------------------------------------
console.log('--- getRank ---');

const ranked = [entry(30, 5, 1, 'top'), entry(20, 5, 2, 'mid'), entry(10, 5, 3, 'low')];
assertEq(LB.getRank(ranked, ranked[0]), 1, 'top → rank 1');
assertEq(LB.getRank(ranked, ranked[1]), 2, 'mid → rank 2');
assertEq(LB.getRank(ranked, ranked[2]), 3, 'low → rank 3');
assertEq(LB.getRank(ranked, entry(99, 1, 999, 'ghost')), null, 'unknown → null');

// ---------------------------------------------------------------------------
console.log('--- clearLeaderboard ---');

const sClear = makeMockStorage(JSON.stringify([entry(10, 5, 100, 'a')]));
LB.clearLeaderboard(sClear);
assertEq(LB.loadLeaderboard(sClear), [], 'cleared → empty');

// ---------------------------------------------------------------------------
console.log('--- formatElapsed ---');

assertEq(LB.formatElapsed(0), '00:00', '0 → 00:00');
assertEq(LB.formatElapsed(5), '00:05', '5 → 00:05');
assertEq(LB.formatElapsed(65), '01:05', '65 → 01:05');
assertEq(LB.formatElapsed(3600), '01:00:00', '3600 → 01:00:00');
assertEq(LB.formatElapsed(3725), '01:02:05', '3725 → 01:02:05');
assertEq(LB.formatElapsed(-5), '00:00', 'negative clamped to 0');
assertEq(LB.formatElapsed(5.9), '00:05', 'floored');

// ---------------------------------------------------------------------------
console.log('--- storage write failure is non-fatal ---');

const failingStorage = {
  read() { return null; },
  write() { throw new Error('quota exceeded'); },
};
let threw = false;
try {
  LB.insertEntry(failingStorage, entry(10, 5, 100, 'a'));
} catch (_) { threw = true; }
assert(!threw, 'insert does not throw when storage.write fails');

// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
