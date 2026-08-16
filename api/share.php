<?php
/**
 * share.php —— 分享事件记录（SQLite）
 *
 * 接口：
 *   POST  ?api=1                {run_id, score, channel, recipient_hint?, note?, poster_format?}
 *                                  → 记一条分享事件，返回 {ok:true, id:<n>}
 *   GET   ?api=1&page=&per=&q=&channel=&from=&to=
 *                                  → 列表（按 created_at DESC，分页+搜索+过滤）
 *   POST  ?api=1&action=clear    清空全部分享记录
 *   POST  ?api=1&action=delete  {id}   删除单条
 *
 * channel 取值：system | qrcode | poster | link | copy | other
 * poster_format：仅 channel=poster 时使用，取值 landscape | portrait | ''
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
niulai_preflight();
niulai_cors();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$action = strtolower(trim(strval($_GET['action'] ?? '')));

/**
 * 分享限流：按 IP、本局 run_id 分别检查「小时 / 天」上限。
 * 返回 null 表示通过；否则返回 'hour' | 'day'。
 */
function niulai_share_rate_hit(PDO $db, string $ip, string $runId): ?string {
    $now  = time();
    $hour = $now - 3600;
    $day  = $now - 86400;
    $limH = max(1, (int)NIULAI_SHARE_LIMIT_HOUR);
    $limD = max($limH, (int)NIULAI_SHARE_LIMIT_DAY);

    $checks = [];
    if ($ip !== '') {
        $checks[] = ['ip_hint = ?', $ip];
    }
    if ($runId !== '') {
        $checks[] = ['run_id = ?', $runId];
    }
    if (!$checks) return null;

    foreach ($checks as [$where, $val]) {
        $st = $db->prepare("SELECT COUNT(*) FROM share_records WHERE $where AND created_at >= ?");
        $st->execute([$val, $hour]);
        if ((int)$st->fetchColumn() >= $limH) return 'hour';
        $st = $db->prepare("SELECT COUNT(*) FROM share_records WHERE $where AND created_at >= ?");
        $st->execute([$val, $day]);
        if ((int)$st->fetchColumn() >= $limD) return 'day';
    }
    return null;
}

$db = niulai_db();

if ($method === 'POST' && $action === '') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) niulai_json(['ok' => false, 'error' => '请求格式不对'], 400);

    $runId = trim(strval($body['run_id'] ?? ''));
    if ($runId === '') niulai_json(['ok' => false, 'error' => '缺少本局信息'], 400);

    $channel = trim(strval($body['channel'] ?? 'other'));
    if (!in_array($channel, ['system', 'qrcode', 'poster', 'link', 'copy', 'other'], true)) {
        $channel = 'other';
    }
    $posterFmt = trim(strval($body['poster_format'] ?? ''));
    if (!in_array($posterFmt, ['landscape', 'portrait', ''], true)) $posterFmt = '';
    $recipient = trim(strval($body['recipient_hint'] ?? ''));
    $note      = trim(strval($body['note'] ?? ''));
    $score     = isset($body['score']) ? floatval($body['score']) : 0;
    $ipHint    = substr(trim(strval($_SERVER['REMOTE_ADDR'] ?? '')), 0, 64);

    $hit = niulai_share_rate_hit($db, $ipHint, $runId);
    if ($hit === 'hour') {
        niulai_json([
            'ok' => false,
            'error' => '分享太频繁，请一小时后再试',
            'rateLimited' => true,
            'limit' => 'hour',
        ], 429);
    }
    if ($hit === 'day') {
        niulai_json([
            'ok' => false,
            'error' => '今日分享次数已用完，明天再来吧',
            'rateLimited' => true,
            'limit' => 'day',
        ], 429);
    }

    $stmt = $db->prepare("INSERT INTO share_records
        (run_id, score, channel, poster_format, recipient_hint, note, ip_hint, created_at)
        VALUES (?,?,?,?,?,?,?,?)");
    $stmt->execute([$runId, $score, $channel, $posterFmt, $recipient, $note, $ipHint, time()]);
    niulai_json(['ok' => true, 'id' => (int)$db->lastInsertId()]);
}

if ($method === 'POST' && $action === 'clear') {
    $db->exec("DELETE FROM share_records");
    niulai_json(['ok' => true, 'total' => 0]);
}

if ($method === 'POST' && $action === 'delete') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id = intval($body['id'] ?? 0);
    if ($id <= 0) niulai_json(['ok' => false, 'error' => '缺少 id'], 400);
    $db->prepare("DELETE FROM share_records WHERE id = ?")->execute([$id]);
    niulai_json(['ok' => true, 'total' => (int)$db->query("SELECT COUNT(*) FROM share_records")->fetchColumn()]);
}

if ($method === 'GET') {
    $page = max(1, intval($_GET['page'] ?? 1));
    $per  = min(200, max(1, intval($_GET['per']  ?? 20)));
    $q    = trim(strval($_GET['q'] ?? ''));
    $channel = trim(strval($_GET['channel'] ?? ''));

    $where = ' WHERE 1=1 ';
    $p = [];
    if ($q !== '') { $where .= ' AND (run_id LIKE ? OR recipient_hint LIKE ? OR note LIKE ?) '; $p[] = "%$q%"; $p[] = "%$q%"; $p[] = "%$q%"; }
    if ($channel !== '') { $where .= ' AND channel = ? '; $p[] = $channel; }
    if (isset($_GET['from']) && $_GET['from'] !== '') { $where .= ' AND created_at >= ? '; $p[] = intval($_GET['from']); }
    if (isset($_GET['to'])   && $_GET['to']   !== '') { $where .= ' AND created_at <= ? '; $p[] = intval($_GET['to']); }

    $cnt = $db->prepare("SELECT COUNT(*) FROM share_records $where");
    $cnt->execute($p);
    $total = (int)$cnt->fetchColumn();
    $pages = $per > 0 ? (int)ceil($total / $per) : 1;
    $offset = ($page - 1) * $per;

    $sql = "SELECT id, run_id, score, channel, poster_format AS posterFormat,
                   recipient_hint AS recipientHint, note, ip_hint AS ipHint, created_at AS createdAt
            FROM share_records $where ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
    $st = $db->prepare($sql);
    $i = 1;
    foreach ($p as $v) { $st->bindValue($i++, $v); }
    $st->bindValue($i++, $per, PDO::PARAM_INT);
    $st->bindValue($i++, $offset, PDO::PARAM_INT);
    $st->execute();
    $rows = array_map(function ($r) {
        $r['score']     = floatval($r['score']);
        $r['createdAt'] = intval($r['createdAt']);
        $r['id']        = intval($r['id']);
        return $r;
    }, $st->fetchAll());

    // 按 channel 聚合统计（便于后台看板）
    $stats = $db->query("SELECT channel, COUNT(*) AS n FROM share_records GROUP BY channel")->fetchAll();
    $byCh = ['system'=>0,'qrcode'=>0,'poster'=>0,'link'=>0,'copy'=>0,'other'=>0];
    foreach ($stats as $s) { $byCh[$s['channel']] = (int)$s['n']; }

    niulai_json([
        'ok'      => true,
        'list'    => $rows,
        'total'   => $total,
        'page'    => $page,
        'per'     => $per,
        'pages'   => $pages,
        'hasMore' => $page < $pages,
        'byChannel' => $byCh,
    ]);
}

niulai_json(['ok' => false, 'error' => '不支持的方法或动作'], 405);