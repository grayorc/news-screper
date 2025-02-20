const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const NodeCache = require('node-cache');
const newsCache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

const app = express();
const port = 5090;

app.use(cors());

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/news', async (req, res) => {
  try {
    const cachedNews = newsCache.get('news');

    if (cachedNews) {
      return res.json(cachedNews);
    }

    const browser = await puppeteer.launch({
      executablePath: "path/to/chrome",//executable path to chrome
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'script' || resourceType === 'font'|| resourceType === 'x-icon') {
        req.abort();
      } else {
        req.continue();
      }
    });

    const url = 'https://www.khabaronline.ir/archive?tp=6&irst=1';
    await page.goto(url, { waitUntil: 'networkidle2' });

    const news = await page.evaluate(() => {
      const newsItems = [];
      const articles = document.querySelectorAll('li.News');

      articles.forEach((article) => {
        const title = article.querySelector('h3 a')?.innerText.trim();
        const link = article.querySelector('h3 a')?.href;
        const image = article.querySelector('img')?.src;
        const description = article.querySelector('p')?.innerText.trim();
        const time = article.querySelector('time a')?.innerText.trim();

        if (title && link) {
          newsItems.push({
            title,
            link,
            image,
            description,
            time,
          });
        }
      });

      return newsItems;
    });

    await browser.close();

    newsCache.set('news', news);
    res.json(news);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error occurred while fetching news');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
