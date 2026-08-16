# SEO / GEO 说明（国内搜索引擎）

> 与代码同步：2026-08-17。结构见 `static/`、`includes/seo.php`、`robots.txt`、`sitemap.php`。

## 已落地

| 项 | 位置 |
|----|------|
| 静态资源目录 | `static/css` · `static/js` · `static/vendor` · `static/img` |
| Logo / 图标 | `static/img/logo.svg` · `logo-192/512.png` · favicon · apple-touch |
| 公共 SEO 头 | `includes/seo.php`（首页 `index.php` 引用） |
| 游戏 / 榜页 meta | `niulai-game.html` · `leaderboard.html` 内嵌 |
| robots | `/robots.txt`（放行百度/搜狗/360/神马，屏蔽 admin/api） |
| 站点地图 | `/sitemap.php`（含百度 mobile 扩展） |
| 结构化数据 | JSON-LD：WebSite / Organization / WebApplication |
| GEO | `geo.region=CN`、`zh-CN`、`applicable-device`、国内爬虫规则 |
| 去 Google 字体 | 避免国内加载失败；特效字回退楷体系统字体 |

## 上线后请你填的验证码

在搜索站长平台拿到验证码后，任选其一：

1. 环境变量（推荐）：
   - `BAIDU_SITE_VERIFY`
   - `SOGOU_SITE_VERIFY`
   - `QIHOO360_SITE_VERIFY`
   - `GOOGLE_SITE_VERIFY`
2. 或在调用 `includes/seo.php` 前往 `$seo` 数组写入同名键。

## 提交收录（清单）

1. 确保公网 HTTPS + 稳定域名  
2. 百度搜索资源平台：验证站点 → 提交 `https://你的域名/sitemap.php`  
3. 搜狗 / 360：同样提交 sitemap  
4. 主动推送（可选）：百度普通收录 API / 熊掌号已下线，用「资源提交」即可  
5. 检查：`/robots.txt`、首页 Logo、`<title>`/`description` 含主关键词「牛来运转」

## 目录速览

```
static/
  css/niulai.css
  js/{niulai,config,data}.js
  vendor/qrcode.min.js
  img/logo*.png|svg · favicon*
  manifest.json
includes/seo.php
robots.txt
sitemap.php
favicon.ico
```
