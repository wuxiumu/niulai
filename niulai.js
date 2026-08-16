
// 数据与配置作为 ES Modules 导入（强模块边界：需经 http(s) 加载，file:// 直接打开会被 CORS 拦截）
import { CYCLE_TIME, RUN_DURATION, LEADERBOARD_KEY, LEVERAGES, LEV_THEORETICAL, LEV_PRACTICAL, LEV_TABLE, TRILLION, WINDOW_MIN, WINDOW_MAX, WINDOW_PER_CYCLE, WINDOW_MAX_COUNT, SAVE_VERSION } from './config.js';
import { STOCK_DEFS, ACHV_DEFS, EVENTS, MARKET_NAMES, MARKET_EMOJI } from './data.js';

/* ===== 游戏状态 ===== */
let state = {
  version: SAVE_VERSION,    // 存档版本号
  lastDailyFree: 0,         // 上次每日送牛来符的日期（当天只送一次）
  talismanTotal: 0,         // 累计获得牛来符（多渠道统计）
  bullLuck: 0,
  bullCoins: 100,
  cattle: 1,
  cattleInfoShown: false, // 是否已看过「养牛说明」弹窗（首次点牛时弹出一次）
  stocks: {},        // { stockId: count }
  stockCost: {},     // { stockId: 累计投入牛币 }
  items: { talisman: 1, boost: 0 },
  market: 'bull',
  marketIndex: 100,       // 大盘指数，基数线 = 100：≥100 偏牛 / <100 偏熊 / 贴近 100 为震荡
  indexDelta: 0,          // 大盘指数上一周期变动（随机游走动量用）
  indexHist: [100],       // 大盘指数历史（用于 K 线图绘制），由 klineTick 每 3 秒 push 一次
  klineIndex: 100,       // K 线图实时大盘值（每 3 秒小幅游走，围绕 marketIndex 波动）
  cycleStart: Date.now(),
  cycleCount: 0,
  wishes: { total: 0, success: 0, active: false },
  boostUntil: 0,
  achievements: [],
  eventBonus: { bonusAll: 0, bonusBull: 0, penaltyLeader: 0 },
  forceNext: null,   // 'bull' | 'bear' | null
  dailyLuck: true,
  totalEarned: 0,
  muted: true,            // 音效默认静音（浏览器要求用户主动开启）
  tutorialDone: false,    // 新手引导是否完成
  lastSaveTime: Date.now(),
  // ===== 对局制 =====
  runId: null,
  runStart: 0,
  runEnd: 0,
  runActive: false,
  runReason: '',
  paused: false,           // 对局是否暂停（暂停时主循环停止，时间戳冻结）
  pauseAt: 0,               // 暂停开始时间戳，恢复时据此平移所有绝对时间戳
  nickname: '',             // 排行榜昵称（默认空，首次进入随机生成）
  // ===== 杠杆 / 窗口 =====
  leverage: 1,            // 当前买入杠杆偏好：1=无杠杆（仓位=自有，正常买卖）；2/3/5/10=持仓倍数，单周期涨跌达实操强平线即清仓
  holdLev: {},            // { stockId: 买入时杠杆 }
  debt: 0,                // 负债（预留，当前用收益放大模型）
  maxNetWorth: 100,       // 本局最高净值（排行榜成绩）
  windowActive: false,
  windowDeadline: 0,
  windowJoined: false,    // 窗口内是否上车（买入牛股）
  windowCount: 0,         // 本局已出现窗口次数
  marginWarned: false,    // 保证金预警是否已提示（避免每周期刷屏）
  log: [],                 // 本局流水账（明细）：[{ c, t, type, text, d }]，d=牛币变动（红涨绿跌）
  coinsHist: [],           // 牛币/净值历史快照（点击牛币饼图看走势）：[{ c, t, coins, net, debt, hold }]
  runIntroShown: false,    // 首次点头部「⏱ 时间」是否已弹过引导弹窗（只弹一次）
  // ===== 万亿彩蛋 =====
  trillionRun: false,      // 本局是否已放过「万亿」全屏特效（每局只放一次，避免刷屏）
  trillionEver: false,     // 生涯是否破过万亿（首次额外给证书文案 + 成就）
  trillionCount: 0,        // 生涯破万亿次数（彩蛋文案里显摆用）
};

// 从 localStorage 读取
try {
  const saved = localStorage.getItem('niulai_save');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
    state.cycleStart = Date.now(); // 重置周期计时
    state.eventBonus = { bonusAll: 0, bonusBull: 0, penaltyLeader: 0 };
    state.forceNext = null;
    // 补全对局/杠杆/窗口字段（兼容旧存档）
    if (typeof state.runActive === 'undefined') state.runActive = false;
    if (typeof state.leverage === 'undefined' || state.leverage < 1) state.leverage = 1;
    if (typeof state.log === 'undefined' || !Array.isArray(state.log)) state.log = [];
    if (typeof state.coinsHist === 'undefined' || !Array.isArray(state.coinsHist)) state.coinsHist = [];
    if (typeof state.runIntroShown === 'undefined') state.runIntroShown = false;
    if (typeof state.trillionRun === 'undefined') state.trillionRun = false;
    if (typeof state.trillionEver === 'undefined') state.trillionEver = false;
    if (typeof state.trillionCount === 'undefined') state.trillionCount = 0;
    if (typeof state.holdLev === 'undefined') state.holdLev = {};
    if (typeof state.maxNetWorth === 'undefined') state.maxNetWorth = 100;
    if (typeof state.windowActive === 'undefined') state.windowActive = false;
    if (typeof state.windowCount === 'undefined') state.windowCount = 0;
    if (typeof state.debt === 'undefined') state.debt = 0;
    if (typeof state.marginWarned === 'undefined') state.marginWarned = false;
    if (typeof state.nickname === 'undefined') state.nickname = '';
    if (typeof state.paused === 'undefined') state.paused = false;
    if (typeof state.pauseAt === 'undefined') state.pauseAt = 0;
    if (typeof state.marketIndex === 'undefined') state.marketIndex = 100;
    if (typeof state.indexDelta === 'undefined') state.indexDelta = 0;
    if (typeof state.indexHist === 'undefined' || !Array.isArray(state.indexHist)) state.indexHist = [100];
    if (typeof state.klineIndex === 'undefined' || typeof state.klineIndex !== 'number') state.klineIndex = (state.marketIndex || 100);
    // 存档版本 / 牛来符多渠道字段兼容
    if (typeof state.version === 'undefined') state.version = SAVE_VERSION;
    if (typeof state.lastDailyFree === 'undefined') state.lastDailyFree = 0;
    if (typeof state.talismanTotal === 'undefined') state.talismanTotal = 0;
  }
} catch(e) {}

/* ===== DOM 引用 ===== */
const $ = id => document.getElementById(id);
const elLuck = $('luckNum'), elCoins = $('coinsNum'), elCattle = $('valCattle');
const elLuckArc = $('luckArc'), elCoinsArc = $('coinsArc');
const DONUT_C = 2 * Math.PI * 42; // 半径 42 的圆周长
function setDonut(arcEl, frac) {
  if (!arcEl) return;
  frac = Math.max(0, Math.min(1, frac));
  arcEl.style.strokeDashoffset = DONUT_C * (1 - frac);
}

/* ===== 数字缩写（国内习惯：万 / 亿 / 万亿 / 京） =====
   破万亿后不再显示成「12345亿」，直接进「万亿」档；再往上到 1e16 用「京」兜底。
   注意：这里用「向下截断」而非 toFixed 四舍五入 —— 否则 99999999 会被舍成 "10000万"、
   999999999999 会被舍成 "10000亿"，越档显示（这也是"亿单位破万亿"看起来很怪的根因）。 */
function cut2(x) {
  return (Math.floor(x * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
}
function fmt(n) {
  n = Math.floor(n);
  const neg = n < 0;
  n = Math.abs(n);
  let s;
  if (n >= 1e16) s = cut2(n / 1e16) + '京';
  else if (n >= 1e12) s = cut2(n / 1e12) + '万亿';
  else if (n >= 1e8) s = cut2(n / 1e8) + '亿';
  else if (n >= 1e4) s = cut2(n / 1e4) + '万';
  else s = String(n);
  return neg ? '-' + s : s;
}
// 自适应字号：数字越长字号越小，避免大数（万/亿缩略）溢出饼图
function fitDonutNum(el, str) {
  el.textContent = str;
  const len = str.length;
  let fs = 24;
  if (len >= 7) fs = 14;
  else if (len === 6) fs = 16;
  else if (len === 5) fs = 19;
  else if (len === 4) fs = 22;
  el.style.fontSize = fs + 'px';
}
const elMarketInd = $('marketInd'), elMarketEmoji = $('marketEmoji'), elMarketText = $('marketText');
const elCycleBar = $('cycleBar');
const elStockGrid = $('stockGrid'), elItemList = $('itemList'), elAchvGrid = $('achvGrid');
const elWishBtn = $('wishBtn'), elWishStat = $('wishStat');
const elBullChar = $('klineChart');
const elToastContainer = $('toastContainer');
const elRunChip = $('runChip'), elRunClock = $('runClock');
const elLeverageBar = $('leverageBar'), elWindowHint = $('windowHint'), elWindowCd = $('windowCd');

/* ===== 工具函数 ===== */
function save() {
  state.lastSaveTime = Date.now();
  try {
    const s = JSON.stringify(state);
    localStorage.setItem('niulai_save', s);
    localStorage.setItem('niulai_save_bak', s); // 自动备份，清缓存也能从 bak 恢复
  } catch(e) {}
}

// 离线收益：重新打开时按离开时长补发牛运值（封顶2小时，牛运值封顶100）
function applyOfflineProgress() {
  if (!state.lastSaveTime) return;
  let elapsed = (Date.now() - state.lastSaveTime) / 1000; // 秒
  if (elapsed < 60) return; // 离开不足1分钟不补发
  elapsed = Math.min(elapsed, 7200); // 最多补 2 小时
  let rate = state.cattle * 0.3; // 每头牛每秒
  if (state.dailyLuck) rate *= 1.1;
  const gained = Math.min(100 - state.bullLuck, rate * elapsed);
  if (gained > 0.5) {
    state.bullLuck = Math.min(100, state.bullLuck + gained);
    const hrs = (elapsed / 3600).toFixed(1);
    setTimeout(() => toast(`🐄 你离开了约 ${hrs} 小时，牛牛们攒了 ${Math.round(gained)} 牛运值！`, 'good'), 800);
    flashChip('pieLuck');
    save();
  }
}

function toast(text, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = text;
  elToastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ===== 音效系统（Web Audio，无需音频文件） ===== */
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
  }
  return _audioCtx;
}
function playSfx(type) {
  if (state.muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const now = ctx.currentTime;
  const tones = {
    buy:    [ {f: 660, t: 0.08} ],
    sell:   [ {f: 440, t: 0.08}, {f: 330, t: 0.1} ],
    bull:   [ {f: 523, t: 0.1}, {f: 784, t: 0.16} ],
    niulai: [ {f: 392, t: 0.12}, {f: 523, t: 0.12}, {f: 659, t: 0.12}, {f: 880, t: 0.28} ],
    error:  [ {f: 200, t: 0.15} ],
    click:  [ {f: 800, t: 0.04} ],
  };
  const seq = tones[type] || tones.click;
  seq.forEach((note, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.f;
    const start = now + i * 0.09;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.t);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.t + 0.02);
  });
}

function floatText(text, type, x, y) {
  const el = document.createElement('div');
  el.className = 'float-text ' + type;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  elBullChar.parentElement.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function flashChip(chipId) {
  const chip = $(chipId);
  if (!chip) return; // chipLuck/chipCoins 已移除（饼图替代），空安全
  const cls = chip.classList.contains('pie-card') ? 'pop' : 'flash';
  chip.classList.remove(cls);
  void chip.offsetWidth;
  chip.classList.add(cls);
}

function getStockDef(id) { return STOCK_DEFS.find(s => s.id === id); }
function ownedStockCount() { return Object.values(state.stocks).reduce((a,b)=>a+b, 0); }

/* ===== UI 更新 ===== */
let _uiCache = {}; // 差异更新缓存：值未变则不重写 DOM
function updateUI() {
  const luck = Math.floor(state.bullLuck);
  const coins = Math.floor(state.bullCoins);
  const luckFrac = Math.min(100, state.bullLuck) / 100;          // 牛运值：0~100 线性
  const coinFrac = Math.max(0, Math.min(1, (Math.log10(state.bullCoins + 10) - 1) / 5)); // 牛币：对数刻度，随数值持续增长

  if (_uiCache.luck !== luck) { fitDonutNum(elLuck, String(luck)); setDonut(elLuckArc, luckFrac); _uiCache.luck = luck; }
  if (_uiCache.coins !== coins) { fitDonutNum(elCoins, fmt(coins)); setDonut(elCoinsArc, coinFrac); _uiCache.coins = coins; }
  if (_uiCache.cattle !== state.cattle) { elCattle.textContent = state.cattle; _uiCache.cattle = state.cattle; }

  // 万亿彩蛋检测（内部有 trillionRun 守卫，每局只放一次特效）
  if (typeof checkTrillion === 'function') checkTrillion();

  // 行情指示器（大盘指数：基数线 100，≥100 牛 / <100 熊 / 贴近 100 震荡）
  const idx = Math.round(state.marketIndex);
  const regime = idx > 103 ? 'bull' : idx < 97 ? 'bear' : 'side';
  const mkKey = regime + '|' + idx;
  if (_uiCache.market !== mkKey) {
    elMarketInd.className = 'market-indicator market-' + regime;
    elMarketEmoji.textContent = idx >= 100 ? '🐂' : '🐻';
    elMarketText.textContent = (idx >= 100 ? '牛' : '熊') + ' · 大盘 ' + idx;
    _uiCache.market = mkKey;
  }

  // 道具数量（仅变化时重建列表，避免每帧重绘 DOM）
  if (_uiCache.talisman !== state.items.talisman || _uiCache.boost !== state.items.boost) {
    $('itemList') && updateItems();
    _uiCache.talisman = state.items.talisman;
    _uiCache.boost = state.items.boost;
  }
  $('wishBtn') && updateWishBtn();

  // 对局倒计时
  if (state.runActive) {
    if (state.paused) {
      if (_uiCache.runClock !== '⏸') { elRunClock.textContent = '⏸'; _uiCache.runClock = '⏸'; }
      if (!_uiCache.runUrgent) { elRunChip.classList.add('urgent'); _uiCache.runUrgent = true; }
    } else {
      const left = Math.max(0, state.runEnd - Date.now());
      const mm = Math.floor(left / 60000);
      const ss = Math.floor((left % 60000) / 1000);
      const txt = `${mm}:${ss.toString().padStart(2, '0')}`;
      if (_uiCache.runClock !== txt) { elRunClock.textContent = txt; _uiCache.runClock = txt; }
      const urgent = left < 60000;
      if (_uiCache.runUrgent !== urgent) { elRunChip.classList.toggle('urgent', urgent); _uiCache.runUrgent = urgent; }
    }
  } else {
    // 未开始 / 已结束：提示可点击开始或重开
    const txt = state.runReason ? '🔄 重开' : '▶ 开始';
    if (_uiCache.runClock !== txt) { elRunClock.textContent = txt; _uiCache.runClock = txt; }
    if (_uiCache.runUrgent) { elRunChip.classList.remove('urgent'); _uiCache.runUrgent = false; }
  }
  // 机会窗口提示
  if (_uiCache.winActive !== state.windowActive) {
    elWindowHint.classList.toggle('show', state.windowActive);
    _uiCache.winActive = state.windowActive;
  }
  if (state.windowActive) {
    const wl = Math.max(0, Math.ceil((state.windowDeadline - Date.now()) / 1000));
    if (_uiCache.winCd !== wl) { elWindowCd.textContent = wl; _uiCache.winCd = wl; }
  }

  // 账户看板（资产/负债）实时刷新
  renderAccountStrip();
}

function updateWishBtn() {
  elWishBtn.disabled = state.bullLuck < 30 || state.wishes.active;
  elWishBtn.textContent = state.wishes.active ? '许愿生效中…' : `许愿 (30 🍀)`;
  elWishStat.textContent = `已许愿 ${state.wishes.total} 次 · 成功 ${state.wishes.success} 次`;
}

/* ===== 对局制：排行榜 + 开始/结束 ===== */
function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || []; } catch(e) { return []; }
}
function saveLeaderboard(lb) {
  try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(lb.slice(0, 100))); } catch(e) {}
}
function genRunId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function randomName() { return '牛人' + Math.floor(1000 + Math.random() * 9000); }

// 重置本局游戏内资源（保留成就、设置、引导状态）
function startRun() {
  state.runId = genRunId();
  state.runStart = Date.now();
  state.runEnd = state.runStart + RUN_DURATION;
  state.runActive = true;
  state.runReason = '';
  state.bullCoins = 100;
  state.cattle = 1;
  state.cattleInfoShown = false;
  state.stocks = {};
  state.stockCost = {};
  state.holdLev = {};
  state.items = { talisman: 1, boost: 0 };
  state.debt = 0;
  state.leverage = 1;
  state.maxNetWorth = 100;
  state.market = 'bull';
  state.marketIndex = 100;
  state.indexDelta = 0;
  state.indexHist = [100];
  state.klineIndex = 100;
  state.cycleStart = Date.now();
  state.cycleCount = 0;
  state.wishes = { total: 0, success: 0, active: false };
  state.boostUntil = 0;
  state.eventBonus = { bonusAll: 0, bonusBull: 0, penaltyLeader: 0 };
  state.forceNext = null;
  state.dailyLuck = true;
  state.totalEarned = 0;
  state.windowActive = false;
  state.windowDeadline = 0;
  state.windowJoined = false;
  state.windowCount = 0;
  state.marginWarned = false;
  state.trillionRun = false;  // 新局重置：本局可再放一次万亿彩蛋（trillionEver 生涯标记保留）
  state.log = [];
  state.coinsHist = [];
  state.paused = false;
  state.pauseAt = 0;
  save();
  if (typeof renderStocks === 'function') renderStocks();
  renderLeverageBar();
  updateUI();
  pushLog('start', '🏁 本局开始（初始 100 牛币）', null);
  recordSnapshot();
  refreshRunControls();
}

// 主循环定时器句柄（暂停时清除，恢复时重建）
let tickTimer = null;
let klineTimer = null;

// ===== 时间控制：开始 / 暂停 / 重新开始 =====
// 暂停：清除主循环，冻结所有依赖绝对时间戳的字段（runEnd / cycleStart / windowDeadline / boostUntil）
function pauseRun() {
  if (!state.runActive || state.paused) return;
  state.paused = true;
  state.pauseAt = Date.now();
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  refreshRunControls();
  updateUI();   // 关键：主循环已停，必须主动刷新，否则 ⏸ 不会被写入 → 看起来"没暂停"
  save();
  toast('⏸ 已暂停，行情与计时已冻结', 'info');
}
// 恢复：按暂停时长平移所有绝对时间戳，使剩余时间精确延续
function resumeRun() {
  if (!state.paused) return;
  const delta = Date.now() - (state.pauseAt || Date.now());
  state.cycleStart += delta;
  state.runEnd += delta;
  if (state.windowActive && state.windowDeadline) state.windowDeadline += delta;
  if (state.boostUntil) state.boostUntil += delta;
  state.paused = false;
  state.pauseAt = 0;
  lastTick = Date.now();
  if (!tickTimer) tickTimer = setInterval(gameTick, TICK_INTERVAL);
  refreshRunControls();
  save();
  toast('▶ 继续，冲！', 'good');
}
// 重新开始：当前局直接重置为新的一局
function restartRun() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  state.paused = false;
  state.pauseAt = 0;
  startRun();
  lastTick = Date.now();
  tickTimer = setInterval(gameTick, TICK_INTERVAL);
  refreshRunControls();
  toast('🔄 已重新开始新的一局！', 'good');
}
// 刷新时间控制按钮状态与提示
function refreshRunControls() {
  // 时间控制已集中到头部「⏱ 时间」chip（见 onRunChipClick）；设置页不再含开始/暂停按钮，故此处无需处理
}

// 设置页「本局速览」实时刷新（人性化：一眼看清当前对局状况）
// 本局当前净值（牛币 + 持仓按当前市价估值 − 负债）
function netWorth() {
  let value = state.bullCoins;
  STOCK_DEFS.forEach(def => {
    const cnt = state.stocks[def.id] || 0;
    if (cnt > 0) {
      const price = Math.round(def.cost * SELL_RATIO[state.market][def.type]);
      value += price * cnt;
    }
  });
  value -= (state.debt || 0);
  return Math.floor(value);
}

// 当前所有持仓的市值（按本周期现价估算，mark-to-market）
function positionValue() {
  let v = 0;
  STOCK_DEFS.forEach(def => {
    const cnt = state.stocks[def.id] || 0;
    if (cnt > 0) v += Math.round(def.cost * SELL_RATIO[state.market][def.type]) * cnt;
  });
  return v;
}

/* ===== 本局流水账（明细）===== */
const LOG_LIMIT = 300;
function pushLog(type, text, d) {
  if (!Array.isArray(state.log)) state.log = [];
  state.log.push({
    c: state.cycleCount || 0,
    t: Date.now(),
    type: type,
    text: text,
    d: (d == null ? null : Math.round(d)),
  });
  if (state.log.length > LOG_LIMIT) state.log = state.log.slice(state.log.length - LOG_LIMIT);
  renderLedger();
}
// 流水行 HTML（纯函数，供主页面流水账 / 结算弹窗 / 饼图弹窗三处复用）
const LEDGER_ICONS = { buy: '💰', sell: '💱', liq: '💥', settle: '📊', repay: '💸', event: '📣', window: '🚀', wish: '🌟', achv: '🏆', egg: '✨', start: '🏁', end: '🔚' };
function ledgerRowsHtml() {
  if (!state.log || state.log.length === 0) {
    return '<div class="ledger-empty">本局尚未开始，买入/结算/事件都会记在这里</div>';
  }
  // 最新在前
  return state.log.slice().reverse().map(e => {
    let dHtml = '';
    if (e.d != null && e.d !== 0) {
      const cls = e.d > 0 ? 'gain' : 'loss';
      const sign = e.d > 0 ? '+' : '';
      dHtml = `<span class="ledger-d ${cls}">${sign}${fmt(e.d)}🪙</span>`;
    } else if (e.d != null && e.d === 0) {
      dHtml = '<span class="ledger-d">±0</span>';
    }
    const cHtml = e.c > 0 ? `<span class="ledger-cycle">#${e.c}</span>` : '';
    return `<div class="ledger-row type-${e.type}">${cHtml}<span class="ledger-icon">${LEDGER_ICONS[e.type] || '•'}</span><span class="ledger-text">${e.text}</span>${dHtml}</div>`;
  }).join('');
}
// 把流水渲染进任意容器（结算弹窗 / 饼图弹窗复用）
function renderLedgerInto(id) {
  const el = $(id);
  if (el) el.innerHTML = ledgerRowsHtml();
}
// 本局流水汇总（结算弹窗顶部统计卡）
function ledgerSummary() {
  const log = Array.isArray(state.log) ? state.log : [];
  let gain = 0, loss = 0, buys = 0, sells = 0, liqs = 0;
  log.forEach(e => {
    if (typeof e.d === 'number') { if (e.d > 0) gain += e.d; else if (e.d < 0) loss += e.d; }
    if (e.type === 'buy') buys++;
    else if (e.type === 'sell') sells++;
    else if (e.type === 'liq') liqs++;
  });
  return { rows: log.length, gain, loss, net: gain + loss, buys, sells, liqs };
}
// 统计卡 HTML（红涨绿跌：入账红、出账绿，遵循 A 股习惯）
function ledgerStatsHtml() {
  const s = ledgerSummary();
  const netColor = s.net >= 0 ? 'var(--bull-red)' : 'var(--bear-blue)';
  const cards = [
    ['本局周期', `${state.cycleCount || 0} 期`, ''],
    ['流水条数', `${s.rows} 条`, ''],
    ['累计入账', `+${fmt(s.gain)}🪙`, 'var(--bull-red)'],
    ['累计出账', `${fmt(s.loss)}🪙`, 'var(--bear-blue)'],
    ['流水净额', `${s.net >= 0 ? '+' : ''}${fmt(s.net)}🪙`, netColor],
    ['买/卖/强平', `${s.buys} / ${s.sells} / ${s.liqs}`, ''],
  ];
  return cards.map(([k, v, c]) =>
    `<div class="hist-stat"><span>${k}</span><b${c ? ` style="color:${c}"` : ''}>${v}</b></div>`
  ).join('');
}
function renderLedger() {
  const body = $('ledgerBody');
  if (body) body.innerHTML = ledgerRowsHtml();
  // 弹窗已打开时同步刷新（结算/饼图弹窗里的流水保持实时）
  const rm = $('resultModal');
  if (rm && rm.classList.contains('show')) renderLedgerInto('resultLedgerBody');
  const cm = $('coinsHistoryModal');
  if (cm && cm.classList.contains('show')) renderLedgerInto('histLedgerBody');
}
function renderAccountStrip() {
  const set = (id, v) => { const el = $(id); if (el) el.textContent = fmt(v); };
  const cash = Math.floor(state.bullCoins);
  const pos = positionValue();
  const total = cash + pos;
  const debt = Math.floor(state.debt || 0);
  const net = netWorth();
  set('asCash', cash);
  set('asPos', pos);
  set('asTotal', total);
  set('asDebt', debt);
  set('asNet', net);
}

// 记录本周期资产快照（牛币饼图→历史走势用）：每周期一条 { c, t, coins, net, debt, hold }
function recordSnapshot() {
  if (!Array.isArray(state.coinsHist)) state.coinsHist = [];
  const coins = Math.floor(state.bullCoins);
  const hold = positionValue();
  const debt = Math.floor(state.debt || 0);
  const net = netWorth();
  const last = state.coinsHist[state.coinsHist.length - 1];
  // 值与上一拍完全相同（暂停态或无变化）则不重复记录，避免折线被压平
  if (last && last.coins === coins && last.net === net && last.c === (state.cycleCount || 0)) return;
  state.coinsHist.push({ c: state.cycleCount || 0, t: Date.now(), coins, net, debt, hold });
  if (state.coinsHist.length > 300) state.coinsHist = state.coinsHist.slice(state.coinsHist.length - 300);
  save();
}

// 所有持仓的建仓成本合计（用于维持保证金强平阈值）
function totalEntryPosition() {
  let t = 0;
  STOCK_DEFS.forEach(def => { if (!def.instant) t += (state.stockCost[def.id] || 0); });
  return t;
}

function endRun(reason) {
  if (!state.runActive) return;
  state.runActive = false;
  state.runReason = reason;
  pushLog('end', `🏁 本局结束：${reason}`, null);
  recordSnapshot();
  state.windowActive = false; // 清窗口状态，避免重复触发踏空提示
  const score = state.maxNetWorth; // 排行榜成绩取本局最高净值
  const name = (state.nickname && state.nickname.trim()) ? state.nickname.trim() : randomName();
  state.nickname = name; // 落地昵称，下一局复用
  const lb = loadLeaderboard();
  const entry = {
    name: name,
    score: score,
    reason: reason,
    runStart: state.runStart,
    runEnd: Date.now(),
    date: new Date().toLocaleDateString('zh-CN'),
    id: state.runId,
  };
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  saveLeaderboard(lb);
  currentEntry = entry;
  currentLb = lb;
  showResult(entry, lb);
  // 尽力同步到服务端 PHP+Redis 排行榜（无服务端/离线时静默失败，回退本地榜）
  submitScoreToServer(entry);
  refreshServerBoard(false);
  refreshRunControls();
}

/* ===== K线背景 ===== */
function genKline() {
  const bg = $('klineBg');
  bg.innerHTML = '';
  const count = Math.floor(window.innerWidth / 8);
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'kline-bar';
    const isBull = Math.random() > 0.4;
    const h = 10 + Math.random() * 70;
    bar.style.height = h + '%';
    bar.style.background = isBull ? 'var(--bull-red)' : 'var(--bear-blue)';
    bar.style.animationDelay = (i * 0.03) + 's';
    bg.appendChild(bar);
  }
}

/* ===== 主视觉 K 线图（蜡烛图，替代牛形角色） ===== */
function drawKline() {
  const cv = elBullChar;                       // 现指向 <canvas id="klineChart">
  if (!cv || !cv.getContext) return;
  const wrap = cv.parentElement;               // .kline-wrap（position: relative，飘字挂载处）
  if (!wrap || !wrap.clientWidth) return;
  const cssW = wrap.clientWidth, cssH = 152;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const padL = 10, padR = 10, padT = 16, padB = 14;
  const W = cssW - padL - padR, H = cssH - padT - padB;

  const hist = (state.indexHist && state.indexHist.length) ? state.indexHist.slice() : [100];
  let lo = Math.min.apply(null, hist.concat(100));
  let hi = Math.max.apply(null, hist.concat(100));
  const span = Math.max(20, hi - lo);
  lo -= span * 0.15; hi += span * 0.15;
  const yOf = function (v) { return padT + (hi - v) / (hi - lo) * H; };

  // 横向网格
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const gy = padT + H * g / 4;
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(cssW - padR, gy); ctx.stroke();
  }

  // 100 牛熊分界线
  const y100 = yOf(100);
  ctx.strokeStyle = 'rgba(255,210,63,0.5)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(padL, y100); ctx.lineTo(cssW - padR, y100); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,210,63,0.85)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('100 牛熊分界', padL + 2, Math.max(padT + 9, y100 - 3));

  // 蜡烛
  const N = hist.length;
  const step = N > 1 ? W / (N - 1) : W;
  const cw = Math.max(2, Math.min(10, step * 0.55));
  for (let i = 0; i < N; i++) {
    const open = i === 0 ? hist[0] : hist[i - 1];
    const close = hist[i];
    const x = padL + (N === 1 ? W / 2 : step * i);
    const yO = yOf(open), yC = yOf(close);
    const top = Math.min(yO, yC), bot = Math.max(yO, yC);
    const up = close >= open;
    const col = up ? '#ff2d2d' : '#22c55e';     // 红涨绿跌（A股习惯）
    ctx.strokeStyle = col; ctx.fillStyle = col;
    const wick = Math.max(3, (bot - top) * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, Math.max(padT, top - wick));
    ctx.lineTo(x, Math.min(padT + H, bot + wick));
    ctx.stroke();
    ctx.fillRect(x - cw / 2, top, cw, Math.max(1.5, bot - top));
  }

  // 最新价标注
  const last = hist[N - 1];
  const yL = yOf(last);
  ctx.fillStyle = last >= 100 ? '#ff5c5c' : '#22c55e';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('大盘 ' + Math.round(last), cssW - padR - 2, Math.max(padT + 11, yL - 4));
  ctx.textAlign = 'left';
}

/* ===== K 线高频采样：每 3 秒记录一根（与 15 秒行情结算解耦） ===== */
function klineTick() {
  if (!state || !state.runActive || state.paused) return;   // 未开局 / 暂停时不推进
  let v = (typeof state.klineIndex === 'number') ? state.klineIndex : (state.marketIndex || 100);
  const base = state.marketIndex || 100;
  const noise = (Math.random() * 2 - 1) * 2.2;   // ±2.2 随机扰动 → 有涨有跌
  const pull = (base - v) * 0.22;                // 向 15 秒周期基准回归，避免长期偏离
  v = Math.max(50, Math.min(180, v + noise + pull));
  state.klineIndex = Math.round(v * 10) / 10;
  if (!state.indexHist || !Array.isArray(state.indexHist)) state.indexHist = [100];
  state.indexHist.push(state.klineIndex);
  if (state.indexHist.length > 60) state.indexHist.shift();
  drawKline();
}

/* ===== 杠杆选择栏 ===== */
function renderLeverageBar() {
  if (!elLeverageBar) return;
  const L = state.leverage;
  const prac = LEV_PRACTICAL(L);
  const levTxt = L <= 1
    ? '无杠杆：正常买卖，无爆仓，可长拿穿越牛熊'
    : `${L}x 杠杆：借 ${L - 1} 倍、仓位 ${L} 倍 · 个股单周期涨跌 ≥ ${(prac * 100).toFixed(0)}% 直接强平清仓 · 盈利优先还债`;
  const debtTxt = state.debt > 0 ? ` · 负债 ${fmt(state.debt)}🪙` : '';
  const nwTxt = ` · 净值 ${fmt(netWorth())}🪙`;
  const buttons =
    `<button class="lev-btn ${L <= 1 ? 'active' : ''}" data-lev="1">无</button>` +
    LEVERAGES.map(l => `<button class="lev-btn ${L === l ? 'active' : ''}" data-lev="${l}">${l}x</button>`).join('');
  elLeverageBar.innerHTML = '<span class="label">💡 杠杆：</span>' + buttons +
    `<span class="lev-help" id="levHelpBtn" title="杠杆怎么玩？点我查看">❔</span>` +
    `<span class="label" style="margin-left:auto;font-size:13px;color:var(--text-faint)">${levTxt} · 股票≤10x，基金强制无杠杆${debtTxt}${nwTxt}</span>`;
  elLeverageBar.querySelectorAll('[data-lev]').forEach(b => {
    b.addEventListener('click', () => {
      state.leverage = parseInt(b.dataset.lev, 10);
      renderLeverageBar();
      playSfx('click');
      toast(state.leverage <= 1
        ? '已切换至 无杠杆（正常买卖，无强平）'
        : `已切换至 ${state.leverage}x 杠杆（单周期涨跌 ≥ ${(LEV_PRACTICAL(state.leverage) * 100).toFixed(0)}% 即强平清仓）`, 'info');
    });
  });
  const helpBtn = $('levHelpBtn');
  if (helpBtn) helpBtn.addEventListener('click', openLeverageModal);
}

function stockPnlHtml(def, count) {
  const avg = (state.stockCost[def.id] || 0) / count;
  const price = Math.round(def.cost * SELL_RATIO[state.market][def.type]);
  const pnl = (price - avg) * count;
  const cls = pnl >= 0 ? 'up' : 'down';
  const sign = pnl >= 0 ? '+' : '';
  const lev = state.holdLev[def.id] || 0;
  const pnlTxt = pnl >= 0 ? '+' + fmt(pnl) : fmt(pnl);
  return `<div class="stock-pnl">均价 ${Math.round(avg)} · 浮盈 <span class="${cls}">${pnlTxt}🪙</span>${lev >= 1 ? `<span class="stock-lev-tag">${lev}x</span>` : ''}</div>`;
}

/* ===== 渲染股票卡片 ===== */
let cardMap = {}; // 股票/牛卡节点缓存：id -> { root, ownedEl, pnlEl, hintEl, costEl, buyBtn, sellBtn }

// 完整重建股票面板（仅结构变化时调用：开局重置 / 首次进入）
function renderStocks() {
  elStockGrid.innerHTML = '';
  cardMap = {};
  // 注：养牛已改为「点击左上角 🐂 直接 +1」，不再占股票面板的卡片空间
  STOCK_DEFS.forEach(def => {
    const owned = state.stocks[def.id] || 0;
    const card = document.createElement('div');
    card.className = `stock-card ${def.type}-type`;
    card.dataset.card = def.id;
    card.innerHTML = `
      <div class="stock-head">
        <span class="stock-icon">${def.icon}</span>
        <span class="stock-name">${def.name}</span>
        <span class="stock-type-tag">${def.type === 'bull' ? '牛市' : def.type === 'bear' ? '熊市' : def.type === 'etf' ? '稳健·1x' : '即时'}</span>
      </div>
      <div class="stock-desc">${def.desc}</div>
      <div class="stock-returns">
        <span class="return-pill bull">🐂 +${def.bull}</span>
        <span class="return-pill bear">🐻 ${def.bear >= 0 ? '+' : ''}${def.bear}</span>
        <span class="return-pill side">😐 +${def.side}</span>
      </div>
      <span class="stock-owned" data-owned style="display:none;"></span>
      <div class="stock-pnl" data-pnl></div>
      <div class="buy-hint" data-hint style="font-size:12px;color:var(--text-faint);margin:2px 0 4px;"></div>
      <div class="stock-bottom">
        <span class="stock-cost"><span class="coin-ico">🪙</span> ${def.cost}</span>
        <div style="display:flex; gap:6px; margin-left:auto;">
          ${!def.instant ? `<button class="buy-btn sell-btn" data-sell="${def.id}">卖出</button>` : ''}
          <button class="buy-btn" data-buy="${def.id}">买入</button>
        </div>
      </div>
    `;
    elStockGrid.appendChild(card);
    cardMap[def.id] = {
      root: card,
      ownedEl: card.querySelector('[data-owned]'),
      pnlEl: card.querySelector('[data-pnl]'),
      hintEl: card.querySelector('[data-hint]'),
      buyBtn: card.querySelector('[data-buy]'),
      sellBtn: card.querySelector('[data-sell]'),
    };
  });
  updateStockCards(); // 填充动态数据
}

// 差异更新：只改文本/状态，不重建 DOM（#12 性能优化，行情每 15 秒刷新不再卡顿）
function updateStockCards() {
  STOCK_DEFS.forEach(def => {
    const m = cardMap[def.id];
    if (!m) return;
    const owned = state.stocks[def.id] || 0;
    const effLev = def.instant ? 0 : Math.min(state.leverage, maxLevFor(def));
    const afford = def.instant ? (state.bullCoins >= def.cost ? 1 : 0) : buyableRemaining(def.id, def.cost, effLev);
    const canBuy = afford > 0;
    m.root.classList.toggle('disabled', !canBuy);
    if (owned > 0) { m.ownedEl.style.display = ''; m.ownedEl.textContent = `持仓 ${owned}`; }
    else { m.ownedEl.style.display = 'none'; }
    m.pnlEl.innerHTML = (owned > 0 && !def.instant) ? stockPnlHtml(def, owned) : '';
    if (!def.instant) m.hintEl.textContent = `可买 ${afford} 张`;
    m.buyBtn.disabled = !canBuy;
    if (m.sellBtn) m.sellBtn.disabled = owned <= 0;
  });
}

// 买入分批：连点3次买满，单次≈可买量的1/3（#15）
// buySession 记录"本次建仓进度"，3秒无操作或切到其他标的即重置
let buySession = null; // { id, base, bought, step, time }
function nextBatchQ(id, base) {
  const now = Date.now();
  if (!buySession || buySession.id !== id || now - buySession.time > 3000) {
    buySession = { id, base, bought: 0, step: 0, time: now };
  } else {
    buySession.time = now;
  }
  // 关键修复：会话进行中始终用"首次锁定"的基准 base，不能用后续传入的剩余份数当 base，
  // 否则第2/3次点击会用错分母算 targets，导致 q 变负、提前"已满仓"（点3次买不满）。
  const useBase = buySession.base;
  if (useBase <= 0) return 0;
  const targets = [Math.ceil(useBase / 3), Math.ceil(2 * useBase / 3), useBase];
  let q = targets[buySession.step] - buySession.bought;
  if (q < 1 && buySession.step < 2) q = 1;        // 最低范围：每次至少 1 份
  if (q <= 0) q = useBase - buySession.bought;        // 兜底
  q = Math.max(0, Math.min(q, useBase - buySession.bought)); // 不超过可买
  if (q <= 0) return 0;
  buySession.bought += q;
  buySession.step = Math.min(buySession.step + 1, 2);
  return q;
}

// 剩余可买份数（修复"点3次买满"点不动的 bug）：
// lev = 持仓倍数（1=无杠杆只用现金；2/3/5/10=借 (lev-1) 倍、购买力 lev 倍）。
// 已花掉的钱本就不在 bullCoins 里，绝不能再减一次 stockCost。建仓会话进行中直接返回会话剩余目标。
function buyableRemaining(id, cost, lev) {
  if (buySession && buySession.id === id && (Date.now() - buySession.time) <= 3000 && buySession.bought < buySession.base) {
    return buySession.base - buySession.bought;
  }
  const mult = lev <= 1 ? 1 : lev;
  return Math.max(0, Math.floor(state.bullCoins * mult / cost));
}

// 各资产类型允许的最大杠杆：股票（牛股/龙头/熊股）最高 10x，ETF 基金 / 即时型最多 1x（无杠杆）
function maxLevFor(def) {
  if (!def || def.type === 'etf' || def.instant) return 1;
  return 10;
}

function buyStock(id) {
  const def = getStockDef(id);

  // 即时型（政策利好）：一次性，不走分批/杠杆
  if (def.instant) {
    if (state.bullCoins < def.cost) { toast('牛币不足！', 'bad'); return; }
    state.bullCoins -= def.cost;
    state.bullCoins += def.bull;
    state.totalEarned += def.bull;
    toast(`📜 ${def.name} 生效！+${fmt(def.bull)} 牛币`, 'good');
    flashChip('pieCoins');
    checkAllStocksAchv();
    save(); updateStockCards(); updateUI();
    return;
  }

  // 资产类型封顶：股票最高 10x，ETF/即时强制 1x（无杠杆）
  const lev = Math.min(state.leverage, maxLevFor(def));
  if (lev < state.leverage) toast(`${def.name} 最多 ${maxLevFor(def)} 倍杠杆，已按 ${lev} 倍买入`, 'info');

  let q;
  if (lev > 1) {
    // 杠杆买入：一次性部署满杠杆仓位。负债 = 借入部分（现金 × 杠杆 − 现金），立即正确，
    // 避免"点3次分批"在现金耗尽后卡住、导致负债数字错位（如 100 牛币 10x 只显示 250 负债）。
    const capacity = Math.floor(state.bullCoins * lev / def.cost);
    if (capacity <= 0) { toast('资金不足，无法以此杠杆建仓！', 'bad'); return; }
    q = capacity;
    buySession = null; // 杠杆满仓即建完，避免与无杠杆分批会话串号
  } else {
    // 无杠杆：保留"点3次买满"分批（仅用现金预算，每批自然花现金）
    const newAfford = buyableRemaining(id, def.cost, lev);
    const sessionFull = buySession && buySession.id === id && buySession.bought >= buySession.base;
    if (newAfford <= 0) { toast(sessionFull ? '已满仓' : '已达杠杆上限或资金不足！', sessionFull ? 'info' : 'bad'); return; }
    q = nextBatchQ(id, newAfford);
    if (q <= 0) { toast('已满仓', 'info'); return; }
  }

  const costTotal = q * def.cost;
  const cashUsed = Math.min(state.bullCoins, costTotal);
  const borrowed = lev <= 1 ? 0 : costTotal - cashUsed; // 无杠杆（lev=1）不借；杠杆借 (lev-1) 倍计入负债
  state.bullCoins -= cashUsed;
  state.debt += borrowed;
  state.stocks[id] = (state.stocks[id] || 0) + q;
  state.stockCost[id] = (state.stockCost[id] || 0) + costTotal;
  state.holdLev[id] = lev;

  // 机会窗口内买入牛股 = 成功上车（只提示一次）
  if (state.windowActive && def.type === 'bull' && !state.windowJoined) {
    state.windowJoined = true;
    toast('🚀 你在暴涨窗口上车了！本窗口收益 ×3', 'good');
  }

  const debtTxt = borrowed > 0 ? `，借 ${fmt(borrowed)}🪙` : '';
  toast(`买入 ${q} 张 ${def.name} ${def.icon}（${lev <= 1 ? '无杠杆' : lev + 'x 杠杆'}${debtTxt}）`, 'good');
  pushLog('buy', `买入 ${q} 张 ${def.name} ${lev <= 1 ? '无杠杆' : lev + 'x'}${debtTxt}`, -cashUsed);
  unlockAchv('firstBuy');
  playSfx('buy');
  checkAllStocksAchv();
  save(); updateStockCards(); updateUI(); renderLeverageBar();
  const boughtCard = elStockGrid.querySelector(`.stock-card[data-card="${id}"]`);
  if (boughtCard) { boughtCard.classList.remove('bought'); void boughtCard.offsetWidth; boughtCard.classList.add('bought'); }
}

// 卖出市价系数：按股票类型 × 当前行情
const SELL_RATIO = {
  bull:  { bull: 1.6, bear: 0.55, etf: 1.1,  policy: 1 },
  bear:  { bull: 0.55, bear: 1.6, etf: 0.95, policy: 1 },
  side:  { bull: 1.0, bear: 1.1, etf: 1.0,  policy: 1 },
};

function sellStock(id) {
  const def = getStockDef(id);
  if (!def || def.instant) return;
  const count = state.stocks[id] || 0;
  if (count <= 0) { toast('没有可卖出的持仓', 'info'); return; }
  const price = Math.round(def.cost * SELL_RATIO[state.market][def.type]);
  const refund = price * count;
  const costBasis = state.stockCost[id] || 0;
  const profit = refund - costBasis;
  state.bullCoins += refund;
  // 卖出回笼资金先偿还负债（保证金交易平仓）
  const repay = Math.min(state.debt, refund);
  state.debt -= repay;
  state.bullCoins -= repay;
  state.stocks[id] = 0;
  state.stockCost[id] = 0;
  state.holdLev[id] = 0;
  const tag = (profit >= 0 ? '盈利 ' : '亏损 ') + fmt(Math.abs(profit));
  const repayTxt = repay > 0 ? `，偿还负债 ${fmt(repay)}🪙` : '';
  toast(`卖出 ${count} 张 ${def.name} ${def.icon} +${fmt(refund)} 🪙（${tag}${repayTxt}）`, profit >= 0 ? 'good' : 'bad');
  pushLog('sell', `卖出 ${count} 张 ${def.name}（${tag}）`, profit);
  playSfx('sell');
  flashChip('pieCoins');
  save();
  updateStockCards();
  updateUI();
  renderLeverageBar();
  const soldCard = elStockGrid.querySelector(`.stock-card[data-card="${id}"]`);
  if (soldCard) { soldCard.classList.remove('bought'); void soldCard.offsetWidth; soldCard.classList.add('bought'); }
}

/* ===== 渲染道具 ===== */
function updateItems() {
  const list = [
    {
      id: 'talisman', icon: '🛡️', name: '牛来符', cls: 'talisman',
      desc: '熊市时自动消耗，抵御一次牛股/龙头股亏损。来源：每日登录 / 牛来彩蛋 / 成就奖励。',
      count: state.items.talisman,
      buyCost: 40,
      buyLabel: '购买 (40 🪙)',
      useLabel: null, // 被动触发
    },
    {
      id: 'boost', icon: '⚡', name: '牛运加速', cls: 'boost',
      desc: '激活后 30 秒内牛运值产出翻倍。',
      count: state.items.boost,
      buyCost: 20,
      buyLabel: '购买 (20 🪙)',
      useLabel: '激活',
      useCost: 'luck',
    },
  ];

  elItemList.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item-card';
    const canBuy = state.bullCoins >= item.buyCost;
    const canUse = item.useLabel && item.count > 0;
    div.innerHTML = `
      <div class="item-icon-box ${item.cls}">${item.icon}</div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.desc}</div>
      </div>
      <span class="item-count">×${item.count}</span>
      <button class="item-btn buy" data-buy-item="${item.id}" ${!canBuy ? 'disabled' : ''}>${item.buyLabel}</button>
      ${item.useLabel ? `<button class="item-btn use" data-use-item="${item.id}" ${!canUse ? 'disabled' : ''}>${item.useLabel}</button>` : ''}
    `;
    elItemList.appendChild(div);
  });

  elItemList.querySelectorAll('[data-buy-item]').forEach(btn => {
    btn.addEventListener('click', () => buyItem(btn.dataset.buyItem));
  });
  elItemList.querySelectorAll('[data-use-item]').forEach(btn => {
    btn.addEventListener('click', () => useItem(btn.dataset.useItem));
  });
}

function buyItem(id) {
  const costs = { talisman: 40, boost: 20 };
  if (state.bullCoins < costs[id]) { toast('牛币不足！', 'bad'); return; }
  state.bullCoins -= costs[id];
  state.items[id]++;
  toast(`购买 ${id === 'talisman' ? '🛡️ 牛来符' : '⚡ 牛运加速'} ×1`, 'good');
  pushLog('buy', `购买 ${id === 'talisman' ? '🛡️ 牛来符' : '⚡ 牛运加速'} ×1`, -costs[id]);
  flashChip('pieCoins');
  save();
  updateUI();
}

function useItem(id) {
  if (state.items[id] <= 0) return;
  if (id === 'boost') {
    state.items.boost--;
    state.boostUntil = Date.now() + 30000;
    toast('⚡ 牛运加速激活！30 秒内牛运值翻倍', 'good');
  }
  save();
  updateUI();
}

/* ===== 渲染成就 ===== */
function renderAchievements() {
  elAchvGrid.innerHTML = '';
  ACHV_DEFS.forEach(a => {
    const unlocked = state.achievements.includes(a.id);
    const div = document.createElement('div');
    div.className = 'achv-card ' + (unlocked ? 'unlocked' : 'locked');
    div.innerHTML = `
      <span class="achv-icon">${unlocked ? a.icon : '🔒'}</span>
      <div class="achv-info">
        <div class="achv-name">${a.name}</div>
        <div class="achv-desc">${a.desc}</div>
      </div>
      <span class="achv-check">${unlocked ? '✅' : '⬜'}</span>
    `;
    elAchvGrid.appendChild(div);
  });
}

function unlockAchv(id) {
  if (state.achievements.includes(id)) return;
  const def = ACHV_DEFS.find(a => a.id === id);
  if (!def) return;
  state.achievements.push(id);
  toast(`🏆 成就解锁：${def.name} ${def.icon}`, 'good');
  pushLog('achv', `🏆 解锁成就：${def.name}`, null);
  // 成就奖励：部分成就解锁额外送牛来符（多渠道获取之一）
  if (def.reward && def.reward.talisman) {
    state.items.talisman += def.reward.talisman;
    state.talismanTotal += def.reward.talisman;
    toast(`🎁 成就奖励 +${def.reward.talisman} 牛来符 🛡️`, 'good');
  }
  renderAchievements();
  save();
}

function checkAllStocksAchv() {
  const held = ['bull','leader','bear','etf'].every(id => (state.stocks[id] || 0) > 0);
  if (held) unlockAchv('allStocks');
}

/* ===== 许愿池 ===== */
elWishBtn.addEventListener('click', () => {
  if (state.bullLuck < 30) { toast('牛运值不足！', 'bad'); return; }
  if (state.wishes.active) { toast('已有许愿生效中', 'info'); return; }
  state.bullLuck -= 30;
  state.wishes.total++;
  const success = Math.random() < 0.8;
  if (success) {
    state.wishes.active = true;
    state.wishes.success++;
    toast('🌟 许愿成功！下个牛市周期收益 ×1.5', 'good');
    pushLog('wish', '🌟 许愿成功（下个牛市 ×1.5）', null);
    unlockAchv('wish3');
  } else {
    toast('💔 许愿失败…心诚则灵，再试试', 'bad');
    pushLog('wish', '💔 许愿失败', null);
  }
  if (state.wishes.success >= 3) unlockAchv('wish3');
  save();
  updateUI();
});

/* ===== 牛来彩蛋 ===== */
function triggerNiulai() {
  const overlay = $('niulaiOverlay');
  overlay.classList.add('show');
  playSfx('niulai');
  // 粒子爆炸
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const colors = ['#ffd23f', '#ff2d2d', '#ff6b6b', '#ffe082', '#ff9800'];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = '50%';
    p.style.top = '50%';
    const angle = (Math.PI * 2 * i) / 40;
    const dist = 150 + Math.random() * 200;
    const dur = 1 + Math.random() * 0.8;
    p.style.transition = `all ${dur}s cubic-bezier(0.1, 0.6, 0.3, 1)`;
    overlay.appendChild(p);
    requestAnimationFrame(() => {
      p.style.left = `calc(50% + ${Math.cos(angle) * dist}px)`;
      p.style.top = `calc(50% + ${Math.sin(angle) * dist}px)`;
      p.style.opacity = '0';
      p.style.transform = `scale(${0.5 + Math.random()})`;
    });
    setTimeout(() => p.remove(), dur * 1000 + 100);
  }
  setTimeout(() => {
    overlay.classList.remove('show');
    overlay.querySelectorAll('.particle').forEach(p => p.remove());
  }, 2500);

  // 奖励
  state.bullCoins += 100;
  state.bullLuck = Math.min(100, state.bullLuck + 30);
  state.totalEarned += 100;
  toast('✨ 牛来！天降牛财 +100 🪙 +30 🍀', 'good');
  pushLog('egg', '✨ 牛来彩蛋 +100🪙 +30🍀', 100);
  // 牛来彩蛋掉落牛来符（35% 几率，多渠道获取之一）
  if (Math.random() < 0.35) {
    state.items.talisman++;
    state.talismanTotal++;
    toast('🛡️ 牛来符掉了一张！', 'good');
  }
  flashChip('pieCoins');
  flashChip('pieLuck');
  unlockAchv('niulai');
  save();
  updateUI();
}

/* ===== 万亿彩蛋（净值突破 1 万亿 🪙）=====
   每局首次突破放一次全屏特效（trillionRun 守卫，避免每帧刷屏）；
   生涯首次突破额外解锁「万亿牛神」成就 + 证书文案。 */
function checkTrillion() {
  if (state.trillionRun) return;                    // 本局已放过，不再触发
  if (!state.runActive) return;                     // 未开局不触发
  if (netWorth() < TRILLION) return;
  state.trillionRun = true;
  state.trillionCount = (state.trillionCount || 0) + 1;
  const firstEver = !state.trillionEver;
  state.trillionEver = true;
  triggerTrillion(firstEver);
}

function triggerTrillion(firstEver) {
  const net = netWorth();
  const overlay = $('trillionOverlay');
  if (overlay) {
    const sub = $('trillionSub');
    if (sub) {
      sub.textContent = firstEver
        ? `净值 ${fmt(net)} 🪙 · 生涯首次破万亿，封神！`
        : `净值 ${fmt(net)} 🪙 · 生涯第 ${state.trillionCount} 次破万亿`;
    }
    overlay.classList.add('show');
    // 金币雨：从顶部随机位置落下，比牛来彩蛋的放射粒子更"壕"
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'coin-rain';
      p.textContent = ['🪙', '💰', '🐂', '✨'][Math.floor(Math.random() * 4)];
      p.style.left = (Math.random() * 100) + '%';
      p.style.top = '-8%';
      const dur = 1.6 + Math.random() * 1.6;
      p.style.fontSize = (16 + Math.random() * 20) + 'px';
      p.style.transition = `all ${dur}s cubic-bezier(0.3, 0.1, 0.6, 1)`;
      overlay.appendChild(p);
      requestAnimationFrame(() => {
        p.style.top = '108%';
        p.style.opacity = '0';
        p.style.transform = `rotate(${(Math.random() * 720 - 360).toFixed(0)}deg)`;
      });
      setTimeout(() => p.remove(), dur * 1000 + 120);
    }
    setTimeout(() => {
      overlay.classList.remove('show');
      overlay.querySelectorAll('.coin-rain').forEach(p => p.remove());
    }, 4200);
  }
  playSfx('niulai');

  // 彩蛋奖励：牛运值拉满 + 送牛 + 牛来符（破万亿是壮举，给足仪式感）
  state.bullLuck = 100;
  state.cattle += 1;
  state.items.talisman += 2;
  state.talismanTotal += 2;
  toast('🌌 万亿牛神降世！净值破 ' + fmt(TRILLION) + ' 🪙', 'good');
  toast('🎁 彩蛋奖励：牛运值拉满 🍀 +1 头牛 🐂 +2 张牛来符 🛡️', 'good');
  pushLog('egg', `🌌 破万亿彩蛋！净值 ${fmt(net)}🪙（牛运拉满 +1🐂 +2🛡️）`, null);
  flashChip('pieCoins');
  flashChip('pieLuck');
  flashChip('chipCattle');
  if (firstEver) unlockAchv('trillion');   // 生涯首次：解锁成就（额外 +3 牛来符）
  save();
}

/* ===== 点击 K 线图抓取行情（替代点击牛牛）；并跳转到股市视图 ===== */
elBullChar.addEventListener('click', (e) => {
  const gain = 1 + Math.floor(state.cattle * 0.3);
  state.bullLuck = Math.min(100, state.bullLuck + gain);
  const rect = elBullChar.getBoundingClientRect();
  const parentRect = elBullChar.parentElement.getBoundingClientRect();
  floatText('+' + gain + ' 🍀', 'gain', e.clientX - parentRect.left, e.clientY - parentRect.top - 20);
  flashChip('pieLuck');
  updateUI();
  save();
  applyView('stocks');      // 点 K 线图默认进入股市视图
  syncViewHash('stocks');
});

/* ===== 行情周期结算 ===== */
// 杠杆阀值清仓：按现价卖出该持仓，偿还对应负债，剩余（盈亏）归现金；盈亏已含杠杆放大
function forceCloseStock(def, mk, L, movePct, threshold, count) {
  const price = Math.round(def.cost * SELL_RATIO[mk][def.type]);
  const refund = price * count;
  const costBasis = state.stockCost[def.id] || 0;   // 含借入的总成本（与卖出模型一致）
  const profit = refund - costBasis;                 // 真实已实现盈亏（卖出模型，与 netWorth/sellStock 一致）
  state.bullCoins += refund;                          // 先收回全部卖出所得
  const repay = Math.min(state.debt, refund);         // 平仓偿还负债
  state.debt -= repay;
  state.bullCoins -= repay;                           // 还债后净到手
  state.stocks[def.id] = 0;
  state.stockCost[def.id] = 0;
  state.holdLev[def.id] = 0;
  const dir = movePct >= 0 ? '涨' : '跌';
  const pct = (Math.abs(movePct) * 100).toFixed(0);
  const sign = profit >= 0 ? '+' : '';
  toast(`💥 ${def.name} ${L}x 杠杆触发强平线（${dir} ${pct}%）→ 强制清仓！本周期${sign}${fmt(profit)}🪙${repay > 0 ? `，偿还负债 ${fmt(repay)}🪙` : ''}`, profit >= 0 ? 'info' : 'bad');
  pushLog('liq', `💥 ${def.name} ${L}x 强平（${dir}${pct}%）`, profit);
  playSfx('error');
  document.body.classList.remove('crash'); void document.body.offsetWidth; document.body.classList.add('crash');
  setTimeout(() => document.body.classList.remove('crash'), 600);
}

function settleCycle() {
  state.cycleCount++;
  const mk = state.market;
  let cycleEarn = 0;
  let bullEarn = 0;
  let levEarn = 0;       // 杠杆持仓（L≥2）本周期自身盈利，专用于"盈利优先还债"（避免拿无杠杆仓收益还杠杆债）

  // 结算股票
  STOCK_DEFS.forEach(def => {
    if (def.instant) return;
    const count = state.stocks[def.id] || 0;
    if (count === 0) return;
    const L = state.holdLev[def.id] || 0;   // 0 = 无杠杆
    let unit = def[mk]; // 每单位收益
    // 事件加成（作用于单位收益）
    if (state.eventBonus.bonusAll > 0) unit *= (1 + state.eventBonus.bonusAll);
    if (def.type === 'bull' && state.eventBonus.bonusBull > 0) unit += state.eventBonus.bonusBull;
    if (def.id === 'leader' && state.eventBonus.penaltyLeader > 0) unit *= (1 - state.eventBonus.penaltyLeader);
    // 许愿加成
    if (mk === 'bull' && state.wishes.active) unit *= 1.5;
    // 机会窗口加成（已上车的牛股 ×3）
    if (state.windowActive && def.type === 'bull' && state.windowJoined) unit *= 3;
    // 牛来符保护（熊市亏损时）
    if (mk === 'bear' && unit < 0 && def.type === 'bull' && state.items.talisman > 0) {
      state.items.talisman--;
      unit = 0;
      toast(`🛡️ 牛来符抵御了 ${def.name} 的亏损！`, 'good');
      unlockAchv('bearSurvive');
    }
    // 杠杆强平清仓：有杠杆(L≥2)且本周期该股价跌幅 ≥ 实操强平线 → 强制清仓（上行不强制平，可继续持有放大收益）
    if (L >= 2) {
      const priceMove = SELL_RATIO[mk][def.type] - 1;   // 本周期实际涨跌幅（卖出价相对成本）
      const threshold = LEV_PRACTICAL(L);                // 实操平台强平线（提前平仓位置）
      if (priceMove <= -threshold) {                     // 仅跌幅触线才强平，上行保留
        forceCloseStock(def, mk, L, priceMove, threshold, count);
        return;
      }
    }
    const ret = unit * count;
    state.bullCoins += ret;
    cycleEarn += ret;
    if (L >= 2) levEarn += ret;          // 杠杆仓自身盈利单独累计，用于优先还债
    if (def.type === 'bull') bullEarn += ret;
  });

  // 亏损超过现金的部分转为负债（保证金逻辑：缺口即借入）
  if (state.bullCoins < 0) {
    state.debt += -state.bullCoins;
    state.bullCoins = 0;
  }
  // 杠杆利息：每个周期对负债收 0.5%（真实成本）
  if (state.debt > 0) state.debt = Math.round(state.debt * 1.005);

  // 杠杆负债偿还：仅用"仍持有的杠杆持仓"本周期自身盈利优先还债（levEarn）。
  // 避免拿无杠杆仓收益还杠杆债（Bug4），也不与强平/卖出已在内部偿还的部分重复。
  if (levEarn > 0 && state.debt > 0) {
    const repay = Math.min(levEarn, state.debt);
    state.debt = Math.round(state.debt - repay);
    state.bullCoins -= repay;
    pushLog('repay', `💸 杠杆持仓盈利优先偿还负债 ${fmt(repay)}🪙`, -repay);
  }

  // 爆仓清零：阀值清仓本身只清"该持仓"、不会结束本局；若清仓后净值 ≤ 0（本金亏完）才结束本局
  if (netWorth() <= 0) {
    state.bullCoins = 0;
    toast('💥 爆仓清零！净值归零，本局结束', 'bad');
    playSfx('error');
    document.body.classList.remove('crash'); void document.body.offsetWidth; document.body.classList.add('crash');
    setTimeout(() => document.body.classList.remove('crash'), 600);
    updateUI();
    endRun('爆仓清零');
    return;
  }
  state.bullCoins = Math.max(0, state.bullCoins);

  // 刷新本局最高净值（排行榜成绩）
  const nw = netWorth();
  if (nw > state.maxNetWorth) state.maxNetWorth = nw;
  if (cycleEarn > 0) state.totalEarned += cycleEarn;

  // 结算通知
  if (Math.abs(cycleEarn) > 0) {
    const earnTxt = cycleEarn > 0 ? '+' + fmt(cycleEarn) : fmt(cycleEarn);
    toast(`${MARKET_EMOJI[mk]} ${MARKET_NAMES[mk]}结算：${earnTxt} 🪙`, cycleEarn > 0 ? 'good' : 'bad');
    if (mk === 'bull' && cycleEarn > 0) {
      playSfx('bull');
      // 牛市结算：背景闪金 + 牛币飘字（#8 反馈动画）
      document.body.classList.remove('bull-flash'); void document.body.offsetWidth; document.body.classList.add('bull-flash');
      setTimeout(() => document.body.classList.remove('bull-flash'), 700);
      const cr = ($('pieCoins') || elBullChar).getBoundingClientRect();
      const pr = elBullChar.parentElement.getBoundingClientRect();
      floatText('+' + fmt(cycleEarn) + ' 🪙', 'gain', cr.left - pr.left + cr.width / 2 - 20, cr.top - pr.top - 6);
    }
    flashChip('pieCoins');
  }
  // 本局流水：记录本周期结算净额（无论盈亏）
  pushLog('settle', `${MARKET_EMOJI[mk]} ${MARKET_NAMES[mk]}结算`, cycleEarn);

  // 成就检测
  if (mk === 'bull' && bullEarn >= 200) unlockAchv('bullKing');
  if (mk === 'bear' && cycleEarn >= 100) unlockAchv('bearKing');
  if (state.bullCoins >= 1000) unlockAchv('rich');
  if (state.cycleCount >= 20) unlockAchv('veteran');
  if (state.cattle >= 10) unlockAchv('cattle10');

  // 许愿消耗
  if (state.wishes.active && mk === 'bull') {
    state.wishes.active = false;
    toast('🌟 许愿加成已消耗', 'info');
  }

  // 清除事件加成
  state.eventBonus = { bonusAll: 0, bonusBull: 0, penaltyLeader: 0 };

  // 切换行情
  rollMarket();
  // 随机事件（30% 几率）
  if (Math.random() < 0.3) triggerEvent();

  save();
  updateStockCards();
  updateUI();
  renderLeverageBar();
  recordSnapshot();
}

function rollMarket() {
  // 如果有强制行情
  if (state.forceNext) {
    state.market = state.forceNext;
    state.forceNext = null;
  } else {
    // 大盘指数随机游走（基数线 = 100）：动量 + 弱均值回归
    const prev = state.indexDelta || 0;
    let delta = prev * 0.5 + (Math.random() * 16 - 8) + (100 - state.marketIndex) * 0.05;
    delta = Math.max(-14, Math.min(14, delta));
    state.indexDelta = delta;
    state.marketIndex = Math.max(50, Math.min(180, state.marketIndex + delta));
    const idx = state.marketIndex;
    // 超过 100% 是牛，低于 100% 是熊，贴近 100 为震荡
    state.market = idx > 103 ? 'bull' : idx < 97 ? 'bear' : 'side';
  }

  // 牛来彩蛋（牛市时 8% 几率）
  if (state.market === 'bull' && Math.random() < 0.08) {
    setTimeout(triggerNiulai, 500);
  }

  maybeOpenWindow();
  // 行情切换后立即按最新周期基准重绘 K 线（高频采样由 klineTick 每 3 秒负责推进）
  drawKline();
  state.cycleStart = Date.now();
}

// 机会窗口：随机出现，限时买入牛股收益 ×3，错过则踏空清零
function maybeOpenWindow() {
  if (state.windowActive) return;
  if (state.windowCount >= WINDOW_MAX_COUNT) return;
  if (state.cycleCount < 3) return; // 前 3 周期不出现，给新手缓冲
  if (Math.random() < WINDOW_PER_CYCLE) {
    state.windowActive = true;
    state.windowJoined = false;
    state.windowDeadline = Date.now() + (WINDOW_MIN + Math.random() * (WINDOW_MAX - WINDOW_MIN));
    state.windowCount++;
    toast('🚀 暴涨窗口开启！限时买入牛股，收益 ×3 且免符保护！', 'event');
    pushLog('window', '🚀 暴涨窗口开启！牛股收益 ×3', null);
  }
}

function triggerEvent() {
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  toast(ev.text, ev.type === 'good' ? 'event' : 'bad');
  let evD = null;

  switch (ev.effect) {
    case 'bonusAll': state.eventBonus.bonusAll = ev.val; break;
    case 'forceBull': state.forceNext = 'bull'; break;
    case 'addLuck': state.bullLuck = Math.min(100, state.bullLuck + ev.val); flashChip('pieLuck'); break;
    case 'bonusBull': state.eventBonus.bonusBull = ev.val; break;
    case 'forceBear': state.forceNext = 'bear'; break;
    case 'loseCoins':
      const loss = Math.floor(state.bullCoins * ev.val);
      state.bullCoins -= loss;
      evD = -loss;
      flashChip('pieCoins');
      break;
    case 'loseLuck': state.bullLuck = Math.max(0, state.bullLuck - ev.val); break;
    case 'penaltyLeader': state.eventBonus.penaltyLeader = ev.val; break;
  }
  pushLog('event', ev.text, evD);
  save();
  updateUI();
}

/* ===== 购买牛牛 ===== */
function buyCattle() {
  const cost = 50 + (state.cattle - 1) * 30; // 递增成本
  if (state.bullCoins < cost) {
    toast(`牛币不足！养第 ${state.cattle + 1} 头需 ${fmt(cost)} 🪙`, 'bad');
    return;
  }
  state.bullCoins -= cost;
  state.cattle += 1;
  toast(`🐄 新牛 +1！现有 ${state.cattle} 头（花费 ${fmt(cost)}🪙）`, 'good');
  pushLog('buy', `🐄 养牛 +1（花费 ${fmt(cost)}🪙）`, -cost);
  flashChip('chipCattle');
  flashChip('pieCoins');
  if (state.cattle >= 10) unlockAchv('cattle10');
  save();
  updateUI();
}

/* ===== 主游戏循环 ===== */
let lastTick = Date.now();
function gameTick() {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // 牛运值自动产出
  let luckRate = state.cattle * 0.3; // 每头牛 0.3/秒
  if (state.dailyLuck) luckRate *= 1.1; // 每日任务 +10%
  if (now < state.boostUntil) luckRate *= 2; // 加速
  state.bullLuck = Math.min(100, state.bullLuck + luckRate * dt);

  // 周期进度条
  const cycleProgress = ((now - state.cycleStart) / CYCLE_TIME) * 100;
  elCycleBar.style.width = Math.min(100, cycleProgress) + '%';

  // 机会窗口关闭检测（踏空则本局清零重来）
  if (state.windowActive && now >= state.windowDeadline) {
    state.windowActive = false;
    if (state.windowJoined) {
      toast('🚀 暴涨窗口结束，你抓住了机会！', 'good');
    } else {
      toast('😱 踏空！错过暴涨窗口，本局收益清零，从头再来！', 'bad');
      playSfx('error');
      updateUI();
      pushLog('end', '😱 踏空！错过暴涨窗口，本局收益清零', null);
      endRun('踏空清零');
      return;
    }
  }

  // 周期结算
  if (state.runActive && now - state.cycleStart >= CYCLE_TIME) {
    settleCycle();
  }

  // 对局结束检测（时间到）
  if (state.runActive && now >= state.runEnd) {
    updateUI();
    endRun('时间到');
    return;
  }

  updateUI();
}

const TICK_INTERVAL = 500; // 性能优化：由 200ms 改为 500ms，滚动仍流畅


/* ===== 面板切换（股市/道具/许愿池/成就，菜单已迁至设置页） ===== */
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = $('panel-' + name);
  if (target) target.classList.add('active');
  if (name === 'items') updateItems();
  if (name === 'achv') renderAchievements();
}
// ===== 视图路由：用 URL hash 记录当前面板，方便后续分享 =====
// 合法视图：stocks(股市) / items(道具) / wish(许愿池) / achv(成就)
const VIEWS = ['stocks', 'items', 'wish', 'achv'];
function applyView(name) {
  if (!VIEWS.includes(name)) name = 'stocks';
  switchPanel(name);
}
function syncViewHash(name) {
  if (VIEWS.includes(name) && ('#' + name) !== location.hash) {
    history.replaceState(null, '', '#' + name); // 仅更新 URL，不新增历史记录
  }
}
// 设置页内的 4 菜单导航：切到对应面板、记录到 URL、关闭设置页
document.querySelectorAll('.set-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.goto;
    applyView(v);
    syncViewHash(v);
    $('settingsModal').classList.remove('show');
  });
});
// 进入页面 / 浏览器前进后退：按 URL hash 恢复对应面板（分享链接直达）
function restoreViewFromHash() {
  const v = location.hash.replace('#', '');
  if (VIEWS.includes(v)) applyView(v);
}
restoreViewFromHash();
window.addEventListener('hashchange', restoreViewFromHash);

/* ===== 设置弹窗 ===== */
$('settingsBtn').addEventListener('click', () => { $('settingsModal').classList.add('show'); });
$('modalCloseBtn').addEventListener('click', () => $('settingsModal').classList.remove('show'));
$('settingsModal').addEventListener('click', (e) => {
  if (e.target === $('settingsModal')) $('settingsModal').classList.remove('show');
});
$('resetBtn').addEventListener('click', () => {
  if (confirm('确定要重置存档吗？本机所有进度（含排行榜、昵称）都将清空且无法恢复！')) {
    localStorage.removeItem('niulai_save');
    localStorage.removeItem('niulai_save_bak');
    localStorage.removeItem(LEADERBOARD_KEY); // 一并清空排行榜，避免重置后榜还在
    try { sessionStorage.setItem('niulai_reset_tip', '1'); } catch(e) {}
    location.reload();
  }
});
// 结束本局（用于主动结算看排行榜）
$('endRunBtn').addEventListener('click', () => {
  $('settingsModal').classList.remove('show');
  if (state.runActive) endRun('手动结束');
});
// 时间控制已集中到头部「⏱ 时间」chip：点击即开始 / 暂停 / 继续 / 重开（见 onRunChipClick）

// 静音开关
function refreshMuteBtn() {
  const b = $('muteBtn');
  if (b) b.textContent = state.muted ? '🔇 音效：关' : '🔊 音效：开';
}
$('muteBtn').addEventListener('click', () => {
  state.muted = !state.muted;
  if (!state.muted) playSfx('click'); // 开启时给个反馈声
  refreshMuteBtn();
  save();
});

// 点击左上角 🐂 直接 +1 头牛；首次点击先弹「养牛说明」
function openCattleModal() { $('cattleModal').classList.add('show'); }
function closeCattleModal() { $('cattleModal').classList.remove('show'); }
const elChipCattle = $('chipCattle');
elChipCattle.addEventListener('click', () => {
  playSfx('click');
  if (!state.cattleInfoShown) { openCattleModal(); return; }
  buyCattle();
});
elChipCattle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elChipCattle.click(); }
});
$('cattleModalOk').addEventListener('click', () => {
  closeCattleModal();
  state.cattleInfoShown = true;
  save();
  buyCattle();
});
$('cattleModal').addEventListener('click', (e) => { if (e.target === $('cattleModal')) closeCattleModal(); });

// 杠杆说明弹窗：点击杠杆栏 ❔ 打开，表格数据来自 config.js 的 LEV_TABLE（与最新规则同步）
function openLeverageModal() { renderLevTable(); $('leverageModal').classList.add('show'); }
function closeLeverageModal() { $('leverageModal').classList.remove('show'); }

/* ===== 牛币饼图 → 历史走势弹窗 ===== */
function openCoinsHistory() { renderCoinsHistory(); $('coinsHistoryModal').classList.add('show'); }
function closeCoinsHistory() { $('coinsHistoryModal').classList.remove('show'); }

/* ===== 头部「⏱ 时间」点击控制（开始 / 暂停 / 继续 / 重开，简化对局时间入口）===== */
function onRunChipClick() {
  if (state.runActive && !state.paused) { pauseRun(); return; }   // 进行中 → 暂停
  if (state.paused) { resumeRun(); return; }                       // 已暂停 → 继续
  if (!state.runIntroShown) { openRunStartModal(); return; }       // 首次进入 → 弹引导
  // 非首次：未开始直接开新局，已结束则重开
  if (state.runReason) restartRun();
  else { startRun(); if (!tickTimer) tickTimer = setInterval(gameTick, TICK_INTERVAL); }
}
function openRunStartModal() { $('runStartModal').classList.add('show'); }
function closeRunStartModal() { $('runStartModal').classList.remove('show'); }
function runStartModalOk() {
  state.runIntroShown = true; save();
  closeRunStartModal();
  if (state.runReason) restartRun();
  else { startRun(); if (!tickTimer) tickTimer = setInterval(gameTick, TICK_INTERVAL); }
}
function renderCoinsHistory() {
  renderLedgerInto('histLedgerBody'); // 本局流水明细（无论有没有走势数据都展示）
  const hist = Array.isArray(state.coinsHist) ? state.coinsHist : [];
  const chart = $('coinsHistChart'), stats = $('coinsHistStats');
  if (!chart || !stats) return;
  if (hist.length < 2) {
    chart.innerHTML = '<div class="hist-empty">📈 本局刚开始，再多玩几个周期就能看到净值走势啦～<br>每个行情周期结算后自动记录一次。</div>';
    stats.innerHTML = '';
    return;
  }
  const W = 320, H = 160, padL = 8, padR = 8, padT = 14, padB = 18;
  const n = hist.length;
  const xs = i => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
  let lo = Infinity, hi = -Infinity;
  hist.forEach(p => { lo = Math.min(lo, p.net, p.coins); hi = Math.max(hi, p.net, p.coins); });
  if (!isFinite(lo) || lo === hi) { lo = (lo || 0) - 10; hi = (hi || 0) + 10; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const ys = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const line = key => hist.map((p, i) => `${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
  const areaNet = `${xs(0).toFixed(1)},${(H - padB).toFixed(1)} ` + hist.map((p, i) => `${xs(i).toFixed(1)},${ys(p.net).toFixed(1)}`).join(' ') + ` ${xs(n - 1).toFixed(1)},${(H - padB).toFixed(1)}`;
  const first = hist[0], last = hist[n - 1];
  const up = last.net >= first.net;
  const netColor = up ? '#e23b3b' : '#1aab4b'; // 红涨绿跌（国内习惯）
  const coinColor = '#3a7bd5';
  const nets = hist.map(p => p.net);
  const maxNet = Math.max(...nets), minNet = Math.min(...nets);
  const ret = ((last.net - first.net) / Math.max(1, first.net)) * 100;
  const retCls = ret >= 0 ? 'gain' : 'loss';
  const retSign = ret >= 0 ? '+' : '';
  stats.innerHTML = `
    <div class="hist-stat"><span>起始净值</span><b>${fmt(first.net)}🪙</b></div>
    <div class="hist-stat"><span>当前净值</span><b>${fmt(last.net)}🪙</b></div>
    <div class="hist-stat"><span>收益率</span><b class="${retCls}">${retSign}${ret.toFixed(1)}%</b></div>
    <div class="hist-stat"><span>最高净值</span><b>${fmt(maxNet)}🪙</b></div>
    <div class="hist-stat"><span>最低净值</span><b>${fmt(minNet)}🪙</b></div>
    <div class="hist-stat"><span>当前牛币</span><b>${fmt(last.coins)}🪙</b></div>`;
  chart.innerHTML = `
    <svg class="hist-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="牛币/净值走势">
      <polygon points="${areaNet}" fill="${netColor}" opacity="0.12"/>
      <polyline points="${line('coins')}" fill="none" stroke="${coinColor}" stroke-width="2" stroke-dasharray="4 3"/>
      <polyline points="${line('net')}" fill="none" stroke="${netColor}" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="${xs(0).toFixed(1)}" cy="${ys(first.net).toFixed(1)}" r="2.6" fill="${netColor}"/>
      <circle cx="${xs(n - 1).toFixed(1)}" cy="${ys(last.net).toFixed(1)}" r="3.2" fill="${netColor}"/>
      <text x="${xs(n - 1).toFixed(1)}" y="${(ys(last.net) - 6).toFixed(1)}" fill="${netColor}" text-anchor="end" class="hist-pt">${fmt(last.net)}</text>
    </svg>
    <div class="hist-legend"><span class="lg-net">■ 净值</span><span class="lg-coin">▢ 牛币现金</span><span class="lg-muted">周期 #${first.c} → #${last.c}</span></div>`;
}
function renderLevTable() {
  const tb = $('levTableBody');
  if (!tb) return;
  tb.innerHTML = LEV_TABLE.map(r => `<tr>
    <td><b>${r.lev}x</b></td>
    <td>${r.total}</td>
    <td>${r.borrow}</td>
    <td>${r.theo}</td>
    <td class="prac">${r.prac}</td>
    <td class="note">${r.note}</td>
  </tr>`).join('');
}
$('leverageModalOk').addEventListener('click', closeLeverageModal);
$('leverageModal').addEventListener('click', (e) => { if (e.target === $('leverageModal')) closeLeverageModal(); });
const levHelpLink = $('levHelpLink');
if (levHelpLink) levHelpLink.addEventListener('click', (e) => { e.preventDefault(); openLeverageModal(); });

// 牛币饼图 → 点击看历史走势 + 本局流水明细
const pieCoinsEl = $('pieCoins');
if (pieCoinsEl) {
  pieCoinsEl.style.cursor = 'pointer';
  pieCoinsEl.setAttribute('title', '点击查看净值走势 + 本局流水明细');
  pieCoinsEl.setAttribute('role', 'button');
  pieCoinsEl.addEventListener('click', openCoinsHistory);
}
// 牛运值饼图 → 点击跳转到许愿池
const pieLuckEl = $('pieLuck');
if (pieLuckEl) {
  pieLuckEl.style.cursor = 'pointer';
  pieLuckEl.setAttribute('title', '点击进入许愿池（消耗牛运值许愿）');
  pieLuckEl.setAttribute('role', 'button');
  pieLuckEl.addEventListener('click', () => { applyView('wish'); syncViewHash('wish'); });
}
const coinsHistoryOk = $('coinsHistoryOk');
if (coinsHistoryOk) coinsHistoryOk.addEventListener('click', closeCoinsHistory);
const coinsHistoryModal = $('coinsHistoryModal');
if (coinsHistoryModal) coinsHistoryModal.addEventListener('click', (e) => { if (e.target === coinsHistoryModal) closeCoinsHistory(); });

// 头部「⏱ 时间」→ 点击开始 / 暂停 / 继续 / 重开
const runChipEl = $('runChip');
if (runChipEl) {
  runChipEl.style.cursor = 'pointer';
  runChipEl.setAttribute('role', 'button');
  runChipEl.addEventListener('click', onRunChipClick);
}
// 头部时间后的「✕」按钮：点击直接重置游戏（重新开始一局）
const runResetBtn = $('runResetBtn');
if (runResetBtn) {
  runResetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restartRun();
  });
}
const runStartModalOkBtn = $('runStartModalOk');
if (runStartModalOkBtn) runStartModalOkBtn.addEventListener('click', runStartModalOk);
const runStartModalEl = $('runStartModal');
if (runStartModalEl) runStartModalEl.addEventListener('click', (e) => { if (e.target === runStartModalEl) closeRunStartModal(); });

// 本局流水账：展开/收起（默认收起，避免遮挡主视图）
const ledgerEl = $('ledger'), ledgerHeadEl = $('ledgerHead'), ledgerToggleEl = $('ledgerToggle');
function toggleLedger() {
  if (!ledgerEl) return;
  const open = ledgerEl.classList.toggle('open');
  if (ledgerToggleEl) ledgerToggleEl.textContent = open ? '收起 ▴' : '展开 ▾';
}
if (ledgerHeadEl) {
  ledgerHeadEl.addEventListener('click', toggleLedger);
  ledgerHeadEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLedger(); } });
}
renderLedger();

// 导出存档
$('exportBtn').addEventListener('click', () => {
  save();
  try {
    const raw = JSON.stringify(state);
    const encoded = btoa(unescape(encodeURIComponent(raw)));
    $('saveData').value = encoded;
    $('saveData').select();
    if (navigator.clipboard) navigator.clipboard.writeText(encoded).catch(() => {});
    toast('已生成存档文本，已复制到剪贴板（也可手动复制）', 'good');
  } catch(e) {
    toast('导出失败：' + e.message, 'bad');
  }
});

// 导入存档
$('importBtn').addEventListener('click', () => {
  const raw = $('saveData').value.trim();
  if (!raw) { toast('请先粘贴存档文本', 'bad'); return; }
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json);
    Object.assign(state, parsed);
    state.cycleStart = Date.now();
    state.eventBonus = { bonusAll: 0, bonusBull: 0, penaltyLeader: 0 };
    state.forceNext = null;
    save();
    renderStocks();
    renderAchievements();
    updateItems();
    updateUI();
    refreshMuteBtn();
    $('settingsModal').classList.remove('show');
    toast('存档导入成功！', 'good');
  } catch(e) {
    toast('导入失败：文本无效', 'bad');
  }
});
refreshMuteBtn();

/* ===== 新手引导 ===== */
const TUT_STEPS = [
  { title: '👆 第一步：攒牛运值', body: '点中间那张 K 线图 📈 每次点击都能抓取行情、获得牛运值。牛运值满 100 可去「许愿池」许愿，下个牛市收益翻倍！' },
  { title: '📈 第二步：开杠杆买股', body: '顶部「大盘 100」是牛熊分界线：>100 牛、<100 熊。杠杆在「股市」顶部切换——股票最高 10x、ETF 基金强制 1x、默认 1x 无杠杆。杠杆=借钱放大仓位：10x 是用 100 本钱控制 1000 仓位，赚亏都按 1000 算；倍数越高容错越小，10x 时个股跌约 9.1% 就爆仓清零。点「买入」连点 3 次买满（单次≈1/3），借的钱要还本金+利息。' },
  { title: '🚀 第三步：抓住机会窗口', body: '行情中会随机弹出「暴涨窗口」，限时几秒，窗口内买入牛股收益 ×3！但若窗口关闭你还没上车，就「踏空」——本局收益清零、从头再来。顶部倒计时归零也会结算冲榜。想听声音？点右上角 ⚙ 开启音效。' },
];
let _tutIdx = 0;
function renderTutStep() {
  const s = TUT_STEPS[_tutIdx];
  $('tutTitle').textContent = s.title;
  $('tutBody').textContent = s.body;
  $('tutStep').textContent = `第 ${_tutIdx + 1} / ${TUT_STEPS.length} 步`;
  $('tutNextBtn').textContent = _tutIdx === TUT_STEPS.length - 1 ? '开始游戏 🚀' : '下一步';
}
function showTutorial() {
  _tutIdx = 0;
  renderTutStep();
  $('tutorialModal').classList.add('show');
}
function finishTutorial() {
  state.tutorialDone = true;
  save();
  $('tutorialModal').classList.remove('show');
}
$('tutNextBtn').addEventListener('click', () => {
  playSfx('click');
  if (_tutIdx < TUT_STEPS.length - 1) { _tutIdx++; renderTutStep(); }
  else { finishTutorial(); }
});
$('tutSkipBtn').addEventListener('click', finishTutorial);

/* ===== 结算页 + 排行榜展示 ===== */
const LB_LIMIT = 100; // 排行榜默认展示前 100 名，超出用「查看跟多」
let currentEntry = null;   // 本局结算条目（高亮 + 昵称回写）
let currentLb = [];        // 本地排行榜（服务端不可用时的回退）
let serverBoard = null;    // 服务端排行榜（PHP+Redis）数据，非 null 表示已联网
let boardShowingAll = false;

function showResult(entry, lb) {
  currentEntry = entry;
  currentLb = lb;
  boardShowingAll = false;
  serverBoard = null;
  const myRank = lb.findIndex(e => e.id === entry.id) + 1;
  $('resultRank').textContent = myRank > 0 ? `本局排名第 ${myRank} 位` : '';
  $('resultScore').textContent = fmt(entry.score) + ' 🪙';
  const reasonText = {
    '时间到': '⏰ 对局时间结束',
    '爆仓清零': '💥 杠杆爆仓，净值归零',
    '踏空清零': '😱 错过暴涨窗口，踏空清零',
    '手动结束': '🏁 主动结算'
  }[entry.reason] || entry.reason;
  $('resultReason').textContent = reasonText;
  $('nickInput').value = entry.name; // 预填昵称，可编辑
  $('lbTitle').textContent = '🏆 牛人排行榜（本机）';
  renderBoard(lb, false);            // 先渲染本地榜，联网后由服务端榜替换
  renderResultLog();                 // 结算先看本局流水
  showResultStage('log');
  $('resultModal').classList.add('show');
}

// 结算弹窗两阶段：'log' = 本局流水回顾（默认）；'board' = 昵称编辑 + 排行榜
function showResultStage(which) {
  const stageLog = $('resultStageLog'), stageBoard = $('resultStageBoard');
  if (!stageLog || !stageBoard) return;
  const showLog = which !== 'board';
  stageLog.style.display = showLog ? 'block' : 'none';
  stageBoard.style.display = showLog ? 'none' : 'block';
  const box = $('resultModal') && $('resultModal').querySelector('.modal-box');
  if (box) box.scrollTop = 0; // 切换阶段回到顶部，避免长流水滚到一半
}
// 渲染结算弹窗里的「本局流水」（统计卡 + 明细）
function renderResultLog() {
  const stats = $('resultLogStats');
  if (stats) stats.innerHTML = ledgerStatsHtml();
  renderLedgerInto('resultLedgerBody');
}

// 渲染排行榜列表：默认前 LB_LIMIT 名；超出且未展开时显示「查看跟多」
// hasMore：服务端已知是否还有更多（用于默认返回满 100 条时仍能正确提示）
function renderBoard(list, showAll, hasMore) {
  const limit = showAll ? list.length : LB_LIMIT;
  const shown = list.slice(0, limit);
  $('lbList').innerHTML = shown.map((e, i) => {
    const t = new Date(e.runStart).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return `<li class="lb-item ${currentEntry && e.id === currentEntry.id ? 'me' : ''}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${escapeHtml(e.name)}</span>
      <span class="lb-score">${fmt(e.score)}🪙</span>
      <span class="lb-time">${t}</span>
    </li>`;
  }).join('');
  const more = (typeof hasMore === 'boolean') ? hasMore : (list.length > limit);
  $('lbMoreBtn').style.display = more ? 'block' : 'none';
  $('lbMoreBtn').textContent = showAll ? '已显示全部' : '查看跟多 ↓';
  $('lbMoreBtn').disabled = !!showAll;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 提交成绩到服务端 PHP+Redis 排行榜（尽力而为，失败不影响本机）
function submitScoreToServer(entry) {
  try {
    fetch('api/submit.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(() => {});
  } catch (e) {}
}

// 从服务端拉取排行榜；all=true 表示「查看跟多」（取全部）
function refreshServerBoard(all) {
  const url = 'api/rank.php' + (all ? '?all=1' : '');
  fetch(url, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (j && j.ok && Array.isArray(j.list) && j.list.length) {
        serverBoard = j.list;
        boardShowingAll = !!all;
        $('lbTitle').textContent = '🏆 牛人排行榜（全网）';
        renderBoard(j.list, !!all, all ? false : !!j.hasMore);
      } else if (all) {
        renderBoard(currentLb, true); // 服务端取全部失败，回退展开本地榜
      }
    })
    .catch(() => { if (all) renderBoard(currentLb, true); });
}

// 结算页「查看跟多」
$('lbMoreBtn').addEventListener('click', () => {
  if (serverBoard) refreshServerBoard(true);
  else renderBoard(currentLb, true);
});

// 结算页修改昵称并保存（回写本地榜 + 持久化 + 重新提交服务端）
// restart=true：显式点击「保存」→ 保存成功后自动关闭弹窗并再来一局
function saveNick(restart) {
  if (!currentEntry) return;
  const v = ($('nickInput').value || '').trim().slice(0, 12) || randomName();
  $('nickInput').value = v;
  state.nickname = v;
  currentEntry.name = v;
  const lb = loadLeaderboard();
  const hit = lb.find(e => e.id === currentEntry.id);
  if (hit) hit.name = v;
  lb.sort((a, b) => b.score - a.score);
  saveLeaderboard(lb);
  currentLb = lb;
  $('lbTitle').textContent = serverBoard ? '🏆 牛人排行榜（全网）' : '🏆 牛人排行榜（本机）';
  if (serverBoard) refreshServerBoard(boardShowingAll); // 保留 hasMore 标记
  else renderBoard(lb, boardShowingAll);
  submitScoreToServer(currentEntry); // 同 runId 覆盖昵称
  save();
  toast('昵称已保存：' + v, 'good');
  // 保存昵称成功 → 自动关闭弹窗并再来一局（仅在显式点击「保存」时触发重开）
  if (restart) {
    $('resultModal').classList.remove('show');
    restartRun();
    toast('🔄 新的一局开始！冲！', 'good');
  }
}
$('nickSaveBtn').addEventListener('click', () => saveNick(true));
$('nickInput').addEventListener('change', () => saveNick(false)); // 实时保存昵称，不自动重开

// 结算弹窗：关闭流水 → 进入昵称编辑 + 排行榜
const resultLogCloseBtn = $('resultLogCloseBtn');
if (resultLogCloseBtn) resultLogCloseBtn.addEventListener('click', () => showResultStage('board'));
// 排行榜阶段：回头再看本局流水
const resultBackLogBtn = $('resultBackLogBtn');
if (resultBackLogBtn) resultBackLogBtn.addEventListener('click', () => { renderResultLog(); showResultStage('log'); });

$('againBtn').addEventListener('click', () => {
  $('resultModal').classList.remove('show');
  restartRun(); // 重置新局并重启主循环（覆盖暂停后无定时器的情况）
  toast('🔄 新的一局开始！冲！', 'good');
});

// 结算弹窗：点击遮罩（弹窗外）的处理
// - 昵称未改动 → 直接关闭弹窗（仅 dismiss，不重开）
// - 昵称有改动/未确认 → 提示确认昵称，确认则保存并关闭，取消则继续编辑
$('resultModal').addEventListener('click', (e) => {
  const overlay = $('resultModal');
  if (e.target !== overlay) return; // 只处理点遮罩本身，点弹窗内部不触发
  const cur = ($('nickInput').value || '').trim();
  const saved = (currentEntry && currentEntry.name) || '';
  if (cur && cur === saved) {
    overlay.classList.remove('show'); // 昵称未改，直接关闭
    return;
  }
  const name = cur || saved || randomName();
  const ok = confirm('确认昵称「' + name + '」？\n点“确定”保存昵称并关闭弹窗；点“取消”继续编辑。');
  if (ok) {
    saveNick(false); // 保存昵称并关闭（不重开）
    overlay.classList.remove('show');
  }
});

/* ===== 初始化 ===== */
function init() {
  applyOfflineProgress(); // 离线收益补发
  // 昵称：首次进入随机生成，之后复用
  if (!state.nickname || !state.nickname.trim()) {
    state.nickname = randomName();
    save();
  }
  // 重置成功提示
  try {
    if (sessionStorage.getItem('niulai_reset_tip')) {
      sessionStorage.removeItem('niulai_reset_tip');
      toast('✅ 存档已重置，开新局吧！', 'good');
    }
  } catch (e) {}
  // 每日登录送牛来符（每天首次进入送 1 张，多渠道获取之一）
  const today = new Date().toDateString();
  if (state.lastDailyFree !== today) {
    state.lastDailyFree = today;
    state.items.talisman++;
    state.talismanTotal++;
    toast('🎁 每日登录赠送 1 张牛来符 🛡️', 'good');
  }
  // 对局制：无活跃局或已过期则开新局
  if (!state.runActive || Date.now() >= state.runEnd) {
    startRun();
  } else {
    // 加载时若处于暂停态：按已暂停时长平移所有绝对时间戳，保持剩余时间精确
    if (state.paused && state.pauseAt) {
      const delta = Date.now() - state.pauseAt;
      state.cycleStart += delta;
      state.runEnd += delta;
      if (state.windowActive && state.windowDeadline) state.windowDeadline += delta;
      if (state.boostUntil) state.boostUntil += delta;
    }
    renderLeverageBar();
  }
  if (!state.tutorialDone) setTimeout(showTutorial, 600);
  // 股票面板事件委托（一次性绑定，节点由 renderStocks 重建但父容器不变）
  if (!elStockGrid.dataset.bound) {
    elStockGrid.dataset.bound = '1';
    elStockGrid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (b) { buyStock(b.dataset.buy); return; }
      const s = e.target.closest('[data-sell]');
      if (s) { sellStock(s.dataset.sell); return; }
    });
  }
  genKline();
  drawKline();
  renderStocks();
  renderAchievements();
  updateItems();
  updateUI();
  refreshRunControls();

  // 窗口resize重新生成K线
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { genKline(); drawKline(); }, 200);
  });

  // 启动游戏循环（暂停时不启动，恢复时由 resumeRun 重建）
  if (!state.paused) {
    tickTimer = setInterval(gameTick, TICK_INTERVAL);
  }

  // 主视觉 K 线：每 3 秒记录一根（暂停 / 未开局时不推进）
  klineTimer = setInterval(klineTick, 3000);

  // 首次提示
  if (state.cycleCount === 0 && state.bullCoins === 100) {
    setTimeout(() => toast('📈 欢迎来到牛来运转！点击 K 线图抓取行情获取牛运值，买入股票开始赚钱吧！', 'info'), 500);
  }
}

init();
