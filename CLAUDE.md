# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chess Roguelike** - A turn-based survival game combining chess rules with roguelike mechanics on an 8x8 board.

- **Type**: Single-player HTML5 Canvas game
- **Language**: Pure JavaScript (ES6+) in demo.html, TypeScript in src/
- **Dependencies**: None (zero-dependency)

## Commands

```bash
# Play the game - open in browser
demo.html

# Run logic tests
tests/game_logic_test.html   # Unit tests (open in browser)
tests/harness.html          # Console-based tests
```

No build step required - the game runs directly in the browser.

## Architecture

The game has two implementations:

1. **demo.html** - Self-contained playable demo (single HTML file, all JS embedded)
2. **src/** - TypeScript implementation split into modules

### Core Game Logic (in demo.html)

| Function | Purpose |
|----------|---------|
| `createGrid(size)` | Initialize 8x8 board with cells Map |
| `updatePlayerAccessiblePositions(state)` | Mark 9 positions around player |
| `updateThreatMap(state)` | Calculate and mark all enemy threat ranges |
| `getRookThreat(entity, grid)` | Return straight-line threats until blocked |
| `getKnightThreat(entity, grid)` | Return 8 L-shape positions |
| `calculateEnemyMoves(state)` | AI: each enemy moves toward player |
| `executeEnemyTurn(state)` | Move enemies, check player death, spawn new enemies |
| `handlePlayerMove(state, targetPos)` | Validate and execute player move |

### Rendering (CanvasRenderer class in demo.html)

- `render(state)` - Main render loop
- `screenToBoard(x, y)` - Convert click coordinates to grid position

### Game Flow

```
Player click → validate accessible → move player → calculate enemy moves → 
enemy turn → check death → spawn enemies → update threat map → render
```

### Entity Types

- `KING` (player) - moves in 9-square area
- `PAWN` - moves 1 tile toward player, threatens diagonal
- `ROOK` - moves straight toward player, threatens entire row/column
- `KNIGHT` - moves in L-shape toward player, threatens 8 L-positions

## Testing

The test file at `tests/game_logic_test.html` contains unit tests for:
- Position utilities (posEq, isValidPos, sign)
- Threat range calculations (Rook, Knight, Pawn)
- Player accessible positions
- Enemy move calculations

Open in browser to run all tests.
