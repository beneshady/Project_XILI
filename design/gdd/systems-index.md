# Systems Index

## System Map

| System | Owns | Depends On | Feeds |
|---|---|---|---|
| Turn State | `GamePhase`, safe flow points, shop-to-player resume | Board input, enemy AI | Shop, HUD, survival timer |
| Scoring | score awards, kill values, kill-streak multiplier | Combat kills, skill auto-kills | Coins, shop thresholds, leaderboard |
| Coins | equal-value income from every score award, purchase spending | Scoring | Shop purchasing, HUD |
| Skills | levels, max levels, immediate effects, first-acquisition side effects | Skill specs, shop purchases | Movement, defense, enemy turns |
| Shop | thresholds, offers, purchases, pause/resume | Score, coins, skills, turn state | Skill growth, HUD/modal |
| HUD / UI | score, coins, time, phase, skill levels, shop cards | All runtime state | Player decisions |
| Survival Timer | active elapsed time excluding shop pauses | Turn state, shop timestamps, game over | HUD, leaderboard |
| Leaderboard | final score, turn, active survival time | Scoring, timer, game over | Result UI |

## Dependency Rules

- Scoring is the only source of coin income: every positive score award grants equal coins.
- Purchases subtract coins only and never change score.
- Shop thresholds read score and advance independently from whether offers can be generated.
- The shop owns a modal `SHOP` phase and always closes into `PLAYER_TURN`.
- Board input and enemy progression accept only their expected phases, so `SHOP` pauses gameplay.
- Survival time subtracts completed and currently active shop pause durations.
- Skill effects remain in the skill system; the shop calls the same explicit grant path so first-acquisition initialization remains consistent.

## Safe Shop Entry Points

- Player movement kill: after movement resolution and enemy move calculation, before enemy execution.
- Skill automatic kill: after the enemy-turn effect resolves, at the next player-turn safe point.
- Other future score sources: award score first, then call shop entry at their nearest stable flow boundary.
