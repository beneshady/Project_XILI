// ============================================================================
// 工具函数
// ----------------------------------------------------------------------------

import { Position } from './types';

// 坐标比较
export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

// 坐标转字符串键（用于 Map/Set）
export function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

// 字符串键转坐标
export function posFromKey(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

// 复制坐标
export function posClone(pos: Position): Position {
  return { x: pos.x, y: pos.y };
}

// 验证坐标是否在棋盘范围内
export function isValidPos(pos: Position, size: number): boolean {
  return pos.x >= 0 && pos.x < size && pos.y >= 0 && pos.y < size;
}

// 曼哈顿距离
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 欧几里得距离平方
export function euclideanDistanceSquared(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// 获取符号函数
export function sign(n: number): number {
  return n === 0 ? 0 : n < 0 ? -1 : 1;
}

// 生成唯一 ID
let idCounter = 0;
export function generateId(): string {
  return `entity_${++idCounter}`;
}

// 随机生成位置
export function randomPos(size: number): Position {
  return {
    x: Math.floor(Math.random() * size),
    y: Math.floor(Math.random() * size),
  };
}

// 洗牌算法
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 获取所有棋盘位置
export function getAllPositions(size: number): Position[] {
  const positions: Position[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      positions.push({ x, y });
    }
  }
  return positions;
}
