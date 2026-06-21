'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { stripTypeScriptTypes } = require('module');

const root = path.resolve(__dirname, '..');
const files = [
  'src/core/types.ts',
  'src/core/GameConfig.ts',
  'src/core/utils.ts',
  'src/core/SkillSpecs.ts',
  'src/core/SkillSystem.ts',
  'src/core/ShopSystem.ts',
  'src/core/GameLogic.ts',
];
let code = files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
code = stripTypeScriptTypes(code, { mode: 'transform' });
code = code.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/g, '');
code = code.replace(/\bexport\s+(?=(var|let|const|function|class)\b)/g, '');
const m = new Module(__filename);
const wrapped = `(function(module,exports,require){${code}
module.exports={GamePhase,SKILL_SPECS,getNextShopThreshold,awardScore,generateShopOffers,maybeOpenShop,purchaseShopOffer,canPurchaseOffer,closeShop,getElapsedGameMs,createInitialState,executeEnemyTurn};})`;
eval(wrapped)(m, m.exports, require);
const S = m.exports;

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`  FAIL: ${message}`); }
}
function eq(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}; expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}
function state() {
  return {
    phase: S.GamePhase.PLAYER_TURN,
    score: 0,
    coins: 0,
    lastShopScore: 0,
    shopOffers: [],
    pausedDurationMs: 0,
    animating: false,
    skills: { armor: 0, intimidate: 0, castling: 0, aura: 0, siege: 0 },
    castlingCooldown: 99,
    siegeTimer: 0,
    startedAt: 1000,
  };
}

console.log('--- Shop thresholds and rewards ---');
eq([0, 3, 7, 12].map(S.getNextShopThreshold), [3, 7, 12, 17], 'threshold ladder');
const rewards = state();
S.awardScore(rewards, 8);
eq([rewards.score, rewards.coins], [8, 8], 'score awards equal coins');
assert(S.maybeOpenShop(rewards, 2000), 'crossed thresholds open one shop');
eq(rewards.lastShopScore, 7, 'multi-threshold reward advances to latest threshold');

console.log('--- Offers and purchases ---');
const duplicate = state();
duplicate.score = 3;
duplicate.coins = 15;
const oldRandom = Math.random;
Math.random = () => 0;
S.maybeOpenShop(duplicate, 2000);
Math.random = oldRandom;
eq(duplicate.shopOffers.map(o => o.skillId), ['armor', 'armor', 'armor'], 'duplicate offers allowed');
eq(S.purchaseShopOffer(duplicate, duplicate.shopOffers[0].id), 'purchased', 'purchase succeeds');
eq([duplicate.score, duplicate.coins, duplicate.skills.armor], [3, 10, 1], 'purchase only spends coins');
eq(S.purchaseShopOffer(duplicate, duplicate.shopOffers[0].id), 'sold_out', 'slot purchases once');

const maxed = state();
maxed.coins = 20;
maxed.skills.armor = S.SKILL_SPECS.armor.maxLevel - 1;
maxed.phase = S.GamePhase.SHOP;
maxed.shopOffers = [
  { id: 'a', skillId: 'armor', price: 5, purchased: false },
  { id: 'b', skillId: 'armor', price: 5, purchased: false },
];
eq(S.purchaseShopOffer(maxed, 'a'), 'purchased', 'purchase can reach max');
eq(S.canPurchaseOffer(maxed, maxed.shopOffers[1]), 'max_level', 'remaining duplicate disabled at max');

const poor = state();
poor.phase = S.GamePhase.SHOP;
poor.shopOffers = [{ id: 'x', skillId: 'aura', price: 5, purchased: false }];
eq(S.purchaseShopOffer(poor, 'x'), 'insufficient_coins', 'insufficient coins rejected');

const limited = state();
limited.skills.armor = S.SKILL_SPECS.armor.maxLevel;
limited.skills.intimidate = S.SKILL_SPECS.intimidate.maxLevel;
limited.skills.castling = S.SKILL_SPECS.castling.maxLevel;
Math.random = () => 0;
const limitedOffers = S.generateShopOffers(limited);
Math.random = oldRandom;
eq(limitedOffers.length, 2, 'fewer than three available skills yields fewer offers');
assert(limitedOffers.every(o => o.skillId === 'aura' || o.skillId === 'siege'), 'max-level skills excluded from offers');

const sideEffects = state();
sideEffects.phase = S.GamePhase.SHOP;
sideEffects.coins = 10;
sideEffects.shopOffers = [
  { id: 'c', skillId: 'castling', price: 5, purchased: false },
  { id: 's', skillId: 'siege', price: 5, purchased: false },
];
S.purchaseShopOffer(sideEffects, 'c');
S.purchaseShopOffer(sideEffects, 's');
eq([sideEffects.castlingCooldown, sideEffects.siegeTimer], [0, 3], 'first-acquisition side effects apply');

console.log('--- Full skills and pause/resume ---');
const full = state();
for (const id of Object.keys(full.skills)) full.skills[id] = S.SKILL_SPECS[id].maxLevel;
full.score = 20;
assert(!S.maybeOpenShop(full, 2000), 'all max skips shop');
eq(full.lastShopScore, 17, 'all max still advances threshold');

const paused = state();
paused.phase = S.GamePhase.ENEMY_TURN;
paused.score = 3;
S.maybeOpenShop(paused, 2000);
eq(S.getElapsedGameMs(paused, 5000), 1000, 'active shop pause excluded from elapsed time');
eq(S.closeShop(paused, 6000), S.GamePhase.PLAYER_TURN, 'close always returns to player turn');
eq(paused.pausedDurationMs, 4000, 'closed pause accumulated');
eq(S.getElapsedGameMs(paused, 7000), 2000, 'elapsed continues after shop');

const flow = S.createInitialState();
flow.phase = S.GamePhase.SHOP;
flow.shopOpenedAt = 2000;
flow.turn = 9;
S.closeShop(flow, 3000);
S.executeEnemyTurn(flow);
eq([flow.phase, flow.turn], [S.GamePhase.PLAYER_TURN, 9], 'enemy turn cannot execute after shop closes');

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
