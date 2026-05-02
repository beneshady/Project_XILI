#!/usr/bin/env node
// 将 shared/ 逻辑层同步到各项目目录
// 用法: node sync-shared.js

const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.join(__dirname, 'shared');
const TARGETS = [
  // HTML5 项目
  { dir: path.join(__dirname, 'src', 'core'), description: 'src/core/' },
  // Cocos 项目（同目录下的 assets/scripts/core/）
  { dir: path.join(__dirname, 'assets', 'scripts', 'core'), description: 'assets/scripts/core/' },
];

const SHARED_FILES = fs.readdirSync(SHARED_DIR).filter(f => f.endsWith('.ts'));

for (const target of TARGETS) {
  if (!fs.existsSync(target.dir)) {
    console.log(`SKIP ${target.description} (directory not found)`);
    continue;
  }

  for (const file of SHARED_FILES) {
    const src = path.join(SHARED_DIR, file);
    const dest = path.join(target.dir, file);
    fs.copyFileSync(src, dest);
    console.log(`COPY ${file} → ${target.description}`);
  }
}

console.log(`\nSynced ${SHARED_FILES.length} files from shared/`);
