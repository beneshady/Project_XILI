// ============================================================================
// 数据驱动的技能规格表（共享逻辑层 - 零平台依赖）
// ----------------------------------------------------------------------------
// 新加技能 = 新增一个 SkillSpec 条目 + （必要时）在 SkillSystem.ts 中接入效果。
// ============================================================================

import { SkillSpec, SkillType, Faction } from './Types';

export const SKILL_SPECS: Record<string, SkillSpec> = {
  armor: {
    id: 'armor',
    name: '铁甲护身',
    desc: '抵挡一次致命攻击',
    flavor: '为自身披上一层护甲。当受到会造成死亡的攻击时，护甲自动消耗一层将其抵挡，免于一死。',
    types: [SkillType.DEFENSE],
    faction: Faction.GENERAL,
    icon: '\u{1F6E1}',
    maxLevel: 5,
    scaling: { armorLayers: [1, 1, 2, 2, 3] },
  },
  intimidate: {
    id: 'intimidate',
    name: '借刀杀人',
    desc: '相邻敌人有概率被冻结',
    flavor: '玩家的气势令相邻的敌人心生胆怯。每轮敌人行动前，紧靠你的敌人有一定概率被吓住，该回合无法移动。',
    types: [SkillType.UTILITY],
    faction: Faction.GENERAL,
    icon: '\u{1F628}',
    maxLevel: 5,
    scaling: { freezeChance: [0.30, 0.45, 0.60, 0.75, 0.75] },
  },
  castling: {
    id: 'castling',
    name: '王车易位',
    desc: '可传送到任意空格',
    flavor: '传承自象棋的特殊走法。冷却就绪时，本回合可以无视距离限制，直接传送到棋盘上任意一个空格。传送后进入冷却。',
    types: [SkillType.MOVEMENT],
    faction: Faction.GENERAL,
    icon: '⚡',
    maxLevel: 5,
    scaling: { cooldown: [4, 3, 2, 2, 2] },
  },
  aura: {
    id: 'aura',
    name: '将军威势',
    desc: '敌人回避你的周围',
    flavor: '散发出令敌人不敢靠近的王者气场。敌人计算移动路线时，会主动避开你周围的格子。',
    types: [SkillType.UTILITY],
    faction: Faction.GENERAL,
    icon: '\u{1F451}',
    maxLevel: 3,
    scaling: { auraRange: [1, 1, 2] },
  },
  siege: {
    id: 'siege',
    name: '兵临城下',
    desc: '定期自动消灭一个小兵',
    flavor: '来自四面八方的力量汇聚，定期自动击杀场上一名随机小兵。无小兵时该次效果跳过。',
    types: [SkillType.DAMAGE],
    faction: Faction.GENERAL,
    icon: '⚔',
    maxLevel: 5,
    scaling: { interval: [3, 2, 1, 1, 1] },
  },
};

/** 获取技能指定数值在当前等级的值（等级超出时取上限） */
export function getScalingValue(spec: SkillSpec, valueName: string, level: number): number {
  const values = spec.scaling[valueName];
  if (!values || values.length === 0) return 0;
  const idx = Math.max(0, Math.min(level - 1, values.length - 1));
  return values[idx];
}

/** 获取指定流派的所有技能 */
export function getSkillsByFaction(faction: Faction): SkillSpec[] {
  return Object.values(SKILL_SPECS).filter(s => s.faction === faction);
}
