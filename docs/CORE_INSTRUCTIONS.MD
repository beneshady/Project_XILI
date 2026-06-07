# 项目核心编码指令

> 本文件是项目身份、架构规则、编码原则和验证要求的唯一真源。
> AGENTS.md（Codex）和 CLAUDE.md（Claude Code）均引用本文件。
> 不要在其他文件中重复本文件内容。
> Codex 不要修改 CLAUDE.md，Claude Code 不要修改 AGENTS.md。

## 项目概览

本项目是一个棋类 Roguelike 小游戏原型，核心玩法是在 8x8 棋盘上控制玩家棋子生存，敌人按棋类规则移动和产生威胁。

- 游戏类型：单人 HTML5 Canvas / Cocos Creator 小游戏原型
- 主要语言：TypeScript（`src/`）、JavaScript ES6+（`demo.html`）
- Cocos 版本：`package.json` 中声明为 Cocos Creator `3.8.8`
- 外部依赖：无（零依赖）
- 当前特点：已有可玩 `demo.html`、Cocos 工程、共享逻辑层和 Node 逻辑测试

## 项目结构

- `demo.html`：自包含的可玩浏览器 Demo，早期验证和展示用。
- `src/core/`：TypeScript 核心游戏逻辑，包含状态、规则、技能、配置和工具函数。
- `src/render/`：Canvas 渲染层。
- `src/game-demo.ts`：TypeScript Web Demo 整合入口。
- `assets/scripts/`：Cocos Creator 脚本，其中 `GameController.ts` 是 Cocos 适配入口。
- `assets/scripts/core/`：Cocos 侧复制出来的核心逻辑。
- `shared/`：共享逻辑副本。
- `tests/`：测试页面和 Node 逻辑测试。
- `docs/architecture/`：核心逻辑设计文档。

## 架构

### 核心架构原则

1. `src/core/` 是唯一核心逻辑源。玩法规则、状态机、计分、敌人 AI、技能系统都应优先写在这里。
2. Cocos 代码只做输入、渲染、生命周期、节点和 UI 适配。
3. 不要把复杂规则直接写死在 Cocos Component 里。

### 同步规则

- `shared/` 和 `assets/scripts/core/` 是从 `src/core/` 生成的同步副本，不要手工修改。
- 修改核心逻辑后必须运行 `node sync-shared.js`（具体命令见 `AGENTS.md`）。
- 详见 `docs/CORE_LOGIC_SYNC.md`。

### 核心逻辑函数表

| 函数 | 用途 |
|------|------|
| `createGrid(size)` | 初始化 8x8 棋盘 |
| `updatePlayerAccessiblePositions(state)` | 标记玩家周围 9 格可移动区域 |
| `updateThreatMap(state)` | 计算并标记所有敌人威胁范围 |
| `getRookThreat(entity, grid)` | 车的直线威胁（碰阻挡停） |
| `getKnightThreat(entity, grid)` | 马的 8 个日字威胁 |
| `calculateEnemyMoves(state)` | AI：每个敌人向玩家方向移动 |
| `executeEnemyTurn(state)` | 执行敌人移动、检查玩家死亡、生成新敌人 |
| `handlePlayerMove(state, targetPos)` | 验证并执行玩家移动 |

### 渲染层

`CanvasRenderer`（`demo.html`）：
- `render(state)` — 主渲染循环
- `screenToBoard(x, y)` — 点击坐标转棋盘坐标

### 游戏流程

```
玩家点击 → 验证可移动 → 移动玩家 → 计算敌人移动 →
敌人回合 → 检查死亡 → 生成敌人 → 更新威胁图 → 渲染
```

### 实体类型

- `KING`（玩家）— 9 宫格内移动
- `PAWN` — 向玩家移动 1 格，威胁对角线
- `ROOK` — 向玩家直线移动，威胁整行/列
- `KNIGHT` — 日字向玩家移动，威胁 8 个日字位

详细设计见 `docs/architecture/SDD-Core-Logic.md`。

## 编码原则

### 1. 编码前思考

**不要假设。不要隐藏困惑。呈现权衡。**

- **明确说明假设** — 如果不确定，询问而不是猜测
- **呈现多种解释** — 当存在歧义时，不要默默选择
- **适时提出异议** — 如果存在更简单的方法，说出来
- **困惑时停下来** — 指出不清楚的地方并要求澄清

### 2. 简洁优先

**用最少的代码解决问题。不要过度推测。**

- 不要添加要求之外的功能
- 不要为一次性代码创建抽象
- 不要添加未要求的"灵活性"或"可配置性"
- 不要为不可能发生的场景做错误处理
- 如果 200 行代码可以写成 50 行，重写它

**检验标准：** 资深工程师会觉得这过于复杂吗？如果是，简化。

### 3. 精准修改

**只碰必须碰的。只清理自己造成的混乱。**

编辑现有代码时：

- 不要"改进"相邻的代码、注释或格式
- 不要重构没坏的东西
- 匹配现有风格，即使你更倾向于不同的写法
- 如果注意到无关的死代码，提一下 —— 不要删除它

当你的改动产生孤儿代码时：

- 删除因你的改动而变得无用的导入/变量/函数
- 不要删除预先存在的死代码，除非被要求

**检验标准：** 每一行修改都应该能直接追溯到用户的请求。

### 4. 目标驱动执行

**定义成功标准。循环验证直到达成。**

| 不要这样做... | 转化为... |
|--------------|-----------|
| "添加验证" | "为无效输入编写测试，然后让它们通过" |
| "修复 bug" | "编写重现 bug 的测试，然后让它通过" |
| "重构 X" | "确保重构前后测试都能通过" |

对于多步骤任务，说明一个简短的计划：

```
1. [步骤] → 验证: [检查]
2. [步骤] → 验证: [检查]
3. [步骤] → 验证: [检查]
```

强有力的成功标准让 LLM 能够独立循环执行。弱标准（"让它工作"）需要不断澄清。

## 验证要求

- 涉及核心逻辑的改动后，必须运行同步和逻辑测试（具体命令见 `AGENTS.md` 或 `CLAUDE.md`）。
- 涉及 UI、Canvas、Cocos 或可玩流程时，应补充浏览器预览、截图或 Playwright 测试。
- 若本机缺少验证环境，要在回复里明确说明未验证的部分和原因。
- 测试先行：较大功能先拆验收标准为测试，再实现。
- 开发流程（US 规范、Commit 规范、飞书追踪）见 `docs/DEV_FLOW_FEISHU.md`。
