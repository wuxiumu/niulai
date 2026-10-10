<?php
/**
 * pk.php —— 分享后好友 PK 邀请（SQLite）
 *
 * 数据来源：pk_invites 表（见 api/db.php）。
 * 游戏结算页可发起（create）；好友经 leaderboard.html?pk=CODE 进入游戏应战，
 * 局终自动 accept 回写比分（见 niulai.js · M05）。
 * 主要动作：
 *   POST ?api=1&action=create     {run_id, name, score, challenge?}
 *                                     → 创建邀请，返回 {code, url, qrimg, createdAt}
 *   GET  ?api=1&action=resolve&code=XXXXXX
 *                                     → 拉取发起方成绩；用于被邀请方进入时显示
 *   POST ?api=1&action=accept     {code, run_id, name, score}
 *                                     → 被邀请方跑完一局后回写成绩并标记 accepted
 *   GET  ?api=1&action=list&page=&per=&status=
 *                                     → 列表（admin 用）
 *   POST ?api=1&action=clear                                    清空全部邀请（admin）
 *
 * 字段形状与前端约定：
 *   { code, challenger:{runId,name,score,challenge},
 *     recipient?:{runId,name,score}, status, createdAt, acceptedAt }
 *
 * 短码规则：6 位，去 0/O/1/I/L 等歧义字符（见 niulai_gen_pk_code）。
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
niulai_preflight();
niulai_cors();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$action = strtolower(trim(strval($_GET['action'] ?? '')));
$db = niulai_db();

/** 把一行 pk_invites 还原为前端约定形状 */
function niulai_pk_row(array $r): array {
    $status = $r['status'] ?? 'pending';
    $chScore = floatval($r['challenger_score'] ?? 0);
    $rcScore = floatval($r['recipient_score'] ?? 0);
    $hasRecipient = !empty($r['recipient_run_id']);
    $winner = null;
    if ($status === 'accepted' && $hasRecipient) {
        if ($rcScore > $chScore) $winner = 'recipient';
        elseif ($chScore > $rcScore) $winner = 'challenger';
        else $winner = 'draw';
    }
    return [
        'code'      => $r['code'],
        'status'    => $status,
        'challenge' => $r['challenge'] ?? '',
        'createdAt' => intval($r['created_at'] ?? 0),
        'acceptedAt'=> intval($r['accepted_at'] ?? 0),
        'winner'    => $winner,
        'challenger'=> [
            'runId' => $r['challenger_run_id'] ?? '',
            'name'  => $r['challenger_name']   ?? '',
            'score' => $chScore,
        ],
        'recipient' => !$hasRecipient ? null : [
            'runId' => $r['recipient_run_id'] ?? '',
            'name'  => $r['recipient_name']   ?? '',
            'score' => $rcScore,
        ],
    ];
}

/** 结果页绝对 URL */
function niulai_pk_result_url(string $code): string {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
    $base   = dirname(dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($base === '/' || $base === '\\' || $base === '.') $base = '';
    return $scheme . '://' . $host . $base . '/pk-result.html?pk=' . rawurlencode($code);
}

if ($method === 'POST' && $action === 'create') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) niulai_json(['ok' => false, 'error' => '请求格式不对'], 400);
    $runId = trim(strval($body['run_id'] ?? ''));
    $name  = trim(strval($body['name']   ?? '牛人'));
    $score = isset($body['score']) ? floatval($body['score']) : 0;
    $ch    = trim(strval($body['challenge'] ?? ''));
    if ($runId === '') niulai_json(['ok' => false, 'error' => '缺少本局信息'], 400);
    if ($score <= 0)  niulai_json(['ok' => false, 'error' => '分数必须大于 0'], 400);
    if (mb_strlen($name, 'UTF-8') > 12) $name = mb_substr($name, 0, 12, 'UTF-8');

    $code = niulai_gen_pk_code($db);
    $now  = time();
    $db->prepare("INSERT INTO pk_invites
        (code, challenger_run_id, challenger_name, challenger_score, status, challenge, created_at)
        VALUES (?,?,?,?,?,?,?)")
        ->execute([$code, $runId, $name, $score, 'pending', $ch, $now]);

    // url 拼装：以当前请求的 origin 为准
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
    $base   = dirname(dirname($_SERVER['SCRIPT_NAME']));     // /api → 站点根
    if ($base === '/' || $base === '\\' || $base === '.') $base = '';
    $url = $scheme . '://' . $host . $base . '/leaderboard.html?pk=' . $code;

    niulai_json([
        'ok'        => true,
        'code'      => $code,
        'url'       => $url,
        'resultUrl' => niulai_pk_result_url($code),
        'qrimg'     => $url,                                   // 前端用 qrcodejs 直接编码 url
        'createdAt' => $now,
    ]);
}

if ($method === 'GET' && $action === 'resolve') {
    $code = strtoupper(trim(strval($_GET['code'] ?? '')));
    if (!preg_match('/^[A-Z0-9]{6,12}$/', $code)) {
        niulai_json(['ok' => false, 'error' => '邀请码格式不对'], 400);
    }
    $st = $db->prepare("SELECT * FROM pk_invites WHERE code = ? LIMIT 1");
    $st->execute([$code]);
    $row = $st->fetch();
    if (!$row) niulai_json(['ok' => false, 'error' => '邀请码不存在'], 404);

    // 已过期（>30 天 pending）
    if ($row['status'] === 'pending' && time() - intval($row['created_at']) > 86400 * 30) {
        $db->prepare("UPDATE pk_invites SET status='expired' WHERE code=?")->execute([$code]);
        $row['status'] = 'expired';
    }
    niulai_json(['ok' => true, 'pk' => niulai_pk_row($row)]);
}

if ($method === 'POST' && $action === 'accept') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) niulai_json(['ok' => false, 'error' => '请求格式不对'], 400);
    $code = strtoupper(trim(strval($body['code'] ?? '')));
    $runId = trim(strval($body['run_id'] ?? ''));
    $name  = trim(strval($body['name']   ?? '牛人'));
    $score = isset($body['score']) ? floatval($body['score']) : 0;
    if (!preg_match('/^[A-Z0-9]{6,12}$/', $code)) niulai_json(['ok' => false, 'error' => '邀请码格式不对'], 400);
    if ($runId === '') niulai_json(['ok' => false, 'error' => '缺少本局信息'], 400);
    if ($score <= 0)  niulai_json(['ok' => false, 'error' => '分数必须大于 0'], 400);

    $row = $db->prepare("SELECT * FROM pk_invites WHERE code=? LIMIT 1");
    $row->execute([$code]);
    $r = $row->fetch();
    if (!$r) niulai_json(['ok' => false, 'error' => '邀请码不存在'], 404);
    if ($r['status'] === 'expired') niulai_json(['ok' => false, 'error' => '邀请已过期'], 410);
    if ($r['challenger_run_id'] === $runId) niulai_json(['ok' => false, 'error' => '不能跟自己 PK'], 400);

    if (mb_strlen($name, 'UTF-8') > 12) $name = mb_substr($name, 0, 12, 'UTF-8');
    $db->prepare("UPDATE pk_invites
        SET recipient_run_id=?, recipient_name=?, recipient_score=?, status='accepted', accepted_at=?
        WHERE code=?")
        ->execute([$runId, $name, $score, time(), $code]);
    // 重新拉一次回给前端
    $st3 = $db->prepare("SELECT * FROM pk_invites WHERE code=?");
    $st3->execute([$code]);
    $row2 = $st3->fetch();
    $pk = niulai_pk_row($row2);
    niulai_json([
        'ok' => true,
        'pk' => $pk,
        'resultUrl' => niulai_pk_result_url($code),
    ]);
}

if ($method === 'POST' && $action === 'delete') {
    $body = json_decode(file_get_contents('php://input'), true);
    $code = strtoupper(trim(strval($body['code'] ?? '')));
    if (!preg_match('/^[A-Z0-9]{6,12}$/', $code)) niulai_json(['ok' => false, 'error' => '邀请码格式不对'], 400);
    $db->prepare("DELETE FROM pk_invites WHERE code = ?")->execute([$code]);
    niulai_json(['ok' => true, 'total' => (int)$db->query("SELECT COUNT(*) FROM pk_invites")->fetchColumn()]);
}

if ($method === 'GET' && $action === 'list') {
    $page = max(1, intval($_GET['page'] ?? 1));
    $per  = min(200, max(1, intval($_GET['per']  ?? 20)));
    $status = trim(strval($_GET['status'] ?? ''));
    $where = ' WHERE 1=1 '; $p = [];
    if (in_array($status, ['pending','accepted','expired'], true)) { $where .= ' AND status = ? '; $p[] = $status; }
    $cnt = $db->prepare("SELECT COUNT(*) FROM pk_invites $where");
    $cnt->execute($p);
    $total = (int)$cnt->fetchColumn();
    $pages = $per > 0 ? (int)ceil($total / $per) : 1;
    $offset = ($page - 1) * $per;

    $st = $db->prepare("SELECT * FROM pk_invites $where ORDER BY created_at DESC, code ASC LIMIT ? OFFSET ?");
    $i = 1;
    foreach ($p as $v) { $st->bindValue($i++, $v); }
    $st->bindValue($i++, $per, PDO::PARAM_INT);
    $st->bindValue($i++, $offset, PDO::PARAM_INT);
    $st->execute();
    $list = array_map('niulai_pk_row', $st->fetchAll());

    niulai_json(['ok' => true, 'list' => $list, 'total' => $total, 'page' => $page, 'per' => $per, 'pages' => $pages, 'hasMore' => $page < $pages]);
}

if ($method === 'POST' && $action === 'clear') {
    $db->exec("DELETE FROM pk_invites");
    niulai_json(['ok' => true, 'total' => 0]);
}

niulai_json(['ok' => false, 'error' => '不支持的方法或动作'], 405);