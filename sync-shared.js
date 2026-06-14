#!/usr/bin/env node
// Sync the canonical core logic from src/core/ into generated copies.
// Usage: node sync-shared.js
//
// Direction:
//   src/core/ -> shared/
//   src/core/ -> assets/scripts/core/
//
// Do not edit shared/ or assets/scripts/core/ by hand unless you are fixing
// this sync pipeline itself. Gameplay changes should start in src/core/.

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'src', 'core');
const TARGETS = [
  { dir: path.join(__dirname, 'shared'), description: 'shared/' },
  { dir: path.join(__dirname, 'assets', 'scripts', 'core'), description: 'assets/scripts/core/' },
];

const CORE_FILES = [
  { source: ['GameConfig.ts'], target: 'GameConfig.ts' },
  { source: ['GameLogic.ts'], target: 'GameLogic.ts' },
  { source: ['SkillSystem.ts'], target: 'SkillSystem.ts' },
  { source: ['SkillSpecs.ts'], target: 'SkillSpecs.ts' },
  { source: ['Types.ts', 'types.ts'], target: 'Types.ts' },
  { source: ['Utils.ts', 'utils.ts'], target: 'Utils.ts' },
];

function resolveSource(candidates) {
  for (const name of candidates) {
    const filePath = path.join(SOURCE_DIR, name);
    if (fs.existsSync(filePath)) return filePath;
  }

  const available = fs.readdirSync(SOURCE_DIR);
  const lowerMap = new Map(available.map((name) => [name.toLowerCase(), name]));
  for (const name of candidates) {
    const actual = lowerMap.get(name.toLowerCase());
    if (actual) return path.join(SOURCE_DIR, actual);
  }

  throw new Error(`Missing source file in src/core: ${candidates.join(' or ')}`);
}

if (!fs.existsSync(SOURCE_DIR)) {
  throw new Error(`Source directory not found: ${SOURCE_DIR}`);
}

let copied = 0;

for (const target of TARGETS) {
  fs.mkdirSync(target.dir, { recursive: true });

  for (const file of CORE_FILES) {
    const src = resolveSource(file.source);
    const dest = path.join(target.dir, file.target);
    fs.copyFileSync(src, dest);
    copied++;
    console.log(`COPY ${path.basename(src)} -> ${target.description}${file.target}`);
  }
}

console.log(`\nSynced ${CORE_FILES.length} core files from src/core/ to ${TARGETS.length} targets (${copied} copies).`);
