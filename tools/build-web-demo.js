#!/usr/bin/env node
// Build the browser demo bundle from the canonical TypeScript sources.

const fs = require('fs');
const path = require('path');
const { stripTypeScriptTypes } = require('module');

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'js', 'web-demo.js');

const sources = [
  'src/core/types.ts',
  'src/core/GameConfig.ts',
  'src/core/utils.ts',
  'src/core/SkillSpecs.ts',
  'src/core/SkillSystem.ts',
  'src/core/ShopSystem.ts',
  'src/core/Leaderboard.ts',
  'src/core/GameLogic.ts',
  'src/render/canvas-renderer.ts',
];

function readSource(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function toBrowserJs(relativePath) {
  let code = stripTypeScriptTypes(readSource(relativePath), { mode: 'transform' });
  code = code.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/g, '');
  code = code.replace(/import\s+['"][^'"]+['"];\s*/g, '');
  code = code.replace(/export\s+\{[\s\S]*?\};?\s*/g, '');
  code = code.replace(/\bexport\s+(?=(var|let|const|function|class)\b)/g, '');
  return `// ---- ${relativePath} ----\n${code.trim()}\n`;
}

const app = `
// ---- browser app ----
const STORAGE_KEY = 'xili_leaderboard_v1';
const NAME_KEY = 'xili_last_player_name';

const browserStorage = {
  read()  { try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; } },
  write(v){ try { localStorage.setItem(STORAGE_KEY, v); } catch (_) { /* private mode */ } },
};

function readLastName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; }
}
function writeLastName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch (_) { /* ignore */ }
}

function createDemoState() {
  const state = createInitialState();
  spawnEnemies(state);
  updateThreatMap(state);
  return state;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderLeaderboardOverlay(state, currentEntry) {
  const overlay = document.getElementById('leaderboard-overlay');
  if (!overlay) return;
  const entries = loadLeaderboard(browserStorage);
  const rank = currentEntry ? getRank(entries, currentEntry) : null;

  let rowsHtml;
  if (entries.length === 0) {
    rowsHtml = '<div class="leaderboard-empty">尚无记录</div>';
  } else {
    const rows = entries.map((e, i) => {
      const isCurrent = currentEntry && e.timestamp === currentEntry.timestamp && e.name === currentEntry.name;
      const cls = isCurrent ? ' class="current"' : '';
      const mark = e.isVictory ? ' 🏆' : '';
      return '<tr' + cls + '>' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(e.name) + mark + '</td>' +
        '<td class="score">' + e.score + '</td>' +
        '<td class="time">' + formatElapsed(e.elapsedSec) + '</td>' +
        '</tr>';
    }).join('');
    rowsHtml = '<table class="leaderboard-table">' +
      '<thead><tr><th>#</th><th>名字</th><th>分数</th><th>时间</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  const rankLine = rank
    ? '<div class="rank-line">本局排名：第 ' + rank + ' 名</div>'
    : (currentEntry ? '<div class="rank-line">未上榜（成绩低于第 10 名）</div>' : '');

  const closeLabel = currentEntry ? '再来一局' : '关闭';
  const closeAction = currentEntry ? 'restart' : 'close';

  overlay.innerHTML =
    '<div class="modal">' +
      '<h2>🏆 排行榜 (Top 10)</h2>' +
      rankLine +
      rowsHtml +
      '<div class="actions">' +
        '<button type="button" class="secondary" data-action="clear">清空榜单</button>' +
        '<button type="button" data-action="' + closeAction + '">' + closeLabel + '</button>' +
      '</div>' +
    '</div>';
  overlay.hidden = false;

  const closeBtn = overlay.querySelector('[data-action="restart"], [data-action="close"]');
  closeBtn.addEventListener('click', () => {
    overlay.hidden = true;
    overlay.innerHTML = '';
    if (closeAction === 'restart') {
      window.__xiliRestart && window.__xiliRestart();
    }
  });
  overlay.querySelector('[data-action="clear"]').addEventListener('click', () => {
    if (window.confirm('确定清空全部历史记录？此操作无法撤销。')) {
      clearLeaderboard(browserStorage);
      renderLeaderboardOverlay(state, currentEntry);
    }
  });
}

function renderResultOverlay(state) {
  const overlay = document.getElementById('leaderboard-overlay');
  if (!overlay) return;

  const elapsedSec = Math.floor(getElapsedGameMs(state) / 1000);
  const lastName = readLastName();

  overlay.innerHTML =
    '<div class="modal">' +
      '<h2>' + (state.isVictory ? '胜利！' : '游戏结束') + '</h2>' +
      '<div class="stats">' +
        '<span class="k">得分</span><span class="v">' + state.score + '</span>' +
        '<span class="k">回合</span><span class="v">' + state.turn + '</span>' +
        '<span class="k">时间</span><span class="v">' + formatElapsed(elapsedSec) + '</span>' +
      '</div>' +
      '<label for="player-name">你的名字</label>' +
      '<input id="player-name" type="text" maxlength="' + MAX_NAME_LENGTH + '" placeholder="匿名" value="' + escapeHtml(lastName) + '">' +
      '<div class="actions">' +
        '<button type="button" class="secondary" data-action="skip">不保存</button>' +
        '<button type="button" data-action="save">保存成绩</button>' +
      '</div>' +
    '</div>';
  overlay.hidden = false;

  const input = overlay.querySelector('#player-name');
  input.focus();
  input.select();

  function save() {
    const rawName = input.value;
    const name = normalizeName(rawName);
    writeLastName(name);
    const entry = {
      name,
      score: state.score,
      turn: state.turn,
      elapsedSec,
      isVictory: !!state.isVictory,
      timestamp: Date.now(),
    };
    insertEntry(browserStorage, entry);
    renderLeaderboardOverlay(state, entry);
  }
  function skip() {
    const entry = {
      name: normalizeName(input.value),
      score: state.score,
      turn: state.turn,
      elapsedSec,
      isVictory: !!state.isVictory,
      timestamp: Date.now(),
    };
    // 不写入 storage，但传入 currentEntry 仅用于在榜外提示「未上榜」
    renderLeaderboardOverlay(state, entry);
  }

  overlay.querySelector('[data-action="save"]').addEventListener('click', save);
  overlay.querySelector('[data-action="skip"]').addEventListener('click', skip);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
  });
}

function renderShopOverlay(state, onClose) {
  const overlay = document.getElementById('leaderboard-overlay');
  if (!overlay) return;
  const cards = state.shopOffers.map(offer => {
    const spec = SKILL_SPECS[offer.skillId];
    const status = canPurchaseOffer(state, offer);
    const disabled = status !== 'purchased';
    const label = offer.purchased ? '售罄'
      : status === 'max_level' ? '已满级'
      : status === 'insufficient_coins' ? '金币不足'
      : offer.price + ' 金币购买';
    return '<article class="shop-card" data-offer-id="' + offer.id + '">' +
      '<h3>' + escapeHtml(spec.icon + ' ' + spec.name) + ' Lv.' + state.skills[offer.skillId] + '</h3>' +
      '<p>' + escapeHtml(spec.desc) + '</p>' +
      '<button type="button" data-action="buy" data-offer-id="' + offer.id + '"' +
        (disabled ? ' disabled' : '') + '>' + label + '</button>' +
      '</article>';
  }).join('');

  overlay.innerHTML =
    '<div class="modal shop-modal">' +
      '<h2>技能商店</h2>' +
      '<div class="rank-line">金币：<span data-shop-coins>' + state.coins + '</span></div>' +
      '<div class="shop-cards">' + cards + '</div>' +
      '<div class="actions"><button type="button" data-action="continue">继续战斗</button></div>' +
    '</div>';
  overlay.hidden = false;
  overlay.querySelectorAll('[data-action="buy"]').forEach(button => {
    button.addEventListener('click', () => {
      purchaseShopOffer(state, button.getAttribute('data-offer-id'));
      renderShopOverlay(state, onClose);
    });
  });
  overlay.querySelector('[data-action="continue"]').addEventListener('click', onClose);
}

function startWebDemo() {
  const canvas = document.getElementById('game-canvas');
  const status = document.getElementById('status');
  const restartButton = document.getElementById('restart-button');
  const overlay = document.getElementById('leaderboard-overlay');
  if (!canvas) throw new Error('Missing #game-canvas');

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = 960;
  const cssHeight = 760;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = cssWidth;
  renderCanvas.height = cssHeight;
  const renderer = new CanvasRenderer(renderCanvas);
  let state = createDemoState();
  let lastShownPhase = null;
  let tickHandle = null;

  function draw() {
    renderer.render(state);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.drawImage(renderCanvas, 0, 0);
    if (status) {
      status.textContent = state.phase === GamePhase.GAME_OVER
        ? (state.deathMessage || '游戏结束')
        : '点击绿色交点移动，红色区域为敌方威胁。';
    }
    // 进入 GAME_OVER 时打开结算面板（只触发一次）
    if (state.phase === GamePhase.SHOP && lastShownPhase !== GamePhase.SHOP) {
      renderShopOverlay(state, continueAfterShop);
    }
    if (state.phase === GamePhase.GAME_OVER && lastShownPhase !== GamePhase.GAME_OVER) {
      stopTick();
      renderResultOverlay(state);
    }
    lastShownPhase = state.phase;
  }

  function startTick() {
    if (tickHandle) return;
    tickHandle = window.setInterval(() => {
      if (state.phase !== GamePhase.GAME_OVER) draw();
    }, 1000);
  }
  function stopTick() {
    if (tickHandle) { window.clearInterval(tickHandle); tickHandle = null; }
  }

  function restart() {
    if (overlay) { overlay.hidden = true; overlay.innerHTML = ''; }
    state = createDemoState();
    lastShownPhase = null;
    startTick();
    draw();
  }
  window.__xiliRestart = restart;

  function continueAfterShop() {
    closeShop(state);
    if (overlay) { overlay.hidden = true; overlay.innerHTML = ''; }
    lastShownPhase = null;
    draw();
  }

  canvas.addEventListener('click', (event) => {
    if (overlay && !overlay.hidden) return; // 弹窗时禁用棋盘点击
    if (state.phase === GamePhase.GAME_OVER) return;
    if (state.phase !== GamePhase.PLAYER_TURN || state.animating) return;

    const rect = canvas.getBoundingClientRect();
    const target = renderer.screenToBoard(event.clientX - rect.left, event.clientY - rect.top);
    if (!target) return;

    const result = handlePlayerMove(state, target);
    if (!result.moved) return;
    draw();

    window.setTimeout(() => {
      if (state.phase === GamePhase.ENEMY_TURN) {
        executeEnemyTurn(state);
        draw();
      }
    }, 180);
  });

  if (restartButton) restartButton.addEventListener('click', restart);
  const leaderboardButton = document.getElementById('leaderboard-button');
  if (leaderboardButton) leaderboardButton.addEventListener('click', () => {
    renderLeaderboardOverlay(state, null);
  });
  startTick();
  draw();
  window.ProjectXiliDemo = {
    getState: () => state,
    restart,
    // —— 测试钩子；生产环境无害，仅供 Playwright E2E 使用 ——
    __test: {
      forceGameOver(opts) {
        opts = opts || {};
        state.score = opts.score == null ? 0 : opts.score;
        state.turn = opts.turn == null ? 1 : opts.turn;
        state.startedAt = Date.now() - (opts.elapsedSec || 0) * 1000;
        state.finishedAt = Date.now();
        state.isVictory = !!opts.isVictory;
        state.deathMessage = opts.message || '测试触发';
        state.phase = GamePhase.GAME_OVER;
        draw();
      },
      clearStorage() {
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(NAME_KEY);
        } catch (_) { /* ignore */ }
      },
      seedLeaderboard(entries) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (_) { /* ignore */ }
      },
      seedLeaderboardRaw(rawString) {
        try {
          localStorage.setItem(STORAGE_KEY, rawString);
        } catch (_) { /* ignore */ }
      },
      readLeaderboard() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
      },
      seedLastName(name) {
        try { localStorage.setItem(NAME_KEY, name); } catch (_) { /* ignore */ }
      },
      grantSkill(id) {
        // Explicit test-only grant path; production skill growth goes through shop purchases.
        if (!grantSkill(state, id)) throw new Error('cannot grant skill: ' + id);
        draw();
      },
      setSkillLevel(id, level) {
        if (state.skills[id] == null) throw new Error('unknown skill: ' + id);
        state.skills[id] = level;
        draw();
      },
      // 暴露纯函数给端到端测试断言（非 UI 路径）
      getScalingValue: getScalingValue,
      SKILL_SPECS: SKILL_SPECS,
      awardScore(amount) { awardScore(state, amount); draw(); },
      openShop(now) { const opened = maybeOpenShop(state, now); draw(); return opened; },
      purchaseOffer(id) { const result = purchaseShopOffer(state, id); draw(); return result; },
      closeShop() { continueAfterShop(); },
      setShopOffers(skillIds) {
        state.shopOffers = skillIds.map((skillId, i) => ({ id: 'test_' + i, skillId, price: SHOP_PRICE, purchased: false }));
        state.phase = GamePhase.SHOP;
        state.shopOpenedAt = Date.now();
        draw();
      },
      getElapsedGameMs: () => getElapsedGameMs(state),
      executeEnemyTurn: () => executeEnemyTurn(state),
    },
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWebDemo);
} else {
  startWebDemo();
}
`;

const bundle = `/* Generated by tools/build-web-demo.js. Do not edit directly. */\n(function () {\n'use strict';\n${sources.map(toBrowserJs).join('\n')}\n${app}\n})();\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, bundle, 'utf8');
console.log(`Built ${path.relative(root, outFile)} from ${sources.length} TypeScript sources.`);
