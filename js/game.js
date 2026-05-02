// ============================================================================
// game.js —— Controller（瘦胶水）
// ----------------------------------------------------------------------------
// 唯一职责：
//   1. 创建 GameLogic state 与 Renderer 实例
//   2. 路由触摸事件到 GameLogic
//   3. 驱动 render loop
// 不允许写入任何游戏规则或绘制代码。
// ============================================================================

const GameLogic = require('./GameLogic.js');
const { CanvasRenderer } = require('./Renderer.js');

class Game {
  /**
   * @param {Object} opts
   * @param {Object} opts.canvas
   * @param {number} opts.windowWidth
   * @param {number} opts.windowHeight
   * @param {number} opts.pixelRatio
   */
  constructor({ canvas, windowWidth, windowHeight, pixelRatio }) {
    this.state = GameLogic.createInitialState();
    this.renderer = new CanvasRenderer({ canvas, windowWidth, windowHeight, pixelRatio });
    this._startRenderLoop();
  }

  handleTouch(x, y) {
    if (GameLogic.isGameOver(this.state)) {
      const btn = this.renderer.restartButtonRect;
      if (btn && this._hitTest(x, y, btn)) this._restart();
      return;
    }

    for (const badge of this.renderer.skillBadgeRects) {
      if (this._hitTest(x, y, badge)) {
        this.renderer.activeTooltipSkillId =
          this.renderer.activeTooltipSkillId === badge.skillId ? null : badge.skillId;
        return;
      }
    }

    if (this.renderer.activeTooltipSkillId) {
      this.renderer.activeTooltipSkillId = null;
      return;
    }

    if (this.state.phase !== GameLogic.GamePhase.PLAYER_TURN) return;

    const boardPos = this.renderer.screenToBoard(x, y);
    if (!boardPos) return;

    const moved = GameLogic.handlePlayerMove(this.state, boardPos);
    if (!moved) return;

    setTimeout(() => {
      if (this.state.phase === GameLogic.GamePhase.ENEMY_TURN) {
        GameLogic.executeEnemyTurn(this.state);
      }
    }, 200);
  }

  _restart() {
    this.state = GameLogic.createInitialState();
    this.renderer.activeTooltipSkillId = null;
    this.renderer.restartButtonRect = null;
  }

  _hitTest(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w &&
           y >= rect.y && y <= rect.y + rect.h;
  }

  _startRenderLoop() {
    const loop = () => {
      this.renderer.render(this.state);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

module.exports = Game;
