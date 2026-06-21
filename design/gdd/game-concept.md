# Project XILI Game Concept

## High Concept

Project XILI is an infinite-survival Chinese-chess roguelike. The player controls the 帅 on a 9x10 board, reads enemy threat ranges, kills advancing pieces, and grows a build through periodic shop decisions.

## Core Loop

1. Read the board and choose a safe or aggressive move.
2. Kill enemies to gain score and an equal amount of coins.
3. Survive the enemy turn and escalating spawn pressure.
4. At score thresholds `3`, `7`, then every `+5`, pause in the skill shop.
5. Spend coins on any number of offered skill upgrades, or save coins and leave.
6. Resume the interrupted turn flow and survive as long as possible.

## Run Structure

- Mode: infinite survival; there is no fixed victory score.
- Failure: the 帅 is killed by an enemy threat.
- Score: permanent run performance and leaderboard value.
- Coins: spendable run currency; every score award grants the same number of coins.
- Skills: persistent upgrades within the current run, acquired only through shop purchases.
- Survival time: active gameplay time, excluding time spent in the shop; frozen at game over.

## Player Decisions

- Board tactics: safety, positioning, kill streaks, and threat avoidance.
- Economy: spend five coins now or save for later shops.
- Build growth: choose among up to three random skill offers, including duplicate offers.
- Tempo: the shop is safe and can be closed without buying.

## Experience Goals

- Short tactical turns with readable consequences.
- A clear reward rhythm driven by kills and score thresholds.
- Meaningful build choices without interrupting the underlying chess-survival identity.
- Runs that remain comparable through score and active survival time.

