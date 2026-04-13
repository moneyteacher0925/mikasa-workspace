const puppeteer = require('puppeteer');
const fs = require('fs');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  const cookies = JSON.parse(fs.readFileSync('/Users/kwoneren/.openclaw/workspace/naver-cafe-bot/cookies-full.json','utf8'));
  for (const c of cookies) { try { await page.setCookie({name:c.name,value:String(c.value),domain:c.domain,path:c.path||'/',httpOnly:!!c.httpOnly,secure:!!c.secure,...(c.expires>0?{expires:c.expires}:{})}); } catch(e){} }

  await page.goto('https://cafe.naver.com/ca-fe/cafes/10553650/articles/write?boardType=L', {waitUntil:'networkidle2', timeout:20000});
  await delay(3000);

  // Select board
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('게시판을 선택'));
    if (btn) btn.click();
  });
  await delay(500);
  await page.evaluate(() => {
    const opt = Array.from(document.querySelectorAll('button.option')).find(o => o.textContent.trim() === '옥상텃밭');
    if (opt) opt.click();
  });
  await delay(2000);

  // Check ALL visible buttons
  const btns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(b => {
      const r = b.getBoundingClientRect();
      return {text: b.textContent.trim().substring(0,40), cls: b.className.substring(0,80), y: Math.round(r.y)};
    }).sort((a,b) => a.y - b.y);
  });
  
  console.log('All visible buttons:');
  btns.forEach(b => console.log(`y=${b.y} | "${b.text}" | ${b.cls}`));

  await browser.close();
})();
