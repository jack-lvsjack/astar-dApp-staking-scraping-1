# Astar Network Countdown Scraper

自动抓取 [Astar Network Portal](https://portal.astar.network/astar/dapp-staking/discover) 页面上的倒计时时间（格式：`8d:1h:5m`）。

## 🎯 方案

使用 **GitHub Actions + GitHub Pages** 实现完全免费的自动化抓取：

- ⏰ 每 10 分钟自动抓取一次（可在 `.github/workflows/scrape.yml` 修改 cron）
- 📦 数据自动提交到 `gh-pages` 分支
- 🌐 通过 GitHub Pages 免费提供 JSON API
- 💰 **完全免费**，无需任何服务器或账单

## 📋 使用步骤

### 1. 设置 GitHub Pages

1. 将仓库推送到 GitHub（如果是公共仓库，Actions 免费）
2. 进入仓库 **Settings** → **Pages**
3. 配置：
   - **Source**: Deploy from a branch
   - **Branch**: `gh-pages`
   - **Folder**: `/` (root)
4. 保存后等待 1-2 分钟，GitHub Pages 会自动部署

### 2. 触发第一次抓取

- **自动触发**：等待第一次 scheduled run（每 10 分钟）
- **手动触发**：在 Actions 标签页点击 "Run workflow"

### 3. 访问数据 API

抓取成功后，访问：

```
https://<你的用户名>.github.io/<仓库名>/index.json
```

例如：`https://jack.github.io/lst-data-scraping/index.json`

## 📊 数据格式

```json
{
  "chain": "astar",
  "source": "https://portal.astar.network/astar/dapp-staking/discover",
  "countdown": "8d:1h:5m",
  "raw": "页面原始文本（前3000字符）...",
  "ts": 1703123456789,
  "iso": "2023-12-21T12:34:56.789Z",
  "selector": "[data-testid='staking-countdown']"
}
```

## 🔧 本地测试

```bash
# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install --with-deps chromium

# 运行抓取脚本
npm run scrape

# 查看结果
cat data.json
```

## ⚙️ 自定义配置

### 修改抓取频率

编辑 `.github/workflows/scrape.yml` 中的 cron 表达式：

```yaml
schedule:
  - cron: "*/10 * * * *"   # 每10分钟
  # - cron: "*/5 * * * *"  # 每5分钟
  # - cron: "0 * * * *"    # 每小时
```

### 修改选择器

如果页面结构变化，编辑 `scripts/scrape.js` 中的 `candidates` 数组：

```javascript
const candidates = [
  "[data-testid='staking-countdown']",
  ".countdown",
  // 添加更多选择器...
];
```

## 🐛 调试

如果抓取失败：

1. 在 GitHub Actions 的 Run 详情中查看日志
2. 检查是否有 `debug-screenshot.png` 或 `error-screenshot.png`
3. 根据实际页面 DOM 更新选择器

## 📝 注意事项

- 确保仓库是 **公开的**（Public），才能使用免费的 GitHub Actions 额度
- 首次运行可能需要几分钟来设置环境
- GitHub Pages 部署可能需要 1-2 分钟生效

## 🚀 进阶方案（可选）

如果需要自定义域名或更专业的 API，可以考虑：

- **Cloudflare Workers**：将数据写入 KV，通过 Workers 提供 API
- **自定义域名**：在 GitHub Pages 设置中绑定自己的域名

---

**完全免费，无需服务器！** 🎉

