const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ============ 시트 기록 ============
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwEi1TmspCd9IIi7Ll4t_dZwfKJuGw0qruKrKoJj0zu_Ry4yf-PaXt6MC3L_9ADUcSfxA/exec';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const doGet = (u) => {
      https.get(u, { headers: { 'User-Agent': 'CafeViralBot/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }).on('error', reject);
    };
    doGet(url);
  });
}

async function recordToSheet(post, result) {
  try {
    const params = new URLSearchParams({
      action: 'addRecord',
      account: process.env.NAVER_ACCOUNT || '현우',
      cafeId: post.cafeId || '',
      menuId: post.menuId || '',
      cafeName: post.cafeName || '',
      board: post.boardName || '',
      title: post.title || '',
      body: (post.body || '').substring(0, 500),
      status: result.success ? '완료' : '실패',
      url: result.url || ''
    });
    const resp = await httpGet(`${WEBAPP_URL}?${params.toString()}`);
    console.log(`  시트 기록: ${resp.ok ? '✓' : '✗'}`);
  } catch (e) {
    console.log(`  시트 기록 실패: ${e.message}`);
  }
}

// CLI 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

// 하드코딩 기본값 (CLI 인자 없을 때 테스트용)
const DEFAULT_POSTS = [
  {
    cafeId: '10553650',
    cafeName: '텃밭과 채소키우기',
    boardName: '옥상텃밭',
    title: '올해 텃밭 시작하는데 배양토 뭐 쓰시나요?',
    body: '안녕하세요, 올해 처음으로 옥상에서 텃밭을 시작하려고 하는 초보입니다.\n\n아이들이랑 같이 상추, 방울토마토 같은 거 심어보려고 하는데\n배양토를 뭘 써야 할지 모르겠어서 질문 올립니다.\n\n마트에서 파는 거랑 온라인에서 파는 거랑 차이가 있나요?\n특히 무농약 배양토가 좋다고 들었는데 맞나요?\n아이들이랑 같이 키울거라 안전한 걸로 하고 싶어요.\n\n선배님들 조언 부탁드립니다!'
  },
  {
    cafeId: '11289639',
    cafeName: '지성아빠의 나눔세상',
    boardName: null,
    title: '화분 분갈이할때 배양토 어떤거 쓰세요?',
    body: '봄이라 분갈이 시즌이 다가오네요.\n\n작년에 산 몬스테라가 화분이 꽉 차서 분갈이를 해줘야 하는데\n배양토를 어떤 걸 써야 할지 고민입니다.\n\n마트 배양토는 벌레가 나온다는 후기가 있어서 좀 걱정이고\n온라인에서 무농약 배양토를 사볼까 하는데 추천해주실 수 있나요?\n\n배양토 섞는 비율도 알려주시면 감사하겠습니다!'
  }
];

const COOKIES_DIR = path.join(__dirname, 'cookies');
const COOKIE_PATH = path.join(__dirname, 'cookies-full.json'); // 레거시 호환
const delay = ms => new Promise(r => setTimeout(r, ms));

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
  // 아이디별 쿠키 또는 레거시 쿠키
  const accountId = process.env.NAVER_ACCOUNT || '';
  const accountCookiePath = accountId ? path.join(COOKIES_DIR, `${accountId}.json`) : null;
  const cookiePath = (accountCookiePath && fs.existsSync(accountCookiePath)) ? accountCookiePath : COOKIE_PATH;
  console.log(`쿠키: ${path.basename(cookiePath)}`);
  const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  for (const c of cookies) {
    try {
      await page.setCookie({ name: c.name, value: String(c.value), domain: c.domain, path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, ...(c.expires > 0 ? { expires: c.expires } : {}) });
    } catch (e) { }
  }
  return { browser, page };
}

async function writePost(page, post, dryRun) {
  // menuId가 있으면 URL에 직접 포함
  const menuParam = post.menuId ? `&menuId=${post.menuId}` : '';
  const writeUrl = `https://cafe.naver.com/ca-fe/cafes/${post.cafeId}/articles/write?boardType=L${menuParam}`;
  console.log(`\n[${post.cafeName}] 글쓰기 페이지 이동...`);
  console.log(`  URL: ${writeUrl}`);
  await page.goto(writeUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  await delay(3000);

  // Select board (menuId 없고 boardName 있을 때만)
  if (!post.menuId && post.boardName) {
    console.log(`  게시판 선택: ${post.boardName}`);
    await page.evaluate((name) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('게시판을 선택'));
      if (btn) btn.click();
    });
    await delay(500);
    await page.evaluate((name) => {
      const opt = Array.from(document.querySelectorAll('button.option')).find(o => o.textContent.trim() === name);
      if (opt) opt.click();
    }, post.boardName);
    await delay(1000);
  }

  // Title - set value via JS and trigger events
  console.log('  제목 입력...');
  await page.evaluate((title) => {
    const textarea = document.querySelector('textarea.textarea_input');
    if (!textarea) throw new Error('Title textarea not found');
    // Use native setter to bypass React/Vue control
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(textarea, title);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }, post.title);
  await delay(500);

  // Body - use execCommand in focused editor
  console.log('  본문 입력...');
  await page.evaluate((bodyText) => {
    const p = document.querySelector('.se-text-paragraph');
    if (!p) throw new Error('Editor paragraph not found');
    p.click();
    p.focus();
    
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        document.execCommand('insertText', false, lines[i]);
      }
      if (i < lines.length - 1) {
        document.execCommand('insertParagraph', false);
      }
    }
  }, post.body);
  await delay(1000);
  console.log('  본문 입력 완료');

  // Verify content was entered
  const bodyCheck = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.se-text-paragraph');
    return Array.from(nodes).map(n => n.textContent.trim()).filter(t => t).length;
  });
  console.log(`  본문 단락 수: ${bodyCheck}`);

  if (dryRun) {
    console.log(`  [DRY RUN] 완료`);
    return { success: true, dryRun: true };
  }

  // Submit
  console.log('  등록 클릭...');
  await page.evaluate(() => {
    const span = Array.from(document.querySelectorAll('.BaseButton__txt')).find(s => s.textContent.trim() === '등록');
    if (span) {
      const link = span.closest('a, button');
      if (link) link.click();
      else throw new Error('등록 parent not found');
    } else {
      throw new Error('등록 버튼 not found');
    }
  });

  // Wait for navigation or confirmation
  try {
    await page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle2' });
  } catch (e) {
    // Check for dialog/alert
  }
  await delay(2000);

  const finalUrl = page.url();
  const success = !finalUrl.includes('/write');
  console.log(`  ${success ? '✓ 등록 성공!' : '✗ 등록 실패'} URL: ${finalUrl}`);
  return { success, url: finalUrl };
}

(async () => {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes('--dry-run');
  const cliArgs = parseArgs();

  if (dryRun) console.log('=== DRY RUN MODE ===\n');
  console.log('Naver Cafe Bot 시작...');

  const { browser, page } = await setupBrowser();

  // 로그인 확인: 카페 마이페이지로 접근
  await page.goto('https://cafe.naver.com/ca-fe/home/me', { waitUntil: 'networkidle2', timeout: 15000 });
  const currentUrl = page.url();
  const loggedIn = !currentUrl.includes('nidlogin');
  if (!loggedIn) {
    console.error('✗ 로그인 실패! (로그인 페이지로 리다이렉트됨)');
    await browser.close();
    process.exit(1);
  }
  console.log('✓ 로그인 확인');

  let postsToWrite;

  if (cliArgs.cafeId && cliArgs.title) {
    // CLI 인자로 받은 단일 포스트
    postsToWrite = [{
      cafeId: cliArgs.cafeId,
      cafeName: cliArgs.cafeName || cliArgs.cafeId,
      boardName: cliArgs.boardName || null,
      menuId: cliArgs.menuId || null,
      title: cliArgs.title,
      body: (cliArgs.body || '').replace(/\\n/g, '\n')
    }];
  } else {
    // 기본 하드코딩 포스트
    const postIndex = rawArgs.find(a => !a.startsWith('-'));
    postsToWrite = postIndex !== undefined ? [DEFAULT_POSTS[parseInt(postIndex)]] : DEFAULT_POSTS;
  }

  for (const post of postsToWrite) {
    try {
      const result = await writePost(page, post, dryRun);
      if (result && result.url) {
        console.log(`RESULT_URL: ${result.url}`);
      }
      if (!dryRun && result) {
        await recordToSheet(post, result);
      }
    } catch (err) {
      console.error(`✗ [${post.cafeName}] 에러: ${err.message}`);
      if (!dryRun) {
        await recordToSheet(post, { success: false, url: err.message });
      }
    }
    await delay(3000);
  }

  await browser.close();
  console.log('\n완료!');
})();
