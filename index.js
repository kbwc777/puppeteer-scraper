const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/scrape', async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ error: '請提供 ?keyword=參數' });

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // ✅ 模擬真實使用者瀏覽器 UA
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    const url = `https://www.price.com.hk/search.php?g=A&q=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 等待價格資料出現（行貨 / 水貨區塊）
    await page.waitForSelector('.line.price-range', { timeout: 15000 });

    // 提取價格範圍
    const prices = await page.evaluate(() => {
      const results = {};
      document.querySelectorAll('.line.price-range').forEach((el) => {
        const label = el.querySelector('img')?.getAttribute('title') || '';
        const priceTexts = el.querySelectorAll('.text-price-number');
        const low = parseFloat(priceTexts?.[0]?.innerText || 0);
        const high = parseFloat(priceTexts?.[1]?.innerText || 0);
        if (label.includes('行貨')) {
          results['行貨最低'] = low;
          results['行貨最高'] = high;
        } else if (label.includes('水貨')) {
          results['水貨最低'] = low;
          results['水貨最高'] = high;
        }
      });
      return results;
    });

    await browser.close();

    res.json({
      品牌: keyword.split(' ')[0] || '',
      型號: keyword.split(' ')[1] || '',
      ...prices,
    });
  } catch (err) {
    res.status(500).json({ error: '擷取失敗', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
