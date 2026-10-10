#!/usr/bin/env bash
# 牛来运转 · 本地环境自检（路线图 M03.1）
# 用法：在项目根目录执行 ./scripts/check-env.sh
# 可选：BASE=http://127.0.0.1:8800 ./scripts/check-env.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE:-http://127.0.0.1:8800}"
ok=0
fail=0

pass() { echo "  ✓ $*"; ok=$((ok+1)); }
bad()  { echo "  ✗ $*"; fail=$((fail+1)); }

echo "== 牛来运转 环境自检 =="
echo "根目录: $ROOT"
echo "接口基址: $BASE"
echo

echo "[1] PHP"
if command -v php >/dev/null 2>&1; then
  pass "php $(php -r 'echo PHP_VERSION;')"
else
  bad "未安装 php"
fi
if php -m 2>/dev/null | grep -qi '^redis$'; then
  pass "扩展 redis 已加载"
else
  bad "缺少 phpredis（php -m | grep redis）——全网榜不可用"
fi
if php -m 2>/dev/null | grep -qiE 'pdo_sqlite|sqlite3'; then
  pass "扩展 sqlite（pdo_sqlite/sqlite3）已加载"
else
  bad "缺少 pdo_sqlite / sqlite3——分享/PK 不可用"
fi

echo
echo "[2] Redis"
if command -v redis-cli >/dev/null 2>&1; then
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    pass "redis-cli ping → PONG"
  else
    bad "redis-cli ping 失败（请 brew services start redis 或等价命令）"
  fi
else
  bad "未找到 redis-cli"
fi

echo
echo "[3] HTTP 服务（需已在根目录执行: php -S 127.0.0.1:8800）"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/niulai-game.html" 2>/dev/null || echo 000)"
if [ "$code" = "200" ]; then
  pass "GET /niulai-game.html → 200"
else
  bad "GET /niulai-game.html → $code（请先启动 php -S）"
fi
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/" 2>/dev/null || echo 000)"
if [ "$code" = "200" ]; then
  pass "GET / → 200（落地页）"
else
  bad "GET / → $code"
fi

rank_body="$(curl -s "$BASE/api/rank.php" 2>/dev/null || true)"
if echo "$rank_body" | grep -q '"ok":true'; then
  pass "GET /api/rank.php → ok"
elif echo "$rank_body" | grep -q 'Redis'; then
  bad "GET /api/rank.php → Redis 不可用"
else
  bad "GET /api/rank.php → 无有效响应（服务未起？）"
fi

echo
echo "[4] 静态资源 / SEO"
for path in \
  /static/css/niulai.css \
  /static/js/niulai.js \
  /static/js/config.js \
  /static/js/data.js \
  /static/vendor/qrcode.min.js \
  /static/img/logo.svg \
  /static/img/logo-512.png \
  /static/manifest.json \
  /robots.txt \
  /sitemap.php
do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    pass "GET $path → 200"
  else
    bad "GET $path → $code"
  fi
done

echo
echo "结果: 通过 $ok · 失败 $fail"
if [ "$fail" -gt 0 ]; then
  echo "提示: 全网榜需要「php -S + Redis + phpredis」三者同时就绪。"
  exit 1
fi
echo "环境就绪，可玩全网榜。"
exit 0
