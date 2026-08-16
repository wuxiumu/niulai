<?php
/**
 * api/admin.php —— 牛来运转·管理后台（纯 JSON 数据接口）
 *
 * 前后端分离：本文件只输出 JSON，不再内嵌 HTML 界面。
 * 管理后台界面请访问 /admin/index.html（静态前端，调用本接口）。
 *
 * 三个 tab（数据来自不同存储）：
 *   tab=rank   排行榜（Redis：ZSET + HASH）
 *   tab=share  分享记录（SQLite：share_records）
 *   tab=pk     好友 PK 邀请（SQLite：pk_invites，预留模块）
 *
 * 入口示例：
 *   管理界面：http://域名/admin/index.html
 *   数据接口：http://域名/api/admin.php?api=1&tab=rank&action=list
 *
 * 未带 ?api=1 直接访问本文件 → 返回 JSON 提示，引导到 /admin/
 *
 * 排行榜接口：
 *   GET  ?api=1&tab=rank&action=list&page=&per=&q=                  分页+搜索
 *   POST ?api=1&tab=rank&action=save    {id?,name,score,reason,date}  新增或更新
 *   POST ?api=1&tab=rank&action=delete  {id}                            删除一条
 *   POST ?api=1&tab=rank&action=clear                                   清空全部 + 删 sentinel
 *
 * 分享记录接口：
 *   GET  ?api=1&tab=share&action=list&page=&per=&channel=&q=
 *   POST ?api=1&tab=share&action=delete {id}
 *   POST ?api=1&tab=share&action=clear
 *
 * PK 邀请接口：
 *   GET  ?api=1&tab=pk&action=list&page=&per=&status=
 *   POST ?api=1&tab=pk&action=clear
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// 接口层不向外暴露错误堆栈（仅在服务器日志中记录）
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE);

niulai_preflight();
niulai_cors();

// 仅作为数据接口：未带 ?api=1 时返回 JSON 引导，避免被当成页面渲染成乱码
if (!isset($_GET['api']) || $_GET['api'] != '1') {
    niulai_json([
        'ok'      => false,
        'error'   => '这是数据接口（JSON API），请访问管理后台界面 /admin/index.html',
        'adminUi' => '/admin/index.html',
    ], 400);
}

$method = $_SERVER['REQUEST_METHOD'];
$tab    = strtolower(trim(strval($_GET['tab']    ?? '')));
$action = strtolower(trim(strval($_GET['action'] ?? '')));

/* ============================================================
 *  tab: rank（排行榜，Redis）
 * ============================================================ */
if ($tab === 'rank') {
    $r = niulai_redis();
    if ($r === null) niulai_json(['ok' => false, 'error' => 'Redis 不可用'], 503);

    if ($method === 'GET' && $action === 'list') {
        $page = max(1, intval($_GET['page'] ?? 1));
        $per  = min(NIULAI_KEEP, max(1, intval($_GET['per'] ?? 10)));
        $q    = trim(strval($_GET['q'] ?? ''));

        // 全量 + 过滤（与 rank.php 同套路，便于搜索）
        $allIds = $r->zRevRange(NIULAI_ZSET, 0, NIULAI_KEEP - 1);
        $rows = [];
        if (is_array($allIds) && count($allIds) > 0) {
            foreach ($allIds as $rid) {
                $h = $r->hGetAll(NIULAI_HASH . $rid);
                if (!is_array($h) || empty($h)) continue;
                if ($q !== '' && mb_strpos($h['name'] ?? '', $q) === false) continue;
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
        }
        $total = count($rows);
        $pages = $per > 0 ? (int)ceil($total / $per) : 1;
        $offset = ($page - 1) * $per;
        $list = array_slice($rows, $offset, $per);
        niulai_json(['ok' => true, 'rows' => $list, 'total' => $total, 'page' => $page, 'per' => $per, 'pages' => $pages]);
    }

    if ($method === 'POST' && $action === 'save') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) $body = [];
        $id     = trim(strval($body['id'] ?? ''));
        $name   = trim(strval($body['name'] ?? ''));
        $score  = isset($body['score']) ? floatval($body['score']) : 0;
        $reason = trim(strval($body['reason'] ?? ''));
        $date   = trim(strval($body['date'] ?? date('Y/m/d')));
        $runStart = isset($body['runStart']) ? intval($body['runStart']) : 0;
        $runEnd   = isset($body['runEnd'])   ? intval($body['runEnd'])   : 0;
        if ($score <= 0) niulai_json(['ok' => false, 'error' => '分数必须 > 0'], 400);
        if ($name === '') $name = '牛人' . rand(1000, 9999);
        if (mb_strlen($name, 'UTF-8') > 12) $name = mb_substr($name, 0, 12, 'UTF-8');
        if ($id === '') $id = 'adm_' . bin2hex(random_bytes(6)) . '_' . time();
        if ($date === '') $date = date('Y/m/d');

        $r->hMSet(NIULAI_HASH . $id, [
            'name' => $name, 'score' => $score, 'reason' => $reason,
            'date' => $date, 'runStart' => $runStart, 'runEnd' => $runEnd,
            'createdAt' => time(),
        ]);
        $r->zAdd(NIULAI_ZSET, $score, $id);
        niulai_json(['ok' => true, 'id' => $id]);
    }

    if ($method === 'POST' && $action === 'delete') {
        $body = json_decode(file_get_contents('php://input'), true);
        $id = trim(strval($body['id'] ?? ''));
        if ($id === '') niulai_json(['ok' => false, 'error' => '缺少 id'], 400);
        $r->zRem(NIULAI_ZSET, $id);
        $r->del(NIULAI_HASH . $id);
        niulai_json(['ok' => true, 'total' => (int)$r->zCard(NIULAI_ZSET)]);
    }

    if ($method === 'POST' && $action === 'clear') {
        // 清排行榜 + sentinel
        $allIds = $r->zRange(NIULAI_ZSET, 0, -1);
        if (is_array($allIds)) {
            foreach ($allIds as $rid) $r->del(NIULAI_HASH . $rid);
        }
        $r->del(NIULAI_ZSET);
        $r->del('niulai:seed:done');
        niulai_json(['ok' => true, 'total' => 0]);
    }

    niulai_json(['ok' => false, 'error' => '未识别的 rank 动作'], 400);
}

/* ============================================================
 *  tab: share（分享记录，SQLite）
 * ============================================================ */
if ($tab === 'share') {
    $db = niulai_db();
    if ($method === 'GET' && $action === 'list') {
        $page = max(1, intval($_GET['page'] ?? 1));
        $per  = min(200, max(1, intval($_GET['per']  ?? 20)));
        $q    = trim(strval($_GET['q'] ?? ''));
        $channel = trim(strval($_GET['channel'] ?? ''));

        $where = ' WHERE 1=1 '; $p = [];
        if ($q !== '') { $where .= ' AND (run_id LIKE ? OR recipient_hint LIKE ? OR note LIKE ?) '; $p[] = "%$q%"; $p[] = "%$q%"; $p[] = "%$q%"; }
        if ($channel !== '') { $where .= ' AND channel = ? '; $p[] = $channel; }

        $cnt = $db->prepare("SELECT COUNT(*) FROM share_records $where"); $cnt->execute($p);
        $total = (int)$cnt->fetchColumn();
        $pages = $per > 0 ? (int)ceil($total / $per) : 1;
        $offset = ($page - 1) * $per;

        $st = $db->prepare("SELECT id, run_id, score, channel, poster_format AS posterFormat,
                                   recipient_hint AS recipientHint, note, ip_hint AS ipHint, created_at AS createdAt
                            FROM share_records $where ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?");
        $i = 1;
        foreach ($p as $v) { $st->bindValue($i++, $v); }
        $st->bindValue($i++, $per, PDO::PARAM_INT);
        $st->bindValue($i++, $offset, PDO::PARAM_INT);
        $st->execute();
        $rows = array_map(function ($r) {
            $r['score'] = floatval($r['score']); $r['id'] = intval($r['id']); $r['createdAt'] = intval($r['createdAt']); return $r;
        }, $st->fetchAll());

        $by = $db->query("SELECT channel, COUNT(*) AS n FROM share_records GROUP BY channel")->fetchAll();
        $byCh = ['system'=>0,'qrcode'=>0,'poster'=>0,'link'=>0,'copy'=>0,'other'=>0];
        foreach ($by as $s) { $byCh[$s['channel']] = (int)$s['n']; }

        niulai_json(['ok' => true, 'rows' => $rows, 'total' => $total, 'page' => $page, 'per' => $per, 'pages' => $pages, 'byChannel' => $byCh]);
    }
    if ($method === 'POST' && $action === 'delete') {
        $body = json_decode(file_get_contents('php://input'), true);
        $id = intval($body['id'] ?? 0);
        if ($id <= 0) niulai_json(['ok' => false, 'error' => '缺少 id'], 400);
        $db->prepare("DELETE FROM share_records WHERE id = ?")->execute([$id]);
        niulai_json(['ok' => true, 'total' => (int)$db->query("SELECT COUNT(*) FROM share_records")->fetchColumn()]);
    }
    if ($method === 'POST' && $action === 'clear') {
        $db->exec("DELETE FROM share_records");
        niulai_json(['ok' => true, 'total' => 0]);
    }
    niulai_json(['ok' => false, 'error' => '未识别的 share 动作'], 400);
}

/* ============================================================
 *  tab: pk（好友 PK 邀请，SQLite）
 * ============================================================ */
if ($tab === 'pk') {
    $db = niulai_db();
    if ($method === 'GET' && $action === 'list') {
        $page = max(1, intval($_GET['page'] ?? 1));
        $per  = min(200, max(1, intval($_GET['per']  ?? 20)));
        $status = trim(strval($_GET['status'] ?? ''));
        $where = ' WHERE 1=1 '; $p = [];
        if (in_array($status, ['pending','accepted','expired'], true)) { $where .= ' AND status = ? '; $p[] = $status; }
        $cnt = $db->prepare("SELECT COUNT(*) FROM pk_invites $where"); $cnt->execute($p);
        $total = (int)$cnt->fetchColumn();
        $pages = $per > 0 ? (int)ceil($total / $per) : 1;
        $offset = ($page - 1) * $per;

        $st = $db->prepare("SELECT * FROM pk_invites $where ORDER BY created_at DESC, code ASC LIMIT ? OFFSET ?");
        $i = 1;
        foreach ($p as $v) { $st->bindValue($i++, $v); }
        $st->bindValue($i++, $per, PDO::PARAM_INT);
        $st->bindValue($i++, $offset, PDO::PARAM_INT);
        $st->execute();
        $rows = array_map(function ($r) {
            return [
                'code' => $r['code'],
                'status' => $r['status'],
                'challenge' => $r['challenge'] ?? '',
                'createdAt' => intval($r['created_at']),
                'acceptedAt' => intval($r['accepted_at'] ?? 0),
                'challenger' => ['runId' => $r['challenger_run_id'], 'name' => $r['challenger_name'], 'score' => floatval($r['challenger_score'])],
                'recipient'  => empty($r['recipient_run_id']) ? null : ['runId' => $r['recipient_run_id'], 'name' => $r['recipient_name'], 'score' => floatval($r['recipient_score'])],
            ];
        }, $st->fetchAll());

        $by = $db->query("SELECT status, COUNT(*) AS n FROM pk_invites GROUP BY status")->fetchAll();
        $bySt = ['pending'=>0,'accepted'=>0,'expired'=>0];
        foreach ($by as $s) { $bySt[$s['status']] = (int)$s['n']; }

        niulai_json(['ok' => true, 'rows' => $rows, 'total' => $total, 'page' => $page, 'per' => $per, 'pages' => $pages, 'byStatus' => $bySt]);
    }
    if ($method === 'POST' && $action === 'clear') {
        $db->exec("DELETE FROM pk_invites");
        niulai_json(['ok' => true, 'total' => 0]);
    }
    if ($method === 'POST' && $action === 'delete') {
        $body = json_decode(file_get_contents('php://input'), true);
        $code = strtoupper(trim(strval($body['code'] ?? '')));
        if (!preg_match('/^[A-Z0-9]{6,12}$/', $code)) niulai_json(['ok' => false, 'error' => '邀请码格式不对'], 400);
        $db->prepare("DELETE FROM pk_invites WHERE code = ?")->execute([$code]);
        niulai_json(['ok' => true, 'total' => (int)$db->query("SELECT COUNT(*) FROM pk_invites")->fetchColumn()]);
    }
    niulai_json(['ok' => false, 'error' => '未识别的 pk 动作'], 400);
}

niulai_json(['ok' => false, 'error' => '未知 tab'], 400);
