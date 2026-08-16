# 牛来运转 · 排行榜接口（PHP + Redis）

本目录是与游戏 `niulai-game.html` 配合的服务端排行榜。`niulai-game.html` 在「结束本局」时会
尽力把成绩提交到 `api/submit.php`，并在结算页从 `api/rank.php` 拉取榜单（服务端不可用时自动回退到本机 localStorage 榜单）。

## 依赖
- PHP ≥ 7.4（开发用 8.3）
- phpredis 扩展（`php -m | grep redis`）
- Redis 服务（默认 `127.0.0.1:6379`，可用环境变量 `REDIS_HOST/REDIS_PORT/REDIS_DB/REDIS_AUTH` 覆盖）

## 部署
把整个项目用 **PHP 服务器** 托管（接口与页面需同域，避免跨域）：
```bash
# 在项目根目录启动（默认端口 8800）
php -S 127.0.0.1:8800
# 浏览器打开 http://127.0.0.1:8800/niulai-game.html
```
> 注意：用普通静态服务器（如 `python -m http.server`）打开时，`api/*.php` 不会被解析，
> 排行榜会回退到本机榜单——这是预期行为，部署到 PHP 环境即生效。

## 接口
### POST `api/submit.php`
请求体（JSON）：
```json
{ "id":"本局runId", "name":"昵称", "score":12345, "reason":"时间到",
  "date":"2026/8/17", "runStart":1690000000000, "runEnd":1690000600000 }
```
返回：`{ "ok": true, "runId": "..." }`
同 `id` 重复提交会覆盖昵称与分数。

### GET `api/rank.php`
- 默认：返回前 100 名。
- `?all=1`：返回全部（「查看跟多」）。
返回：
```json
{ "ok": true, "list": [ { "id","name","score","reason","date","runStart","runEnd" } ],
  "total": 123, "shown": 100, "hasMore": true, "all": false }
```

## 数据结构（Redis）
- `niulai:leaderboard`：ZSET，`score=净值`，`member=runId`（降序排序）。
- `niulai:entry:<runId>`：HASH，存昵称/分数/原因/时间等明细。
- ZSET 仅保留前 1000 名（`NIULAI_KEEP`），对外默认展示前 100 名（`NIULAI_TOP`）。
