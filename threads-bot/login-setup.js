const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'cookies.json');

(async () => {
  console.log('=== Threads Login Setup ===');
  console.log('브라우저 창이 열리면 인스타그램 계정으로 로그인해주세요.');
  console.log('로그인 완료 후 자동으로 쿠키를 저장합니다.\n');

  const browser = await puppeteer.launch({
    headless: false,
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
    // Hide automation indicators
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
  });

  await page.goto('https://www.threads.com/login', { waitUntil: 'networkidle2' });

  console.log('로그인 대기 중... (3초마다 확인)');

  let loggedIn = false;
  for (let i = 0; i < 200; i++) { // 10분 타임아웃
    await new Promise(r => setTimeout(r, 3000));

    const url = page.url();
    const cookies = await page.cookies('https://www.threads.com');

    // 로그인 성공 판별: 로그인 페이지가 아니고, 인증 쿠키 존재
    const hasSession = cookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id' || c.name === 'csrftoken');
    const notLoginPage = !url.includes('/login');

    if (hasSession && notLoginPage) {
      loggedIn = true;

      // threads.com 메인으로 이동해서 추가 쿠키 수집
      await page.goto('https://www.threads.com', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));

      const allCookies = await page.cookies('https://www.threads.com', 'https://www.instagram.com');

      fs.writeFileSync(COOKIE_PATH, JSON.stringify(allCookies, null, 2));
      console.log(`\n✓ 로그인 성공! ${allCookies.length}개 쿠키 저장 → cookies.json`);

      const sessionCookie = allCookies.find(c => c.name === 'sessionid');
      const dsUser = allCookies.find(c => c.name === 'ds_user_id');
      console.log(`  sessionid: ${sessionCookie ? '✓' : '✗'}`);
      console.log(`  ds_user_id: ${dsUser ? dsUser.value : '✗'}`);
      break;
    }

    if (i % 10 === 0 && i > 0) {
      console.log(`  대기 중... (${i * 3}초 경과)`);
    }
  }

  if (!loggedIn) {
    console.log('\n✗ 로그인 타임아웃. 다시 시도해주세요.');
  }

  await browser.close();
  console.log('Done!');
})();
