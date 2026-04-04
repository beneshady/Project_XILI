// ============================================================================
// Canvas 渲染引擎
// ----------------------------------------------------------------------------
// 负责游戏画面的绘制，采用莫兰迪色系和几何风格
// ============================================================================

import { COLORS, ENTITY_SYMBOLS } from './colors';
import { GameState, Entity, Position } from '../core/types';

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  padding: number;
}

export class CanvasRenderer {
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

    // 计算格子大小
    this.padding = 20;
    const availableWidth = canvas.width - this.padding * 2;
    this.cellSize = Math.floor(availableWidth / 8);
    this.boardSize = this.cellSize * 8;
  }

  // ============================================================================
  // 主渲染函数
  // ============================================================================

  render(state: GameState): void {
    // 清空画布
    this.clear();

    // 绘制棋盘背景
    this.drawBoardBackground();

    // 绘制网格
    this.drawGrid();

    // 绘制高亮（可移动范围、威胁范围）
    this.drawHighlights(state);

    // 绘制实体
    this.drawEntities(state);

    // 绘制 UI
    this.drawUI(state);
  }

  // ============================================================================
  // 基础绘制函数
  // ============================================================================

  private clear(): void {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ============================================================================
  // 棋盘绘制
  // ============================================================================

  private drawBoardBackground(): void {
    const startX = this.padding;
    const startY = this.padding;

    // 绘制棋盘底色
    this.ctx.fillStyle = COLORS.board.background;
    this.ctx.fillRect(startX, startY, this.boardSize, this.boardSize);
  }

  private drawGrid(): void {
    const startX = this.padding;
    const startY = this.padding;

    this.ctx.strokeStyle = COLORS.board.grid;
    this.ctx.lineWidth = 1;

    // 绘制横向线
    for (let i = 0; i <= 8; i++) {
      const y = startY + i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(startX + this.boardSize, y);
      this.ctx.stroke();
    }

    // 绘制纵向线
    for (let i = 0; i <= 8; i++) {
      const x = startX + i * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, startY + this.boardSize);
      this.ctx.stroke();
    }
  }

  // ============================================================================
  // 高亮绘制
  // ============================================================================

  private drawHighlights(state: GameState): void {
    const startX = this.padding;
    const startY = this.padding;

    // 遍历所有格子
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = state.grid.cells.get(`${x},${y}`);
        if (!cell) continue;

        const px = startX + x * this.cellSize;
        const py = startY + y * this.cellSize;

        // 绘制可移动范围（空格子）
        if (cell.isPlayerAccessible && !cell.entity) {
          this.ctx.fillStyle = COLORS.highlight.accessible;
          this.ctx.fillRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);

          // 绘制小圆点指示
          this.ctx.fillStyle = 'rgba(144, 190, 144, 0.8)';
          this.ctx.beginPath();
          this.ctx.arc(px + this.cellSize / 2, py + this.cellSize / 2, 4, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // 绘制威胁范围
        if (cell.isThreatened) {
          this.ctx.fillStyle = COLORS.highlight.threatened;
          this.ctx.fillRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4);
        }
      }
    }
  }

  // ============================================================================
  // 实体绘制
  // ============================================================================

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
      const offset = size / 2;

      switch (entity.type) {
        case 'king':
          this.drawPlayer(cx, cy, size, entity);
          break;
        case 'pawn':
          this.drawPawn(cx, cy, size, entity);
          break;
        case 'rook':
          this.drawRook(cx, cy, size, entity);
          break;
        case 'knight':
          this.drawKnight(cx, cy, size, entity);
          break;
      }
    }
  }

  // 绘制玩家（圆角矩形）
  private drawPlayer(x: number, y: number, size: number, entity: Entity): void {
    const halfSize = size / 2;
    const radius = size * 0.2;

    // 阴影
    this.ctx.fillStyle = COLORS.entity.player.shadow;
    this.drawRoundedRect(x - halfSize + 3, y - halfSize + 3, size, size, radius);

    // 主体
    this.ctx.fillStyle = COLORS.entity.player.fill;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius);

    // 描边
    this.ctx.strokeStyle = COLORS.entity.player.stroke;
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius, true);

    // 符号
    this.ctx.fillStyle = COLORS.text.playerSymbol;
    this.ctx.font = `${size * 0.5}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(ENTITY_SYMBOLS.PLAYER, x, y);
  }

  // 绘制兵（圆形）
  private drawPawn(x: number, y: number, size: number, entity: Entity): void {
    const radius = size / 2;

    // 阴影
    this.ctx.fillStyle = COLORS.entity.pawn.shadow;
    this.ctx.beginPath();
    this.ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // 主体
    this.ctx.fillStyle = COLORS.entity.pawn.fill;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // 描边
    this.ctx.strokeStyle = COLORS.entity.pawn.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  // 绘制车（圆角矩形 + 文字）
  private drawRook(x: number, y: number, size: number, entity: Entity): void {
    const halfSize = size / 2;
    const radius = size * 0.15;

    // 阴影
    this.ctx.fillStyle = COLORS.entity.rook.shadow;
    this.drawRoundedRect(x - halfSize + 3, y - halfSize + 3, size, size, radius);

    // 主体
    this.ctx.fillStyle = COLORS.entity.rook.fill;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius);

    // 描边
    this.ctx.strokeStyle = COLORS.entity.rook.stroke;
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius, true);

    // 符号
    this.ctx.fillStyle = COLORS.text.enemySymbol;
    this.ctx.font = `bold ${size * 0.45}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('车', x, y);
  }

  // 绘制马（圆角矩形 + 文字）
  private drawKnight(x: number, y: number, size: number, entity: Entity): void {
    const halfSize = size / 2;
    const radius = size * 0.15;

    // 阴影
    this.ctx.fillStyle = COLORS.entity.knight.shadow;
    this.drawRoundedRect(x - halfSize + 3, y - halfSize + 3, size, size, radius);

    // 主体
    this.ctx.fillStyle = COLORS.entity.knight.fill;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius);

    // 描边
    this.ctx.strokeStyle = COLORS.entity.knight.stroke;
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - halfSize, y - halfSize, size, size, radius, true);

    // 符号
    this.ctx.fillStyle = COLORS.text.enemySymbol;
    this.ctx.font = `bold ${size * 0.45}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('马', x, y);
  }

  // ============================================================================
  // 辅助绘制函数
  // ============================================================================

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

  // ============================================================================
  // UI 绘制
  // ============================================================================

  private drawUI(state: GameState): void {
    const topY = 20;
    const leftX = this.padding + this.boardSize + 20;

    // 标题
    this.ctx.fillStyle = COLORS.text.primary;
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('肉鸽象棋', leftX, topY);

    // 回合数
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.font = '16px Arial';
    this.ctx.fillText(`回合: ${state.turn}`, leftX, topY + 40);

    // 分数
    this.ctx.fillText(`分数: ${state.score}`, leftX, topY + 65);

    // 阶段
    const phaseText = this.getPhaseText(state.phase);
    this.ctx.fillText(`阶段: ${phaseText}`, leftX, topY + 90);

    // 游戏结束信息
    if (state.phase === 'game_over') {
      this.ctx.fillStyle = COLORS.text.accent;
      this.ctx.font = 'bold 20px Arial';
      this.ctx.fillText('游戏结束!', leftX, topY + 130);

      this.ctx.fillStyle = COLORS.text.secondary;
      this.ctx.font = '14px Arial';
      if (state.deathMessage) {
        // 简单换行处理
        const words = state.deathMessage.split('');
        let line = '';
        let y = topY + 160;
        for (let i = 0; i < words.length; i++) {
          line += words[i];
          if ((i + 1) % 10 === 0) {
            this.ctx.fillText(line, leftX, y);
            line = '';
            y += 20;
          }
        }
        if (line) {
          this.ctx.fillText(line, leftX, y);
        }
      }

      this.ctx.fillStyle = COLORS.button.text;
      this.ctx.fillText('刷新页面重新开始', leftX, topY + 200);
    }

    // 图例
    this.drawLegend(leftX, topY + 250);
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

  private drawLegend(x: number, y: number): void {
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.font = '14px Arial';
    this.ctx.fillText('图例:', x, y);

    const legendY = y + 25;
    const spacing = 25;

    // 玩家
    this.ctx.fillStyle = COLORS.entity.player.fill;
    this.ctx.beginPath();
    this.ctx.arc(x + 10, legendY, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.fillText('玩家', x + 25, legendY - 5);

    // 兵
    this.ctx.fillStyle = COLORS.entity.pawn.fill;
    this.ctx.beginPath();
    this.ctx.arc(x + 10, legendY + spacing, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.fillText('兵', x + 25, legendY + spacing - 5);

    // 车
    this.ctx.fillStyle = COLORS.entity.rook.fill;
    this.ctx.fillRect(x + 2, legendY + spacing * 2 - 8, 16, 16);
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.fillText('车', x + 25, legendY + spacing * 2 - 5);

    // 马
    this.ctx.fillStyle = COLORS.entity.knight.fill;
    this.ctx.fillRect(x + 2, legendY + spacing * 3 - 8, 16, 16);
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.fillText('马', x + 25, legendY + spacing * 3 - 5);

    // 可移动
    this.ctx.fillStyle = COLORS.highlight.accessible;
    this.ctx.fillRect(x + 2, legendY + spacing * 4 - 8, 16, 16);
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.fillText('可移动', x + 25, legendY + spacing * 4 - 5);

    // 威胁
    this.ctx.fillStyle = COLORS.highlight.threatened;
    this.ctx.fillRect(x + 2, legendY + spacing * 5 - 8, 16, 16);
    this.ctx.fillStyle = COLORS.text.secondary;
    this.ctx.fillText('威胁', x + 25, legendY + spacing * 5 - 5);
  }

  // ============================================================================
  // 坐标转换
  // ============================================================================

  // 将屏幕坐标转换为棋盘坐标
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
