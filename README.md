# 牛来运转（niulai）

限时搏杀型股市模拟小游戏：养牛攒运值 → 炒股搏净值 → 冲排行榜。

核心爽点：**杠杆**、**机会窗口（踏空清零）**、**10 分钟一局冲榜**。

---

## 3 分钟跑起来

### 依赖

| 用途 | 要求 |
|------|------|
| 打开游戏 | **PHP ≥ 7.4**（推荐 8.3）内置服务器即可 |
| 全网排行榜 | 另需 **Redis** + PHP 扩展 `redis`（`php -m \| grep redis`） |
| 分享 / PK 记录 | **SQLite**（一般随 PHP 的 `pdo_sqlite` 自带，零配置） |

### 启动

在项目**根目录**执行：

```bash
php -S 127.0.0.1:8800
```

浏览器打开：

| 页面 | URL |
|------|-----|
| 落地导览（官网） | http://127.0.0.1:8800/ |
| 游戏 | http://127.0.0.1:8800/niulai-game.html |
| 用户排行榜 | http://127.0.0.1:8800/leaderboard.html |
| 管理后台 | http://127.0.0.1:8800/admin/ （公开浏览；增删改密码默认 `654321`） |
| 站点地图 | http://127.0.0.1:8800/sitemap.php |

### 重要限制

- 前端是 **ES Module**（`/static/js/niulai.js` import 同目录 `config.js` / `data.js`）。
- **不要**用资源管理器双击 HTML（`file://` 会被浏览器 CORS 拦截）。
- 用纯静态服务器时：游戏能玩，但 `api/*.php` 不执行，榜回退本机（预期行为）。

### 自检（可选）

```bash
redis-cli ping
./scripts/check-env.sh   # 含静态资源 / SEO 探活
```

---

## 仓库结构（简图）

```
index.php / niulai-game.html / leaderboard.html   页面入口
static/
  css/niulai.css
  js/{niulai,config,data}.js
  vendor/qrcode.min.js
  img/logo*.png|svg · favicon*
  manifest.json
includes/seo.php                                  SEO/GEO 公共头
robots.txt · sitemap.php · favicon.ico
api/                                              PHP 接口
admin/                                            管理后台
doc/                                              路线图 · SEO 说明 · 玩法
```

调数值优先改 `static/js/config.js`；改股票/成就/事件改 `static/js/data.js`。

---

## 文档去哪看

| 文档 | 用途 |
|------|------|
| [doc/项目完善路线图.md](doc/项目完善路线图.md) | **主线**：优先级、勾选进度 |
| [doc/SEO与GEO说明.md](doc/SEO与GEO说明.md) | 国内搜索引擎 / Logo / 验证码 |
| [overview.md](overview.md) | 架构摘要 |
| [api/README.md](api/README.md) | 服务端接口 |

完善项目请按路线图推进（已完成至 **M05** · 下一批 **M06**）。

---

## 已知半成品（摘录）

- 玩法体验待补（离线股市结算等）→ **M06+**
