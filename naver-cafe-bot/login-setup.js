const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'cookies-full.json');

(async () => {
  console.log('=== Naver Login Setup (ONE TIME) ===');
  console.log('브라우저 창이 열리면 네이버 로그인해주세요.');
  console.log('로그인 완료되면 자동으로 쿠키를 저장합니다.\n');

  const browser = await puppeteer.launch({
    headless: false,  // 화면에 보여야 함
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=800,700',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ],
    defaultViewport: { width: 800, height: 600 }
  });

  const page = await browser.newPage();
  
  // Anti-detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete navigator.__proto__.webdriver;
  });

  // Go to Naver login
  await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'networkidle2' });
  
  console.log('Waiting for login... (checking every 3 seconds)');
  
  // Poll until logged in (redirected to naver.com or has NID_AUT cookie)
  let loggedIn = false;
  for (let i = 0; i < 120; i++) { // 6 minutes timeout
    await new Promise(r => setTimeout(r, 3000));
    
    const cookies = await page.cookies('https://naver.com', 'https://nid.naver.com');
    const hasNidAut = cookies.some(c => c.name === 'NID_AUT');
    const hasNidSes = cookies.some(c => c.name === 'NID_SES');
    
    if (hasNidAut && hasNidSes) {
      loggedIn = true;
      
      // Navigate to naver.com to collect all cookies
      await page.goto('https://www.naver.com', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));
      
      // Also visit cafe.naver.com
      await page.goto('https://cafe.naver.com', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));
      
      // Collect ALL cookies
      const allCookies = await page.cookies(
        'https://www.naver.com',
        'https://nid.naver.com', 
        'https://cafe.naver.com',
        'https://section.cafe.naver.com'
      );
      
      // Save cookies
      fs.writeFileSync(COOKIE_PATH, JSON.stringify(allCookies, null, 2));
      console.log(`\n✓ Login successful! ${allCookies.length} cookies saved to cookies-full.json`);
      
      const nidAut = allCookies.find(c => c.name === 'NID_AUT');
      console.log(`  NID_AUT: ${nidAut ? '✓ present' : '✗ missing'}`);
      console.log(`  NID_SES: ${allCookies.find(c => c.name === 'NID_SES') ? '✓ present' : '✗ missing'}`);
      console.log(`  Expires: ${nidAut ? new Date(nidAut.expires * 1000).toLocaleString() : 'unknown'}`);
      break;
    }
    
    if (i % 10 === 0 && i > 0) {
      console.log(`  Still waiting... (${i * 3}s elapsed)`);
    }
  }
  
  if (!loggedIn) {
    console.log('\n✗ Login timeout. Please try again.');
  }
  
  await browser.close();
  console.log('Done!');
})();
