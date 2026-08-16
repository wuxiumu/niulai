export const CYCLE_TIME = 15000; // 15秒一个行情周期

// ===== 对局制 / 杠杆 / 窗口 配置 =====
export const RUN_DURATION = 10 * 60 * 1000; // 一局 10 分钟
export const LEADERBOARD_KEY = 'niulai_leaderboard';
// 杠杆档位：数值 = 持仓总资金 / 自有本金（标准定义）。1 倍=无杠杆（仓位=自有）；
// 2 / 3 / 5 / 10 倍 = 借 (L-1) 倍本金、仓位放大为 L 倍。
export const LEVERAGES = [2, 3, 5, 10];
// ===== 杠杆模型（标准定义，2026-08-17 同步最新规则）=====
//  · 无杠杆(L=1)：正常买卖，无强平，可长拿穿越牛熊。
//  · L 倍：借 (L-1) 倍本金、仓位变为 L 倍；每个行情周期若该股票"单周期涨跌幅度"≥ 实操强平线，
//    直接强制清仓该持仓（不论牛市/熊市、不论涨/跌，达到即清）。
//  · 理论临界爆仓跌幅 = 1/L（本金归零点位，腰斩才归零=最稳）；实操强平线 = 平台一般提前平仓的位置（见 LEV_PRACTICAL）。
//  · 清仓后若净值 ≤ 0（本金亏完）→ 本局结束（爆仓清零）。
export const LEV_THEORETICAL = l => 1 / l; // 理论临界爆仓跌幅（本金归零点位）
export const LEV_PRACTICAL = l => ({ 2: 0.42, 3: 0.275, 5: 0.165, 10: 0.085 }[l] ?? 1 / l); // 实操平台强平线（提前平仓触发点）
// 杠杆说明弹窗表格数据（自有资金固定示例：1 万元）
export const LEV_TABLE = [
  { lev: 2,  own: '10000', total: '20000',  borrow: '10000',  theo: '50.00%',  prac: '40～45', note: '标的腰斩才会亏光本金，容错最高' },
  { lev: 3,  own: '10000', total: '30000',  borrow: '20000',  theo: '33.33%',  prac: '25～30', note: '回撤三成左右就面临爆仓风险' },
  { lev: 5,  own: '10000', total: '50000',  borrow: '40000',  theo: '20.00%',  prac: '15～18', note: '连续大跌两三个交易日，极易被平仓' },
  { lev: 10, own: '10000', total: '100000', borrow: '90000',  theo: '10.00%',  prac: '8～9%',   note: '个股一个跌停，本金直接清零' },
];
// ===== 万亿彩蛋 =====
// 净值突破 1 万亿牛币 → 触发「万亿牛神」彩蛋（每局首次放全屏特效，生涯首次额外解锁成就）
export const TRILLION = 1e12;
export const WINDOW_MIN = 8000, WINDOW_MAX = 12000; // 机会窗口持续 8~12 秒
export const WINDOW_PER_CYCLE = 0.2;  // 每个周期后开启窗口的概率
export const WINDOW_MAX_COUNT = 2;     // 每局最多出现窗口次数
export const SAVE_VERSION = 1;         // 存档版本号：升级数据结构时 +1，load 做迁移兼容
