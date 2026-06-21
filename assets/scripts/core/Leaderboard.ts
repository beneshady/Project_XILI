// ============================================================================
// 本地排行榜（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------
// 纯函数 + Storage 适配器接口；浏览器 / Cocos / Node 各自注入实现。
// 详细设计：design/Leaderboard_Design.md
// ============================================================================

export interface LeaderboardEntry {
  name:       string;     // 玩家输入，已 trim、最长 12 字符；空则视为「匿名」
  score:      number;     // GameState.score 终值
  turn:       number;     // GameState.turn 终值（参考信息，不参与排序）
  elapsedSec: number;     // wall-clock 秒（整数，>=0）
  isVictory:  boolean;    // GameState.isVictory ?? false
  timestamp:  number;     // Date.now()，毫秒
}

/** Storage 抽象：核心层不直接依赖 localStorage / 文件系统 */
export interface LeaderboardStorage {
  read(): string | null;
  write(value: string): void;
}

export const MAX_ENTRIES = 10;
export const MAX_NAME_LENGTH = 12;
export const ANONYMOUS_NAME = '匿名';

/**
 * 排序比较器：score DESC → elapsedSec ASC → timestamp ASC
 * （a 排在 b 之前时返回负数）
 */
export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.elapsedSec !== b.elapsedSec) return a.elapsedSec - b.elapsedSec;
  return a.timestamp - b.timestamp;
}

/** 名字规范化：trim、截断、空串替换为匿名 */
export function normalizeName(raw: string): string {
  const trimmed = (raw || '').trim();
  if (trimmed.length === 0) return ANONYMOUS_NAME;
  if (trimmed.length > MAX_NAME_LENGTH) return trimmed.slice(0, MAX_NAME_LENGTH);
  return trimmed;
}

/** 安全反序列化；任何异常或 schema 不对都当作空榜 */
function parseEntries(raw: string | null): LeaderboardEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const entries: LeaderboardEntry[] = [];
    for (const item of data) {
      if (
        item &&
        typeof item.name === 'string' &&
        typeof item.score === 'number' &&
        typeof item.turn === 'number' &&
        typeof item.elapsedSec === 'number' &&
        typeof item.isVictory === 'boolean' &&
        typeof item.timestamp === 'number'
      ) {
        entries.push(item);
      }
    }
    entries.sort(compareEntries);
    return entries.slice(0, MAX_ENTRIES);
  } catch (_e) {
    return [];
  }
}

/** 读取榜单（已排序、已截断） */
export function loadLeaderboard(storage: LeaderboardStorage): LeaderboardEntry[] {
  return parseEntries(storage.read());
}

/**
 * 插入新成绩，写回 storage，返回排序后的新榜单（截断到 MAX_ENTRIES）。
 * 若 storage.write 抛错（如隐私模式），仍返回内存中的新榜，但不持久化。
 */
export function insertEntry(
  storage: LeaderboardStorage,
  entry: LeaderboardEntry,
): LeaderboardEntry[] {
  const next = parseEntries(storage.read());
  next.push(entry);
  next.sort(compareEntries);
  const truncated = next.slice(0, MAX_ENTRIES);
  try {
    storage.write(JSON.stringify(truncated));
  } catch (_e) {
    // 静默失败：调用方通过 getRank 检查实际是否上榜即可
  }
  return truncated;
}

/** 清空榜单 */
export function clearLeaderboard(storage: LeaderboardStorage): void {
  try {
    storage.write(JSON.stringify([]));
  } catch (_e) {
    // ignore
  }
}

/**
 * 计算 entry 在 entries 中的排名（1-based），未上榜返回 null。
 * entries 必须已按 compareEntries 排序。
 * 通过 timestamp 唯一识别同一条记录。
 */
export function getRank(
  entries: LeaderboardEntry[],
  entry: LeaderboardEntry,
): number | null {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].timestamp === entry.timestamp && entries[i].name === entry.name) {
      return i + 1;
    }
  }
  return null;
}

/** 把秒数格式化为 mm:ss 或 hh:mm:ss */
export function formatElapsed(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
