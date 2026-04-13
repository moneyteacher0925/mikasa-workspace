const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'cookies.json');
const DEBUG_DIR = path.join(__dirname, 'debug');
const delay = ms => new Promise(r => setTimeout(r, ms));

// CLI 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w[\w-]*)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
    else if (arg.startsWith('--')) parsed[arg.slice(2)] = true;
  }
  return parsed;
}

async function setupBrowser(headless = true) {
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ],
    defaultViewport: { width: 430, height: 932 } // 모바일 느낌
  });

  const page = await browser.newPage();

  // Anti-detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete navigator.__proto__.webdriver;
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
  });

  // 쿠키 로드
  if (!fs.existsSync(COOKIE_PATH)) {
    throw new Error('cookies.json 없음! 먼저 node login-setup.js 실행하세요.');
  }
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
  for (const c of cookies) {
    try {
      await page.setCookie({
        name: c.name,
        value: String(c.value),
        domain: c.domain,
        path: c.path || '/',
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        ...(c.expires > 0 ? { expires: c.expires } : {})
      });
    } catch (e) { }
  }

  return { browser, page };
}

async function debugScreenshot(page, name) {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const filePath = path.join(DEBUG_DIR, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  📸 ${filePath}`);
}

/**
 * 텍스트 입력 - 클립보드 붙여넣기 방식 (React contenteditable 대응)
 */
async function inputViaPaste(page, text) {
  // 클립보드에 텍스트 복사 후 붙여넣기
  await page.evaluate(async (txt) => {
    await navigator.clipboard.writeText(txt);
  }, text).catch(() => {
    // clipboard API 실패 시 fallback
    console.log('  clipboard API 실패, fallback 사용');
  });

  // CDP를 통한 클립보드 붙여넣기 이벤트 시뮬레이션
  await page.evaluate((txt) => {
    const el = document.activeElement;
    if (!el) return;
    const dt = new DataTransfer();
    dt.setData('text/plain', txt);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt
    });
    el.dispatchEvent(pasteEvent);
  }, text);
}

/**
 * 텍스트 입력 - CDP insertText + Enter 방식 (줄바꿈 처리)
 */
async function inputViaCDP(page, text) {
  const client = await page.createCDPSession();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      await client.send('Input.insertText', { text: lines[i] });
    }
    if (i < lines.length - 1) {
      await page.keyboard.press('Enter');
      await delay(100);
    }
  }
  await client.detach();
}

/**
 * 스레드에 글 게시
 */
async function postToThreads(text, options = {}) {
  const { headless = true, debug = false } = options;

  console.log(`\n📝 게시할 내용 (${text.length}자):`);
  console.log(`  "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

  const { browser, page } = await setupBrowser(headless);

  try {
    // 1. Threads 접속
    console.log('\n1️⃣  Threads 접속...');
    await page.goto('https://www.threads.com', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // 로그인 확인
    const url = page.url();
    if (url.includes('/login')) {
      throw new Error('로그인 실패! 쿠키가 만료되었습니다. node login-setup.js를 다시 실행하세요.');
    }
    console.log('  ✓ 로그인 확인');

    if (debug) await debugScreenshot(page, 'after-login');

    // 2. 새 글 작성 버튼 클릭
    console.log('2️⃣  글쓰기 버튼 탐색...');

    // 방법 1: 프로필 페이지로 이동 (글쓰기 영역이 바로 노출됨)
    console.log('  프로필 페이지로 이동...');
    const profileUrl = await page.evaluate(() => {
      const profileLink = document.querySelector('a[href*="/@"]');
      if (profileLink) return profileLink.href;
      return null;
    });
    
    if (profileUrl) {
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      await delay(2000);
    }

    // 방법 2: 다양한 셀렉터로 만들기 버튼 찾기
    const composeSelectors = [
      '[aria-label="만들기"]',
      '[aria-label="Create"]',
      '[aria-label="New thread"]',
      '[aria-label="새 스레드"]',
      'svg[aria-label="만들기"]',
      'svg[aria-label="Create"]',
    ];

    let clicked = false;
    for (const sel of composeSelectors) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          await el.click();
          clicked = true;
          console.log(`  ✓ 클릭: ${sel}`);
          break;
        }
        if (clicked) break;
      } catch (e) { }
    }

    // 방법 3: 하단 네비게이션 + 버튼 (가운데 버튼)
    if (!clicked) {
      clicked = await page.evaluate(() => {
        // 프로필 페이지의 "새로운 소식이 있나요?" 텍스트 영역 클릭
        const placeholder = document.querySelector('[contenteditable="true"], [role="textbox"]');
        if (placeholder) {
          placeholder.click();
          placeholder.focus();
          return true;
        }
        // 모든 버튼/링크에서 "만들기" 텍스트 찾기
        const allElements = document.querySelectorAll('div[role="button"], button, a');
        for (const el of allElements) {
          const text = el.textContent?.trim();
          const label = el.getAttribute('aria-label');
          if (label === '만들기' || label === 'Create' || text === '만들기') {
            el.click();
            return true;
          }
        }
        return false;
      });
      if (clicked) console.log('  ✓ JS로 버튼 클릭');
    }

    if (!clicked) {
      console.log('  버튼 못찾음, 키보드 단축키 시도...');
    }

    await delay(3000);
    if (debug) await debugScreenshot(page, 'after-compose-click');

    // 3. 다이얼로그 내 텍스트 입력 영역 찾기 & 포커스
    console.log('3️⃣  텍스트 입력...');

    // 다이얼로그가 열릴 때까지 대기 후 그 안의 에디터를 찾기
    let editorFound = false;
    
    // 다이얼로그 내부의 contenteditable 찾기 (dialog > contenteditable)
    const editorHandle = await page.evaluateHandle(() => {
      // 다이얼로그 안의 에디터를 우선 탐색
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const editor = dialog.querySelector('[contenteditable="true"]') 
          || dialog.querySelector('[role="textbox"]')
          || dialog.querySelector('p[data-placeholder]');
        if (editor) return editor;
      }
      // 다이얼로그 밖이라도 시도
      return document.querySelector('[contenteditable="true"]') 
        || document.querySelector('[role="textbox"]');
    });

    const editorEl = editorHandle.asElement();
    if (editorEl) {
      await editorEl.click();
      await delay(500);
      editorFound = true;
      console.log('  ✓ 에디터 발견 (다이얼로그 내부)');
    }

    if (!editorFound) {
      await debugScreenshot(page, 'editor-not-found');
      throw new Error('텍스트 입력 영역을 찾을 수 없습니다.');
    }

    // 에디터에 확실하게 포커스 잡기
    await editorEl.click();
    await delay(300);
    await editorEl.click();
    await delay(300);
    
    // 에디터 내부 paragraph 직접 클릭 (React가 포커스를 잡도록)
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const p = dialog.querySelector('p[data-placeholder], br, span');
        if (p) p.click();
        const editor = dialog.querySelector('[contenteditable="true"]');
        if (editor) {
          editor.focus();
          // 커서를 에디터 끝으로 이동
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
    await delay(500);

    // 방법 1: keyboard.type (실제 키보드 입력 시뮬레이션)
    console.log('  입력 방식: keyboard.type...');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        // 한 글자씩 입력 (한글 IME 대응)
        for (const char of lines[i]) {
          await page.keyboard.sendCharacter(char);
          await delay(20);
        }
      }
      if (i < lines.length - 1) {
        await page.keyboard.press('Enter');
        await delay(80);
      }
    }
    await delay(1000);

    // 입력 확인
    let inputSuccess = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const root = dialog || document;
      const editors = root.querySelectorAll('[contenteditable="true"], [role="textbox"]');
      for (const ed of editors) {
        const text = ed.textContent || ed.innerText || '';
        if (text.trim().length > 0 && !text.includes('새로운 소식')) return true;
      }
      return false;
    });

    if (!inputSuccess) {
      console.log('  keyboard.type 실패, CDP insertText 재시도...');
      if (editorEl) { await editorEl.click(); await delay(300); }
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const editor = dialog.querySelector('[contenteditable="true"]');
          if (editor) { editor.focus(); }
        }
      });
      await delay(300);
      await inputViaCDP(page, text);
      await delay(1000);

      inputSuccess = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const root = dialog || document;
        const editors = root.querySelectorAll('[contenteditable="true"], [role="textbox"]');
        for (const ed of editors) {
          const text = ed.textContent || ed.innerText || '';
          if (text.trim().length > 0 && !text.includes('새로운 소식')) return true;
        }
        return false;
      });
    }

    if (!inputSuccess) {
      console.log('  ⚠️ 텍스트 입력 확인 실패, 게시 중단.');
      if (debug) await debugScreenshot(page, 'input-failed');
      await browser.close();
      return { success: false, error: '텍스트 입력 실패' };
    } else {
      console.log('  ✓ 텍스트 입력 확인!');
    }

    if (debug) await debugScreenshot(page, 'after-text-input');

    // 4. 게시 버튼 클릭
    console.log('4️⃣  게시 버튼 클릭...');

    const postSelectors = [
      '[data-pressable-container="true"] >> text=게시',
      'div[role="button"]:has-text("게시")',
      'div[role="button"]:has-text("Post")',
    ];

    let posted = await page.evaluate(() => {
      // 다이얼로그 내부에서 게시 버튼 찾기
      const dialog = document.querySelector('[role="dialog"]');
      const root = dialog || document;
      const buttons = root.querySelectorAll('div[role="button"], button');
      for (const btn of buttons) {
        const txt = btn.textContent.trim();
        if (txt === '게시' || txt === 'Post') {
          // 실제 클릭 이벤트 발생
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return true;
        }
      }
      return false;
    });
    
    // JS 클릭이 안 먹힐 수 있으니 Puppeteer 클릭도 시도
    if (!posted) {
      try {
        const dialog = await page.$('[role="dialog"]');
        if (dialog) {
          const btns = await dialog.$$('div[role="button"], button');
          for (const btn of btns) {
            const txt = await page.evaluate(el => el.textContent.trim(), btn);
            if (txt === '게시' || txt === 'Post') {
              await btn.click();
              posted = true;
              break;
            }
          }
        }
      } catch (e) {}
    }

    if (!posted) {
      await debugScreenshot(page, 'post-button-not-found');
      throw new Error('게시 버튼을 찾을 수 없습니다.');
    }

    console.log('  ✓ 게시 버튼 클릭!');
    await delay(5000);

    if (debug) await debugScreenshot(page, 'after-post');

    // 5. 결과 확인 (다이얼로그가 닫혔는지 체크)
    const dialogClosed = await page.evaluate(() => {
      return !document.querySelector('[role="dialog"]');
    });
    const finalUrl = page.url();
    const success = dialogClosed;
    console.log(`\n${success ? '✅ 게시 성공!' : '⚠️  다이얼로그가 아직 열려있음 — 게시 실패 가능성'}`);
    console.log(`  URL: ${finalUrl}`);

    await debugScreenshot(page, success ? 'success' : 'result');

    await browser.close();
    return { success, url: finalUrl };

  } catch (err) {
    console.error(`\n❌ 에러: ${err.message}`);
    await debugScreenshot(page, 'error').catch(() => {});
    await browser.close();
    return { success: false, error: err.message };
  }
}

// CLI 실행
(async () => {
  const args = parseArgs();

  let text = '';

  if (args.text) {
    text = args.text.replace(/\\n/g, '\n');
  } else if (args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error(`파일 없음: ${filePath}`);
      process.exit(1);
    }
    text = fs.readFileSync(filePath, 'utf8').trim();
  } else {
    console.log('사용법:');
    console.log('  node post.js --text="게시할 내용"');
    console.log('  node post.js --file=원고.txt');
    console.log('  node post.js --text="줄바꿈\\n테스트" --debug');
    console.log('  node post.js --text="내용" --visible  (브라우저 표시)');
    process.exit(0);
  }

  const result = await postToThreads(text, {
    headless: !args.visible,
    debug: !!args.debug
  });

  process.exit(result.success ? 0 : 1);
})();

module.exports = { postToThreads };
