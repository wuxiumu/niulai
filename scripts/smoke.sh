#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
fail(){ echo "✗ $1" >&2; exit 1; }; ok(){ echo "✓ $1"; }
command -v php >/dev/null || fail "需要 PHP"
[[ -f niulai-game.html && -f api/config.php ]] || fail "缺少核心"
[[ -f .env.example ]] || fail "缺少 .env.example"
ok "核心文件齐全"
grep -q "654321" api/config.php && fail "仍含默认 654321" || ok "无默认 654321"
php -l api/config.php >/dev/null
ok "PHP lint OK"
PORT="${SMOKE_PORT:-18087}"
php -S "127.0.0.1:${PORT}" -t "$ROOT" >/tmp/niulai-smoke.log 2>&1 &
PID=$!; trap "kill $PID 2>/dev/null||true" EXIT
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 && break; sleep 0.15; done
curl -sf "http://127.0.0.1:${PORT}/niulai-game.html" | grep -qi 'html' || fail "游戏页失败"
ok "游戏页 200"
echo ""; echo "smoke: ok"
