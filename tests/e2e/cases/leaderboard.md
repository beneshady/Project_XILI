# 排行榜系统 E2E 用例

依赖测试钩子 `window.ProjectXiliDemo.__test`：
- `forceGameOver({score, turn, elapsedSec, isVictory, message})` 强制进入 GAME_OVER + 弹结算面板
- `clearStorage()` 清空 `xili_leaderboard_v1` 和 `xili_last_player_name`

## 1.1 排行榜按钮入口（顶部 #leaderboard-button）

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| LB-01 | ✅ | P0 | 游戏中点「排行榜」按钮 → overlay 出现 | `#leaderboard-overlay` visible，`<h2>` 含「排行榜」 |
| LB-02 | ✅ | P0 | overlay 打开时按钮显示「关闭」（非「再来一局」） | `[data-action="close"]` 存在，`[data-action="restart"]` 不存在 |
| LB-03 | ✅ | P0 | 点「关闭」→ overlay 隐藏，游戏未重启 | overlay hidden，`getState().turn` 不变 |
| LB-04 | ✅ | P1 | 游戏结束状态下点「排行榜」按钮也能打开 | `forceGameOver` 后点击 → overlay 可见 |

## 1.2 结算面板（GAME_OVER 自动弹出）

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| LB-05 | ✅ | P0 | GAME_OVER 自动弹出结算面板 | `forceGameOver` 后 `#player-name` input 可见 |
| LB-06 | ✅ | P0 | 结算面板显示得分/回合/时间 | `.stats .v` 三项匹配传入值 |
| LB-07 | ✅ | P1 | 名字输入框默认填 localStorage 上次名字 | 预填 `xili_last_player_name` 后 input.value === 该值 |
| LB-08 | ✅ | P1 | 名字输入框首次为空，placeholder 显示「匿名」 | input.value === ''，placeholder === '匿名' |
| LB-09 | ✅ | P1 | 按 Enter 键 = 点「保存成绩」 | input keydown Enter → 进入排行榜面板 |
| LB-10 | ✅ | P2 | maxlength 限制 12 字符 | input 的 `maxlength` === 12 |

## 1.3 保存与上榜

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| LB-11 | ✅ | P0 | 点「保存成绩」→ 排行榜面板，本局行高亮 | `tr.current` 含输入的名字 |
| LB-12 | ✅ | P0 | 排行榜面板显示「本局排名：第 N 名」 | `.rank-line` 含「第 1 名」（清空 storage 后保存） |
| LB-13 | ✅ | P0 | 保存后 localStorage 写入正确 JSON | 解析 `xili_leaderboard_v1` 含 7 个字段 |
| LB-14 | ✅ | P1 | 名字 trim：「  神  」→ 保存后存为「神」 | 写入的 `name === '神'` |
| LB-15 | ✅ | P1 | 空名字 → 保存为「匿名」 | 写入的 `name === '匿名'` |
| LB-16 | ✅ | P0 | 点「不保存」→ 进入排行榜面板，不写 storage | `xili_leaderboard_v1` 仍为空（或保留旧值） |
| LB-17 | ✅ | P1 | 不保存 + 满榜 → 显示「未上榜」 | `.rank-line` 含「未上榜」 |
| LB-18 | ✅ | P0 | 满榜 + 高分保存 → 上榜 + 最末位被剔除 | 解析后长度 = 10，最低分换成本局 |

## 1.4 排行榜面板（查看 / 排序 / 高亮）

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| LB-19 | ✅ | P0 | 空榜单显示「尚无记录」 | `.leaderboard-empty` 文本 |
| LB-20 | ✅ | P0 | Top 10 截断：12 条 → 只显示 10 条 | `tbody tr` 数量 === 10 |
| LB-21 | ✅ | P0 | 排序：score DESC | 第一行分数 > 最后一行分数 |
| LB-22 | ✅ | P0 | 排序：相同 score → time ASC | 同分时第一行 elapsedSec < 第二行 |
| LB-23 | ✅ | P1 | 胜利记录显示 🏆 标记 | `isVictory: true` 的行含 🏆 |
| LB-24 | ✅ | P0 | 时间格式 mm:ss（< 1 小时） | `td.time` 文本匹配 `/^\d{2}:\d{2}$/` |
| LB-25 | ✅ | P2 | 时间格式 hh:mm:ss（≥ 1 小时） | `elapsedSec: 3725` → 显示 `01:02:05` |

## 1.5 清空榜单

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| LB-26+27 | ✅ | P0 | 点「清空榜单」弹 confirm，确认后清空 + storage 清空 | `dialog.accept()` 后 `.leaderboard-empty` 出现，storage === `[]` |
| LB-28 | ✅ | P1 | 取消清空 → 列表保持原样 | `dialog.dismiss()` 后行数不变 |

## 1.6 流程切换

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| LB-29 | ✅ | P0 | 排行榜 overlay 打开时，棋盘点击被屏蔽 | overlay 打开 → click canvas → `getState().turn` 不变 |
| LB-30 | ✅ | P0 | 结算后点「再来一局」→ overlay 关 + 游戏重启 | 排行榜面板「再来一局」点击后 overlay hidden，`turn === 1`，`startedAt` 更新 |
| LB-31 | ✅ | P0 | 重启后 startedAt / finishedAt 重置 | 新对局 `finishedAt === undefined` |
