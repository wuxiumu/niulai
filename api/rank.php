<?php
/**
 * rank.php —— 读取排行榜（Redis 版）
 *
 * GET 参数：
 *  - all=1 ：返回当前容量的全部（用于「查看跟多」），等价于 page=1&per=1000
 *  - page=N：页码（1 起，默认 1）
 *  - per =N：每页条数（默认 20，最大 NIULAI_KEEP）
 *  - q=xxx ：按昵称模糊搜索（命中后按分数 DESC 排序）
 *  - info=1：附带自己的条目详情（参数 ?info=1&id=runId，仅在已存在时返回）
 *
 * 返回 JSON：
 *   { ok, list:[{id,name,score,reason,date,runStart,runEnd}], total, page, per, pages, hasMore, all, mine }
 *   - hasMore：当前是否还有下一页
 *   - mine   ：info=1 时附带的本机条目
 *
 * 字段形状与原 SQLite 版完全一致。
 *
 * 首次启动空榜时，灌一份 14 条示例数据并写 sentinel：niulai:seed:done=1，
 * 后续 admin 的「清空全部排行榜」必须同时删除 sentinel 才不会复活示例。
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
niulai_preflight();
niulai_cors();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    niulai_json(['ok' => false, 'error' => '仅支持 GET'], 405);
}

$r = niulai_redis();
if ($r === null) {
    niulai_json(['ok' => false, 'error' => 'Redis 不可用'], 503);
}

/* ---------- 首次 lazy seed ---------- */
function niulai_seed_if_empty($r) {
    $sentinel = 'niulai:seed:done';
    if ($r->exists($sentinel)) return;
    if ((int)$r->zCard(NIULAI_ZSET) > 0) { $r->set($sentinel, '1'); return; }

    $now = time();
    $demo = [
        ['seed_01', '牛魔王',     58820, '牛市封神',  'Y/m/d', $now-9000, $now-1200],
        ['seed_02', '华尔街之牛', 42150, '牛市封神',  '',      $now-8000, $now-1000],
        ['seed_03', '杠杆狂人',   38900, '杠杆爆仓',  '',      $now-7000, $now-900],
        ['seed_04', '复利信徒',   31200, '主动收手',  '',      $now-6000, $now-800],
        ['seed_05', '佛系养牛',   27500, '时间到',    '',      $now-5000, $now-700],
        ['seed_06', '熊市猎手',   24900, '熊市退场',  '',      $now-4500, $now-600],
        ['seed_07', '小富即安',   19800, '主动收手',  '',      $now-4000, $now-500],
        ['seed_08', '摸鱼玩家',   15400, '牛币耗尽',  '',      $now-3500, $now-400],
        ['seed_09', '韭菜自救',   12600, '杠杆爆仓',  '',      $now-3000, $now-300],
        ['seed_10', '稳健老牛',   10300, '时间到',    '',      $now-2500, $now-200],
        ['seed_11', '追涨杀跌',    8700, '熊市退场',  '',      $now-2000, $now-150],
        ['seed_12', '新手村长',    6500, '牛币耗尽',  '',      $now-1500, $now-100],
        ['seed_13', '运气牛牛',    4200, '主动收手',  '',      $now-1000, $now-60],
        ['seed_14', '试试水',      2100, '时间到',    '',      $now-500,  $now-30],
    ];
    foreach ($demo as $i => $d) {
        $rid  = $d[0]; $name = $d[1]; $score = $d[2]; $reason = $d[3];
        $date = $d[4] !== '' ? $d[4] : date('Y/m/d', $now - 86400 * (9 - $i));
        $rs   = $d[5]; $re = $d[6];
        $r->hMSet(NIULAI_HASH . $rid, [
            'name' => $name, 'score' => $score, 'reason' => $reason,
            'date' => $date, 'runStart' => $rs, 'runEnd' => $re,
            'createdAt' => $now - (1000 * (9 - $i)),
        ]);
        $r->zAdd(NIULAI_ZSET, $score, $rid);
    }
    $r->set($sentinel, '1');
}
niulai_seed_if_empty($r);

/* ---------- 参数 ---------- */
$all  = isset($_GET['all'])  && $_GET['all']  == '1';
$page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$per  = isset($_GET['per'])  ? min(NIULAI_KEEP, max(1, intval($_GET['per']))) : 20;
$q    = isset($_GET['q'])    ? trim(strval($_GET['q'])) : '';
$info = (isset($_GET['info']) && $_GET['info'] == '1');
$mine = null;

if ($all) { $per = NIULAI_KEEP; $page = 1; }

/* ---------- 搜索时改为「全量 + 过滤」 ---------- */
if ($q !== '') {
    $need = $all ? NIULAI_KEEP : ($page * $per);
    // 拉全量（最多 KEEP）然后按 q 过滤
    $allIds = $r->zRevRange(NIULAI_ZSET, 0, NIULAI_KEEP - 1);
    if (!is_array($allIds) || count($allIds) === 0) {
        niulai_json(['ok' => true, 'list' => [], 'total' => 0, 'page' => 1, 'per' => $per, 'pages' => 0, 'hasMore' => false, 'all' => $all, 'mine' => null]);
    }
    $rows = [];
    foreach ($allIds as $rid) {
        $h = $r->hGetAll(NIULAI_HASH . $rid);
        if (!is_array($h) || empty($h)) continue;
        if (mb_strpos($h['name'] ?? '', $q) === false) continue;
        $rows[] = [
            'id'    => $rid,
            'name'  => $h['name']  ?? '牛人',
            'score' => floatval($h['score'] ?? 0),
            'reason'=> $h['reason'] ?? '',
            'date'  => $h['date']  ?? '',
            'runStart' => intval($h['runStart'] ?? 0),
            'runEnd'   => intval($h['runEnd']   ?? 0),
        ];
    }
    $total = count($rows);
    $pages = $per > 0 ? (int)ceil($total / $per) : 1;
    $offset = ($page - 1) * $per;
    $list = array_slice($rows, $offset, $per);

    if ($info && isset($_GET['id'])) {
        $mineId = strval($_GET['id']);
        $m = $r->hGetAll(NIULAI_HASH . $mineId);
        if (is_array($m) && !empty($m)) {
            $mine = [
                'id'    => $mineId,
                'name'  => $m['name'] ?? '牛人',
                'score' => floatval($m['score'] ?? 0),
                'reason'=> $m['reason'] ?? '',
                'date'  => $m['date']  ?? '',
                'runStart' => intval($m['runStart'] ?? 0),
                'runEnd'   => intval($m['runEnd']   ?? 0),
            ];
        }
    }
    niulai_json([
        'ok'      => true,
        'list'    => $list,
        'total'   => $total,
        'page'    => $page,
        'per'     => $per,
        'pages'   => $pages,
        'hasMore' => !$all && $page < $pages,
        'all'     => $all,
        'mine'    => $mine,
    ]);
}

/* ---------- 列表 + 分页（按分数 DESC） ---------- */
$start = ($page - 1) * $per;
$stop  = $start + $per - 1;
$ids   = $r->zRevRange(NIULAI_ZSET, $start, $stop);
if (!is_array($ids)) $ids = [];
$total = (int)$r->zCard(NIULAI_ZSET);
$pages = $per > 0 ? (int)ceil($total / $per) : 1;

$list = [];
foreach ($ids as $rid) {
    $h = $r->hGetAll(NIULAI_HASH . $rid);
    if (!is_array($h) || empty($h)) continue;
    $list[] = [
        'id'    => $rid,
        'name'  => $h['name']  ?? '牛人',
        'score' => floatval($h['score'] ?? 0),
        'reason'=> $h['reason'] ?? '',
        'date'  => $h['date']  ?? '',
        'runStart' => intval($h['runStart'] ?? 0),
        'runEnd'   => intval($h['runEnd']   ?? 0),
    ];
}

if ($info && isset($_GET['id'])) {
    $mineId = strval($_GET['id']);
    $m = $r->hGetAll(NIULAI_HASH . $mineId);
    if (is_array($m) && !empty($m)) {
        $mine = [
            'id'    => $mineId,
            'name'  => $m['name'] ?? '牛人',
            'score' => floatval($m['score'] ?? 0),
            'reason'=> $m['reason'] ?? '',
            'date'  => $m['date']  ?? '',
            'runStart' => intval($m['runStart'] ?? 0),
            'runEnd'   => intval($m['runEnd']   ?? 0),
        ];
    }
}

niulai_json([
    'ok'      => true,
    'list'    => $list,
    'total'   => $total,
    'page'    => $page,
    'per'     => $per,
    'pages'   => $pages,
    'hasMore' => !$all && $page < $pages,
    'all'     => $all,
    'mine'    => $mine,
]);
