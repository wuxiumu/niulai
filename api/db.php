<?php
/**
 * db.php —— 牛来运转·分享与 PK 数据层（SQLite 文件，零配置）
 *
 * 仅负责：
 *   1) share_records：用户分享事件（每次分享海报/QR/链接记一行）
 *   2) pk_invites   ：分享后好友 PK 邀请码（短码 6 位，目前仅为预留）
 *
 * 排行榜/成绩信息一律走 Redis（见 api/config.php + api/submit.php + api/rank.php）。
 *
 * 提供：
 *   - niulai_db()             获取 PDO（自动建表）
 *   - niulai_gen_pk_code()    生成 6 位去歧义短码
 *
 * JSON 输出、CORS、预检均由 api/config.php 统一提供，本文件不再重复定义。
 *
 * 文件位置：api/share.sqlite（不再叫 leaderboard.sqlite，避免和历史语义混淆）
 */

define('NIULAI_SHARE_DB', __DIR__ . '/share.sqlite');

/**
 * 获取分享 SQLite 连接（单例）；首次访问自动建表，不做任何 seed。
 */
function niulai_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $pdo = new PDO('sqlite:' . NIULAI_SHARE_DB);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL');

    $pdo->exec("CREATE TABLE IF NOT EXISTS share_records (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id          TEXT    NOT NULL,
        score           REAL    NOT NULL DEFAULT 0,
        channel         TEXT    NOT NULL,
        poster_format   TEXT    DEFAULT '',
        recipient_hint  TEXT    DEFAULT '',
        note            TEXT    DEFAULT '',
        ip_hint         TEXT    DEFAULT '',
        created_at      INTEGER NOT NULL
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_share_run ON share_records(run_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_share_created ON share_records(created_at)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_share_ip_created ON share_records(ip_hint, created_at)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS pk_invites (
        code                TEXT    PRIMARY KEY,
        challenger_run_id   TEXT    NOT NULL,
        challenger_name     TEXT    DEFAULT '',
        challenger_score    REAL    NOT NULL DEFAULT 0,
        recipient_run_id    TEXT    DEFAULT '',
        recipient_name      TEXT    DEFAULT '',
        recipient_score     REAL    DEFAULT 0,
        status              TEXT    NOT NULL DEFAULT 'pending',
        challenge           TEXT    DEFAULT '',
        created_at          INTEGER NOT NULL,
        accepted_at         INTEGER DEFAULT 0
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pk_challenger ON pk_invites(challenger_run_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pk_status ON pk_invites(status)");

    return $pdo;
}

/**
 * 生成 6 位 PK 短码（去歧义字符 0/O/1/I/L），保证全表唯一。
 * 失败重试 5 次以避免极端碰撞。
 */
function niulai_gen_pk_code(PDO $db) {
    $alpha = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $len   = strlen($alpha);
    for ($i = 0; $i < 5; $i++) {
        $code = '';
        for ($k = 0; $k < 6; $k++) {
            $code .= $alpha[random_int(0, $len - 1)];
        }
        $hit = $db->prepare('SELECT 1 FROM pk_invites WHERE code = :c LIMIT 1');
        $hit->execute([':c' => $code]);
        if (!$hit->fetchColumn()) return $code;
    }
    return substr(strtoupper(bin2hex(random_bytes(4))), 0, 6);
}
