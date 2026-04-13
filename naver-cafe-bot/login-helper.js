const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COOKIES_DIR = path.join(__dirname, 'cookies');
const delay = ms => new Promise(r => setTimeout(r, ms));

// 쿠키 디렉토리 생성
if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

// CLI에서 아이디 목록 또는 단일 아이디 받기
function getAccountList() {
  const args = process.argv.slice(2);
  
  // --list=accounts.txt 로 파일에서 읽기
  const listArg = args.find(a => a.startsWith('--list='));
  if (listArg) {
    const filePath = listArg.split('=')[1];
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    return lines.map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  }
  
  // --id=아이디명 으로 단일
  const idArg = args.find(a => a.startsWith('--id='));
  if (idArg) {
    return [idArg.split('=')[1]];
  }
  
  // 인자 없으면 cookies 폴더의 기존 아이디 목록 보여주기
  const existing = fs.readdirSync(COOKIES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
  
  if (existing.length > 0) {
    console.log('기존 등록된 아이디:');
    existing.forEach((id, i) => {
      const stats = fs.statSync(path.join(COOKIES_DIR, `${id}.json`));
      const days = Math.floor((Date.now() - stats.mtimeMs) / 86400000);
      console.log(`  ${i + 1}. ${id} (${days}일 전 저장)`);
    });
  }
  
  console.log('\n사용법:');
  console.log('  node login-helper.js --id=아이디명          # 단일 아이디 로그인');
  console.log('  node login-helper.js --list=accounts.txt   # 파일에서 아이디 목록 읽기');
  console.log('  node login-helper.js --all                 # 대화형 모드 (계속 추가)');
  process.exit(0);
}

async function extractAndSaveCookies(page, accountName) {
  const cookies = await page.cookies();
  const naverCookies = cookies.filter(c => c.domain.includes('naver.com'));
  
  const savePath = path.join(COOKIES_DIR, `${accountName}.json`);
  fs.writeFileSync(savePath, JSON.stringify(naverCookies, null, 2));
  console.log(`  ✓ ${naverCookies.length}개 쿠키 저장 → cookies/${accountName}.json`);
  return naverCookies.length;
}

async function checkLoginStatus(page) {
  try {
    await page.goto('https://cafe.naver.com/ca-fe/home/me', { 
      waitUntil: 'networkidle2', timeout: 10000 
    });
    const url = page.url();
    return !url.includes('nidlogin');
  } catch {
    return false;
  }
}

async function loginAccount(browser, accountName) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${accountName}] 로그인 시작`);
  console.log(`${'='.repeat(50)}`);
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  // 네이버 로그인 페이지로 이동
  await page.goto('https://nid.naver.com/nidlogin.login', {
    waitUntil: 'networkidle2', timeout: 15000
  });
  
  console.log('  → 네이버 로그인 페이지 열림');
  console.log('  → 아이디/비번 입력 후 로그인하세요!');
  console.log('  → (로그인 완료 감지 대기 중...)');
  
  // 로그인 완료 대기 (최대 120초)
  let loggedIn = false;
  for (let i = 0; i < 60; i++) {
    await delay(2000);
    const url = page.url();
    
    // 로그인 성공 시 리다이렉트됨
    if (!url.includes('nidlogin') && !url.includes('login')) {
      loggedIn = true;
      break;
    }
    
    // 2단계 인증 페이지도 통과 대기
    if (url.includes('protect') || url.includes('device')) {
      console.log('  → 기기 인증 페이지 감지, 인증 완료 대기...');
    }
  }
  
  if (!loggedIn) {
    // 한번 더 직접 체크
    loggedIn = await checkLoginStatus(page);
  }
  
  if (loggedIn) {
    console.log('  ✓ 로그인 성공!');
    await extractAndSaveCookies(page, accountName);
  } else {
    console.log('  ✗ 로그인 시간 초과 (2분)');
  }
  
  await page.close();
  return loggedIn;
}

async function interactiveMode(browser) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));
  
  console.log('\n=== 대화형 로그인 모드 ===');
  console.log('아이디 입력 후 엔터 → 로그인 → 다음 아이디... (q로 종료)\n');
  
  let count = 0;
  while (true) {
    const name = await ask(`아이디명 입력 (${count}개 완료, q=종료): `);
    if (name.toLowerCase() === 'q' || !name.trim()) break;
    
    const success = await loginAccount(browser, name.trim());
    if (success) count++;
  }
  
  rl.close();
  console.log(`\n총 ${count}개 아이디 로그인 완료!`);
}

(async () => {
  const args = process.argv.slice(2);
  const isInteractive = args.includes('--all');
  
  console.log('네이버 로그인 헬퍼 시작...');
  console.log('(화면이 보이는 크롬이 열립니다)\n');
  
  const browser = await puppeteer.launch({
    headless: false,  // 화면 보이게!
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900'
    ]
  });
  
  if (isInteractive) {
    await interactiveMode(browser);
  } else {
    const accounts = getAccountList();
    let success = 0;
    
    for (const account of accounts) {
      const result = await loginAccount(browser, account);
      if (result) success++;
      
      if (accounts.indexOf(account) < accounts.length - 1) {
        console.log('\n  → 3초 후 다음 아이디...');
        await delay(3000);
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`완료! ${success}/${accounts.length} 아이디 로그인 성공`);
    console.log(`쿠키 저장 위치: ${COOKIES_DIR}/`);
  }
  
  await browser.close();
})();
