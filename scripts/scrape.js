// scripts/scrape.js

import fs from "node:fs";
import { chromium } from "playwright";

const URL = "https://portal.astar.network/astar/dapp-staking/discover";

function pickCountdown(text) {
  // 支持多种时间格式（按优先级匹配，从最完整到最简单）：
  //
  // 冒号分隔格式（标准格式）：
  // - 完整：8d:1h:5m, 0d:2h:12m, 8d:1h:5m:30s
  // - 天+小时+分钟：8d:1h:5m
  // - 天+分钟：8d:5m
  // - 小时+分钟：2h:12m, 2h:0m
  // - 分钟+秒：5m:30s
  // - 单一单位：12m, 30s
  //
  // 空格分隔格式：
  // - 8d 1h 5m, 2h 12m, 12m
  //
  // 无分隔符格式：
  // - 8d1h5m
  //
  // 大小写不敏感：
  // - 8D:1H:5M, 8D 1H 5M

  const patterns = [
    // 冒号分隔，包含秒（最完整）
    /\b\d+[dD]:\d+[hH]:\d+[mM]:\d+[sS]\b/,    // 8d:1h:5m:30s
    /\b\d+[hH]:\d+[mM]:\d+[sS]\b/,            // 2h:12m:30s
    /\b\d+[mM]:\d+[sS]\b/,                     // 5m:30s

    // 冒号分隔，标准格式（天+小时+分钟）
    /\b\d+[dD]:\d+[hH]:\d+[mM]\b/,            // 8d:1h:5m, 0d:2h:12m
    /\b\d+[dD]:\d+[mM]\b/,                     // 8d:5m（缺少小时）
    /\b\d+[hH]:\d+[mM]\b/,                     // 2h:12m, 2h:0m

    // 冒号分隔，单一单位
    /\b\d+[mM]\b/,                             // 12m
    /\b\d+[sS]\b/,                             // 30s

    // 空格分隔格式
    /\b\d+[dD]\s+\d+[hH]\s+\d+[mM]\b/,        // 8d 1h 5m
    /\b\d+[hH]\s+\d+[mM]\b/,                   // 2h 12m
    /\b\d+[mM]\s+\d+[sS]\b/,                   // 5m 30s

    // 无分隔符格式
    /\b\d+[dD]\d+[hH]\d+[mM]\b/,               // 8d1h5m
    /\b\d+[hH]\d+[mM]\b/,                      // 2h12m
    /\b\d+[mM]\d+[sS]\b/,                      // 5m30s
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      return m[0];
    }
  }

  return null;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 更稳的加载策略 + 超时
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
    
    // 等待页面完全加载，给动态内容时间渲染
    await page.waitForTimeout(3000);

    // 1) 尝试用已知类名/属性选择器（可根据实际 DOM 调整）
    // 优先使用 .time-left，这是最准确的选择器
    const candidates = [
      ".time-left", // 最准确的选择器，直接定位倒计时元素
      ".remaining-eras .time-left", // 通过父容器定位
      ".remaining-eras", // 尝试父容器，可能包含倒计时
    ];

    let text = "";
    let foundSelector = null;

    for (const sel of candidates) {
      try {
        // 使用 waitForSelector 等待元素出现，最多等待 5 秒
        const handle = await page.waitForSelector(sel, { 
          timeout: 5000,
          state: 'visible' 
        }).catch(() => null);
        
        if (handle) {
          const t = (await handle.textContent())?.trim() || "";
          if (pickCountdown(t)) {
            text = t;
            foundSelector = sel;
            console.log(`Found countdown with selector: ${sel}`);
            break;
          }
        }
      } catch (e) {
        // 忽略选择器错误，继续下一个
        continue;
      }
    }

    // 2) 兜底：抓取整个页面可见文本再匹配
    if (!pickCountdown(text)) {
      console.log("Countdown not found with selectors, trying full page text...");
      const bodyText = await page.evaluate(() => document.body.innerText);
      text = bodyText;
    }

    const countdown = pickCountdown(text);

    // 如果没有找到，尝试截图以便调试（在 Actions 中很有用）
    if (!countdown) {
      console.error("Countdown not found. Saving screenshot for debugging...");
      await page.screenshot({ path: "debug-screenshot.png", fullPage: true });
      console.error("Screenshot saved to debug-screenshot.png");
    }

    const payload = {
      chain: "astar",
      source: URL,
      countdown, // 格式可能为 "8d:1h:5m:30s" / "8d:1h:5m" / "2h:12m" / "12m" / "8d 1h 5m" / "8d1h5m" 等（大小写不敏感）
      raw: text.slice(0, 3000), // 截断以防过长
      ts: Date.now(),
      iso: new Date().toISOString(),
      selector: foundSelector || null,
    };

    // 输出到 repo 根目录的 data.json（稍后 workflow 会提交到 gh-pages）
    fs.writeFileSync("data.json", JSON.stringify(payload, null, 2));

    // 非空校验：没有抓到就报错，Actions 会标红，方便排查
    if (!countdown) {
      console.error("Countdown not found. Check selector or page structure.");
      process.exit(1);
    }

    console.log("OK:", payload);
  } catch (error) {
    console.error("Error during scraping:", error);
    // 截图帮助调试
    try {
      await page.screenshot({ path: "error-screenshot.png", fullPage: true });
      console.error("Error screenshot saved to error-screenshot.png");
    } catch (e) {
      // 忽略截图错误
    }
    throw error;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

