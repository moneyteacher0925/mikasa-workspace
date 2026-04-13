const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'cookies-full.json');
const delay = ms => new Promise(r => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(.+)$/s);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
  for (const c of cookies) {
    try {
      await page.setCookie({ name: c.name, value: String(c.value), domain: c.domain, path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, ...(c.expires > 0 ? { expires: c.expires } : {}) });
    } catch (e) { }
  }
  return { browser, page };
}

(async () => {
  const args = parseArgs();
  const dryRun = process.argv.includes('--dry-run');

  // 카페URL 또는 cafeId+articleId
  const cafeUrl = args.url; // e.g. https://cafe.naver.com/ninttenddo/141651
  const commentText = (args.comment || '').replace(/\\n/g, '\n');

  if (!cafeUrl || !commentText) {
    console.error('Usage: node comment.js --url=<카페글URL> --comment=<댓글내용>');
    process.exit(1);
  }

  console.log('Naver Cafe Comment Bot 시작...');
  const { browser, page } = await setupBrowser();

  // 로그인 확인
  await page.goto('https://cafe.naver.com/ca-fe/home/me', { waitUntil: 'networkidle2', timeout: 15000 });
  const loggedIn = !page.url().includes('nidlogin');
  if (!loggedIn) {
    console.error('✗ 로그인 실패!');
    await browser.close();
    process.exit(1);
  }
  console.log('✓ 로그인 확인');

  // 글 페이지로 이동
  console.log(`글 페이지 이동: ${cafeUrl}`);
  await page.goto(cafeUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  await delay(3000);

  // iframe 내부일 수 있으므로 확인
  let targetFrame = page;
  const frames = page.frames();
  const cafeFrame = frames.find(f => f.url().includes('ArticleRead'));
  if (cafeFrame) {
    targetFrame = cafeFrame;
    console.log('  iframe 감지, 프레임 전환');
  }

  // 페이지 끝까지 스크롤 (댓글 영역 로딩)
  console.log('  페이지 스크롤 중...');
  await targetFrame.evaluate(async () => {
    const scrollDown = () => new Promise(r => {
      let totalHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 300);
        totalHeight += 300;
        if (totalHeight >= document.body.scrollHeight) { clearInterval(timer); r(); }
      }, 100);
      setTimeout(() => { clearInterval(timer); r(); }, 3000);
    });
    await scrollDown();
  });
  await delay(2000);

  // 댓글 영역 HTML 구조 디버깅
  const commentHtml = await targetFrame.evaluate(() => {
    // 전체 댓글 관련 요소 찾기
    const allElements = document.querySelectorAll('*');
    const commentRelated = [];
    for (const el of allElements) {
      const cls = el.className || '';
      const id = el.id || '';
      if ((typeof cls === 'string' && (cls.includes('comment') || cls.includes('Comment') || cls.includes('reply'))) ||
          (typeof id === 'string' && (id.includes('comment') || id.includes('Comment')))) {
        commentRelated.push({
          tag: el.tagName,
          class: typeof cls === 'string' ? cls.substring(0, 100) : '',
          id: id,
          children: el.children.length
        });
      }
    }
    return JSON.stringify(commentRelated.slice(0, 30));
  });
  console.log('  댓글 관련 요소:', commentHtml);

  await page.screenshot({ path: path.join(__dirname, 'debug-comment.png'), fullPage: true });

  // 댓글 입력란 찾기 및 클릭
  console.log('  댓글 입력란 클릭...');
  const selectors = [
    '.comment_inbox textarea',
    '.CommentWriter textarea',
    'textarea[placeholder*="댓글"]',
    'textarea[placeholder*="의견"]',
    '.comment_inbox [contenteditable="true"]',
    '.CommentWriter [contenteditable="true"]',
    '.comment_box textarea',
    '.TextArea textarea',
    '.comment_write textarea',
    '#cmtinput',
    'textarea.txt_comment'
  ];
  
  let foundSelector = null;
  for (const sel of selectors) {
    const found = await targetFrame.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? { tag: el.tagName, class: el.className } : null;
    }, sel);
    if (found) {
      foundSelector = sel;
      console.log(`  발견: ${sel}`, JSON.stringify(found));
      break;
    }
  }

  if (!foundSelector) {
    console.error('  댓글 입력란을 찾을 수 없습니다. 카페 가입 여부 확인 필요.');
    await browser.close();
    process.exit(1);
  }

  await targetFrame.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.click();
    el.focus();
  }, foundSelector);
  await delay(1000);

  // 댓글 텍스트 입력 (CDP insertText 사용 - 한글 지원)
  console.log('  댓글 입력 중...');
  const client = await page.createCDPSession();

  // insertText로 한글 입력
  for (const char of commentText) {
    if (char === '\n') {
      await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    } else {
      await client.send('Input.insertText', { text: char });
    }
    await delay(10);
  }
  await delay(1000);
  console.log('  댓글 입력 완료');

  if (dryRun) {
    console.log('[DRY RUN] 등록 안 함');
    await page.screenshot({ path: path.join(__dirname, 'debug-comment-preview.png') });
    await browser.close();
    process.exit(0);
  }

  // 등록 버튼 클릭
  console.log('  등록 버튼 클릭...');
  await targetFrame.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button'));
    const submitBtn = btns.find(b => {
      const text = b.textContent.trim();
      return text === '등록' && (b.closest('.comment_inbox') || b.closest('.CommentWriter') || b.closest('.comment_box'));
    });
    if (submitBtn) {
      submitBtn.click();
      return true;
    }
    // 대안
    const anySubmit = btns.find(b => b.textContent.trim() === '등록' && b.className.includes('comment'));
    if (anySubmit) {
      anySubmit.click();
      return true;
    }
    throw new Error('등록 버튼을 찾을 수 없습니다');
  });

  await delay(3000);
  console.log('✓ 댓글 등록 완료!');
  
  await page.screenshot({ path: path.join(__dirname, 'debug-comment-result.png') });
  await browser.close();
})();
