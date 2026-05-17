# 核心逻辑同步规则

本项目从现在开始以 `src/core/` 作为唯一核心逻辑源。

## 为什么这么做

项目需要同时支持：

- Web 版本：用于快速预览和 Playwright 自动化测试。
- Cocos 版本：用于 Cocos Creator、微信小游戏和后续发布。

两者必须共享同一套玩法规则。否则 Playwright 测试通过，也可能只是 Web 版通过，Cocos 版实际逻辑已经漂移。

## 唯一真源

只在这里修改玩法规则：

```text
src/core/
```

包括：

- `GameLogic.ts`
- `SkillSystem.ts`
- `GameConfig.ts`
- `Types.ts` 或 `types.ts`
- `Utils.ts` 或 `utils.ts`

## 生成副本

以下目录视为同步副本：

```text
shared/
assets/scripts/core/
```

`assets/scripts/core/` 是给 Cocos Creator 当前工程结构使用的副本。  
`shared/` 暂时保留，用于兼容已有测试和历史脚本。

## 同步命令

修改 `src/core/` 后运行：

```powershell
node sync-shared.js
```

这个脚本会执行：

```text
src/core/ -> shared/
src/core/ -> assets/scripts/core/
```

## Codex 规则

- Codex 默认只能改 `src/core/` 中的核心玩法。
- 不要手改 `shared/` 或 `assets/scripts/core/`，除非任务明确是修同步机制。
- 如果改了核心逻辑，必须运行 `node sync-shared.js`。
- 同步后至少运行 `node tests\test-shared-logic.js`。

## 后续建议

中期可以把 `shared/` 删除，或改造成真正的包，例如：

```text
packages/game-core/
apps/web-sim/
apps/cocos/
```

但在当前阶段，保留现有目录并固定同步方向，风险最低。
