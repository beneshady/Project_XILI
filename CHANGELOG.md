# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Cocos Creator 项目结构**：在项目根目录集成 Cocos Creator 3.8.8，支持微信/抖音多小程序平台
- **共享逻辑层 `shared/`**：零平台依赖的纯 TypeScript 游戏逻辑，供 HTML5 和 Cocos 双端复用
  - `Types.ts`：扩展 EntityType.COIN、Team.ITEM、SkillLevels、frozenEnemies 等完整类型
  - `Utils.ts`：12 个纯工具函数 + resetIdCounter()
  - `GameConfig.ts`：棋盘常量、莫兰迪色系、生成配置、得分配置
  - `SkillSystem.ts`：5 个技能定义与计算函数，纯逻辑无 UI 依赖
  - `GameLogic.ts`：合并 demo.html 完整逻辑（技能/金币/高级生成/马脚绊/连杀/定期清理）
- **`GameController.ts`**：Cocos 渲染+输入+游戏循环组件，使用 Graphics 画棋盘/实体/高亮
- **`sync-shared.js`**：一键同步 shared/ 到 src/core/ 和 assets/scripts/core/ 的脚本
- **`tests/test-shared-logic.js`**：54 个 Node.js 逻辑测试（全部通过）
- **微信小游戏适配层**：game.js、js/game.js、project.config.json、game.json

### Changed
- **`src/core/types.ts`**：扩展为 shared/Types.ts 的完整版本（补 skills/coins/frozen/killStreak）
- **`src/core/utils.ts`**：新增 resetIdCounter() 函数
- **计分系统**：吃小兵+1分，吃马+3分，吃车+5分

### Fixed
- **Canvas 尺寸**：修复棋盘显示不全的问题（400px → 600px）
- **坐标重合**：敌人移动时检查目标格子是否为空，避免与玩家重叠
- **马的移动逻辑**：马按"日"字形移动，寻找最接近玩家的合法位置
- **拌马脚规则**：马移动时检查马腿方向是否有阻挡

### Changed
- **小兵刷新频率**：从每回合1-2个改为50%概率生成1个
- **死亡界面**：显示 "You Died" 替代 "游戏结束"

### Technical
- 创建 CLAUDE.md 项目配置文件
- 创建 tests/game_logic_test.html 单元测试文件

---

## v0.1.0 - 2025-??-?? (Initial Demo)

### Added
- 8x8 棋盘回合制肉鸽游戏
- 玩家（王）九宫格移动
- 敌人：兵（斜向威胁）、车（直线威胁）、马（日字威胁）
- 威胁范围可视化（红色高亮）
- 可移动范围可视化（绿色高亮）
- 敌人 AI 逼近逻辑
- 击杀敌人机制
- 回合递增和敌人生成