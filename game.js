// ============================================================================
// 微信小游戏入口文件
// ============================================================================

const Game = require('./js/game');

// 获取设备信息（逻辑像素尺寸 + 设备像素比）
const sysInfo = wx.getSystemInfoSync();
const windowWidth  = sysInfo.windowWidth;
const windowHeight = sysInfo.windowHeight;
const pixelRatio   = sysInfo.pixelRatio;

// 创建主 canvas（微信小游戏 API）
const canvas = wx.createCanvas();

// 初始化游戏
const game = new Game({ canvas, windowWidth, windowHeight, pixelRatio });

// ============================================================================
// 触摸输入
// wx.onTouchEnd 的 changedTouches[0].clientX/Y 已是逻辑像素坐标
// ============================================================================

wx.onTouchEnd((e) => {
  const touch = e.changedTouches[0];
  if (!touch) return;
  game.handleTouch(touch.clientX, touch.clientY);
});

// 阻止默认长按菜单（防止误触）
wx.onTouchStart(() => {});
