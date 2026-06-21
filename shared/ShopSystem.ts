import { GamePhase, GameState, ShopOffer, SkillId, SKILL_IDS } from './Types';
import { SHOP_OFFER_COUNT, SHOP_PRICE } from './GameConfig';
import { SKILL_SPECS } from './SkillSpecs';
import { grantSkill } from './SkillSystem';

export type PurchaseResult =
  | 'purchased'
  | 'not_in_shop'
  | 'invalid_offer'
  | 'sold_out'
  | 'max_level'
  | 'insufficient_coins';

export function getNextShopThreshold(lastScore: number): number {
  if (lastScore === 0) return 3;
  if (lastScore === 3) return 7;
  return lastScore + 5;
}

export function awardScore(state: GameState, amount: number): number {
  const gained = Math.max(0, Math.floor(amount));
  state.score += gained;
  state.coins += gained;
  return gained;
}

export function getAvailableShopSkills(state: GameState): SkillId[] {
  return SKILL_IDS.filter(id => state.skills[id] < SKILL_SPECS[id].maxLevel);
}

export function generateShopOffers(state: GameState): ShopOffer[] {
  const available = getAvailableShopSkills(state);
  if (available.length === 0) return [];
  const count = Math.min(SHOP_OFFER_COUNT, available.length);
  const offers: ShopOffer[] = [];
  for (let i = 0; i < count; i++) {
    const skillId = available[Math.floor(Math.random() * available.length)];
    offers.push({ id: `shop_${state.lastShopScore}_${i}`, skillId, price: SHOP_PRICE, purchased: false });
  }
  return offers;
}

export function maybeOpenShop(state: GameState, now: number = Date.now()): boolean {
  let latestThreshold = state.lastShopScore;
  let nextThreshold = getNextShopThreshold(latestThreshold);
  while (state.score >= nextThreshold) {
    latestThreshold = nextThreshold;
    nextThreshold = getNextShopThreshold(latestThreshold);
  }
  if (latestThreshold === state.lastShopScore) return false;

  state.lastShopScore = latestThreshold;
  state.shopOffers = generateShopOffers(state);
  if (state.shopOffers.length === 0) return false;

  state.phase = GamePhase.SHOP;
  state.shopOpenedAt = now;
  state.animating = false;
  return true;
}

export function canPurchaseOffer(state: GameState, offer: ShopOffer): PurchaseResult {
  if (state.phase !== GamePhase.SHOP) return 'not_in_shop';
  if (offer.purchased) return 'sold_out';
  if (state.skills[offer.skillId] >= SKILL_SPECS[offer.skillId].maxLevel) return 'max_level';
  if (state.coins < offer.price) return 'insufficient_coins';
  return 'purchased';
}

export function purchaseShopOffer(state: GameState, offerId: string): PurchaseResult {
  const offer = state.shopOffers.find(item => item.id === offerId);
  if (!offer) return 'invalid_offer';
  const status = canPurchaseOffer(state, offer);
  if (status !== 'purchased') return status;
  if (!grantSkill(state, offer.skillId)) return 'max_level';
  state.coins -= offer.price;
  offer.purchased = true;
  return 'purchased';
}

export function closeShop(state: GameState, now: number = Date.now()): GamePhase {
  if (state.phase !== GamePhase.SHOP) return state.phase;
  if (state.shopOpenedAt !== undefined) {
    state.pausedDurationMs += Math.max(0, now - state.shopOpenedAt);
  }
  state.phase = GamePhase.PLAYER_TURN;
  state.shopOpenedAt = undefined;
  state.shopOffers = [];
  return state.phase;
}

export function getElapsedGameMs(state: GameState, now: number = Date.now()): number {
  const end = state.finishedAt ?? now;
  const activeShopPause = state.phase === GamePhase.SHOP && state.shopOpenedAt !== undefined
    ? Math.max(0, end - state.shopOpenedAt)
    : 0;
  return Math.max(0, end - state.startedAt - state.pausedDurationMs - activeShopPause);
}
