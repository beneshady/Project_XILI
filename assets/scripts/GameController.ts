import { _decorator, Component, Node, Graphics, Label, Color, UITransform, Vec3, EventTouch, Size } from 'cc';
import { GameState, GamePhase, EntityType, Team, Position, Entity } from './core/Types';
import { posKey } from './core/Utils';
import { createInitialState, handlePlayerMove, executeEnemyTurn, isGameOver } from './core/GameLogic';
import { COLORS, ENTITY_SYMBOLS, BOARD_WIDTH, BOARD_HEIGHT } from './core/GameConfig';
import { SKILL_DEFS, getAuraRange } from './core/SkillSystem';

const { ccclass } = _decorator;

function hexColor(hex: string): Color {
    const c = new Color();
    c.fromHEX(hex);
    return c;
}

function parseRgba(rgba: string): Color {
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
    if (m) return new Color(+m[1], +m[2], +m[3], m[4] ? Math.round(+m[4] * 255) : 255);
    return Color.WHITE;
}

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
    private boardNode: Node = null!;
    private boardGfx: Graphics = null!;
    private entityGfx: Graphics = null!;
    private pieceLabelsNode: Node = null!;
    private uiNode: Node = null!;
    private scoreLabel: Label = null!;
    private turnLabel: Label = null!;
    private phaseLabel: Label = null!;
    private gameOverNode: Node = null!;
    private gameOverLabel: Label = null!;
    private skillHudNode: Node = null!;
    private skillLabels: Label[] = [];
    private state: GameState = null!;
    private cellSize = 0;
    private boardOriginX = 0;
    private boardOriginY = 0;
    private boardWidth = 0;
    private boardHeight = 0;
    private readonly PADDING = 20;
    private readonly DESIGN_WIDTH = 720;

    onLoad() {
        console.log('[GameController] onLoad start');
        try {
        this.state = createInitialState();
        const canvasTransform = this.node.getComponent(UITransform)!;
        const canvasWidth = canvasTransform.contentSize.width || this.DESIGN_WIDTH;
        this.cellSize = (canvasWidth - this.PADDING * 2) / BOARD_WIDTH;
        this.boardWidth = this.cellSize * (BOARD_WIDTH - 1);
        this.boardHeight = this.cellSize * (BOARD_HEIGHT - 1);
        this.boardOriginX = -this.boardWidth / 2;
        this.boardOriginY = -this.boardHeight / 2;

        this.boardNode = this.createNode('Board', this.node);
        this.boardNode.addComponent(UITransform).setContentSize(new Size(this.boardWidth + this.cellSize, this.boardHeight + this.cellSize));
        this.boardGfx = this.boardNode.addComponent(Graphics);

        const entityNode = this.createNode('Entities', this.boardNode);
        entityNode.addComponent(UITransform).setContentSize(new Size(this.boardWidth + this.cellSize, this.boardHeight + this.cellSize));
        this.entityGfx = entityNode.addComponent(Graphics);
        this.pieceLabelsNode = this.createNode('PieceLabels', this.boardNode);
        this.pieceLabelsNode.addComponent(UITransform).setContentSize(new Size(this.boardWidth + this.cellSize, this.boardHeight + this.cellSize));

        this.uiNode = this.createNode('UI', this.node);
        this.uiNode.addComponent(UITransform).setContentSize(new Size(canvasWidth, 200));
        this.uiNode.setPosition(0, this.boardHeight / 2 + 70, 0);

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

        this.skillHudNode = this.createNode('SkillHud', this.node);
        this.skillHudNode.addComponent(UITransform).setContentSize(new Size(canvasWidth, 40));
        this.skillHudNode.setPosition(0, -this.boardHeight / 2 - 50, 0);

        this.gameOverNode = this.createNode('GameOver', this.node);
        this.gameOverNode.addComponent(UITransform).setContentSize(new Size(canvasWidth, canvasWidth + 300));
        this.gameOverNode.active = false;
        const dimmer = this.createNode('Dimmer', this.gameOverNode);
        dimmer.addComponent(UITransform).setContentSize(new Size(canvasWidth, canvasWidth + 300));
        const dimGfx = dimmer.addComponent(Graphics);
        dimGfx.fillColor = new Color(0, 0, 0, 180);
        dimGfx.rect(-canvasWidth / 2, -(canvasWidth + 300) / 2, canvasWidth, canvasWidth + 300);
        dimGfx.fill();
        this.gameOverLabel = this.createLabel('GameOverText', this.gameOverNode);
        this.gameOverLabel.fontSize = 36;
        this.gameOverLabel.color = hexColor(COLORS.text.accent);
        this.gameOverLabel.node.setPosition(0, 40, 0);

        this.boardNode.on(Node.EventType.TOUCH_END, this.onBoardTouch, this);
        this.node.on(Node.EventType.TOUCH_END, this.onGlobalTouch, this);
        this.render();
        console.log('[GameController] onLoad complete, board rendered');
        } catch (e) {
            console.error('[GameController] onLoad FAILED:', e);
        }
    }

    private onBoardTouch(event: EventTouch) {
        if (!this.state || this.state.animating || isGameOver(this.state)) return;
        const uiPos = event.getUILocation();
        const worldPos = new Vec3(uiPos.x, uiPos.y, 0);
        const localPos = this.boardNode.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);
        const relX = localPos.x - this.boardOriginX;
        const relY = localPos.y - this.boardOriginY;
        const gridX = Math.round(relX / this.cellSize);
        const gridY = Math.round((this.boardHeight - relY) / this.cellSize);
        if (gridX < 0 || gridX >= BOARD_WIDTH || gridY < 0 || gridY >= BOARD_HEIGHT) return;
        this.onPlayerTap({ x: gridX, y: gridY });
    }

    private onGlobalTouch() {
        if (isGameOver(this.state)) this.restart();
    }

    private onPlayerTap(gridPos: Position) {
        if (this.state.phase !== GamePhase.PLAYER_TURN) return;
        const result = handlePlayerMove(this.state, gridPos);
        if (!result.moved) return;
        this.render();
        this.scheduleOnce(() => {
            if (this.state.phase === GamePhase.ENEMY_TURN) {
                executeEnemyTurn(this.state);
                this.render();
                if (isGameOver(this.state)) this.showGameOver();
            }
        }, 0.2);
    }

    private restart() {
        this.state = createInitialState();
        this.gameOverNode.active = false;
        this.render();
    }

    private render() {
        this.boardGfx.clear();
        this.entityGfx.clear();
        this.pieceLabelsNode.removeAllChildren();
        this.drawBoard();
        this.drawHighlights();
        this.drawEntities();
        this.updateUI();
    }

    private drawBoard() {
        const gfx = this.boardGfx;
        gfx.fillColor = hexColor(COLORS.board.background);
        gfx.rect(this.boardOriginX - this.cellSize * 0.45, this.boardOriginY - this.cellSize * 0.45, this.boardWidth + this.cellSize * 0.9, this.boardHeight + this.cellSize * 0.9);
        gfx.fill();

        gfx.strokeColor = hexColor(COLORS.board.grid);
        gfx.lineWidth = 2;
        const riverTop = this.boardOriginY + 4 * this.cellSize;
        const riverBottom = this.boardOriginY + 5 * this.cellSize;
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            const py = this.boardOriginY + y * this.cellSize;
            gfx.moveTo(this.boardOriginX, py);
            gfx.lineTo(this.boardOriginX + this.boardWidth, py);
        }
        for (let x = 0; x < BOARD_WIDTH; x++) {
            const px = this.boardOriginX + x * this.cellSize;
            gfx.moveTo(px, this.boardOriginY);
            gfx.lineTo(px, riverTop);
            gfx.moveTo(px, riverBottom);
            gfx.lineTo(px, this.boardOriginY + this.boardHeight);
        }
        gfx.stroke();

        gfx.strokeColor = hexColor(COLORS.board.palace);
        gfx.lineWidth = 1.5;
        for (const topRow of [0, 7]) {
            const x3 = this.boardOriginX + 3 * this.cellSize;
            const x5 = this.boardOriginX + 5 * this.cellSize;
            const y0 = this.boardOriginY + topRow * this.cellSize;
            const y2 = this.boardOriginY + (topRow + 2) * this.cellSize;
            gfx.moveTo(x3, y0);
            gfx.lineTo(x5, y2);
            gfx.moveTo(x5, y0);
            gfx.lineTo(x3, y2);
        }
        gfx.stroke();
    }

    private drawHighlights() {
        const gfx = this.boardGfx;
        const auraRange = (this.state.skills && this.state.skills.aura > 0) ? getAuraRange(this.state.skills.aura) : 0;
        for (let gy = 0; gy < BOARD_HEIGHT; gy++) {
            for (let gx = 0; gx < BOARD_WIDTH; gx++) {
                const cell = this.state.grid.cells.get(posKey({ x: gx, y: gy }));
                if (!cell) continue;
                const px = this.boardOriginX + gx * this.cellSize;
                const py = this.boardOriginY + (BOARD_HEIGHT - 1 - gy) * this.cellSize;
                if (cell.isThreatened) {
                    gfx.fillColor = getHighlightColor('threatened');
                    gfx.circle(px, py, this.cellSize * 0.34);
                    gfx.fill();
                }
                if (cell.isPlayerAccessible) {
                    gfx.fillColor = getHighlightColor('accessible');
                    gfx.circle(px, py, this.cellSize * 0.3);
                    gfx.fill();
                    if (!cell.entity || cell.entity === this.state.player) {
                        gfx.fillColor = hexColor(COLORS.highlight.accessibleDot);
                        gfx.circle(px, py, this.cellSize * 0.1);
                        gfx.fill();
                    }
                }
                if (auraRange > 0 && this.state.player) {
                    const dist = Math.max(Math.abs(gx - this.state.player.position.x), Math.abs(gy - this.state.player.position.y));
                    if (dist <= auraRange && dist > 0) {
                        gfx.fillColor = getHighlightColor('aura');
                        gfx.circle(px, py, this.cellSize * 0.28);
                        gfx.fill();
                    }
                }
            }
        }
    }

    private drawEntities() {
        for (const [, entity] of this.state.entities) {
            if (entity.isDead) continue;
            const cx = this.boardOriginX + entity.position.x * this.cellSize;
            const cy = this.boardOriginY + (BOARD_HEIGHT - 1 - entity.position.y) * this.cellSize;
            this.drawPiece(cx, cy, this.cellSize * 0.38, entity);
            if (this.state.frozenEnemies.has(entity.id)) {
                this.entityGfx.fillColor = new Color(100, 150, 255, 60);
                this.entityGfx.circle(cx, cy, this.cellSize * 0.43);
                this.entityGfx.fill();
            }
        }
    }

    private drawPiece(cx: number, cy: number, radius: number, entity: Entity) {
        const gfx = this.entityGfx;
        const style = entity.team === Team.PLAYER ? COLORS.entity.player : ((COLORS.entity as any)[entity.type] || COLORS.entity.soldier);
        gfx.fillColor = parseRgba(style.shadow);
        gfx.circle(cx + 3, cy - 3, radius);
        gfx.fill();
        gfx.fillColor = hexColor(style.fill);
        gfx.strokeColor = hexColor(style.stroke);
        gfx.lineWidth = 3;
        gfx.circle(cx, cy, radius);
        gfx.fill();
        gfx.stroke();
        gfx.lineWidth = 1.5;
        gfx.circle(cx, cy, radius * 0.78);
        gfx.stroke();

        const label = this.createLabel(`Piece_${entity.id}`, this.pieceLabelsNode);
        label.fontSize = Math.floor(radius * 0.9);
        label.color = hexColor(style.text || COLORS.text.enemySymbol);
        label.string = this.symbolFor(entity);
        label.node.setPosition(cx, cy, 0);
    }

    private symbolFor(entity: Entity): string {
        if (entity.team === Team.PLAYER) return ENTITY_SYMBOLS.PLAYER;
        const key = entity.type.toUpperCase() as keyof typeof ENTITY_SYMBOLS;
        return ENTITY_SYMBOLS[key] || '?';
    }

    private updateUI() {
        this.scoreLabel.string = `分数: ${this.state.score}${this.state.killStreak >= 2 ? ` (x${this.state.killStreak})` : ''}`;
        this.turnLabel.string = `回合: ${this.state.turn}`;
        const phaseNames: Record<string, string> = {
            [GamePhase.PLAYER_TURN]: '你的回合',
            [GamePhase.ENEMY_TURN]: '敌人行动中...',
            [GamePhase.GAME_OVER]: '游戏结束',
        };
        this.phaseLabel.string = phaseNames[this.state.phase] || this.state.phase;
        this.updateSkillHud();
    }

    private updateSkillHud() {
        for (const label of this.skillLabels) {
            if (label && label.node) label.node.destroy();
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
            label.node.setPosition(xOffset, 0, 0);
            xOffset += 120;
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
        this.gameOverLabel.string = `游戏结束\n得分: ${this.state.score}  回合: ${this.state.turn}`;
    }

    private createNode(name: string, parent: Node): Node {
        const node = new Node(name);
        parent.addChild(node);
        return node;
    }

    private createLabel(name: string, parent: Node): Label {
        const node = this.createNode(name, parent);
        if (!node.getComponent(UITransform)) node.addComponent(UITransform);
        const label = node.addComponent(Label);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }
}
