// ============================================================================
// GameController - Cocos Creator 渲染+输入+游戏循环（单文件 MVP）
// ----------------------------------------------------------------------------
// 挂到场景 Canvas 节点上，自动创建棋盘、处理输入、驱动游戏循环
// ============================================================================

import { _decorator, Component, Node, Graphics, Label, Color, UITransform, Vec3, EventTouch, Size } from 'cc';
import { GameState, GamePhase, EntityType, Team, Position, Entity, Cell } from './core/Types';
import { posKey, posEq } from './core/Utils';
import { createInitialState, handlePlayerMove, executeEnemyTurn, isGameOver, updatePlayerAccessiblePositions, updateThreatMap } from './core/GameLogic';
import { COLORS, ENTITY_SYMBOLS, ENTITY_NAMES, GRID_SIZE } from './core/GameConfig';
import { SKILL_DEFS, getAuraRange } from './core/SkillSystem';

const { ccclass, property } = _decorator;

// CSS 颜色辅助
function hexColor(hex: string): Color {
    const c = new Color();
    c.fromHEX(hex);
    return c;
}

function rgbaColor(r: number, g: number, b: number, a: number): Color {
    return new Color(r, g, b, a);
}

// 解析 CSS rgba 字符串
function parseRgba(rgba: string): Color {
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
    if (m) {
        return new Color(+m[1], +m[2], +m[3], m[4] ? Math.round(+m[4] * 255) : 255);
    }
    return Color.WHITE;
}

// 从 COLORS 对象获取颜色
function getHighlightColor(key: string): Color {
    const map: Record<string, string> = {
        accessible: COLORS.highlight.accessible,
        threatened: COLORS.highlight.threatened,
        aura: COLORS.highlight.aura,
    };
    return parseRgba(map[key] || 'rgba(0,0,0,0)');
}

@ccclass('GameController')
export class GameController extends Component {

    // ---- 内部节点 ----
    private boardNode: Node = null!;
    private boardGfx: Graphics = null!;
    private entityGfx: Graphics = null!;
    private uiNode: Node = null!;
    private scoreLabel: Label = null!;
    private turnLabel: Label = null!;
    private phaseLabel: Label = null!;
    private gameOverNode: Node = null!;
    private gameOverLabel: Label = null!;
    private restartBtn: Node = null!;
    private skillHudNode: Node = null!;
    private skillLabels: Label[] = [];

    // ---- 游戏状态 ----
    private state: GameState = null!;
    private cellSize: number = 0;
    private boardOriginX: number = 0;
    private boardOriginY: number = 0;
    private boardPixelSize: number = 0;

    // ---- 常量 ----
    private readonly PADDING = 20;
    private readonly DESIGN_WIDTH = 720;

    onLoad() {
        // 初始化游戏状态
        this.state = createInitialState();

        // 计算尺寸
        const canvasTransform = this.node.getComponent(UITransform)!;
        const canvasWidth = canvasTransform.contentSize.width || this.DESIGN_WIDTH;
        this.boardPixelSize = canvasWidth - this.PADDING * 2;
        this.cellSize = this.boardPixelSize / GRID_SIZE;
        this.boardOriginX = -this.boardPixelSize / 2;
        this.boardOriginY = -this.boardPixelSize / 2;

        // 创建棋盘节点
        this.boardNode = this.createNode('Board', this.node);
        const boardTransform = this.boardNode.addComponent(UITransform);
        boardTransform.setContentSize(new Size(this.boardPixelSize, this.boardPixelSize));

        this.boardGfx = this.boardNode.addComponent(Graphics);

        // 创建实体层（在棋盘上方）
        const entityNode = this.createNode('Entities', this.boardNode);
        const entityTransform = entityNode.addComponent(UITransform);
        entityTransform.setContentSize(new Size(this.boardPixelSize, this.boardPixelSize));
        this.entityGfx = entityNode.addComponent(Graphics);

        // 创建 UI 层
        this.uiNode = this.createNode('UI', this.node);
        const uiTransform = this.uiNode.addComponent(UITransform);
        uiTransform.setContentSize(new Size(canvasWidth, 200));
        this.uiNode.setPosition(0, this.boardPixelSize / 2 + 60, 0);

        this.scoreLabel = this.createLabel('ScoreLabel', this.uiNode);
        this.scoreLabel.fontSize = 24;
        this.scoreLabel.color = hexColor(COLORS.text.accent);
        this.scoreLabel.node.setPosition(0, 60, 0);

        this.turnLabel = this.createLabel('TurnLabel', this.uiNode);
        this.turnLabel.fontSize = 18;
        this.turnLabel.color = hexColor(COLORS.text.secondary);
        this.turnLabel.node.setPosition(0, 30, 0);

        this.phaseLabel = this.createLabel('PhaseLabel', this.uiNode);
        this.phaseLabel.fontSize = 16;
        this.phaseLabel.color = hexColor(COLORS.text.secondary);
        this.phaseLabel.node.setPosition(0, 0, 0);

        // 技能 HUD
        this.skillHudNode = this.createNode('SkillHud', this.node);
        const skillTransform = this.skillHudNode.addComponent(UITransform);
        skillTransform.setContentSize(new Size(canvasWidth, 40));
        this.skillHudNode.setPosition(0, -this.boardPixelSize / 2 - 40, 0);

        // Game Over 覆盖层
        this.gameOverNode = this.createNode('GameOver', this.node);
        const goTransform = this.gameOverNode.addComponent(UITransform);
        goTransform.setContentSize(new Size(canvasWidth, canvasWidth + 300));
        this.gameOverNode.active = false;

        // 半透明遮罩
        const dimmer = this.createNode('Dimmer', this.gameOverNode);
        const dimTransform = dimmer.addComponent(UITransform);
        dimTransform.setContentSize(new Size(canvasWidth, canvasWidth + 300));
        const dimGfx = dimmer.addComponent(Graphics);
        dimGfx.fillColor = new Color(0, 0, 0, 180);
        dimGfx.rect(-canvasWidth / 2, -(canvasWidth + 300) / 2, canvasWidth, canvasWidth + 300);
        dimGfx.fill();

        // Game Over 文字
        this.gameOverLabel = this.createLabel('GameOverText', this.gameOverNode);
        this.gameOverLabel.fontSize = 36;
        this.gameOverLabel.color = hexColor(COLORS.text.accent);
        this.gameOverLabel.node.setPosition(0, 40, 0);

        const restartLabel = this.createLabel('RestartBtn', this.gameOverNode);
        restartLabel.string = '[ 点击重新开始 ]';
        restartLabel.fontSize = 20;
        restartLabel.color = Color.WHITE;
        restartLabel.node.setPosition(0, -40, 0);
        this.restartBtn = restartLabel.node;

        // 注册触摸
        this.boardNode.on(Node.EventType.TOUCH_END, this.onBoardTouch, this);
        this.node.on(Node.EventType.TOUCH_END, this.onGlobalTouch, this);

        // 首次渲染
        this.render();
    }

    // ---- 触摸处理 ----

    private onBoardTouch(event: EventTouch) {
        if (!this.state || this.state.animating) return;
        if (isGameOver(this.state)) return;

        // 将触摸 UI 坐标转为 boardNode 本地坐标
        const uiPos = event.getUILocation();
        const worldPos = new Vec3(uiPos.x, uiPos.y, 0);
        const localPos = this.boardNode.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);

        // localPos 是相对 boardNode 中心的坐标，boardNode 中心 = 棋盘中心
        // 转换为网格坐标：左下角是 (boardOriginX, boardOriginY)
        const relX = localPos.x - this.boardOriginX;
        const relY = localPos.y - this.boardOriginY;

        // Cocos y 向上，grid y 向下，所以 gridY 需要翻转
        const gridX = Math.floor(relX / this.cellSize);
        const gridY = Math.floor((this.boardPixelSize - relY) / this.cellSize);

        if (gridX < 0 || gridX >= GRID_SIZE || gridY < 0 || gridY >= GRID_SIZE) return;

        this.onPlayerTap({ x: gridX, y: gridY });
    }

    private onGlobalTouch(event: EventTouch) {
        // Game Over 时点击重新开始
        if (isGameOver(this.state)) {
            this.restart();
            return;
        }
    }

    private onPlayerTap(gridPos: Position) {
        if (this.state.phase !== GamePhase.PLAYER_TURN) return;

        const result = handlePlayerMove(this.state, gridPos);
        if (!result.moved) return;

        this.render();

        // 延迟执行敌人回合
        this.scheduleOnce(() => {
            if (this.state.phase === GamePhase.ENEMY_TURN) {
                executeEnemyTurn(this.state);
                this.render();

                if (isGameOver(this.state)) {
                    this.showGameOver();
                }
            }
        }, 0.2);
    }

    private restart() {
        this.state = createInitialState();
        this.gameOverNode.active = false;
        this.render();
    }

    // ---- 渲染 ----

    private render() {
        this.boardGfx.clear();
        this.entityGfx.clear();
        this.drawBoard();
        this.drawHighlights();
        this.drawEntities();
        this.updateUI();
    }

    private drawBoard() {
        const gfx = this.boardGfx;

        // 棋盘背景
        gfx.fillColor = hexColor(COLORS.board.background);
        gfx.rect(this.boardOriginX, this.boardOriginY, this.boardPixelSize, this.boardPixelSize);
        gfx.fill();

        // 网格线
        gfx.strokeColor = hexColor(COLORS.board.grid);
        gfx.lineWidth = 1;

        for (let i = 0; i <= GRID_SIZE; i++) {
            // 横线
            const y = this.boardOriginY + i * this.cellSize;
            gfx.moveTo(this.boardOriginX, y);
            gfx.lineTo(this.boardOriginX + this.boardPixelSize, y);
            // 竖线
            const x = this.boardOriginX + i * this.cellSize;
            gfx.moveTo(x, this.boardOriginY);
            gfx.lineTo(x, this.boardOriginY + this.boardPixelSize);
        }
        gfx.stroke();
    }

    private drawHighlights() {
        const gfx = this.boardGfx;
        const auraRange = (this.state.skills && this.state.skills.aura > 0) ? getAuraRange(this.state.skills.aura) : 0;

        for (let gy = 0; gy < GRID_SIZE; gy++) {
            for (let gx = 0; gx < GRID_SIZE; gx++) {
                const cell = this.state.grid.cells.get(posKey({ x: gx, y: gy }));
                if (!cell) continue;

                const px = this.boardOriginX + gx * this.cellSize;
                const py = this.boardOriginY + (GRID_SIZE - 1 - gy) * this.cellSize;

                // 威胁范围（红色）
                if (cell.isThreatened) {
                    gfx.fillColor = getHighlightColor('threatened');
                    gfx.rect(px, py, this.cellSize, this.cellSize);
                    gfx.fill();
                }

                // 可移动范围（绿色）
                if (cell.isPlayerAccessible) {
                    gfx.fillColor = getHighlightColor('accessible');
                    gfx.rect(px, py, this.cellSize, this.cellSize);
                    gfx.fill();

                    // 小圆点指示
                    if (!cell.entity || cell.entity === this.state.player) {
                        gfx.fillColor = hexColor(COLORS.highlight.accessibleDot);
                        gfx.circle(px + this.cellSize / 2, py + this.cellSize / 2, this.cellSize * 0.12);
                        gfx.fill();
                    }
                }

                // Aura 范围（紫色）
                if (auraRange > 0 && this.state.player) {
                    const dist = Math.max(
                        Math.abs(gx - this.state.player.position.x),
                        Math.abs(gy - this.state.player.position.y)
                    );
                    if (dist <= auraRange && dist > 0) {
                        gfx.fillColor = getHighlightColor('aura');
                        gfx.rect(px, py, this.cellSize, this.cellSize);
                        gfx.fill();
                    }
                }
            }
        }
    }

    private drawEntities() {
        const gfx = this.entityGfx;

        for (const [, entity] of this.state.entities) {
            if (entity.isDead) continue;

            const gx = entity.position.x;
            const gy = entity.position.y;
            const cx = this.boardOriginX + gx * this.cellSize + this.cellSize / 2;
            const cy = this.boardOriginY + (GRID_SIZE - 1 - gy) * this.cellSize + this.cellSize / 2;
            const halfSize = this.cellSize * 0.38;

            const isFrozen = this.state.frozenEnemies.has(entity.id);

            switch (entity.type) {
                case EntityType.KING:
                    this.drawRoundedRect(gfx, cx - halfSize, cy - halfSize, halfSize * 2, halfSize * 2, this.cellSize * 0.15,
                        hexColor(COLORS.entity.player.fill),
                        hexColor(COLORS.entity.player.stroke));
                    break;
                case EntityType.PAWN:
                    gfx.fillColor = hexColor(COLORS.entity.pawn.fill);
                    gfx.strokeColor = hexColor(COLORS.entity.pawn.stroke);
                    gfx.lineWidth = 2;
                    gfx.circle(cx, cy, halfSize);
                    gfx.fill();
                    gfx.stroke();
                    break;
                case EntityType.ROOK:
                    this.drawRoundedRect(gfx, cx - halfSize, cy - halfSize, halfSize * 2, halfSize * 2, this.cellSize * 0.1,
                        hexColor(COLORS.entity.rook.fill),
                        hexColor(COLORS.entity.rook.stroke));
                    break;
                case EntityType.KNIGHT:
                    this.drawRoundedRect(gfx, cx - halfSize, cy - halfSize, halfSize * 2, halfSize * 2, this.cellSize * 0.1,
                        hexColor(COLORS.entity.knight.fill),
                        hexColor(COLORS.entity.knight.stroke));
                    break;
            }

            // 冻结覆盖层
            if (isFrozen) {
                gfx.fillColor = new Color(100, 150, 255, 60);
                gfx.circle(cx, cy, halfSize + 2);
                gfx.fill();
            }
        }
    }

    private drawRoundedRect(gfx: Graphics, x: number, y: number, w: number, h: number, r: number, fill: Color, stroke: Color) {
        gfx.fillColor = fill;
        gfx.strokeColor = stroke;
        gfx.lineWidth = 2;

        gfx.roundRect(x, y, w, h, r);
        gfx.fill();
        gfx.stroke();
    }

    private updateUI() {
        if (this.scoreLabel) {
            let streakText = '';
            if (this.state.killStreak >= 2) {
                streakText = ` (x${this.state.killStreak})`;
            }
            this.scoreLabel.string = `分数: ${this.state.score}${streakText}`;
        }
        if (this.turnLabel) {
            this.turnLabel.string = `回合: ${this.state.turn}`;
        }
        if (this.phaseLabel) {
            const phaseNames: Record<string, string> = {
                [GamePhase.PLAYER_TURN]: '你的回合',
                [GamePhase.ENEMY_TURN]: '敌人行动中...',
                [GamePhase.GAME_OVER]: '游戏结束',
            };
            this.phaseLabel.string = phaseNames[this.state.phase] || this.state.phase;
        }

        // 更新技能 HUD
        this.updateSkillHud();
    }

    private updateSkillHud() {
        // 清除旧标签
        for (const label of this.skillLabels) {
            if (label && label.node) {
                label.node.destroy();
            }
        }
        this.skillLabels = [];

        let hasAnySkill = false;
        let xOffset = 0;

        for (const [id, level] of Object.entries(this.state.skills)) {
            if (level <= 0) continue;
            hasAnySkill = true;
            const def = SKILL_DEFS[id as keyof typeof SKILL_DEFS];
            if (!def) continue;

            const label = this.createLabel(`Skill_${id}`, this.skillHudNode);
            label.fontSize = 14;
            label.color = hexColor(COLORS.text.primary);
            label.string = `${def.icon} ${def.name} Lv.${level}`;

            // 计算位置
            label.node.setPosition(xOffset, 0, 0);
            xOffset += 120; // 间距

            this.skillLabels.push(label);
        }

        if (!hasAnySkill) {
            const hint = this.createLabel('SkillHint', this.skillHudNode);
            hint.fontSize = 13;
            hint.color = hexColor(COLORS.text.secondary);
            hint.string = '每得5分获得一个随机技能';
            this.skillLabels.push(hint);
        }
    }

    private showGameOver() {
        this.gameOverNode.active = true;
        if (this.gameOverLabel) {
            this.gameOverLabel.string = `游戏结束\n得分: ${this.state.score}  回合: ${this.state.turn}`;
        }
    }

    // ---- 工具方法 ----

    private createNode(name: string, parent: Node): Node {
        const node = new Node(name);
        parent.addChild(node);
        return node;
    }

    private createLabel(name: string, parent: Node): Label {
        const node = this.createNode(name, parent);
        if (!node.getComponent(UITransform)) {
            node.addComponent(UITransform);
        }
        const label = node.addComponent(Label);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }
}
