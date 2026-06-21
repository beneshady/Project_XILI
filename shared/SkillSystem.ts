// ============================================================================
// 技能系统（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------

import { SkillId, SkillLevels } from './Types';
import { GameState } from './Types';
import { posEq, posKey } from './Utils';
import { EntityType } from './Types';
import { SKILL_SPECS, getScalingValue } from './SkillSpecs';

// 技能定义（名称/图标/描述等展示信息由各平台 UI 层实现）
export interface SkillDef {
  name: string;
  icon: string;
  desc: string;
  fullDesc: string;
  descStack: (level: number) => string;
}

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  armor: {
    name: '铁甲护身',
    icon: '\u{1F6E1}',
    desc: '抵挡一次致命攻击',
    fullDesc: '为自身披上一层护甲。当受到会造成死亡的攻击时，护甲自动消耗一层将其抵挡，免于一死。',
    descStack: (lv) => `当前护甲层数：${lv} 层（可继续叠加）`,
  },
  intimidate: {
    name: '借刀杀人',
    icon: '\u{1F628}',
    desc: '相邻敌人有概率被冻结',
    fullDesc: '玩家的气势令相邻的敌人心生胆怯。每轮敌人行动前，紧靠你的敌人有一定概率被吓住，该回合无法移动。',
    descStack: (lv) => `当前冻结概率：${Math.round(getScalingValue(SKILL_SPECS.intimidate, 'freezeChance', lv) * 100)}%（最高75%）`,
  },
  castling: {
    name: '王车易位',
    icon: '⚡',
    desc: '可传送到任意空格',
    fullDesc: '传承自象棋的特殊走法。冷却就绪时，本回合可以无视距离限制，直接传送到棋盘上任意一个空格。传送后进入冷却。',
    descStack: (lv) => `冷却：${getScalingValue(SKILL_SPECS.castling, 'cooldown', lv)} 回合（叠加可缩短）`,
  },
  aura: {
    name: '将军威势',
    icon: '\u{1F451}',
    desc: '敌人回避你的周围',
    fullDesc: '散发出令敌人不敢靠近的王者气场。敌人计算移动路线时，会主动避开你周围的格子，不会主动走入威慑范围内。',
    descStack: (lv) => `威慑范围：${getScalingValue(SKILL_SPECS.aura, 'auraRange', lv)} 格（最大2格）`,
  },
  siege: {
    name: '兵临城下',
    icon: '⚔',
    desc: '定期自动消灭一个小兵',
    fullDesc: '来自四面八方的力量汇聚，定期自动击杀场上一名随机小兵。无小兵时该次效果跳过。',
    descStack: (lv) => `触发间隔：每 ${getScalingValue(SKILL_SPECS.siege, 'interval', lv)} 回合（叠加可加快）`,
  },
};

// 技能数值计算（兼容旧 API，内部从 SKILL_SPECS 读取）

export function getCastlingCooldown(level: number): number {
  return getScalingValue(SKILL_SPECS.castling, 'cooldown', level);
}

export function getIntimidateChance(level: number): number {
  return getScalingValue(SKILL_SPECS.intimidate, 'freezeChance', level);
}

export function getSiegeInterval(level: number): number {
  return getScalingValue(SKILL_SPECS.siege, 'interval', level);
}

export function getAuraRange(level: number): number {
  return getScalingValue(SKILL_SPECS.aura, 'auraRange', level);
}

export function grantSkill(state: GameState, skillId: SkillId): boolean {
  const spec = SKILL_SPECS[skillId];
  if (!spec || state.skills[skillId] >= spec.maxLevel) return false;
  state.skills[skillId]++;

  if (skillId === 'castling' && state.skills.castling === 1) {
    state.castlingCooldown = 0;
  }
  if (skillId === 'siege' && state.skills.siege === 1) {
    state.siegeTimer = getScalingValue(SKILL_SPECS.siege, 'interval', 1);
  }
  return true;
}

// 借刀杀人：冻结相邻敌人

export function applyIntimidateFreeze(state: GameState): void {
  state.frozenEnemies.clear();
  if (state.skills.intimidate <= 0 || !state.player) return;

  const chance = getScalingValue(SKILL_SPECS.intimidate, 'freezeChance', state.skills.intimidate);
  const px = state.player.position.x;
  const py = state.player.position.y;

  for (const enemy of state.enemies) {
    if (enemy.isDead) continue;
    const chebyshev = Math.max(
      Math.abs(enemy.position.x - px),
      Math.abs(enemy.position.y - py)
    );
    if (chebyshev <= 1 && Math.random() < chance) {
      state.frozenEnemies.add(enemy.id);
    }
  }
}

// 兵临城下：定时击杀小兵（返回被击杀的敌人ID，null表示未触发）

export function applySiegeEffect(state: GameState): string | null {
  if (state.skills.siege <= 0) return null;

  state.siegeTimer--;
  if (state.siegeTimer <= 0) {
    state.siegeTimer = getScalingValue(SKILL_SPECS.siege, 'interval', state.skills.siege);

    const livingPawns = state.enemies.filter(
      e => !e.isDead && e.type === EntityType.SOLDIER
    );
    if (livingPawns.length > 0) {
      const target = livingPawns[Math.floor(Math.random() * livingPawns.length)];
      target.isDead = true;
      const cell = state.grid.cells.get(posKey(target.position));
      if (cell) cell.entity = null;
      return target.id;
    }
  }
  return null;
}

// 铁甲护身：抵挡致命攻击（返回是否成功抵挡）

export function applyArmor(state: GameState): boolean {
  if (state.skills.armor <= 0) return false;
  state.skills.armor--;
  return true;
}

// 王车易位：检查并消耗冷却（返回是否使用了传送）

export function checkCastlingUsed(state: GameState, movedDist: number): boolean {
  if (state.skills.castling <= 0 || state.castlingCooldown > 0) return false;
  if (movedDist > 1) {
    state.castlingCooldown = getScalingValue(SKILL_SPECS.castling, 'cooldown', state.skills.castling);
    return true;
  }
  return false;
}

// 王车易位：冷却递减

export function tickCastlingCooldown(state: GameState): void {
  if (state.skills.castling > 0 && state.castlingCooldown > 0) {
    state.castlingCooldown--;
  }
}
