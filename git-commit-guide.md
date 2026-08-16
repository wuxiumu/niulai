# Git 高赞提交方案：Commit Message 最佳实践

> 一份让团队协作更顺畅、代码历史更清晰的提交规范

---

## 一、为什么需要规范的 Commit Message？

- **提高协作效率**：团队成员一眼看懂每次提交的意图
- **加速 Code Review**：reviewer 不需要猜测改动范围
- **方便排查问题**：`git log` / `git blame` 时快速定位引入问题的提交
- **自动生成 Changelog**：规范化后可以用工具自动提取版本变更日志
- **提升专业度**：开源项目 / 企业级项目的基本要求

---

## 二、推荐的 Commit Message 格式

采用业界最流行的 **Conventional Commits** 规范（Angular 团队推广）：

```
<type>(<scope>): <subject>
<空行>
<body>
<空行>
<footer>
```

### 2.1 Type（必填）— 提交类型

| Type | 含义 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): 添加微信登录` |
| `fix` | Bug 修复 | `fix(cart): 修复金额为 0 时计算错误` |
| `docs` | 文档改动 | `docs(readme): 更新安装说明` |
| `style` | 代码格式（不影响逻辑） | `style: 统一缩进为 4 空格` |
| `refactor` | 重构（非新功能、非修复） | `refactor(user): 提取校验逻辑为独立函数` |
| `perf` | 性能优化 | `perf(query): 添加索引提升查询速度` |
| `test` | 测试相关 | `test(auth): 补充登录边界用例` |
| `build` | 构建系统 / 外部依赖 | `build: 升级 webpack 到 v5` |
| `ci` | CI/CD 配置改动 | `ci: 添加 GitHub Actions 部署流水线` |
| `chore` | 杂项维护 | `chore: 清理无用依赖` |
| `revert` | 回滚提交 | `revert: 回滚 feat: xxx` |

### 2.2 Scope（可选）— 影响范围

标注本次改动影响的模块，例如：
- `auth`、`cart`、`user`、`api`、`ui`、`db`、`config`

### 2.3 Subject（必填）— 简明描述

规则：
- **中文或英文均可**，团队统一即可
- 不超过 **50 个字符**（中文约 25 字）
- 使用**祈使语气**（"添加"而非"添加了"）
- 首字母不大写（英文），末尾不加句号
- **不要重复 type**，例如不要写 `feat: 添加了新功能`

### 2.4 Body（可选）— 详细说明

- 解释 **为什么** 要这样改，而不只是改了什么
- 与上一行空一行
- 每行不超过 72 字符
- 适合描述复杂逻辑、设计决策、已知局限

### 2.5 Footer（可选）— 关联信息

```
BREAKING CHANGE: 登录接口返回值结构变更
Closes #123, #456
Reviewed-by: @zhangsan
```

---

## 三、高赞示例

### 示例 1：简单修复

```
fix(order): 修复订单金额为 0 时仍生成支付链接的问题

当金额为 0 时不应走支付流程，直接标记为已完成。
添加了金额校验逻辑，并补充单元测试。

Closes #234
```

### 示例 2：新功能

```
feat(notification): 支持企业微信机器人推送告警

- 新增 Webhook 通知渠道
- 支持 @指定人员
- 告警模板支持自定义变量

BREAKING CHANGE: 通知配置接口新增 channel 字段
Closes #189
```

### 示例 3：重构

```
refactor(payment): 将支付网关抽象为策略模式

原先 if-else 分支过多，不利于扩展新支付方式。
抽取 PaymentStrategy 接口，每种支付方式独立实现。
功能不变，仅结构优化，现有测试全部通过。
```

### 示例 4：文档

```
docs(api): 补充用户模块接口鉴权说明
```

### 示例 5：性能优化

```
perf(list): 将列表渲染从 O(n²) 优化为 O(n)

使用 Map 缓存替代嵌套循环查找，
10000 条数据场景下渲染耗时从 3200ms 降至 180ms。
```

---

## 四、团队落地方案

### 4.1 使用 Commitlint 强制校验

```bash
npm install -g @commitlint/cli @commitlint/config-conventional
```

`.commitlintrc.json`：
```json
{
  "extends": ["@commitlint/config-conventional"]
}
```

### 4.2 使用 Husky 钩子自动检查

```bash
npx husky install
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ""'
```

### 4.3 使用 Commitizen 交互式生成

```bash
npm install -g commitizen cz-conventional-changelog
cz-init
```

之后用 `git cz` 代替 `git commit`，交互式选择 type、scope，自动生成规范格式。

### 4.4 自动生成 Changelog

```bash
npm install -g conventional-changelog-cli
conventional-changelog -p angular -i CHANGELOG.md -s
```

---

## 五、常见反面教材（避免！）

| 反面示例 | 问题 |
|---------|------|
| `update` | 更新了什么？完全不知道 |
| `fix bug` | 哪个 bug？怎么修的？ |
| `111` / `test` | 毫无意义 |
| `修改了一些代码` | 范围不清，无法追溯 |
| 一次提交改 10 个功能 | 应拆分为多个原子提交 |
| 中英文混用 type | `Feat: 添加xxx` 应小写 `feat` |

---

## 六、提交粒度原则

- **一个提交做一件事**（原子提交）
- 不要在一个 commit 里既修 bug 又加功能
- 如果不确定要不要拆分，**宁可多拆**
- 每个 commit 应该能独立编译通过

---

## 七、快速参考卡片

```
type(scope): 简明描述（50字内）

详细描述（为什么改，72字换行）

关联信息（Closes #123）
```

**记住这个公式**：
> What（改了什么）→ Why（为什么改）→ How（怎么验证）

---

## 八、进阶：Emoji 风格（可选）

部分团队喜欢在 type 前加 Emoji 增强可读性：

| Emoji | 含义 |
|-------|------|
| ✨ `:sparkles:` | 新功能 |
| 🐛 `:bug:` | Bug 修复 |
| 📝 `:memo:` | 文档 |
| ♻️ `:recycle:` | 重构 |
| ⚡️ `:zap:` | 性能优化 |
| 🔥 `:fire:` | 删除代码 |
| 🎨 `:art:` | 格式调整 |
| ✅ `:white_check_mark:` | 测试 |

示例：
```
✨ feat(auth): 添加 SSO 单点登录
🐛 fix(cart): 修复优惠券叠加计算错误
```

---

## 总结

> 好的 commit message 是写给 **6 个月后的自己** 和 **不熟悉上下文的同事** 看的。
>
> 花 30 秒写清楚，省下未来 30 分钟的排查时间。

**核心原则：清晰 > 完整 > 简洁**
