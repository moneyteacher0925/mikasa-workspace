const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ============ 설정 ============
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwEi1TmspCd9IIi7Ll4t_dZwfKJuGw0qruKrKoJj0zu_Ry4yf-PaXt6MC3L_9ADUcSfxA/exec';
const COOKIES_DIR = path.join(__dirname, 'cookies');
const COOKIE_LEGACY = path.join(__dirname, 'cookies-full.json');
const delay = ms => new Promise(r => setTimeout(r, ms));

// 아이디별 마지막 발행시간 추적
const lastPostTime = {};

// ============ HTTP 헬퍼 ============
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const doGet = (u) => {
      https.get(u, { headers: { 'User-Agent': 'CafeViralBot/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      }).on('error', reject);
    };
    doGet(url);
  });
}

// ============ 브라우저 셋업 ============
function getCookiePath(accountId) {
  if (accountId) {
    const p = path.join(COOKIES_DIR, `${accountId}.json`);
    if (fs.existsSync(p)) return p;
  }
  return COOKIE_LEGACY;
}

async function setupBrowser(accountId) {
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

  const cookiePath = getCookiePath(accountId);
  console.log(`  쿠키: ${path.basename(cookiePath)}`);
  const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  for (const c of cookies) {
    try {
      await page.setCookie({ name: c.name, value: String(c.value), domain: c.domain, path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, ...(c.expires > 0 ? { expires: c.expires } : {}) });
    } catch (e) { }
  }

  // dialog handler
  page.on('dialog', async d => { console.log('  DIALOG:', d.message()); await d.accept(); });

  // 로그인 확인
  await page.goto('https://cafe.naver.com/ca-fe/home/me', { waitUntil: 'networkidle2', timeout: 15000 });
  const loggedIn = !page.url().includes('nidlogin');
  if (!loggedIn) {
    console.log(`  ✗ [${accountId}] 로그인 실패! 쿠키 만료 가능성`);
    await browser.close();
    return null;
  }
  console.log(`  ✓ [${accountId}] 로그인 확인`);
  return { browser, page };
}

// ============ 글쓰기 (post.js 로직 재사용) ============
async function writePost(page, post) {
  const menuParam = post.menuId ? `&menuId=${post.menuId}` : '';
  const writeUrl = `https://cafe.naver.com/ca-fe/cafes/${post.cafeId}/articles/write?boardType=L${menuParam}`;
  console.log(`  글쓰기 페이지: ${writeUrl}`);
  await page.goto(writeUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  await delay(3000);

  // 게시판 선택 (항상 필요 — menuId가 있어도 드롭다운 선택 필수)
  const needsBoardSelect = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('게시판을 선택'));
  });
  
  if (needsBoardSelect) {
    console.log('  게시판 선택 중...');
    // 드롭다운 열기
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('게시판을 선택'));
      if (btn) btn.click();
    });
    await delay(500);
    
    // board 이름으로 선택, 없으면 첫 번째 일반 게시판 선택
    const boardName = post.board || '';
    const selected = await page.evaluate((name) => {
      const options = Array.from(document.querySelectorAll('button.option, li.option_item button'));
      if (name) {
        const exact = options.find(o => o.textContent.trim() === name);
        if (exact) { exact.click(); return exact.textContent.trim(); }
      }
      // 이름 없으면 '질문' 또는 '자유' 포함 게시판, 아니면 첫 번째
      const fallback = options.find(o => o.textContent.includes('질문')) ||
                       options.find(o => o.textContent.includes('자유')) ||
                       options[0];
      if (fallback) { fallback.click(); return fallback.textContent.trim(); }
      return null;
    }, boardName);
    console.log('  게시판 선택:', selected);
    await delay(1000);
  }

  // 제목 입력
  await page.evaluate((title) => {
    const textarea = document.querySelector('textarea.textarea_input');
    if (!textarea) throw new Error('Title textarea not found');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(textarea, title);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }, post.title);
  await delay(500);

  // 본문 입력 (CDP insertText)
  const client = await page.createCDPSession();
  await page.evaluate(() => {
    const p = document.querySelector('.se-text-paragraph');
    if (p) { p.click(); p.focus(); }
  });
  await delay(300);

  const lines = post.body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      await client.send('Input.insertText', { text: lines[i] });
    }
    if (i < lines.length - 1) {
      await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    }
  }
  await delay(1000);

  // 등록 클릭 (Promise.all로 네비게이션 대기)
  await Promise.all([
    page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle2' }).catch(() => null),
    page.evaluate(() => {
      const span = Array.from(document.querySelectorAll('.BaseButton__txt')).find(s => s.textContent.trim() === '등록');
      if (span) {
        const link = span.closest('a, button');
        if (link) link.click();
      }
    })
  ]);
  await delay(3000);

  const finalUrl = page.url();
  const success = !finalUrl.includes('/write');
  return { success, url: finalUrl };
}

// ============ 상태 업데이트 ============
async function updateStatus(row, status, url) {
  const params = `action=updateStatus&row=${row}&status=${encodeURIComponent(status)}&url=${encodeURIComponent(url || '')}`;
  try {
    await httpGet(`${WEBAPP_URL}?${params}`);
  } catch (e) {
    console.log(`  상태 업데이트 실패: ${e.message}`);
  }
}

// ============ 메인 폴링 ============
async function pollOnce() {
  console.log(`\n[${new Date().toLocaleString('ko-KR')}] 시트 확인 중...`);

  let data;
  try {
    data = await httpGet(`${WEBAPP_URL}?action=getPending`);
  } catch (e) {
    console.log(`시트 읽기 실패: ${e.message}`);
    return;
  }

  if (!data.ok || !data.pending || data.pending.length === 0) {
    console.log('  대기 중인 발행 없음');
    return;
  }

  console.log(`  ${data.pending.length}건 대기 중`);

  // 아이디별로 그룹핑
  const byAccount = {};
  for (const item of data.pending) {
    const acc = item.account || '현우';
    if (!byAccount[acc]) byAccount[acc] = [];
    byAccount[acc].push(item);
  }

  for (const [accountId, posts] of Object.entries(byAccount)) {
    // 발행간격 체크
    const now = Date.now();
    const lastTime = lastPostTime[accountId] || 0;
    const firstPost = posts[0];
    const intervalMs = (firstPost.interval || 30) * 60 * 1000;

    if (now - lastTime < intervalMs) {
      const remainMin = Math.ceil((intervalMs - (now - lastTime)) / 60000);
      console.log(`  [${accountId}] 발행간격 대기 중 (${remainMin}분 남음)`);
      continue;
    }

    // 한 번에 1건만 발행 (간격 준수)
    const post = posts[0];
    console.log(`  [${accountId}] 발행: "${post.title}" → ${post.cafeName}`);

    // 상태를 '발행중'으로 업데이트
    await updateStatus(post.row, '발행중', '');

    const session = await setupBrowser(accountId);
    if (!session) {
      await updateStatus(post.row, '쿠키만료', '');
      continue;
    }

    try {
      const result = await writePost(session.page, post);
      if (result.success) {
        console.log(`  ✓ 발행 성공: ${result.url}`);
        await updateStatus(post.row, '완료', result.url);
        lastPostTime[accountId] = Date.now();
      } else {
        console.log(`  ✗ 발행 실패`);
        await updateStatus(post.row, '실패', '');
      }
    } catch (e) {
      console.log(`  ✗ 에러: ${e.message}`);
      await updateStatus(post.row, '실패', e.message);
    }

    await session.browser.close();
    await delay(2000);
  }
}

// ============ 삭제 모니터링 ============
let lastMonitorTime = 0;
const MONITOR_INTERVAL = 10 * 60 * 1000; // 10분마다

async function monitorOnce() {
  console.log(`\n[${new Date().toLocaleString('ko-KR')}] 삭제 모니터링 중...`);

  let data;
  try {
    data = await httpGet(`${WEBAPP_URL}?action=getCompleted`);
  } catch (e) {
    console.log(`  모니터링 시트 읽기 실패: ${e.message}`);
    return;
  }

  if (!data.ok || !data.completed || data.completed.length === 0) {
    console.log('  모니터링 대상 없음');
    return;
  }

  console.log(`  ${data.completed.length}건 모니터링`);

  // 아무 계정이나 하나로 브라우저 열기 (로그인 필요)
  const session = await setupBrowser('현우');
  if (!session) {
    console.log('  모니터링 브라우저 실패');
    return;
  }

  try {
    for (const item of data.completed) {
      if (!item.url || !item.url.startsWith('http')) continue;
      try {
        await session.page.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
        await delay(2000);

        const isDeleted = await session.page.evaluate(() => {
          const body = document.body ? document.body.innerText : '';
          // 삭제/비공개/차단 패턴
          return body.includes('삭제된') || body.includes('존재하지 않') ||
                 body.includes('게시글이 없습니다') || body.includes('권한이 없습니다') ||
                 body.includes('비공개') || body.includes('차단');
        });

        if (isDeleted) {
          console.log(`  ✗ 삭제 감지: [${item.cafeName}] "${item.title}" (row ${item.row})`);
          await updateStatus(item.row, '삭제', item.url);
        } else {
          console.log(`  ✓ 정상: [${item.cafeName}] "${item.title}"`);
        }
      } catch (e) {
        console.log(`  모니터링 에러 (row ${item.row}): ${e.message}`);
      }
      await delay(1000);
    }
  } finally {
    await session.browser.close();
  }
}

// ============ 실행 모드 ============
const args = process.argv.slice(2);

if (args.includes('--once')) {
  // 1회 실행
  pollOnce().then(() => {
    console.log('완료');
    process.exit(0);
  });
} else if (args.includes('--daemon')) {
  // 데몬 모드: 1분마다 폴링
  const INTERVAL = 60 * 1000;
  console.log('=== 카페 바이럴 자동 발행 데몬 시작 ===');
  console.log(`폴링 간격: ${INTERVAL / 1000}초`);
  console.log(`웹앱 URL: ${WEBAPP_URL}`);
  console.log(`쿠키 폴더: ${COOKIES_DIR}`);
  console.log('');

  const run = async () => {
    await pollOnce();
    // 10분마다 삭제 모니터링
    const now = Date.now();
    if (now - lastMonitorTime >= MONITOR_INTERVAL) {
      lastMonitorTime = now;
      await monitorOnce();
    }
    setTimeout(run, INTERVAL);
  };
  run();
} else {
  console.log('카페 바이럴 자동 발행 시스템');
  console.log('');
  console.log('사용법:');
  console.log('  node poll-sheet.js --once     # 1회 실행 (체크된 글 발행)');
  console.log('  node poll-sheet.js --daemon   # 데몬 모드 (1분마다 자동 체크)');
  console.log('');
  console.log('시트에서 사용법:');
  console.log('  1. "카페바이럴" 탭에서 아이디, cafeId, menuId, 제목, 본문 입력');
  console.log('  2. "발행" 체크박스 체크');
  console.log('  3. 봇이 자동으로 발행 → 상태/시간/URL 업데이트');
}
