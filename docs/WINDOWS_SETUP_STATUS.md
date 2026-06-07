# Windows 基础安装状态

本文件记录当前电脑上已经检查到的开发环境，以及下一步需要补齐的内容。

## 当前已检测到

- Git：已安装，命令可用。
- VS Code：已安装，`code` 命令可用。
- Codex：已安装，版本检测到 `0.128.0`。
- Node：当前可用的是 Codex 自带 Node，路径位于 `AppData\Local\OpenAI\Codex\bin`。

## 当前未检测到

- `pnpm`
- `npm`
- `corepack`
- `winget`
- Cocos Creator 常见安装路径下的 `CocosCreator.exe`

## 建议补齐顺序

1. 安装 Node.js LTS 官方版。
2. 安装 pnpm。
3. 安装 Cocos Creator 3.8.x，优先和项目 `package.json` 中的 `3.8.8` 保持一致。
4. 安装 Playwright 依赖，等项目补齐 `package.json` 脚本后再执行。
5. 记录 Cocos Creator 的实际安装路径，后续写入构建脚本。

## 推荐命令

如果这台电脑恢复了 `winget`，可使用：

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.VisualStudioCode -e
```

Node 安装完成后：

```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

如果没有 `winget`，建议从官网安装 Node.js LTS，然后重新打开 PowerShell：

```powershell
node -v
npm -v
corepack -v
```

## 当前项目可用验证命令

即使还没有 pnpm，本项目当前仍可用 Codex 自带 Node 跑基础逻辑测试：

```powershell
node tests\test-shared-logic.js
```

本次检查结果：该测试已通过，结果为 `53 passed, 0 failed`。
