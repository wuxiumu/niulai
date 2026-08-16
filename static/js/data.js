/* ===== 游戏数据定义 ===== */
export const STOCK_DEFS = [
  { id: 'bull',   name: '牛股',     icon: '🐂', type: 'bull',   cost: 50,  desc: '牛市猛涨，熊市暴跌。高风险高回报。',         bull: 60,  bear: -15, side: 10 },
  { id: 'leader', name: '龙头股',   icon: '🐉', type: 'bull',   cost: 150, desc: '牛市翻倍猛兽，熊市跌幅更大。豪赌首选。',     bull: 120, bear: -30, side: 20 },
  { id: 'etf',    name: 'ETF基金',  icon: '📊', type: 'etf',    cost: 80,  desc: '稳健派。牛熊通吃，长期持有不亏心。',         bull: 24,  bear: 6,   side: 12 },
  { id: 'bear',   name: '熊股',     icon: '🐻', type: 'bear',   cost: 50,  desc: '逆势英雄。熊市大涨，牛市微赚。防守利器。',   bull: 3,   bear: 30,  side: 8  },
  { id: 'policy', name: '政策利好', icon: '📜', type: 'policy', cost: 30,  desc: '即时生效！买入立刻 +50 牛币，一次性消耗。', bull: 50,  bear: 50,  side: 50, instant: true },
];

export const ACHV_DEFS = [
  { id: 'firstBuy',    name: '初入股海',   icon: '🎯', desc: '购买第一支股票' },
  { id: 'bullKing',    name: '牛气冲天',   icon: '🚀', desc: '单个牛市周期赚取 200+ 牛币' },
  { id: 'bearSurvive', name: '熊市不倒',   icon: '🛡️', desc: '用牛来符抵御熊市亏损', reward: { talisman: 1 } },
  { id: 'niulai',      name: '牛来运转',   icon: '✨', desc: '触发牛来彩蛋', reward: { talisman: 1 } },
  { id: 'cattle10',    name: '养牛大户',   icon: '🐄', desc: '拥有 10 头牛' },
  { id: 'allStocks',   name: '股市达人',   icon: '💼', desc: '同时持仓全部 4 种股票' },
  { id: 'wish3',       name: '许愿成真',   icon: '🌟', desc: '许愿成功 3 次' },
  { id: 'rich',        name: '百万牛翁',   icon: '💰', desc: '累计拥有 1000 牛币' },
  { id: 'veteran',     name: '老司机',     icon: '🎩', desc: '经历 20 次行情周期' },
  { id: 'bearKing',    name: '做空大师',   icon: '🐻', desc: '熊市单周期净赚 100+ 牛币' },
  { id: 'trillion',    name: '万亿牛神',   icon: '🌌', desc: '净值突破 1 万亿牛币（隐藏彩蛋）', reward: { talisman: 3 } },
];

export const EVENTS = [
  { text: '政策利好：印花税下调！所有股票本期收益 +50%', type: 'good', effect: 'bonusAll', val: 0.5 },
  { text: '外资大举入场！下期必定牛市', type: 'good', effect: 'forceBull' },
  { text: '牛年大吉！牛运值 +30', type: 'good', effect: 'addLuck', val: 30 },
  { text: '散户团结就是力量！牛股收益 +20', type: 'good', effect: 'bonusBull', val: 20 },
  { text: '黑天鹅：熊出没！强制进入熊市', type: 'bad', effect: 'forceBear' },
  { text: '监管风暴来袭！损失 10% 牛币', type: 'bad', effect: 'loseCoins', val: 0.1 },
  { text: '市场恐慌！牛运值 -20', type: 'bad', effect: 'loseLuck', val: 20 },
  { text: '机构砸盘！龙头股本期收益减半', type: 'bad', effect: 'penaltyLeader', val: 0.5 },
];

export const MARKET_NAMES = { bull: '牛市', bear: '熊市', side: '震荡市' };
export const MARKET_EMOJI = { bull: '🐂', bear: '🐻', side: '😐' };
