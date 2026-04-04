# 肉鸽象棋 (Chess Roguelike)

一款融合《Shotgun King》回合制逻辑与中国象棋规则的肉鸽生存游戏。

## 游戏说明

### 核心玩法
- 你控制王（蓝色方块），在 8x8 棋盘上移动
- 每回合你可以向周围 8 个方向（包括斜向）移动一格
- 躲避敌人的威胁范围（红色）
- 踩到敌人可以击杀并获得分数
- 敌人每回合向你逼近，被击中则游戏结束

### 实体说明
- **♔ 王（玩家）**：可向九宫格内任意方向移动
- **♟ 兵**：每次向你移动一格（经验包）
- **♜ 车**：按象棋规则，十字方向无限距离威胁
- **** 马**：按象棋规则，日字跳跃威胁

### 敌人生成规则
- **第 1 回合**：无初始敌人
- **每回合生成**：1-2 个兵
- **第 5 回合起**：50% 概率生成马
- **第 10 回合起**：50% 概率生成车

## 快速开始

直接在浏览器中打开 `demo.html` 即可开始游戏！

```
demo.html           # 可玩 Demo（推荐）
tests/harness.html  # 约逻辑测试页面
```

## 项目结构

```
Chess_rogue/
├── docs/
│   └── architecture/
│       └── SDD-Core-Logic.md     # 核心逻辑架构文档
├── src/
│   ├── core/
│   │   ├── types.ts               # 类型定义
│   │   ├── utils.ts               # 工具函数
│   │   ├── game.ts                # 游戏核心逻辑
│   │   └── game.test.ts          # 测试工具
│   ├── render/
│   │   ├── colors.ts              # 莫兰迪色系定义
│   │   └── canvas-renderer.ts     # Canvas 渲染引擎
│   └── game-demo.ts               # 完整游戏整合
├── tests/
│   └── harness.html               # 约逻辑测试页面
├── demo.html                     # 可玩 Demo
└── GAME_README.md                # 本文件
```

## 技术栈

- **渲染**：HTML5 Canvas
- **语言**：纯 JavaScript (ES6+)
- **无依赖**：无需任何构建工具或第三方库

## 开发阶段

### Phase 1: Harness 纯逻辑测试 ✅
- 完整的数据模型实现
- 威胁范围计算逻辑
- AI 决策系统
- 回合状态机
- Console 测试工具

### Phase 2: Canvas 渲染引擎 ✅
- 莫兰迪色系定义
- 几何绘制函数（圆角矩形、圆形）
- 棋盘渲染
- 实体渲染
- 威胁范围和可移动范围高亮

### Phase 3: Demo 整合 ✅
- 鼠标输入处理
- 游戏循环
- 完整游戏流程
- UI 信息显示

## 架构设计

详见 [SDD-Core-Logic.md](docs/architecture/SDD-Core-Logic.md)

核心模块：
- **Grid & Entities**：棋盘和实体数据模型
- **GameState**：游戏状态管理
- **Threat Map**：威胁范围计算
- **AI System**：敌人行为决策
- **Canvas Renderer**：莫兰迪风格渲染

## 视觉风格

参考微信小游戏《跳一跳》：
- 极简低对比度
- 莫兰迪色系
- 柔和阴影
- 扁平化几何体

## 许可证

MIT License

---

**享受游戏！🎮**
