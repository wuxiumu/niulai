# 牛来运转 · 服务端 API（PHP）

与游戏同域部署。游戏结束时尽力 `POST api/submit.php` 写分，结算页 / 排行榜页 `GET api/rank.php` 拉榜；**Redis 不可用时接口返回 503，前端回退本机 localStorage 榜**。

分享与 PK 走 **SQLite**（`api/share.sqlite`），不依赖 Redis。

---

## 依赖

| 能力 | 依赖 |
|------|------|
| 打开页面 / 跑 PHP 接口 | PHP ≥ 7.4（开发常用 8.3） |
| 全网排行榜 | 扩展 `redis`（`php -m \| grep redis`）+ Redis 进程 |
| 分享 / PK / 部分后台 | 扩展 `pdo_sqlite`（通常默认可用） |

Redis 连接可用环境变量覆盖：

- `REDIS_HOST`（默认 `127.0.0.1`）
- `REDIS_PORT`（默认 `6379`）
- `REDIS_DB`（默认 `0`）
- `REDIS_AUTH`（可选）

---

## 本地启动

在**项目根目录**（不是 `api/` 内）：

```bash
php -S 127.0.0.1:8800
```

| 入口 | URL |
|------|-----|
| 游戏 | http://127.0.0.1:8800/niulai-game.html |
| 用户榜 | http://127.0.0.1:8800/leaderboard.html |
| 管理后台 | http://127.0.0.1:8800/admin/ |
| 探活拉榜 | http://127.0.0.1:8800/api/rank.php |

> 用纯静态服务器（如 `python -m http.server`）时 `.php` 不会执行，榜回退本机——预期行为。  
> 前端为 ES Module，禁止 `file://` 双击打开。详见根目录 [README.md](../README.md)。

---

## 接口一览

### 排行榜（Redis）

#### `POST api/submit.php`

请求体（JSON）：

```json
{
  "id": "本局runId",
  "name": "昵称",
  "score": 12345,
  "reason": "时间到",
  "date": "2026/8/17",
  "runStart": 1690000000000,
  "runEnd": 1690000600000
}
```

成功：`{ "ok": true, "runId": "..." }`  
同 `id` 重复提交会覆盖昵称与分数。Redis 不可用：`503` + `{ ok:false, error:"Redis 不可用" }`。

#### `GET api/rank.php`

| 参数 | 说明 |
|------|------|
| （无） | 默认 `page=1&per=20` |
| `all=1` | 尽量返回全量（上限见 `NIULAI_KEEP`） |
| `page` / `per` | 分页（`per` 最大不超过 keep） |
| `q` | 按昵称模糊搜索 |
| `info=1&id=runId` | 附带该 run 的 `mine` 详情 |

返回形状（节选）：

```json
{
  "ok": true,
  "list": [{ "id", "name", "score", "reason", "date", "runStart", "runEnd" }],
  "total": 123,
  "page": 1,
  "per": 20,
  "pages": 7,
  "hasMore": true,
  "all": false
}
```

空榜首次访问会 lazy seed 若干示例数据（sentinel：`niulai:seed:done`）。后台「清空排行榜」需同时清 sentinel，否则示例可能复活。

### 分享（SQLite）

- `POST api/share.php?api=1` — 记一条分享事件  
- `GET api/share.php?api=1&page=&per=&q=&channel=` — 列表  
- 详见 `share.php` 文件头注释；`channel`：`system|qrcode|poster|link|copy|other`

### 好友 PK（SQLite，游戏侧闭环见路线图 M05）

- `POST api/pk.php?api=1&action=create` — 创建邀请，返回短码与 URL  
- `GET api/pk.php?api=1&action=resolve&code=` — 解析邀请  
- `POST api/pk.php?api=1&action=accept` — 应战回写  
- 详见 `pk.php` 文件头注释

### 管理后台

- UI：`/admin/index.html`（人人可浏览列表）
- 数据：`GET/POST api/admin.php?api=1&tab=rank|share|pk&action=...`
- **写操作**（save / delete / clear）需密码：请求体 `password` 或头 `X-Admin-Password`（默认 `654321`，可用环境变量 `NIULAI_ADMIN_PASSWORD` 覆盖）
- 校验：`POST ?api=1&tab=auth&action=verify`（仅验密，不改数据）；前端通过后记录授权状态，可「清空权限」
- 直接打开 `api/admin.php`（无 `api=1`）会返回 JSON 提示去 `/admin/`

### 分享限流

用户写入 `share_records`：按 **IP** 与 **本局 run_id** 分别限制  
默认 **每小时 20** / **每天 80**（`NIULAI_SHARE_LIMIT_HOUR` / `NIULAI_SHARE_LIMIT_DAY` 可覆盖）。超限返回 `429` + `rateLimited`。

### 挑战结果页

应战成功后跳转 `/pk-result.html?pk=CODE`：当事人每次打开有礼花；第三方访客只看双方成绩对比。

---

## Redis 键

| 键 | 类型 | 含义 |
|----|------|------|
| `niulai:leaderboard` | ZSET | score=净值，member=runId |
| `niulai:entry:<runId>` | HASH | 昵称/分数/原因/时间等 |
| `niulai:seed:done` | STRING | 已做过空榜示例灌入 |

常量（`config.php`）：`NIULAI_KEEP=1000`（ZSET 保留上限）、`NIULAI_TOP=100`（对外默认展示参考）。

## SQLite

- 文件：`api/share.sqlite`  
- 表：`share_records`、`pk_invites`（见 `db.php`，首次访问自动建表）

---

## 相关文档

- 根目录 [README.md](../README.md) — 怎么跑起来  
- [项目完善路线图](../doc/项目完善路线图.md) — 主线进度（M03 全网榜已完成；M04 分享、M05 PK）
- 根目录 [scripts/check-env.sh](../scripts/check-env.sh) — 本地 PHP/Redis/接口自检
