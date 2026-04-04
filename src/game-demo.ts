// ============================================================================
// 可玩 Demo - 完整游戏整合
// ============================================================================
// 这个文件整合了游戏逻辑、渲染引擎和用户输入
// 可以直接在浏览器中运行，无需构建工具
// ============================================================================

// ============================================================================
// 类型定义
// ============================================================================

interface Position {
  x: number;
  y: number;
}

enum EntityType {
  KING = 'king',
  PAWN = 'pawn',
  ROOK = 'rook',
  KNIGHT = 'knight',
}

enum Team {
  PLAYER = 'player',
  ENEMY = 'enemy',
}

enum GamePhase {
  PLAYER_TURN = 'player_turn',
  ENEMY_TURN = 'enemy_turn',
  ANIMATING = 'animating',
  SPAWNING = 'spawning',
  GAME_OVER = 'game_over',
}

interface Entity {
  id: string;
  type: EntityType;
  team: Team;
  position: Position;
  isDead: boolean;
  threatRange?: Position[];
  nextMove?: Position;
}

interface Cell {
  position: Position;
  entity: Entity | null;
  isPlayerAccessible: boolean;
  isThreatened: boolean;
}

interface Grid {
  size: number;
  cells: Map<string, Cell>;
}

interface GameState {
  phase: GamePhase;
  turn: number;
  score: number;
  grid: Grid;
  entities: Map<string, Entity>;
  player: Entity | null;
  enemies: Entity[];
  animating: boolean;
  animationQueue: any[];
  isVictory?: boolean;
  deathMessage?: string;
}

interface AnimationAction {
  type: 'move' | 'die';
  entityId: string;
  from?: Position;
  to?: Position;
}

// ============================================================================
// 工具函数
// ============================================================================

function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

function posClone(pos: Position): Position {
  return { x: pos.x, y: pos.y };
}

function isValidPos(pos: Position, size: number): boolean {
  return pos.x >= 0 && pos.x < size && pos.y >= 0 && pos.y < size;
}

function sign(n: number): number {
  return n === 0 ? 0 : n < 0 ? -1 : 1;
}

let idCounter = 0;
function generateId(): string {
  return `entity_${++idCounter}`;
}

function randomPos(size: number): Position {
  return {
    x: Math.floor(Math.random() * size),
    y: Math.floor(Math.random() * size),
  };
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// 游戏逻辑
// ============================================================================

function createEntity(type: EntityType, team: Team, position: Position): Entity {
  return {
    id: generateId(),
    type,
    team,
    position: posClone(position),
    isDead: false,
  };
}

function createGrid(size: number = 8): Grid {
  const grid: Grid = {
    size,
    cells: new Map(),
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell: Cell = {
        position: { x, y },
        entity: null,
        isPlayerAccessible: false,
        isThreatened: false,
      };
      grid.cells.set(posKey({ x, y }), cell);
    }
  }

  return grid;
}

function createInitialState(): GameState {
  const grid = createGrid(8);
  const playerPos = randomPos(8);
  const player = createEntity(EntityType.KING, Team.PLAYER, playerPos);

  const playerCell = grid.cells.get(posKey(playerPos));
  if (playerCell) {
    playerCell.entity = player;
  }

  const state: GameState = {
    phase: GamePhase.PLAYER_TURN,
    turn: 1,
    score: 0,
    grid,
    entities: new Map([[player.id, player]]),
    player,
    enemies: [],
    animating: false,
    animationQueue: [],
  };

  updatePlayerAccessiblePositions(state);

  return state;
}

function getEmptyCells(state: GameState): Position[] {
  const empty: Position[] = [];
  for (const [key, cell] of state.grid.cells) {
    if (cell.entity === null) {
      empty.push(posClone(cell.position));
    }
  }
  return empty;
}

function updatePlayerAccessiblePositions(state: GameState): void {
  for (const cell of state.grid.cells.values()) {
    cell.isPlayerAccessible = false;
  }

  if (!state.player) return;

  const { x, y } = state.player.position;

  const directions = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },  { dx: 0, dy: 0 },  { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
  ];

  for (const dir of directions) {
    const newPos = { x: x + dir.dx, y: y + dir.dy };
    if (isValidPos(newPos, state.grid.size)) {
      const key = posKey(newPos);
      const cell = state.grid.cells.get(key);
      if (cell) {
        cell.isPlayerAccessible = true;
      }
    }
  }
}

function getThreatRange(entity: Entity, grid: Grid): Position[] {
  switch (entity.type) {
    case EntityType.PAWN:
      return [];
    case EntityType.ROOK:
      return getRookThreat(entity, grid);
    case EntityType.KNIGHT:
      return getKnightThreat(entity, grid);
    default:
      return [];
  }
}

function getRookThreat(entity: Entity, grid: Grid): Position[] {
  const threats: Position[] = [];
  const directions = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];

  for (const dir of directions) {
    let pos = posClone(entity.position);

    while (true) {
      pos.x += dir.dx;
      pos.y += dir.dy;

      if (!isValidPos(pos, grid.size)) break;

      threats.push(posClone(pos));

      const cell = grid.cells.get(posKey(pos));
      if (cell && cell.entity) {
        break;
      }
    }
  }

  return threats;
}

function getKnightThreat(entity: Entity, grid: Grid): Position[] {
  const moves = [
    { dx: 1, dy: -2 }, { dx: 2, dy: -1 },
    { dx: 2, dy: 1 },  { dx: 1, dy: 2 },
    { dx: -1, dy: 2 }, { dx: -2, dy: 1 },
    { dx: -2, dy: -1 }, { dx: -1, dy: -2 },
  ];

  return moves
    .map(m => ({
      x: entity.position.x + m.dx,
      y: entity.position.y + m.dy,
    }))
    .filter(pos => isValidPos(pos, grid.size));
}

function updateThreatMap(state: GameState): void {
  for (const cell of state.grid.cells.values()) {
    cell.isThreatened = false;
  }

  if (!state.player) return;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    let threats: Position[] = [];

    if (enemy.type === EntityType.PAWN) {
      const dx = state.player.position.x - enemy.position.x;
      const dy = state.player.position.y - enemy.position.y;
      const step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y + sign(dy),
      };

      if (isValidPos(step, state.grid.size)) {
        threats.push(step);
      }
    } else {
      threats = getThreatRange(enemy, state.grid);
    }

    for (const threat of threats) {
      const cell = state.grid.cells.get(posKey(threat));
      if (cell) {
        cell.isThreatened = true;
      }
    }

    enemy.threatRange = threats;
  }
}

function calculateEnemyMoves(state: GameState): void {
  if (!state.player) return;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    const dx = state.player.position.x - enemy.position.x;
    const dy = state.player.position.y - enemy.position.y;

    let step: Position;

    if (enemy.type === EntityType.ROOK && Math.abs(dx) > Math.abs(dy)) {
      step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y,
      };
    } else if (enemy.type === EntityType.ROOK && Math.abs(dx) < Math.abs(dy)) {
      step = {
        x: enemy.position.x,
        y: enemy.position.y + sign(dy),
      };
    } else {
      step = {
        x: enemy.position.x + sign(dx),
        y: enemy.position.y + sign(dy),
      };
    }

    if (!isValidPos(step, state.grid.size)) {
      if (dx !== 0) {
        step = { x: enemy.position.x + sign(dx), y: enemy.position.y };
      } else {
        step = { x: enemy.position.x, y: enemy.position.y + sign(dy) };
      }
    }

    enemy.nextMove = step;
  }
}

function spawnEnemies(state: GameState): void {
  const turn = state.turn;
  const emptyCells = getEmptyCells(state);
  const shuffledEmpty = shuffle(emptyCells);

  let posIndex = 0;

  const pawnCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < pawnCount && posIndex < shuffledEmpty.length; i++) {
    const pos = shuffledEmpty[posIndex++];
    const pawn = createEntity(EntityType.PAWN, Team.ENEMY, pos);
    state.entities.set(pawn.id, pawn);
    state.enemies.push(pawn);

    const cell = state.grid.cells.get(posKey(pos));
    if (cell) {
      cell.entity = pawn;
    }
  }

  if (turn >= 5 && Math.random() < 0.5 && posIndex < shuffledEmpty.length) {
    const pos = shuffledEmpty[posIndex++];
    const knight = createEntity(EntityType.KNIGHT, Team.ENEMY, pos);
    state.entities.set(knight.id, knight);
    state.enemies.push(knight);

    const cell = state.grid.cells.get(posKey(pos));
    if (cell) {
      cell.entity = knight;
    }
  }

  if (turn >= 10 && Math.random() < 0.5 && posIndex < shuffledEmpty.length) {
    const pos = shuffledEmpty[posIndex++];
    const rook = createEntity(EntityType.ROOK, Team.ENEMY, pos);
    state.entities.set(rook.id, rook);
    state.enemies.push(rook);

    const cell = state.grid.cells.get(posKey(pos));
    if (cell) {
      cell.entity = rook;
    }
  }
}

function handlePlayerMove(state: GameState, targetPos: Position): void {
  if (state.phase !== GamePhase.PLAYER_TURN) {
    return;
  }

  if (!state.player) {
    return;
  }

  const targetCell = state.grid.cells.get(posKey(targetPos));
  if (!targetCell || !targetCell.isPlayerAccessible) {
    return;
  }

  const animAction: AnimationAction = {
    type: 'move',
    entityId: state.player.id,
    from: posClone(state.player.position),
    to: posClone(targetPos),
  };

  if (targetCell.entity && targetCell.entity.team === Team.ENEMY) {
    const enemy = targetCell.entity;
    enemy.isDead = true;
    state.score++;

    animAction.type = 'die';
    animAction.entityId = enemy.id;
  }

  const oldCell = state.grid.cells.get(posKey(state.player.position));
  if (oldCell) {
    oldCell.entity = null;
  }

  state.player.position = posClone(targetPos);
  targetCell.entity = state.player;

  calculateEnemyMoves(state);

  state.phase = GamePhase.ENEMY_TURN;
  state.animating = true;
  state.animationQueue.push(animAction);
}

function executeEnemyTurn(state: GameState): void {
  if (!state.player) return;

  let playerDead = false;
  let killer: Entity | null = null;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;

    for (const threat of enemy.threatRange || []) {
      if (posEq(threat, state.player.position)) {
        playerDead = true;
        killer = enemy;
        break;
      }
    }

    if (playerDead) break;

    if (enemy.nextMove) {
      const oldCell = state.grid.cells.get(posKey(enemy.position));
      if (oldCell) {
        oldCell.entity = null;
      }

      const newCell = state.grid.cells.get(posKey(enemy.nextMove));
      if (newCell) {
        newCell.entity = enemy;
        enemy.position = posClone(enemy.nextMove);
      }
    }
  }

  if (playerDead) {
    state.player.isDead = true;
    state.phase = GamePhase.GAME_OVER;
    state.isVictory = false;
    state.deathMessage = `被 ${killer?.type || '敌人'} 击杀`;
    return;
  }

  state.turn++;
  state.phase = GamePhase.SPAWNING;
  spawnEnemies(state);
  updatePlayerAccessiblePositions(state);
  updateThreatMap(state);
  state.phase = GamePhase.PLAYER_TURN;
  state.animating = false;
}

function isGameOver(state: GameState): boolean {
  return state.phase === GamePhase.GAME_OVER;
}

// ============================================================================
// Canvas 渲染器
// ============================================================================

const COLORS = {
  board: {
    background: '#f5f3f0',
    grid: '#e0ddd8',
    cell: '#faf8f5',
    cellHover: '#e8e6e3',
  },
  highlight: {
    accessible: 'rgba(144, 190, 144, 0.3)',
    threatened: 'rgba(247, 150, 133, 0.4)',
    selected: 'rgba(150, 180, 200, 0.4)',
  },
  entity: {
    player: {
      fill: '#8da4b5',
      stroke: '#6d8596',
      shadow: 'rgba(109, 133, 150, 0.3)',
    },
    pawn: {
      fill: '#98c4b8',
      stroke: '#78a498',
      shadow: 'rgba(120, 164, 152, 0.3)',
    },
    rook: {
      fill: '#e39b7e',
      stroke: '#c37b5e',
      shadow: 'rgba(195, 123, 94, 0.3)',
    },
    knight: {
      fill: '#e8b07a',
      stroke: '#c8905a',
      shadow: 'rgba(200, 144, 90, 0.3)',
    },
  },
  text: {
    primary: '#4a4a4a',
    secondary: '#7a7a7a',
    accent: '#c97b5e',
    playerSymbol: '#ffffff',
    enemySymbol: '#4a4a4a',
  },
  background: '#f8f6f3',
};

const ENTITY_SYMBOLS = {
  PLAYER: '♔',
  PAWN: '♟',
  ROOK: '♜',
  KNIGHT: '♞',
};

class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private padding: number;
  private boardSize: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取 Canvas 2D 上下文');
    }
    this.ctx = ctx;

    this.padding = 20;
    const availableWidth = canvas.width - this.padding * 2;
    this.cellSize = Math.floor(availableWidth / 8);
    this.boardSize = this.cellSize * 8;
  }

  render(state: GameState): void {
    this.clear();
    this.drawBoardBackground();
    this.drawGrid();
    this.drawHighlights(state);
    this.drawEntities(state);
    this.drawUI(state);
  }

  private clear(): void {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawBoardBackground(): void {
    const startX = this.padding;
    const startY = this.padding;

    this.ctx.fillStyle = COLORS.board.background;
    this.ctx.fillRect(startX, startY, this.boardSize, this.boardSize);
  }

  private drawGrid(): void {
    const startX = this.padding;
    const startY = this.padding;

    this.ctx.strokeStyle = COLORS.board.grid;
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= 8; i++) {
      const y = startY + i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(startX + this.boardSize, y);
      this.ctx.stroke();

      const x = startX + i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, startY + this.boardSize);
      this.ctx.stroke();
    }
  }

  private drawHighlights(state: GameState): void {
    const startX = this.padding;
    const startY = this.padding;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = state.grid.cells.get(`${x},${y}`);
        if (!cell) continue;

        const px = startX + x * this.cellSize;
        const py = startY + y * this.cellSize;

        if (cell.isPlayerAccessible && !cell.entity) {
          this.ctx.fillStyle = COLORS.highlight.accessible;
          this.ctx.fillRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);

          this.ctx.fillStyle = 'rgba(144, 190, 144, 0.8)';
          this.ctx.beginPath();
          this.ctx.arc(px + this.cellSize / 2, py + this.cellSize / 2, 4, 0, Math.PI * 2);
          this.ctx.fill();
        }

        if (cell.isThreatened) {
          this.ctx.fillStyle = COLORS.highlight.threatened;
          this.ctx.fillRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);
        }
      }
    }
  }

  private drawEntities(state: GameState): void {
    const startX = this.padding;
    const startY = this.padding;

    for (const entity of state.entities.values()) {
      if (entity.isDead) continue;

      const px = startX + entity.position.x * this.cellSize;
      const py = startY + entity.position.y * this.cellSize;
      const cx = px + this.cellSize / 2;
      const cy = py + this.cellSize / 2;
      const size = this.cellSize * 0.7;
      const halfSize = size / 2;

      switch (entity.type) {
        case EntityType.KING:
          this.drawPlayer(cx, cy, size);
          break;
        case EntityType.PAWN:
          this.drawPawn(cx, cy, size);
          break;
        case EntityType.ROOK:
          this.drawRook(cx, cy, size);
          break;
        case EntityType.KNIGHT:
          this.drawKnight(cx, cy, size);
          break;
      }
    }
  }

  private drawPlayer(x: number, y: number, size: number): void {
    const halfSize = size / 2;
    const radius = size * 0.2;

    this.ctx.fillStyle = COLORS.entity.player.shadow;
    this.drawRoundedRect(x - halfSize + 3, y - halfSize + 3, size, size, radius);

    this.ctx.fillStyle = COLORS.entity.player.fill;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius);

    this.ctx.strokeStyle = COLORS.entity.player.stroke;
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius, true);

    this.ctx.fillStyle = COLORS.text.playerSymbol;
    this.ctx.font = `${size * 0.5}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(ENTITY_SYMBOLS.PLAYER, x, y);
  }

  private drawPawn(x: number, y: number, size: number): void {
    const radius = size / 2;

    this.ctx.fillStyle = COLORS.entity.pawn.shadow;
    this.ctx.beginPath();
    this.ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = COLORS.entity.pawn.fill;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = COLORS.entity.pawn.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawRook(x: number, y: number, size: number): void {
    const halfSize = size / 2;
    const radius = size * 0.15;

    this.ctx.fillStyle = COLORS.entity.rook.shadow;
    this.drawRoundedRect(x - halfSize + 3, y - halfSize + 3, size, size, radius);

    this.ctx.fillStyle = COLORS.entity.rook.fill;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius);

    this.ctx.strokeStyle = COLORS.entity.rook.stroke;
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius, true);

    this.ctx.fillStyle = COLORS.text.enemySymbol;
    this.ctx.font = `bold ${size * 0.45}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('车', x, y);
  }

  private drawKnight(x: number, y: number, size: number): void {
    const halfSize = size / 2;
    const radius = size * 0.15;

    this.ctx.fillStyle = COLORS.entity.knight.shadow;
    this.drawRoundedRect(x - halfSize + 3, y - halfSize + 3, size, size, radius);

    this.ctx.fillStyle = COLORS.entity.knight.fill;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius);

    this.ctx.strokeStyle = COLORS.entity.knight.stroke;
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius, true);

    this.ctx.fillStyle = COLORS.text.enemySymbol;
    this.ctx.font = `bold ${size * 0.45}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('马', x, y);
  }

  private drawRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    stroke: boolean = false
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();

    if (stroke) {
      this.ctx.stroke();
    } else {
      this.ctx.fill();
    }
  }

  private drawUI(state: GameState): void {
    const topY = 20;
    const leftX = this.padding + this.boardSize + 20;

    this.ctx.fillStyle = COLORS.text.primary;
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('肉鸽象棋', leftX, topY);

    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.font = '16px Arial';
    this.ctx.fillText(`回合: ${state.turn}`, leftX, topY + 40);
    this.ctx.fillText(`分数: ${state.score}`, leftX, topY + 65);

    const phaseText = this.getPhaseText(state.phase);
    this.ctx.fillText(`阶段: ${phaseText}`, leftX, topY + 90);

    if (isGameOver(state)) {
      this.ctx.fillStyle = COLORS.text.accent;
      this.ctx.font = 'bold 20px Arial';
      this.ctx.fillText('游戏结束!', leftX, topY + 130);

      this.ctx.fillStyle = COLORS.text.secondary;
      this.ctx.font = '14px Arial';
      if (state.deathMessage) {
        this.ctx.fillText(state.deathMessage, leftX, topY + 160);
      }

      this.ctx.fillText('刷新页面重新开始', leftX, topY + 190);
    }
  }

  private getPhaseText(phase: string): string {
    const phaseMap: { [key: string]: string } = {
      'player_turn': '玩家回合',
      'enemy_turn': '敌人回合',
      'animating': '动画中',
      'spawning': '生成中',
      'game_over': '游戏结束',
    };
    return phaseMap[phase] || phase;
  }

  screenToBoard(screenX: number, screenY: number): Position | null {
    const startX = this.padding;
    const startY = this.padding;

    const boardX = screenX - startX;
    const boardY = screenY - startY;

    if (boardX < 0 || boardX >= this.boardSize ||
        boardY < 0 || boardY >= this.boardSize) {
      return null;
    }

    return {
      x: Math.floor(boardX / this.cellSize),
      y: Math.floor(boardY / this.cellSize),
    };
  }
}

// ============================================================================
// 游戏主类
// ============================================================================

class Game {
  private state: GameState;
  private renderer: CanvasRenderer;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = createInitialState();
    this.renderer = new CanvasRenderer(canvas);

    this.setupInput();
    this.render();
  }

  private setupInput(): void {
    this.canvas.addEventListener('click', (e) => {
      if (isGameOver(this.state)) {
        location.reload();
        return;
      }

      if (this.state.phase !== GamePhase.PLAYER_TURN) {
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const boardPos = this.renderer.screenToBoard(x, y);
      if (boardPos) {
        handlePlayerMove(this.state, boardPos);
        this.render();

        // 短暂延迟后执行敌人回合
        setTimeout(() => {
          if (this.state.phase === GamePhase.ENEMY_TURN) {
            executeEnemyTurn(this.state);
            this.render();
          }
        }, 200);
      }
    });

    // 添加鼠标移动效果（可选）
    this.canvas.addEventListener('mousemove', (e) => {
      // 可以在这里添加悬停效果
    });
  }

  private render(): void {
    this.renderer.render(this.state);
  }
}

// ============================================================================
// 游戏入口
// ============================================================================

declare global {
  interface Window {
    Game: typeof Game;
  }
}

window.Game = Game;

export { Game };
