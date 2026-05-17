// ============================================================================
// 工具函数（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------

import { Position } from './Types';

export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

export function posFromKey(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function posClone(pos: Position): Position {
  return { x: pos.x, y: pos.y };
}

export function isValidPos(pos: Position, width: number, height: number = width): boolean {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclideanDistanceSquared(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function sign(n: number): number {
  return n === 0 ? 0 : n < 0 ? -1 : 1;
}

let idCounter = 0;
export function generateId(): string {
  return `entity_${++idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function randomPos(width: number, height: number = width): Position {
  return {
    x: Math.floor(Math.random() * width),
    y: Math.floor(Math.random() * height),
  };
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getAllPositions(width: number, height: number = width): Position[] {
  const positions: Position[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      positions.push({ x, y });
    }
  }
  return positions;
}
