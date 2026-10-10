<?php
/**
 * submit.php —— 提交一局成绩到排行榜（Redis 版）
 * 接收 POST JSON：{ id, name, score, reason, date, runStart, runEnd }
 *  - id    : 本局唯一标识（runId），用于去重/覆盖
 *  - name  : 昵称（≤12 字）
 *  - score : 本局最高净值（> 0）
 *
 * 存储设计：
 *   - ZSET    niulai:leaderboard   score=净值, member=runId（用于排序/分页）
 *   - HASH    niulai:entry:<runId> {name, score, reason, date, runStart, runEnd, createdAt}
 *   - 上限 KEEP 条；超出 ZREMRANGEBYRANK 自动裁剪
 *
 * 同 id 重复提交会覆盖昵称与分数（ZADD GT 仅在 score 更小时更新、HMSET 全量刷详情）。
 * 与原 SQLite 版契约完全一致，niulai.js 无需修改即可对接。
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';        // 引入仅是为了保留 niulai_json() 统一格式
niulai_preflight();
niulai_cors();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    niulai_json(['ok' => false, 'error' => '仅支持 POST'], 405);
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    niulai_json(['ok' => false, 'error' => '请求格式不对'], 400);
}

$id       = trim(strval($payload['id'] ?? ''));
$name     = trim(strval($payload['name'] ?? ''));
$score    = isset($payload['score']) ? floatval($payload['score']) : 0;
$reason   = trim(strval($payload['reason'] ?? ''));
$date     = trim(strval($payload['date'] ?? date('Y/m/d')));
$runStart = isset($payload['runStart']) ? intval($payload['runStart']) : 0;
$runEnd   = isset($payload['runEnd'])   ? intval($payload['runEnd'])   : 0;

if ($score <= 0) {
    niulai_json(['ok' => false, 'error' => '分数无效'], 400);
}
if ($id === '') {
    $id = 'run_' . bin2hex(random_bytes(8)) . '_' . time();
}
if ($name === '') {
    $name = '牛人' . rand(1000, 9999);
}
if (mb_strlen($name, 'UTF-8') > 12) {
    $name = mb_substr($name, 0, 12, 'UTF-8');
}
if ($date === '') {
    $date = date('Y/m/d');
}

$r = niulai_redis();
if ($r === null) {
    niulai_json(['ok' => false, 'error' => '排行榜暂时不可用'], 503);
}

try {
    // 详情 HASH（覆盖式）
    $hashKey = NIULAI_HASH . $id;
    $r->hMSet($hashKey, [
        'name'       => $name,
        'score'      => $score,
        'reason'     => $reason,
        'date'       => $date,
        'runStart'   => $runStart,
        'runEnd'     => $runEnd,
        'createdAt'  => time(),
    ]);

    // ZSET（GT：仅在更大时更新排名；保留旧最高分避免管理员"冲分"）
    $r->zAdd(NIULAI_ZSET, ['GT' => true], $score, $id);

    // 维护上限：超出 KEEP 名次的，全部移除
    $size = (int)$r->zCard(NIULAI_ZSET);
    if ($size > NIULAI_KEEP) {
        $r->zRemRangeByRank(NIULAI_ZSET, 0, $size - NIULAI_KEEP - 1);
        // 顺手清理被裁剪的 HASH（按 runId 删除）：从 0..size-1 拿全名单，差集裁剪出来的孤儿
        $kept = $r->zRange(NIULAI_ZSET, 0, -1);
        if (is_array($kept)) {
            // 用游标扫所有 niulai:entry:* 太重，改成：拿到所有当前 HASH key，删除不在 kept 中的
            $iter = null;
            $pattern = NIULAI_HASH . '*';
            $r->setOption(Redis::OPT_SCAN, Redis::SCAN_RETRY);
            while ($keys = $r->scan($iter, $pattern, 200)) {
                foreach ($keys as $k) {
                    $rid = substr($k, strlen(NIULAI_HASH));
                    if (!in_array($rid, $kept, true)) {
                        $r->del($k);
                    }
                }
            }
        }
    }

    // 排名（0 起点 → +1）
    $rank = $r->zRevRank(NIULAI_ZSET, $id);
    niulai_json(['ok' => true, 'runId' => $id, 'rank' => $rank === false ? null : ($rank + 1)]);
} catch (Exception $e) {
    niulai_json(['ok' => false, 'error' => '保存失败，请稍后再试'], 500);
}
