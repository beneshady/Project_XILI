# Shop System

## Purpose

The shop replaces automatic random skill grants. It turns score milestones into explicit economy and build decisions while safely pausing the run.

## Rules

- Score thresholds: `3`, `7`, then every `+5`.
- Crossing several thresholds in one reward opens one shop and advances `lastShopScore` to the latest crossed threshold.
- Every score award grants equal coins. Purchases cost coins only.
- Each shop generates up to three random offers. Duplicate skills are allowed.
- Max-level skills are excluded. If fewer than three skills remain available, fewer offers may appear.
- If all skills are max level, the shop is skipped but the crossed threshold is still consumed.
- Every offer costs five coins.
- The player may buy any number of offers or leave without buying.
- Each offer can be purchased once and is not replenished.
- If a purchase maxes a skill, remaining offers for that skill immediately become unavailable.
- Purchases apply immediately through the normal skill grant path.

## State

| Field | Meaning |
|---|---|
| `coins` | Spendable run currency |
| `lastShopScore` | Latest consumed threshold |
| `shopOffers` | Current offer slots and sold state |
| `shopOpenedAt` | Wall-clock pause start |
| `pausedDurationMs` | Completed shop pause duration |

## Flow

```text
score award
  -> score += amount; coins += amount
  -> nearest safe point checks thresholds
  -> consume all crossed thresholds
  -> no available skills? continue original flow
  -> generate offers and enter SHOP
  -> buy zero or more offers
  -> close shop, accumulate pause duration
  -> enter PLAYER_TURN; enemies do not act when the shop closes
```

## UI Contract

- Canvas/Web and Cocos show score, coins, phase, and owned skills.
- Shop modal shows up to three cards with skill name, level, description, price, and current purchase state.
- States include purchasable, insufficient coins, sold out, and max level.
- A continue button is always available.
- Board input is ignored while `phase === SHOP`.
- Closing the shop always returns to `PLAYER_TURN`, never to `ENEMY_TURN`.

## Validation

- Unit coverage: thresholds, score/coin awards, duplicate offers, max-level filtering, purchases, side effects, and pause time.
- E2E coverage: modal rendering, buying, zero-buy close, board blocking, and timer pause.
- Cocos validation: compile/load and manual interaction in Cocos Creator remain required when the editor is unavailable.
