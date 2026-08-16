<?php
/**
 * config.php —— 牛来运转·排行榜 公共配置
 * 负责：Redis 连接、统一 JSON 输出、键名定义、CORS。
 *
 * 依赖：phpredis 扩展（类 Redis）。未安装时 niulai_redis() 返回 null，
 *       各接口会返回 {ok:false, error:'Redis 不可用'}，由前端回退到本机排行榜。
 *
 * 可通过环境变量覆盖连接：REDIS_HOST / REDIS_PORT / REDIS_DB / REDIS_AUTH
 */

// 排行榜成绩 ZSET：score = 净值（用于排序），member = runId（唯一）
define('NIULAI_ZSET', 'niulai:leaderboard');
// 条目明细 HASH 前缀：niulai:entry:<runId>
define('NIULAI_HASH', 'niulai:entry:');
// ZSET 体积上限（仅保留前 N 名，超出裁剪；对外默认展示前 100）
define('NIULAI_KEEP', 1000);
// 对外默认展示条数
define('NIULAI_TOP', 100);
// 管理后台写操作密码（浏览公开；新增/编辑/删除需此密码）
// 可用环境变量 NIULAI_ADMIN_PASSWORD 覆盖；未设置时默认 654321
define('NIULAI_ADMIN_PASSWORD', (getenv('NIULAI_ADMIN_PASSWORD') !== false && getenv('NIULAI_ADMIN_PASSWORD') !== '')
    ? getenv('NIULAI_ADMIN_PASSWORD')
    : '654321');
// 用户分享记录限流（按 IP / 本局 run_id 分别计数）
define('NIULAI_SHARE_LIMIT_HOUR', (int)(getenv('NIULAI_SHARE_LIMIT_HOUR') ?: 20));
define('NIULAI_SHARE_LIMIT_DAY',  (int)(getenv('NIULAI_SHARE_LIMIT_DAY')  ?: 80));

/**
 * 获取 Redis 连接实例；失败返回 null。
 */
function niulai_redis() {
    if (!class_exists('Redis')) {
        return null;
    }
    $r = new Redis();
    $host = getenv('REDIS_HOST') ?: '127.0.0.1';
    $port = (int)(getenv('REDIS_PORT') ?: 6379);
    $db   = (int)(getenv('REDIS_DB') ?: 0);
    try {
        if (!$r->connect($host, $port, 2.0)) {
            return null;
        }
        $auth = getenv('REDIS_AUTH');
        if ($auth !== false && $auth !== '') {
            if (!$r->auth($auth)) {
                return null;
            }
        }
        $r->select($db);
        return $r;
    } catch (Exception $e) {
        return null;
    }
}

/**
 * 统一 JSON 输出并结束脚本。
 */
function niulai_json($data, $code = 200) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 设置 CORS 头（非预检场景也可用）。
 */
function niulai_cors() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password');
}

/**
 * 管理后台写操作鉴权：请求体 password 或头 X-Admin-Password。
 * 校验失败直接返回 401 并结束。
 */
function niulai_admin_require_write($body = null) {
    $pwd = '';
    if (!empty($_SERVER['HTTP_X_ADMIN_PASSWORD'])) {
        $pwd = strval($_SERVER['HTTP_X_ADMIN_PASSWORD']);
    }
    if ($pwd === '' && is_array($body) && isset($body['password'])) {
        $pwd = strval($body['password']);
    }
    if (!is_string($pwd) || !hash_equals(NIULAI_ADMIN_PASSWORD, $pwd)) {
        niulai_json(['ok' => false, 'error' => '需要管理密码', 'needPassword' => true], 401);
    }
}

/**
 * 处理 CORS 预检（OPTIONS）。
 */
function niulai_preflight() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        niulai_json(['ok' => true]);
    }
}
