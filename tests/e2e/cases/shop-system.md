# Shop System E2E Cases

| ID | Status | P | Case | Key assertions |
|---|---|---|---|---|
| SHOP-01 | Done | P0 | Score awards matching coins and opens the shop modal at the threshold | `score === coins === 3`; shop modal visible; `phase === "shop"` |
| SHOP-02 | Done | P0 | Duplicate shop offers can be bought independently, and max level disables the duplicate remainder | First purchase raises the skill to max, deducts coins, and disables the second duplicate offer |
| SHOP-03 | Done | P0 | Closing the shop without buying returns to player turn and excludes paused time | Elapsed game time is frozen while the shop is open; closing sets `phase === "player_turn"`; turn does not advance |
| SHOP-04 | Done | P0 | Shop modal blocks board input and direct enemy progression while open | Canvas clicks and enemy-turn calls leave turn, player position, and phase unchanged |
| SHOP-05 | Done | P0 | Continuing after a shop opened from enemy turn does not resume or execute enemy turn | Open snapshot records previous phase, turn, and enemy positions; after continue, `phase === "player_turn"`, enemies do not move, turn does not increment, and the next board click moves the player |
