# 边界与容错 E2E 用例

| ID | 状态 | P | 用例 | 关键断言 |
|---|---|---|---|---|
| EDGE-01 | ✅ | P0 | localStorage 损坏 JSON → 当作空榜，不崩 | 写入 `'not json'` → 打开 overlay 显示「尚无记录」 |
| EDGE-02 | ✅ | P1 | localStorage schema 错误（缺字段）→ 跳过该条 | 灌入 `[{name:'x'}]` → 列表为空，不报错 |
| EDGE-03 | ✅ | P1 | 隐私模式（localStorage 抛错）→ 保存按钮点了不崩 | stub `setItem` 抛错 → `forceGameOver` + save → 仍进入排行榜面板 |
| EDGE-04 | ✅ | P1 | 0 分死亡 → 仍能保存上榜 | `forceGameOver({score: 0})` → save → 入榜 |
