# AGENTS.md

本文件用于指导 Codex 在本仓库内工作。
通用项目指令见 `docs/CORE_INSTRUCTIONS.MD`，本文件仅包含 Codex 特定规则。

**不要修改 `CLAUDE.md`，那是 Claude Code 的专属文件。**

## Cocos Creator 特定规则

1. 不要直接编辑 `.meta` 文件，除非任务明确要求处理 Cocos 资源元数据，并且已经检查引用关系。
2. 不要随意重命名 Cocos 序列化字段、资源路径、场景节点名和预制体引用。
3. 涉及 Cocos 编辑器操作时，不要凭空猜按钮位置。优先查现有项目文件、官方文档或让用户在编辑器里确认。

## 测试命令

当前可运行的基础测试：

```powershell
node sync-shared.js
node tests\test-shared-logic.js
```

在完成涉及核心逻辑的改动后，至少运行上面的同步和测试。如果未来补齐 `package.json` 脚本，应优先运行：

```powershell
pnpm test
pnpm test:e2e
```

涉及 UI、Canvas、Cocos 或可玩流程时，应补充浏览器预览、截图或 Playwright 测试。若本机没有 Cocos Creator、pnpm 或 Playwright，要在最终回复里明确说明未验证的部分和原因。

## Windows 工作规则

- 默认使用 PowerShell 命令。
- 路径含空格时必须加引号。
- 文件操作涉及用户提供路径时优先使用 `-LiteralPath`。
- 不要使用 `rm -rf`、`export VAR=value` 等 POSIX 专属写法。
- 优先通过项目脚本执行命令，不要把 Cocos Creator 的绝对路径散落在多个文档和脚本里。
- 保持 UTF-8 编码。当前部分中文文件存在乱码，除非任务明确要求修复编码，否则不要大面积重写源码注释。

## Codex 协作规则

- 不要回滚用户或其他 agent 的改动。
- 遇到不相关的脏文件，忽略它们。
- 修改前先读相关文件，尤其是核心逻辑、测试和 Cocos 适配层。
- 变更要小而可验证，优先保留现有风格。
- 对较大功能，先把验收标准拆成测试，再实现。
- 输出结果时说明改了什么、跑了什么测试、报告或截图在哪里，以及还有什么风险。

## 推荐自动化方向

本项目后续应逐步收敛到三层自动化：

1. 纯逻辑测试：覆盖 `src/core/` 的规则、状态机、技能、敌人 AI。
2. Web 测试壳：用浏览器跑可交互版本，并用 Playwright 点击、截图、录 trace。
3. Cocos Web 冒烟测试：通过 Cocos CLI 构建 Web 产物，再用 Playwright 验证页面能加载和推进一回合。

## 禁止事项

- 不要为了整理而删除 `.meta`、`settings/`、`profiles/`、`project.config.json` 等 Cocos 工程文件。
- 不要在没有测试的情况下大改 `GameLogic`、`SkillSystem` 或同步脚本。
- 不要把远程微信/飞书消息设计成可以直接执行任意 shell 命令。
- 不要把浏览器 Web 环境假设直接带入微信小游戏运行时，平台 API 必须做适配或能力检查。
- 不要修改 `CLAUDE.md`，那是 Claude Code 的专属文件。

## 文档渐进式披露

每次工作按以下顺序读取文档，不要一次全部加载：

1. **必读**：`docs/CORE_INSTRUCTIONS.MD`（项目概览、架构、编码原则）
2. **按场景**：
   - 接到 US 开发任务 → `docs/DEV_FLOW_FEISHU.md` → `docs/us/US-XXX_*.md`
   - 修改核心逻辑 → `docs/CORE_LOGIC_SYNC.md` → `docs/architecture/SDD-Core-Logic.md`
   - 改渲染/UI → `docs/architecture/SDD-Core-Logic.md`
   - 需要更新飞书追踪表 → `docs/DEV_FLOW_FEISHU.md`
3. **按需深入**：根据具体任务读取更多细节
