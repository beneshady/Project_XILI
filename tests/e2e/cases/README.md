# E2E 测试用例清单

本目录维护 Playwright E2E 自动化测试的完整用例清单。每个 `.md` 文件对应一个功能模块的用例集，新增用例只在这里写，不要散落到 `.spec.js`。

## 状态约定

| 状态 | 含义 |
|---|---|
| ⬜ Backlog | 计划中，未实现 |
| 🟡 WIP | 正在写 |
| ✅ Passing | 已实现并通过 |
| ❌ Failing | 已实现但失败（带 issue 链接） |
| ⏸️ Skipped | 暂时禁用（带原因） |

## 优先级约定

| 标记 | 含义 | CI 行为 |
|---|---|---|
| **P0** | 核心路径，必须通过 | 每次 push / PR 都跑 |
| **P1** | 重要分支，应通过 | 每次 push / PR 都跑 |
| **P2** | 锦上添花、视觉回归、慢通道 | 仅 nightly / 发版前 |

## 模块索引

| 模块 | 文件 | 用例数 | 状态 |
|---|---|---|---|
| 排行榜系统 | [leaderboard.md](leaderboard.md) | 30 | ✅ 30/30 通过 |
| HUD 与生存计时 | [hud-timer.md](hud-timer.md) | 5 | ✅ 5/5 通过 |
| 技能系统 | [skill-system.md](skill-system.md) | 5 | ✅ 5/5 通过 |
| 视觉回归 | [visual-regression.md](visual-regression.md) | 4 | ⬜ 暂未实现（需 ffmpeg/PRNG 重构） |
| 边界与容错 | [edge-cases.md](edge-cases.md) | 4 | ✅ 4/4 通过 |
| **合计** | | **48** | **44/48 通过，4 暂未实现** |

## 实现路径

实现的 `.spec.js` 在 [tests/e2e/](../) 下。模块 → spec 文件映射：

| 用例文件 | spec 文件 |
|---|---|
| `cases/leaderboard.md` | `leaderboard.spec.js`（首批 10 条 P0）+ `leaderboard-extended.spec.js`（剩余 20 条） |
| `cases/hud-timer.md` | `hud-timer.spec.js` |
| `cases/skill-system.md` | `skill-system.spec.js` |
| `cases/edge-cases.md` | `edge-cases.spec.js` |
| `cases/visual-regression.md` | （未实现） |

每条用例在 spec 中以 `test('LB-01: 描述...')` 命名，便于反查。

## 跑测试

```bash
npm run build:web                              # 重建 demo bundle（含 __test 钩子）
npx playwright test                            # 跑全部
npx playwright test leaderboard.spec.js        # 跑单文件
npx playwright test -g "LB-01"                 # 按用例 ID grep
npx playwright show-report                     # 失败后看报告
```

## 上次全量结果

```
Running 44 tests using 4 workers
44 passed (23.0s)
```
