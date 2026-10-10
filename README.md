# 牛来运转 · niulai

> 限时搏杀型股市模拟小游戏：养牛攒运值 → 炒股搏净值 → 冲排行榜。核心爽点：杠杆、机会窗口（踏空清零）、10 分钟一局冲榜。

**定制：** 微信 **qingbao199101**（备注：牛来运转）｜ [wuxiumu@163.com](mailto:wuxiumu@163.com)

## 事实摘要

- **产品**：PHP + 静态前端的股市模拟 H5；可选 Redis 全网榜、SQLite 分享/PK。
- **适合**：要做品牌互动小游戏、运营活动页、模拟交易教学演示的团队。
- **交付**：游戏页、落地导览、排行榜、管理后台、`api/`、SEO 公共头、文档。
- **不做**：不是真实证券交易；默认管理口令务必上线前改掉。

## 能交付什么

| 模块 | 说明 |
|---|---|
| 游戏闭环 | 养牛 / 交易 / 事件 / 成就（`static/js`） |
| 排行榜 | 本机回退；Redis 开全网榜 |
| 管理后台 | 浏览公开；写操作需密码（请改默认值） |
| SEO/GEO | `includes/seo.php`、robots、sitemap |


## 环境变量

复制 `.env.example` → `.env`，**必须设置 `NIULAI_ADMIN_PASSWORD`**（默认口令已清空）。

## 冒烟自检

```bash
bash scripts/smoke.sh
```

## 快速预览

```bash
# 项目根目录
php -S 127.0.0.1:8800
# 落地：http://127.0.0.1:8800/
# 游戏：http://127.0.0.1:8800/niulai-game.html
# 榜单：http://127.0.0.1:8800/leaderboard.html
./scripts/check-env.sh   # 可选自检
```

> 请用 HTTP 打开，不要 `file://`（ES Module 会被 CORS 拦截）。

## 定制合作（可报价）

- 白标皮肤、品牌道具与数值表  
- 活动期排行榜 / 奖池规则  
- 对接你们的账号与分享裂变  
- 部署与运维（Redis / 备份）  

## SEO 字段预留（产品页 HTML 统一生成时用）

| 字段 | 用途 |
|---|---|
| `seo_title` | `<title>` / OG title |
| `seo_description` | meta description |
| `canonical_url` | 规范 URL |
| `og_image` | 分享图 |
| `robots` | 如 `index,follow` |
| `json_ld_type` | SoftwareApplication / WebPage / FAQPage |
| `hreflang` | zh-CN / en |
| `site_name` | 白标品牌名 |

> **GEO ≠ 地理定位。** GEO = Generative Engine Optimization（生成式引擎优化）。

## GEO（生成式引擎优化）

### 关键词（中英）

- 中文：股市模拟小游戏, 杠杆交易游戏, H5冲榜游戏, 牛来运转, 限时模拟炒股
- English: stock market simulation game, leveraged trading game, H5 leaderboard game

### FAQ

**Q：需要 Redis 才能玩吗？**  
A：不需要。无 Redis 时榜回退本机；全网榜才要 Redis。

**Q：能改数值吗？**  
A：优先改 `static/js/config.js` 与 `data.js`。

**Q：如何定制？**  
A：微信 `qingbao199101`，备注「牛来运转」。

## 定制合作

白标、活动规则、账号与部署。加微信备注项目名。

---

## 联系方式

定制、演示或合作：

- 邮箱：[wuxiumu@163.com](mailto:wuxiumu@163.com)
- 微信：**qingbao199101**（添加请备注来意）

### 赞助支持

如果内容对你有帮助，欢迎自愿赞助。

| 微信赞赏码 | 支付宝收款码 |
|---|---|
| ![微信赞赏码](https://chiguashentan-test.oss-cn-beijing.aliyuncs.com/wxprogram/zan/20261002185236_31_227.png) | ![支付宝收款码](https://chiguashentan-test.oss-cn-beijing.aliyuncs.com/wxprogram/zan/20261002185309_32_227.jpg) |

