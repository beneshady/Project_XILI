// ============================================================================
// Canvas renderer.
// ============================================================================

import { COLORS, ENTITY_SYMBOLS } from './colors';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../core/GameConfig';
import { GameState, Entity, Position } from '../core/types';
import { SKILL_DEFS } from '../core/SkillSystem';
import { formatElapsed } from '../core/Leaderboard';
import { getElapsedGameMs } from '../core/ShopSystem';

/** 当前有效生存时间（秒）：商店暂停不计入，GAME_OVER 后冻结。 */
function formatGameTime(state: GameState): string {
  return formatElapsed(getElapsedGameMs(state) / 1000);
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private padding: number;
  private boardWidth: number;
  private boardHeight: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to get Canvas 2D context');
    this.ctx = ctx;

    this.padding = 28;
    const usableWidth = canvas.width - this.padding * 2 - 180;
    const usableHeight = canvas.height - this.padding * 2;
    this.cellSize = Math.floor(Math.min(usableWidth / (BOARD_WIDTH - 1), usableHeight / (BOARD_HEIGHT - 1)));
    this.boardWidth = this.cellSize * (BOARD_WIDTH - 1);
    this.boardHeight = this.cellSize * (BOARD_HEIGHT - 1);
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

  private origin(): Position {
    return { x: this.padding, y: this.padding };
  }

  private point(pos: Position): Position {
    const start = this.origin();
    return {
      x: start.x + pos.x * this.cellSize,
      y: start.y + pos.y * this.cellSize,
    };
  }

  private drawBoardBackground(): void {
    const start = this.origin();
    this.ctx.fillStyle = COLORS.board.background;
    this.ctx.fillRect(
      start.x - this.cellSize * 0.45,
      start.y - this.cellSize * 0.45,
      this.boardWidth + this.cellSize * 0.9,
      this.boardHeight + this.cellSize * 0.9
    );
  }

  private drawGrid(): void {
    const start = this.origin();
    const endX = start.x + this.boardWidth;
    const endY = start.y + this.boardHeight;
    const riverTop = start.y + 4 * this.cellSize;
    const riverBottom = start.y + 5 * this.cellSize;

    this.ctx.strokeStyle = COLORS.board.grid;
    this.ctx.lineWidth = 2;

    for (let y = 0; y < BOARD_HEIGHT; y++) {
      const py = start.y + y * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, py);
      this.ctx.lineTo(endX, py);
      this.ctx.stroke();
    }

    for (let x = 0; x < BOARD_WIDTH; x++) {
      const px = start.x + x * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(px, start.y);
      this.ctx.lineTo(px, riverTop);
      this.ctx.moveTo(px, riverBottom);
      this.ctx.lineTo(px, endY);
      this.ctx.stroke();
    }

    this.drawPalace(0);
    this.drawPalace(7);
    this.drawRiverText();
  }

  private drawPalace(topRow: number): void {
    const a = this.point({ x: 3, y: topRow });
    const b = this.point({ x: 5, y: topRow });
    const c = this.point({ x: 3, y: topRow + 2 });
    const d = this.point({ x: 5, y: topRow + 2 });
    this.ctx.strokeStyle = COLORS.board.palace;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(d.x, d.y);
    this.ctx.moveTo(b.x, b.y);
    this.ctx.lineTo(c.x, c.y);
    this.ctx.stroke();
  }

  private drawRiverText(): void {
    const start = this.origin();
    const y = start.y + this.cellSize * 4.5;
    this.ctx.fillStyle = COLORS.board.riverText;
    this.ctx.font = `bold ${Math.floor(this.cellSize * 0.42)}px "SimSun", "KaiTi", serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('楚 河', start.x + this.cellSize * 2, y);
    this.ctx.fillText('汉 界', start.x + this.cellSize * 6, y);
  }

  private drawHighlights(state: GameState): void {
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        const cell = state.grid.cells.get(`${x},${y}`);
        if (!cell) continue;
        const p = this.point({ x, y });

        if (cell.isThreatened) {
          this.ctx.fillStyle = COLORS.highlight.threatened;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, this.cellSize * 0.36, 0, Math.PI * 2);
          this.ctx.fill();
        }

        if (cell.isPlayerAccessible && !cell.entity) {
          this.ctx.fillStyle = COLORS.highlight.accessible;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, this.cellSize * 0.32, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = COLORS.highlight.accessibleDot;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, Math.max(3, this.cellSize * 0.08), 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
  }

  private drawEntities(state: GameState): void {
    for (const entity of state.entities.values()) {
      if (entity.isDead) continue;
      const p = this.point(entity.position);
      this.drawPiece(p.x, p.y, this.cellSize * 0.72, entity);
    }
  }

  private drawPiece(x: number, y: number, size: number, entity: Entity): void {
    const style = this.getEntityStyle(entity);
    const radius = size / 2;

    this.ctx.fillStyle = style.shadow;
    this.ctx.beginPath();
    this.ctx.arc(x + 3, y + 4, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = style.fill;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = style.stroke;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.fillStyle = style.text || COLORS.text.enemySymbol;
    this.ctx.font = `bold ${Math.floor(size * 0.46)}px "KaiTi", "SimSun", serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.getEntitySymbol(entity), x, y + 1);
  }

  private getEntityStyle(entity: Entity): { fill: string; stroke: string; shadow: string; text?: string } {
    if (entity.team === 'player') return COLORS.entity.player;
    return (COLORS.entity as any)[entity.type] || COLORS.entity.soldier;
  }

  private getEntitySymbol(entity: Entity): string {
    if (entity.team === 'player') return ENTITY_SYMBOLS.PLAYER;
    const key = entity.type.toUpperCase() as keyof typeof ENTITY_SYMBOLS;
    return ENTITY_SYMBOLS[key] || '?';
  }

  private drawUI(state: GameState): void {
    const leftX = this.padding + this.boardWidth + 56;
    const topY = this.padding;
    this.ctx.fillStyle = COLORS.text.primary;
    this.ctx.font = 'bold 24px Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('肉鸽象棋', leftX, topY);

    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.font = '16px Arial, sans-serif';
    this.ctx.fillText(`回合: ${state.turn}`, leftX, topY + 42);
    this.ctx.fillText(`分数: ${state.score}`, leftX, topY + 68);
    this.ctx.fillText(`金币: ${state.coins}`, leftX, topY + 94);
    this.ctx.fillText(`时间: ${formatGameTime(state)}`, leftX, topY + 120);
    this.ctx.fillText(`阶段: ${this.getPhaseText(state.phase)}`, leftX, topY + 146);

    const skillsBaseY = topY + 186;
    const skillsHeight = this.drawSkillsPanel(state, leftX, skillsBaseY);

    if (state.phase === 'game_over') {
      const gameOverY = skillsBaseY + skillsHeight + 16;
      this.ctx.fillStyle = COLORS.text.accent;
      this.ctx.font = 'bold 20px Arial, sans-serif';
      this.ctx.fillText('游戏结束', leftX, gameOverY);
      this.ctx.font = '14px Arial, sans-serif';
      this.ctx.fillText(state.deathMessage || '被将死', leftX, gameOverY + 30);
      this.ctx.fillText('刷新页面重新开始', leftX, gameOverY + 56);
    }
  }

  // 在右侧面板渲染玩家（帅）当前持有的技能列表。
  // 数据源：state.skills（SkillLevels，玩家独享，没有按棋子区分）。
  // 与 Cocos 端 GameController.updateSkillHud 保持等价输出格式。
  private drawSkillsPanel(state: GameState, x: number, y: number): number {
    const titleHeight = 22;
    const lineHeight = 22;

    this.ctx.fillStyle = COLORS.text.primary;
    this.ctx.font = 'bold 16px Arial, sans-serif';
    this.ctx.fillText('技能', x, y);

    let cursorY = y + titleHeight;
    let hasAny = false;

    for (const id of Object.keys(state.skills) as Array<keyof typeof SKILL_DEFS>) {
      const level = (state.skills as Record<string, number>)[id as string];
      if (!level || level <= 0) continue;
      const def = SKILL_DEFS[id];
      if (!def) continue;
      hasAny = true;
      this.ctx.fillStyle = COLORS.text.secondary;
      this.ctx.font = '14px Arial, sans-serif';
      this.ctx.fillText(`${def.icon} ${def.name} Lv.${level}`, x, cursorY);
      cursorY += lineHeight;
    }

    if (!hasAny) {
      this.ctx.fillStyle = COLORS.text.secondary;
      this.ctx.font = '13px Arial, sans-serif';
      this.ctx.fillText('达到积分阈值可在商店购买技能', x, cursorY);
      cursorY += lineHeight;
    }

    return cursorY - y;
  }

  private getPhaseText(phase: string): string {
    const phaseMap: { [key: string]: string } = {
      player_turn: '你的回合',
      enemy_turn: '敌人行动',
      animating: '动画中',
      spawning: '生成中',
      shop: '商店',
      game_over: '游戏结束',
    };
    return phaseMap[phase] || phase;
  }

  screenToBoard(screenX: number, screenY: number): Position | null {
    const start = this.origin();
    const relX = screenX - start.x;
    const relY = screenY - start.y;
    const x = Math.round(relX / this.cellSize);
    const y = Math.round(relY / this.cellSize);
    const p = this.point({ x, y });
    const dist = Math.hypot(screenX - p.x, screenY - p.y);
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT || dist > this.cellSize * 0.48) {
      return null;
    }
    return { x, y };
  }
}
